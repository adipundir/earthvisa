#!/usr/bin/env bash
# Prints a DATABASE_URL for the RDS instance, assembled from the RDS-managed
# credential in Secrets Manager.
#
# The password is never written to a file, a shell history entry, or a log. It
# exists only in this process's stdout, which the caller is expected to consume
# directly:
#
#   DATABASE_URL="$(Scripts/lib/rds-url.sh)" node scripts/init-auth-db.mjs
#
# `sslmode` is deliberately absent from the URL. src/lib/db.ts strips it anyway
# and decides TLS itself, because node-postgres is mid-way through changing what
# `sslmode=require` means.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
DB_ID="${DB_ID:-earthvisa-db}"

read -r HOST PORT DBNAME SECRET <<<"$(
  aws rds describe-db-instances \
    --db-instance-identifier "$DB_ID" --region "$REGION" \
    --query 'DBInstances[0].[Endpoint.Address,Endpoint.Port,DBName,MasterUserSecret.SecretArn]' \
    --output text
)"

[ "$HOST" != "None" ] || { echo "rds-url: $DB_ID has no endpoint yet" >&2; exit 1; }

CREDS="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET" --region "$REGION" --query SecretString --output text)"

# Percent-encode the password: RDS generates characters that are legal in a
# password but not in a URL, and an unencoded one silently truncates the URL.
python3 - "$CREDS" "$HOST" "$PORT" "$DBNAME" <<'PY'
import json, sys, urllib.parse
creds = json.loads(sys.argv[1])
user = urllib.parse.quote(creds["username"], safe="")
pw = urllib.parse.quote(creds["password"], safe="")
host, port, db = sys.argv[2], sys.argv[3], sys.argv[4]
print(f"postgresql://{user}:{pw}@{host}:{port}/{db}")
PY
