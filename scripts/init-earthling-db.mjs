// One-time (idempotent) schema setup for the Earthling store on Postgres.
// Run with: node --env-file=.env.local scripts/init-earthling-db.mjs
import { connect } from "./lib/db.mjs";

const [sql, close] = await connect();

// seq is GENERATED ALWAYS AS IDENTITY: assigned at claim time, never reused,
// even when lapsed pending claims are deleted - member numbers stay unique.
await sql`
  CREATE TABLE IF NOT EXISTS earthlings (
    username       text PRIMARY KEY,
    email          text NOT NULL,
    passports      text[] NOT NULL,
    credentials    text[] NOT NULL DEFAULT '{}',
    reach          int  NOT NULL,
    percentile     int  NOT NULL,
    seq            int  GENERATED ALWAYS AS IDENTITY,
    is_public      boolean NOT NULL DEFAULT false,
    verified       boolean NOT NULL DEFAULT false,
    verify_token   text UNIQUE,
    verify_expires timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS earthlings_leaderboard ON earthlings (verified, reach DESC, seq ASC)`;
await sql`CREATE INDEX IF NOT EXISTS earthlings_email ON earthlings (email)`;

// Fixed-window rate limiting for the claim endpoint (it sends email to
// caller-supplied addresses); rows expire opportunistically on each claim.
await sql`
  CREATE TABLE IF NOT EXISTS claim_attempts (
    ip text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS claim_attempts_ip_at ON claim_attempts (ip, at)`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM earthlings`;
console.log(`Schema ready. earthlings table has ${count} record(s).`);
await close();
