// Creates the account/auth schema in Neon. Idempotent: safe to re-run.
//
//   node scripts/init-auth-db.mjs
//
// Separate from the Earthling schema on purpose. Earthling is a public profile
// feature; this is authentication for the iOS app, and it will grow to carry
// applications and documents. Keeping the tables apart keeps a mistake in one
// from reaching the other.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

// .env.local is not loaded automatically by a bare node script.
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local; rely on the real environment */ }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

// phone and apple_sub are both nullable and both unique: an account may be
// created by either route, and later gain the other. A partial unique index
// rather than a plain UNIQUE, because Postgres treats every NULL as distinct
// and a plain constraint would permit unlimited NULL rows but is clearer stated
// explicitly.
await sql`
  CREATE TABLE IF NOT EXISTS accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        TEXT,
    apple_sub    TEXT,
    email        TEXT,
    display_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone_key ON accounts (phone) WHERE phone IS NOT NULL`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_apple_sub_key ON accounts (apple_sub) WHERE apple_sub IS NOT NULL`;

// Codes are stored hashed, so a database read cannot be replayed into someone's
// account. One live code per number: issuing replaces rather than adds, or every
// resend would widen the window of valid codes instead of refreshing it.
await sql`
  CREATE TABLE IF NOT EXISTS auth_codes (
    phone      TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS auth_code_requests (
    id         BIGSERIAL PRIMARY KEY,
    phone      TEXT NOT NULL,
    ip         TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`CREATE INDEX IF NOT EXISTS auth_code_requests_recent ON auth_code_requests (created_at DESC)`;

// Session tokens are stored hashed for the same reason as codes.
await sql`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`CREATE INDEX IF NOT EXISTS auth_sessions_account ON auth_sessions (account_id)`;

// Housekeeping. Expired rows are not sensitive, but auth_code_requests grows
// forever and is only ever read over the last hour.
const cleaned = await sql`DELETE FROM auth_codes WHERE expires_at < NOW() RETURNING phone`;
const cleanedReq = await sql`DELETE FROM auth_code_requests WHERE created_at < NOW() - INTERVAL '2 hours' RETURNING id`;
const cleanedSess = await sql`DELETE FROM auth_sessions WHERE expires_at < NOW() RETURNING token_hash`;

console.log("auth schema ready");
console.log(`  cleaned ${cleaned.length} expired codes, ${cleanedReq.length} old requests, ${cleanedSess.length} expired sessions`);
