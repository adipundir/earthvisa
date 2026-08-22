# Moving Earth Visa to AWS

Target: **ap-south-1 (Mumbai)**. Decided 2026-08-08. Prices below were read from
the AWS price list for ap-south-1, not from a US-region blog post — Mumbai NAT
is 24% dearer than the figure everyone quotes.

## The shape

```
Route 53 ──> CloudFront ──> ALB ──> ECS Fargate task (public subnet, ARM)
  (DNS)       (cache,        │        │  Next.js 16 standalone, `node server.js`
               TLS)          │        │  direct IGW egress: appleid.apple.com, msg91
                             │        └──> RDS Postgres (PRIVATE subnet, SG-to-SG)
                             │              publicly_accessible = false
                          us-east-1 ACM cert for CloudFront
```

### Why a container and not Lambda

This is the decision the whole design turns on, and it is not about taste.

The auth routes must reach `appleid.apple.com` (Apple's JWKS) and
`control.msg91.com` (OTP delivery) **and** a private database. A Lambda placed
in a VPC to reach RDS loses default internet egress — AWS is explicit that
"connecting a function to a public subnet doesn't give it internet access" — so
it needs a NAT gateway. NAT in ap-south-1 is **$0.056/hr = $40.88/month idle**,
nearly three times the `db.t4g.micro` it exists to protect.

A Fargate task in a **public** subnet has direct egress through the internet
gateway *and* private VPC reach to RDS, for the price of one public IPv4
(**$3.65/month**). The database is never exposed.

Two further reasons Lambda loses here:

- **Idle death.** After 14 days without invocation, Lambda reclaims the
  Hyperplane ENIs, marks the function `Inactive`, and the next invocation
  *fails*. For a pre-launch app that is a live grenade.
- **OpenNext version churn.** `@opennextjs/aws@4.1.0` declares
  `next: ">=15.5.21 <16 || >=16.2.11"`. This repo is on **16.2.7 — excluded**.
  The Next-16 floor moved four times in three months, and SST v4.17.1 still
  hardcodes `DEFAULT_OPEN_NEXT_VERSION = "3.9.14"`. A container skips this
  entire dependency.

Also ruled out: **Amplify Hosting** supports "Next.js versions 12 through 15" —
Next 16 is not supported, a ~10-month lag with no dated commitment.

### Why the stack stays on Next.js (and not NestJS)

The API is **741 lines across 14 route handlers** — 2.7% of the 27,322 lines in
`src/`. The other 97% is the website: `destination/`, `compare/`, `guide/`,
`passport/`, sitemap, OG images. That website is the acquisition channel, and
NestJS renders none of it.

NestJS is a real framework with real advantages — DI, guards, OpenAPI codegen
for `Auth.swift`, a scheduler. None of them pay for a second deploy unit, a
second CI, a second secret store, and CORS between origins, in service of seven
auth endpoints.

**Split when any two of these become true:** a feature needs a persistent
process (WebSockets, SSE, in-process queue); scheduled work writes to the
database; document uploads exceed Lambda's 6MB payload cap; a second client
needs a versioned contract; the four stores grow into real relational domain
modelling.

Cheap step in that direction, available now: keep pushing logic down into
`src/lib/auth/*` and `src/lib/earthling/*` as framework-free modules that route
handlers merely call. That is 80% of NestJS's structure and makes any future
split mechanical.

## The iOS app is a separate product

Decided 2026-08-09. The two codebases are already separate repos; what was still
shared was the API host and the bundle host. Both move.

- **`api.earthvisa.in`** — a standalone Fastify service carrying the seven
  `auth/*` endpoints, its own Fargate task on the same cluster and ALB (~$5/mo).
  The cut is clean: those seven routes are iOS-only, and the seven website
  routes (`earthling/*`, `geo`, `report`, `subscribe`, `vfs`) stay in Next.js.
- **`data.earthvisa.in`** — S3 + CloudFront serving `manifest.json` and the
  content-addressed `.br` bundles. They are immutable static files and never
  belonged on a Next.js server.

**Nothing security-critical gets rewritten.** `src/lib/auth/*` is already
framework-free: hashed OTPs, `timingSafeEqual`, server-side attempt counting,
one-time code consumption under concurrency, hashed session tokens. Those files
move verbatim. Only the HTTP layer is new, and it is roughly 100 lines — the
route handlers are thin wrappers today.

Fastify over NestJS: at seven endpoints, NestJS's DI and module system are
ceremony without payoff, and v12 is a disruptive ESM/Vitest migration due
~Q3 2026. Fastify brings JSON-schema validation and pino logging, which an auth
API actually wants. Revisit NestJS if `@nestjs/swagger` generating `Auth.swift`
from an OpenAPI document becomes worth it — that client is hand-written today.

### What must NOT separate: the visa data

`AGENTS.md` in the iOS repo is explicit — the web repo is "THE source of truth
for all visa data. Never author a visa fact here. Data flows one way."

Separate products, one dataset. Two divergent visa datasets would let the
website and the app disagree about whether someone needs a visa, and a false
"visa-free" is the worst thing this product can do. `Scripts/sync-data.sh`
stays the single seam: it builds the bundles from the web repo's data and copies
them plus the 1,461 golden fixtures into the iOS repo at build time. Moving
where the bundles are *served* changes nothing about where they are *authored*.

### The app never queries a database for visa answers

Worth stating because it is easy to assume otherwise. The full dataset (3.02MB
brotli) ships inside the binary, so first launch works with no network at all —
which matters, because people check visa rules in airports. On launch the app
asks the CDN whether newer data exists and swaps it in atomically only if the
hash verifies, falling back to the baked-in copy otherwise. The posture is
stale-but-correct over fresh-but-wrong.

So the database is only ever touched for accounts, sessions and OTP codes. A
silent APNs push to trigger refreshes is possible later, but it needs the paid
Apple Developer account and buys little over a single cached manifest request.

## Monthly cost

| Item | ap-south-1 |
|---|---|
| RDS `db.t4g.micro` + 20GB gp3 | ~$15.33 |
| Fargate ARM, website (0.25 vCPU / 0.5GB) | ~$5.30 |
| Fargate ARM, auth API (0.25 vCPU / 0.5GB) | ~$5.30 |
| Public IPv4 × 2 | $7.30 |
| ALB (shared, host-based routing) | ~$17.45 |
| Route 53 hosted zone | $0.50 |
| S3 + CloudFront + ECR at low traffic | ~$1–3 |
| **Total** | **~$55/month** |

Drop the ALB and point CloudFront at the task's public IP to save $17.45 — but
the IP changes on every task restart, so only do that with a stable endpoint in
front. **NAT gateway is deliberately absent**; adding one would take this to
~$86.

## Prerequisites (blocking)

1. **An AWS account**, and credentials on this machine. `~/.aws/config` already
   has `region = ap-south-1`, but there are no credentials at all — every
   `aws` call fails `NoCredentials`. Preferred: IAM Identity Center, then
   `aws configure sso`. Fastest: an IAM user with an access key and
   `aws configure`.
2. **A container build path.** There is no Docker on this machine (no Docker
   Desktop, colima, podman or finch). Either install one, or build the image in
   **CodeBuild** — which is the better answer anyway, since this repo has no CI
   at all (`.github/workflows` does not exist).
3. **Access to the GoDaddy DNS zone** for `earthvisa.in`.
4. **Secrets to load into SSM Parameter Store** (SecureString, free at standard
   tier; Secrets Manager is $0.40/secret/month for no benefit here):
   `DATABASE_URL`, `APPLE_BUNDLE_ID`, `EMAIL_FROM`, `AWS_SMS_SENDER_ID`,
   `AWS_SMS_ENTITY_ID`, `AWS_SMS_TEMPLATE_ID`, `NEXT_PUBLIC_CLARITY_ID`,
   `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `SITE`.

   No SMS or email API keys appear in that list any more, and that is the
   point: both now authenticate through the Fargate task role, so there is no
   third-party credential to leak or rotate.

## SMS and email move onto AWS too

Both third-party vendors are gone from the code: **MSG91 → AWS End User
Messaging SMS**, **Resend → Amazon SES**. Credits cover both (the exclusion
list is Mechanical Turk, Marketplace, Support, Training, Route 53 domain
registration and upfront fees — messaging is not on it).

Neither reads an API key. Credentials come from the task role, so the only
settings are the sender identity and the DLT identifiers.

### SMS: what the code does, and what is still missing

`src/lib/auth/sms.ts` calls `SendTextMessage` with `IN_ENTITY_ID` and
`IN_TEMPLATE_ID` in `DestinationCountryParameters`, which is the only way AWS
accepts DLT identifiers. A `DryRun` against the live API accepted every field
and failed on exactly one thing — `ResourceNotFoundException, sender-id` — so
the request shape is proven correct and only registration is outstanding.

Three separate gates, in order. The first two are AWS; the third is TRAI and is
the long one.

1. **Leave the SMS sandbox.** `ACCOUNT_TIER = SANDBOX` today, so messages only
   reach verified numbers. Support request.
2. **Raise the SMS spend limit.** It is **$1/month** right now, the default.
   At Indian local-route rates that is a few hundred messages. Support request,
   usually same day.
3. **Register with TRAI, then register the sender ID with AWS.** Needs PAN,
   TAN, GSTIN, CIN and a letter of authorization — i.e. a registered legal
   entity. You then build telemarketer chains with **four** named aggregators
   (Route Ledger, Karix, Sinch, Infobip) and feed those chain IDs, plus the
   Principal Entity ID, into an AWS sender ID registration.

Note that step 3 is strictly more work than MSG91 required, because MSG91 built
the telemarketer chains for you. The trade is that the spend then comes out of
credits instead of cash. Nothing about it is avoidable through a different
vendor: DLT is a TRAI rule, not a vendor rule.

**The message template is load-bearing.** Carriers match it character for
character against what was registered. `messageFor()` in `sms.ts` is the exact
string to register — register that text, not a paraphrase of it.

**Region is already right by luck.** Local Indian routes only work from
ap-south-1 and ap-south-2. Sending from anywhere else silently ignores the
registered sender ID and falls back to an international route with a random
short code, which carriers filter.

### Email: SES, and a bug it fixes

`EMAIL_FROM` was `onboarding@resend.dev`, which Resend delivers only to the
account owner's own inbox — so in production, earthling claim verification
emails reached nobody. The route failed closed rather than issuing dead
reservations, which was the right call, but the feature was effectively off.

The SES domain identity for `earthvisa.in` is **already created** in ap-south-1
with Easy DKIM (RSA-2048) and a custom MAIL FROM of `mail.earthvisa.in`.
Publish these six records and verification completes on its own:

```
qgfpl3tind63nvrxfuslrwkn6lvfherg._domainkey   CNAME  qgfpl3tind63nvrxfuslrwkn6lvfherg.dkim.amazonses.com
oq2k6s7uaygq373cltguujm44axvejo6._domainkey   CNAME  oq2k6s7uaygq373cltguujm44axvejo6.dkim.amazonses.com
eomxgnfqcs47deesmh566igiljlnejwt._domainkey   CNAME  eomxgnfqcs47deesmh566igiljlnejwt.dkim.amazonses.com
mail.earthvisa.in                             MX     10 feedback-smtp.ap-south-1.amazonses.com
mail.earthvisa.in                             TXT    "v=spf1 include:amazonses.com ~all"
```

SES is also in its own sandbox: 200 messages/day, verified recipients only, one
per second. Production access is a separate support request from the SMS one.
Until it clears, a claim from a stranger still goes nowhere — so request it
before relying on the feature.

## Cutover order

Each step names what breaks if it is skipped.

**T-7 days**

1. `SHOW server_version` on Neon; install a `pg_dump` at least that new.
   *An older `pg_dump` against a newer server aborts outright.*
2. Lower DNS TTLs at GoDaddy to 60s. Today the apex `A` is TTL 600 and
   `www` is TTL 3600. *Cut without this and `www` resolvers hold the old
   answer for an hour.*
3. Request the ACM certificate **in us-east-1** — CloudFront reads certificates
   only from N. Virginia — with SANs `earthvisa.in` and `www.earthvisa.in`.
   Add the `_x.acm-validations.aws` CNAMEs at GoDaddy.
   *A certificate issued in ap-south-1 is silently un-attachable to
   CloudFront, and you find out at cutover.*
4. Decide the DNS host. **GoDaddy has no ALIAS/ANAME**, so the apex cannot point
   at CloudFront. CloudFront's static-IP workaround costs $3,000/month. Move
   the zone to **Route 53** ($0.50/month) and use a free apex ALIAS. Copy every
   existing record first — MX, TXT/SPF, DKIM, IndexNow.
   *Delegating an incomplete zone kills email and re-verifies Search Console.*

**T-1 day**

5. Create the RDS instance with CA **`rds-ca-rsa2048-g1`**. The 4096 and ECC-384
   bundles are **not available in Mumbai**. *Choosing one that is not offered
   fails at apply time.*
6. Note `max_connections` on `db.t4g.micro` — roughly **112**, with a few
   reserved for superuser and RDS monitoring. `src/lib/db.ts` caps its pool at
   2 per container for this reason.
7. Run the four schema scripts against RDS:
   `node scripts/init-auth-db.mjs`, `init-earthling-db`, `init-reports-db`,
   `init-subscribers-db`. All four now speak the Postgres wire protocol and
   work against RDS.
8. `pg_dump` from Neon's **direct** endpoint, not the pooled one.
   *The pooled endpoint cannot hold the consistent snapshot a dump needs.*

**Cutover**

9. Push the image to ECR, run the service, verify against the ALB hostname
   directly — before any DNS points at it.
10. Confirm `/robots.txt` says `Allow: /`. *See the note below; this one can
    de-index the whole site.*
11. Confirm `/api/geo` returns a country. It needs
    `cloudfront-viewer-country` forwarded by the CloudFront **origin request
    policy**; the code is already reading that header.
12. Confirm rate limiting sees real client IPs — `cloudfront-viewer-address`
    must be forwarded by the same policy. *Without it every caller collapses
    into one bucket and the first person to hit the OTP throttle locks out
    everyone.*
13. Switch DNS. Watch 4xx/5xx on the CloudFront distribution.
14. Restore TTLs.

## Landmines already defused

These were live bugs that would have shipped silently. All are fixed and
verified in the working tree.

- **`robots.ts` read `VERCEL_ENV`.** Off Vercel that is `undefined`, so the
  site would have served `Disallow: /` and asked Google to drop every page —
  the acquisition channel, switched off, looking perfectly healthy. It now
  derives from `NEXT_PUBLIC_SITE_URL`. Verified both ways: the canonical URL
  produces `Allow: /`, a staging URL produces `Disallow: /`.
- **`/api/geo` only knew Vercel's and Cloudflare's headers**, so it would have
  returned `null` for everyone. Now reads `cloudfront-viewer-country` first.
- **`clientIp()` trusted `x-real-ip`**, absent behind CloudFront. Now reads
  `cloudfront-viewer-address`, splitting the port from the right so IPv6
  survives.
- **`@vercel/analytics` would have silently stopped recording.** All eight
  `track()` events now forward to Microsoft Clarity, which was already loaded
  and is host-agnostic. One real loss: Clarity has no per-event property bag,
  so properties become session tags — the last write wins within a session.
- **The Neon HTTP driver could only ever talk to Neon.** All four stores and
  all four init scripts now use `pg` over the wire protocol, so the same code
  reaches RDS, Neon, or localhost. TLS certificates are **verified**
  (`rejectUnauthorized: true`), not merely encrypted.

## Known cost of the current design

`npm run build` prerenders **3,076 passport pages** (30,185 `.rsc` files),
producing a **~2.2GB** standalone tree and an image around 2.5GB. Fargate pulls
the image on every task start, so deploys and scale-outs are slow. It is not a
runtime cost — CloudFront serves those pages — but if deploy speed starts to
hurt, the lever is `generateStaticParams`: prerender the top corridors and let
ISR fill the rest on demand.
