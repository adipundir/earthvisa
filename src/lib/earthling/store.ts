import { neon } from "@neondatabase/serverless";
import type { Earthling } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Earthling store - Neon Postgres via the serverless HTTP driver.
//
// Contract (schema created by scripts/init-earthling-db.mjs):
//   - username uniqueness is a PRIMARY KEY + INSERT ... ON CONFLICT DO NOTHING,
//     so two simultaneous claims for the same name can never both succeed.
//   - seq is GENERATED ALWAYS AS IDENTITY - assigned at claim time and never
//     reused, even after lapsed pending claims are deleted.
//   - verifyEarthling is a single conditional UPDATE ... RETURNING, so a token
//     is atomically one-time even under concurrent clicks.
// Reads degrade to empty (with a loud log) when the database is unreachable;
// writes throw StoreUnavailableError, which API routes map to a clean 503.
// ─────────────────────────────────────────────────────────────────────────────

/** Thrown when the backing store cannot accept writes; API routes map it to 503. */
export class StoreUnavailableError extends Error {}

type Sql = ReturnType<typeof neon>;
let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new StoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function rowToEarthling(r: Row): Earthling {
  return {
    username: r.username,
    email: r.email,
    passports: r.passports ?? [],
    credentials: r.credentials ?? [],
    reach: r.reach,
    percentile: r.percentile,
    seq: r.seq,
    createdAt: new Date(r.created_at).toISOString(),
    isPublic: r.is_public,
    verified: r.verified,
    verifyToken: r.verify_token ?? undefined,
    verifyExpires: r.verify_expires ? new Date(r.verify_expires).toISOString() : undefined,
  };
}

async function readQuery<T>(fn: (sql: Sql) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    console.error("[earthling] store read failed - degrading to empty", err);
    return fallback;
  }
}

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof StoreUnavailableError) throw err;
    throw new StoreUnavailableError(err instanceof Error ? err.message : "database write failed");
  }
}

/** Public read - only confirmed Earthlings exist to the outside world. */
export async function getEarthling(username: string): Promise<Earthling | null> {
  const u = username.trim().toLowerCase();
  return readQuery(async (sql) => {
    const rows = (await sql`
      SELECT * FROM earthlings WHERE username = ${u} AND verified = true LIMIT 1`) as Row[];
    return rows.length ? rowToEarthling(rows[0]) : null;
  }, null);
}

/** Taken = verified, or pending with an unexpired confirmation window. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = username.trim().toLowerCase();
  return readQuery(async (sql) => {
    const rows = (await sql`
      SELECT 1 FROM earthlings
      WHERE username = ${u} AND (verified = true OR verify_expires > now())
      LIMIT 1`) as Row[];
    return rows.length > 0;
  }, false);
}

export async function earthlingCount(): Promise<number> {
  return readQuery(async (sql) => {
    const rows = (await sql`
      SELECT count(*)::int AS count FROM earthlings WHERE verified = true`) as Row[];
    return rows[0].count as number;
  }, 0);
}

/** Insert-if-free; returns the created record or null when the name is taken.
 *  Lapsed unverified claims on the same name are evicted first, freeing it. */
export async function createEarthling(e: Omit<Earthling, "seq" | "createdAt">): Promise<Earthling | null> {
  return writeQuery(async (sql) => {
    await sql`
      DELETE FROM earthlings
      WHERE username = ${e.username} AND verified = false
        AND (verify_expires IS NULL OR verify_expires <= now())`;
    const rows = (await sql`
      INSERT INTO earthlings (username, email, passports, credentials, reach, percentile, is_public, verified, verify_token, verify_expires)
      VALUES (${e.username}, ${e.email}, ${e.passports}, ${e.credentials}, ${e.reach}, ${e.percentile},
              ${e.isPublic}, ${e.verified ?? false}, ${e.verifyToken ?? null}, ${e.verifyExpires ?? null})
      ON CONFLICT (username) DO NOTHING
      RETURNING *`) as Row[];
    return rows.length ? rowToEarthling(rows[0]) : null;
  });
}

/** Look up a pending claim by token WITHOUT consuming it (used by the
 *  confirmation interstitial). Returns null for unknown/spent/expired tokens. */
export async function peekPendingClaim(token: string): Promise<Earthling | null> {
  if (!token) return null;
  return readQuery(async (sql) => {
    const rows = (await sql`
      SELECT * FROM earthlings
      WHERE verify_token = ${token} AND verified = false AND verify_expires > now()
      LIMIT 1`) as Row[];
    return rows.length ? rowToEarthling(rows[0]) : null;
  }, null);
}

/** Flip a pending claim to verified via its one-time token - atomic.
 *  Returns the record, or null when the token is unknown, spent, or expired. */
export async function verifyEarthling(token: string): Promise<Earthling | null> {
  if (!token) return null;
  return writeQuery(async (sql) => {
    const rows = (await sql`
      UPDATE earthlings
      SET verified = true, verify_token = NULL, verify_expires = NULL
      WHERE verify_token = ${token} AND verified = false AND verify_expires > now()
      RETURNING *`) as Row[];
    return rows.length ? rowToEarthling(rows[0]) : null;
  });
}

/** Immediately delete a pending claim (e.g. its confirmation email failed to
 *  send), freeing the username without waiting out the 24-hour window. */
export async function expirePendingClaim(token: string): Promise<void> {
  if (!token) return;
  try {
    await writeQuery(async (sql) => {
      await sql`DELETE FROM earthlings WHERE verify_token = ${token} AND verified = false`;
    });
  } catch {
    /* best-effort cleanup - the claim lapses via its own 24h expiry anyway */
  }
}

/** Reach-descending leaderboard, ties broken by claim order (earlier wins). */
export async function leaderboard(opts?: { primaryIso3?: string; limit?: number }): Promise<Earthling[]> {
  const limit = opts?.limit ?? 100;
  return readQuery(async (sql) => {
    const rows = (opts?.primaryIso3
      ? await sql`
          SELECT * FROM earthlings WHERE verified = true AND passports[1] = ${opts.primaryIso3}
          ORDER BY reach DESC, seq ASC LIMIT ${limit}`
      : await sql`
          SELECT * FROM earthlings WHERE verified = true
          ORDER BY reach DESC, seq ASC LIMIT ${limit}`) as Row[];
    return rows.map(rowToEarthling);
  }, []);
}

/** Record a claim attempt for this IP and return how many landed in the last
 *  hour (including this one). Old rows are purged opportunistically. */
export async function recordClaimAttempt(ip: string): Promise<number> {
  return writeQuery(async (sql) => {
    // Cleanup + insert + count in ONE atomic statement. Postgres data-modifying
    // CTEs run against the statement-start snapshot, so the count subquery does
    // not see the row `ins` just added - hence the explicit +1 for this attempt.
    const rows = (await sql`
      WITH cleanup AS (
        DELETE FROM claim_attempts WHERE at < now() - interval '2 hours'
      ), ins AS (
        INSERT INTO claim_attempts (ip) VALUES (${ip}) RETURNING at
      )
      SELECT (
        SELECT count(*)::int FROM claim_attempts
        WHERE ip = ${ip} AND at > now() - interval '1 hour'
      ) + 1 AS count`) as Row[];
    return rows[0].count as number;
  });
}

/** Pending (unexpired, unverified) claims already held by this email. */
export async function pendingClaimCount(email: string): Promise<number> {
  return readQuery(async (sql) => {
    const rows = (await sql`
      SELECT count(*)::int AS count FROM earthlings
      WHERE email = ${email} AND verified = false AND verify_expires > now()`) as Row[];
    return rows[0].count as number;
  }, 0);
}
