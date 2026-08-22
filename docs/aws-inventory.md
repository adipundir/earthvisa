# What exists in AWS

Account `884681716487`, region `ap-south-1`. Everything below was created on
2026-08-09 and is tagged `Project=earthvisa`, `ManagedBy=claude`.

Read this before creating anything: the account was empty before this, so any
resource without those tags was added by someone else.

## Network

| | |
|---|---|
| VPC | `vpc-0b5745b845aec711d` — `10.20.0.0/16`, DNS hostnames + support on |
| Public subnets | `subnet-0bf3f228cb82083c6` (1a, 10.20.1.0/24), `subnet-0860250d011f9afd2` (1b, 10.20.2.0/24) |
| Private subnets | `subnet-07466d6633622eba4` (1a, 10.20.11.0/24), `subnet-07a8a606a0d20eb05` (1b, 10.20.12.0/24) |
| Internet gateway | `igw-0d311a2443daa17ed`, default route from the public subnets |
| App security group | `sg-0ce1c4755374a4f14` — ingress 3000 from inside the VPC only |
| RDS security group | `sg-04613b8c0e3b74b61` — ingress 5432 from the app SG, plus one operator IP |

There is **no NAT gateway**, deliberately. Tasks run in a public subnet with a
public IP and egress straight through the internet gateway, which is what lets
them reach `appleid.apple.com` and `control.msg91.com` while the database stays
unreachable from outside. A NAT gateway would cost $40.88/month for nothing this
design needs.

## Database

`earthvisa-db` — Postgres 18.3 on `db.t4g.micro`, 20GB gp3 autoscaling to 100GB,
storage encrypted, 7-day backups, CA `rds-ca-rsa2048-g1`.

The master credential is **RDS-managed in Secrets Manager** and rotates on its
own. No password was ever typed, logged, or committed. `scripts/lib/rds-url.sh`
assembles a `DATABASE_URL` from it on demand:

```sh
DATABASE_URL="$(scripts/lib/rds-url.sh)" node scripts/init-auth-db.mjs
```

Parameter group `earthvisa-pg18` sets `rds.force_ssl=1`, so an unencrypted
connection is refused by the server rather than merely discouraged by the client.

## Documents

Two buckets, both with public access blocked, versioning on, and default
SSE-KMS under `alias/earthvisa-docs` (rotation enabled).

- `earthvisa-docs-quarantine-aps1` — where phones upload. Objects expire after
  7 days, so nothing clean is ever left here.
- `earthvisa-docs-aps1` — scanned documents, promoted from quarantine.

Both bucket policies deny plain HTTP and deny `PutObject` under any KMS key but
ours. **Verified by test, not by assumption:** an upload with our key succeeded,
an upload with `AES256` was denied with an explicit-deny error, and an upload
with no encryption header at all was silently encrypted with our key by the
bucket default. Every object in these buckets carries our CMK.

## Identity and configuration

`earthvisa-task` is the Fargate task role. Its inline policy grants exactly:
send one SMS, send email only from `noreply@earthvisa.in`, put into quarantine,
get from the documents bucket, use the one KMS key, and read `/earthvisa/*` from
SSM. Nothing else, no wildcards on resources that support ARNs.

Non-secret configuration lives in SSM under `/earthvisa/`. There are no API keys
in it, because SMS and email now authenticate through the task role.

ECR repositories `earthvisa-web` and `earthvisa-api` exist with scan-on-push.

## Owed before this carries real users

1. **Remove the operator IP from the RDS security group** and set
   `PubliclyAccessible=false`. It is there so migrations can run from a laptop
   during bootstrap; it is the one deliberate compromise in this setup.
2. **Move the database to the private subnets** once a Fargate task can run
   migrations from inside the VPC.
3. **Turn on GuardDuty Malware Protection for S3** on the quarantine bucket, and
   add the tag-based policy that refuses `GetObject` until a scan returns clean.
