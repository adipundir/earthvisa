// One-time (idempotent) schema setup for visa-access change subscribers on Neon
// Postgres (same database as the reports store).
// Run with: node --env-file=.env.local scripts/init-subscribers-db.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set - run with: node --env-file=.env.local scripts/init-subscribers-db.mjs");
  process.exit(1);
}
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS subscribers (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL,
    passports  text[] NOT NULL DEFAULT '{}',
    ip         text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS subscribers_created_at ON subscribers (created_at DESC)`;

// Fixed-window rate limiting (public write endpoint); rows expire
// opportunistically on each subscribe, same pattern as report_attempts.
await sql`
  CREATE TABLE IF NOT EXISTS subscribe_attempts (
    ip text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS subscribe_attempts_ip_at ON subscribe_attempts (ip, at)`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM subscribers`;
console.log(`Schema ready. subscribers table has ${count} record(s).`);
