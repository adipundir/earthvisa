# Deploying Earth Visa to AWS

Four files, three CloudFormation stacks, one driver script.

```
01-build.yml   S3 source bucket + CodeBuild project  ->  an ARM64 image in ECR
02-app.yml     ECS Fargate service behind an ALB      ->  the running website
03-edge.yml    CloudFront in front of the ALB         ->  the public site
deploy.sh      packages the tree and drives all three
```

Everything is idempotent. Re-running a step converges; `aws cloudformation
delete-stack` is a real undo.

## Before the first run

These are the things CloudFormation cannot do for you.

### 1. SSM parameters

The task definition names only parameters the WEBSITE needs, because a missing
one does not warn — the ECS agent fails to resolve it and the task never starts,
in a loop, with the reason visible only in `describe-tasks`.

Already present: `AWS_SES_REGION`, `AWS_SMS_REGION`, `NEXT_PUBLIC_SITE_URL`,
`DOCS_BUCKET`, `DOCS_QUARANTINE_BUCKET`, `DOCS_KMS_ALIAS`.

**Must be created before `deploy.sh app`:**

```sh
aws ssm put-parameter --region ap-south-1 --type SecureString \
  --name /earthvisa/DATABASE_URL --value "postgresql://..."
aws ssm put-parameter --region ap-south-1 --type String \
  --name /earthvisa/EMAIL_FROM --value "noreply@earthvisa.in"
```

`EMAIL_FROM` must be exactly `noreply@earthvisa.in`: the task role's policy
carries an `ses:FromAddress` condition on that single address, and
`src/lib/earthling/email.ts` fails closed rather than reserving names against
mail IAM will refuse to send.

Optional, read only at BUILD time (an absent value simply omits the feature):
`NEXT_PUBLIC_CLARITY_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`.

**On `DATABASE_URL`:** the RDS master credential is RDS-managed and rotates
itself, and `src/lib/db.ts` reads the URL once and freezes it into the pool. A
static copy of the master credential therefore goes stale at the next rotation
and the site silently returns to empty results. Create a **dedicated
non-rotating application role** in Postgres and put *that* connection string
here.

### 2. Certificates

Two, in two regions, and the region matters.

```sh
# For the ALB - must be in ap-south-1.
aws acm request-certificate --region ap-south-1 \
  --domain-name origin.earthvisa.in --validation-method DNS

# For CloudFront - must be in us-east-1. A cert issued anywhere else is
# silently un-attachable, and you find out at cutover.
aws acm request-certificate --region us-east-1 \
  --domain-name earthvisa.in --subject-alternative-names www.earthvisa.in \
  --validation-method DNS
```

Publish the `_x.acm-validations.aws` CNAMEs, wait for `ISSUED`, then export:

```sh
export ORIGIN_CERT_ARN=arn:aws:acm:ap-south-1:...
export VIEWER_CERT_ARN=arn:aws:acm:us-east-1:...
```

### 3. `origin.earthvisa.in`

CloudFront reaches the ALB by this name, not by the ALB's own
`*.elb.amazonaws.com` name, because that is the name the ALB certificate is
issued for. After `deploy.sh app`, point it at the ALB (CNAME is fine — it is a
subdomain, so no ALIAS is required and it can stay at GoDaddy).

Adding this record is safe before cutover: nothing public resolves to it.

## Running it

```sh
deploy/deploy.sh bootstrap   # once: build bucket + CodeBuild project
deploy/deploy.sh build       # package -> CodeBuild -> ECR   (slow, ~40-60 min cold)
deploy/deploy.sh app         # ECS service behind the ALB
deploy/deploy.sh migrate     # schema, as a one-off task INSIDE the VPC
deploy/deploy.sh edge        # CloudFront
```

`migrate` runs after `app` because it reuses that stack's task definition. It is
the reason the RDS security group never needs an operator's home IP address:
migrations run from inside the VPC. Once it has run once, **remove the
bootstrap CIDR from `sg-04613b8c0e3b74b61` and set `PubliclyAccessible=false`.**

## Verifying before DNS moves

The ALB admits only the CloudFront prefix list, so you cannot curl it directly
unless you deliberately open it:

```sh
deploy/deploy.sh app   # with VerifyCidr set to your own /32 first
```

Prefer verifying through the CloudFront domain name instead — it works before
any DNS moves and exercises the real path, including the origin request
policies that `/api/geo` and `clientIp()` depend on:

```sh
D=$(aws cloudformation describe-stacks --region ap-south-1 \
      --stack-name earthvisa-edge \
      --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text)

curl -sS "https://$D/api/health"                     # {"ok":true}
curl -sS "https://$D/robots.txt"                     # MUST say Allow: /
curl -sS "https://$D/api/geo"                        # {"country":"IN"} - not null
curl -sSI "https://$D/passport/india/thailand"       # 200
curl -sS "https://$D/api/corridors"                  # not an empty list, if seeded
```

`robots.txt` is the one that can undo the whole site. `Disallow: /` here asks
Google to drop every page, and it looks perfectly healthy while doing it.

`/api/geo` returning `null` means the origin request policy is not forwarding
`cloudfront-viewer-country`. Do not shrug at it: the same policy carries
`cloudfront-viewer-address`, and without that every caller collapses into one
rate-limit bucket — the first person to hit the OTP throttle locks out
everyone.

## The DNS cutover

The apex cannot point at CloudFront from GoDaddy, which has no ALIAS record.
Moving the zone to Route 53 ($0.50/month) is the only option that keeps
`earthvisa.in` as the canonical host.

**Copy every record first.** The zone currently carries live Zoho email and a
GoDaddy SPF-flattening macro; delegating an incomplete zone kills mail and
re-verifies Search Console.

| type | name | value |
|---|---|---|
| MX | `@` | `10 mx.zoho.in`, `20 mx2.zoho.in`, `50 mx3.zoho.in` |
| TXT | `@` | `v=spf1 include:dc-8e814c8572._spfm.earthvisa.in ~all` |
| TXT | `dc-8e814c8572._spfm` | `v=spf1 include:zohomail.in ~all` |
| TXT | `@` | `zoho-verification=zb43733185.zmverify.zoho.in` |
| TXT | `@` | `google-site-verification=Yk3nLZvl2AbWUnW0ESulIgRWCcF8AbPf-XQNKivi8R8` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |

Then add the six SES records from `docs/aws-migration.md` — none of them are
published today, which is exactly why the SES identity reads `DKIM: FAILED` and
`MAIL FROM: FAILED`, and why earthling claim mail currently reaches nobody.

Lower TTLs to 60s a week ahead (`www` is at 3600 today), cut, watch CloudFront
4xx/5xx, then restore.

## Costs

~$55/month as designed, plus ~$5 because the task runs at 0.5 vCPU / 1GB rather
than 0.25/0.5 — Node with a large route manifest and a `pg` pool does not sit
comfortably in 512MB, and an OOM kill presents as a flapping health check rather
than an obvious memory error.

There is deliberately **no NAT gateway**. Tasks run in public subnets with a
public IP, which is what lets them reach `appleid.apple.com` and the AWS
messaging APIs while RDS stays unreachable from outside. A NAT would add
$40.88/month for nothing this design needs — and note `AssignPublicIp: ENABLED`
is load-bearing: without it the task cannot even pull its own image.
