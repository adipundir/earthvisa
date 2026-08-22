// One-time (idempotent) schema setup for data-inaccuracy reports on Neon
// Postgres (same database as the Earthling store).
// Run with: node --env-file=.env.local scripts/init-reports-db.mjs
import { connect } from "./lib/db.mjs";

const [sql, close] = await connect();

await sql`
  CREATE TABLE IF NOT EXISTS data_reports (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page       text NOT NULL,
    message    text NOT NULL,
    source_url text,
    email      text,
    ip         text,
    status     text NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS data_reports_status_at ON data_reports (status, created_at DESC)`;

// Fixed-window rate limiting (public write endpoint); rows expire
// opportunistically on each report, same pattern as claim_attempts.
await sql`
  CREATE TABLE IF NOT EXISTS report_attempts (
    ip text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS report_attempts_ip_at ON report_attempts (ip, at)`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM data_reports`;
console.log(`Schema ready. data_reports table has ${count} record(s).`);
await close();