4. **Stop using the root account.** Everything above was created as root because
   that is the only credential configured. The `claude` IAM user already exists
   with AdministratorAccess and no access key.
5. ~~**Set a billing alarm.**~~ DONE: `earthvisa-monthly-spend` in us-east-1
   (billing metrics exist only there) fires above **$100/month**. It has **no
   SNS action**, so today it only turns red in the console — attach an email
   subscription to actually be told.
6. **Re-point the RDS security group when your IP changes.** The bootstrap rule
   pins one address, and a home connection moves. When the database suddenly
   times out and the app reports zero corridors, this is why — not the data.

## 2026-08-22: what was done, and what is blocked

Done, from a laptop, against the account as root:

- **Schema.** `scripts/migrate.mjs` run against `earthvisa-db`: auth, earthling,
  reports, subscribers, filing and the new enquiries schema all applied. The
  filing schema was already there with one open corridor and two applications,
  so this database is the live one.
- **Application role.** `earthvisa_app` created in Postgres with a non-rotating
  password (SELECT/INSERT/UPDATE/DELETE on every table, now and by default on
  future ones). Its connection string is `/earthvisa/DATABASE_URL`
  (SecureString); `/earthvisa/EMAIL_FROM` is `noreply@earthvisa.in`. The task
  definition's Secrets list is therefore satisfiable.
- **RDS security group.** The stale operator CIDR was replaced with the current
  one (`122.161.51.157/32`, description "operator bootstrap - remove before
  launch"). Still owed: remove it, `PubliclyAccessible=false`.
- **Build pipeline.** `deploy.sh bootstrap` created stack `earthvisa-build`
  (bucket `earthvisa-build-884681716487`, CodeBuild project
  `earthvisa-web-build`). The source tree was packaged and uploaded.
- **Certificates requested, pending DNS validation.** Publish these CNAMEs at
  the DNS host, then both reach ISSUED on their own:

  | name | value |
  |---|---|
  | `_5cad542f0960c6650abc06f553107bff.origin.earthvisa.in` | `_f49bbfbf1b0f6e89406ed153f7612bc5.jkddzztszm.acm-validations.aws` |
  | `_38d3187630525cc0ce19eed93aea3050.earthvisa.in` | `_927a512b384691b4457c060a75dbe441.jkddzztszm.acm-validations.aws` |
  | `_6e66783487c3f918c121d722d3cd6ffe.www.earthvisa.in` | `_9b5590513e97d667038c0c0e0632c57b.jkddzztszm.acm-validations.aws` |

  `ORIGIN_CERT_ARN=arn:aws:acm:ap-south-1:884681716487:certificate/6d99f5ec-5f41-45c6-953c-5a3631402905`
  `VIEWER_CERT_ARN=arn:aws:acm:us-east-1:884681716487:certificate/df6dd266-8cf8-440d-a385-f8e3cff1f73d`

Blocked, and why:

- **No compute.** Every relevant quota is applied at 0 against an AWS default
  of 1 or more: CodeBuild concurrent builds (all environments), Fargate
  On-Demand vCPUs, EC2 On-Demand and Spot vCPUs. `StartBuild` fails with
  "Cannot have more than 0 builds in queue", and `RequestServiceQuotaIncrease`
  is refused with "Please contact AWS Support". This is a new-account
  restriction, not a configuration. Support case
  `case-884681716487-muen-2026-b053967ca9f2aa18` asks for CodeBuild ARM/Large
  and ARM/Medium to 1, Fargate to 8 vCPUs, EC2 to 8 vCPUs. Only Lambda (10
  concurrent) is open, and the 2GB standalone image does not fit it.

To resume once the case is answered and the certificates read ISSUED:

```sh
deploy/deploy.sh build      # the source is already in the bucket; this re-zips and builds
export ORIGIN_CERT_ARN=... VIEWER_CERT_ARN=...   # the two ARNs above
deploy/deploy.sh app
deploy/deploy.sh migrate    # idempotent; the schema is already applied from the laptop
deploy/deploy.sh edge
```
