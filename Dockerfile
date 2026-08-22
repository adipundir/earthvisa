# The production image: Next.js in standalone mode, one long-lived process.
#
# A container rather than Lambda, deliberately. Two reasons that are specific to
# this app rather than general taste:
#
#   1. Egress. The auth routes must reach appleid.apple.com (JWKS) and
#      control.msg91.com (OTP delivery) while ALSO reaching a private RDS. A
#      Lambda in a VPC gets no internet without a NAT gateway, which is
#      $40.88/month in ap-south-1 - nearly three times the database it would be
#      protecting. A Fargate task in a public subnet has direct egress and
#      private VPC reach at the same time, for the price of one public IPv4.
#   2. A long-lived process means a real `pg` pool, and no cold start on
#      /api/auth/me - the request every app launch makes.
#
# Build it in CodeBuild, not here: `npm run build` prerenders ~3,000 corridor
# pages and the resulting image is roughly 2.5GB.

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
# sharp (next/image) links against glibc symbols that musl does not provide.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` from the lockfile: a deploy must install what was tested, not what
# resolved to be newest this morning.
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Baked in at BUILD time, not injected at run time. Next inlines every
# NEXT_PUBLIC_* value into the client bundle during the build, and robots.ts
# decides from this whether the site may be indexed at all - so a missing value
# here does not degrade, it serves "Disallow: /" to Google.
ARG NEXT_PUBLIC_SITE_URL=https://earthvisa.in
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLARITY_ID=""
ENV NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID

# Search-engine ownership tokens. These are NOT runtime configuration even
# though they carry no NEXT_PUBLIC_ prefix: layout.tsx reads them from the
# module-level `metadata` export, which is evaluated while prerendering. Supply
# them to a running container and the meta tags still will not appear, because
# every page that would carry them was rendered during this build.
ARG GOOGLE_SITE_VERIFICATION=""
ENV GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
ARG BING_SITE_VERIFICATION=""
ENV BING_SITE_VERIFICATION=$BING_SITE_VERIFICATION

ENV NEXT_TELEMETRY_DISABLED=1

# Prerendering ~3,000 corridor pages holds a great many live objects at once and
# overruns Node's default heap on a large build host. The failure is an
# out-of-memory abort partway through page generation, which reads like a
# random crash rather than a limit.
ARG NODE_OPTIONS="--max-old-space-size=8192"
ENV NODE_OPTIONS=$NODE_OPTIONS

# Runs the prebuild data pipeline, then builds. No DATABASE_URL is provided or
# needed: every store fails closed at build time and nothing prerendered reads
# the database.
#
# .dockerignore excludes .git, so build-dataset.mjs cannot read the git history
# it derives per-country dates from. That is safe ONLY because the committed
# src/data/.build-manifest.json matches the sources, which makes the pipeline
# skip the dataset stage entirely. If it does not match, the stage runs, finds
# no history, and REFUSES to emit a dataset - the build fails here rather than
# shipping a sitemap that re-dates every URL at once. deploy/deploy.sh runs
# `npm run data:check` before packaging so that failure surfaces in a second
# locally instead of forty minutes into a remote build.
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Never root. A container that is compromised through a dependency should not
# also be able to rewrite its own application files.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone tree already carries server.js, the traced node_modules and -
# via outputFileTracingIncludes - data/vfs. Static assets and public/ are NOT
# traced into it and have to be copied explicitly; without them the site
# renders with no CSS, no fonts and no /mobile data bundles.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The Amazon RDS certificate authorities. src/lib/db.ts reads this from
# process.cwd()/certs and VERIFIES the database certificate against it. RDS
# presents a cert from its own CA, which is not in Node's trust store, so
# without this file every query fails with SELF_SIGNED_CERT_IN_CHAIN - at run
# time, on a container that started and health-checked perfectly.
COPY --from=builder --chown=nextjs:nodejs /app/certs ./certs

# The schema scripts, so migrations can run as a one-off task on this same
# image from INSIDE the VPC (deploy/deploy.sh migrate). They are a few KB and
# they remove the need to ever expose RDS to an operator's home IP address.
# They are not traced into the standalone tree because nothing imports them.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000
# Bind to every interface. Next's default of localhost is unreachable from
# outside the container, which presents as a load balancer whose health checks
# all time out against a server that is running perfectly well.
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
