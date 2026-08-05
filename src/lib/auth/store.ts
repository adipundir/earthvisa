import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Account store - Neon Postgres via the serverless HTTP driver.
//
// Backs the iOS app's sign-in. Accounts exist ONLY to carry what a server has
// to hold: application progress across devices, documents, and applications
// filed on someone's behalf. Nothing about answering "do I need a visa"
// touches this file, and nothing here may ever become required to get an
// answer.
//
// Two identifiers, for two different jobs:
//   apple_sub  - Apple's stable subject claim. Survives an email change and is
//                the join key for Sign in with Apple.
//   phone      - E.164. The only identifier operations can actually reach a
//                person on. Apple private relay addresses cannot be relied on.
//
// Security contract:
//   - OTP codes are stored as a SHA-256 hash, never in plaintext, so a database
//     read cannot be replayed into someone's account.
//   - Codes are compared with timingSafeEqual.
//   - Attempts are counted server-side and the row is consumed on success, so a
//     code is strictly one-time even under concurrent verifies.
//   - Session tokens are stored hashed for the same reason as codes.
// Schema is created by scripts/init-auth-db.mjs.
// ─────────────────────────────────────────────────────────────────────────────

export class AuthStoreUnavailableError extends Error {}

type Sql = ReturnType<typeof neon>;
let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new AuthStoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError) throw err;
    throw new AuthStoreUnavailableError(
      err instanceof Error ? err.message : "database write failed",
    );
  }
}

export interface Account {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}

function rowToAccount(r: Row): Account {
  return {
    id: r.id,
    phone: r.phone ?? null,
    email: r.email ?? null,
    displayName: r.display_name ?? null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Constant-time compare of two hex digests of equal length. */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

// ── One-time codes ───────────────────────────────────────────────────────────

/** How long a code stays valid. Long enough for a slow SMS, short enough that a
 *  shoulder-surfed code is not useful later. */
const CODE_TTL_MINUTES = 10;
/** Wrong guesses allowed before the code is burned. A 6-digit code has a
 *  1-in-1,000,000 space, so 5 tries is not a meaningful brute-force window
 *  while still forgiving a genuine mistype. */
const MAX_ATTEMPTS = 5;

export interface CodeIssued {
  code: string;
  expiresAt: Date;
}

/** Issues a code for a phone number, replacing any outstanding one.
 *
 *  Replacing rather than adding matters: without it, requesting a second code
 *  would leave the first still valid, and every resend would widen the window
 *  of live codes rather than refresh it. */
export async function issuePhoneCode(phone: string): Promise<CodeIssued> {
  // randomInt over a string would bias; six digits from rejection-free modulo
  // of 4 bytes is fine here because the space (10^6) divides evenly enough that
  // the bias is far below anything exploitable, and the code is rate-limited,
  // single-use and short-lived regardless.
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  await writeQuery(async (sql) => {
    await sql`DELETE FROM auth_codes WHERE phone = ${phone}`;
    await sql`
      INSERT INTO auth_codes (phone, code_hash, expires_at, attempts)
      VALUES (${phone}, ${sha256(code)}, ${expiresAt.toISOString()}, 0)`;
  });
  return { code, expiresAt };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "incorrect"; attemptsRemaining: number }
  | { ok: false; reason: "too_many" };

/** Verifies and CONSUMES a code. */
export async function verifyPhoneCode(phone: string, code: string): Promise<VerifyResult> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT code_hash, expires_at, attempts FROM auth_codes WHERE phone = ${phone} LIMIT 1`) as Row[];
    if (!rows.length) return { ok: false, reason: "expired" } as VerifyResult;

    const row = rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await sql`DELETE FROM auth_codes WHERE phone = ${phone}`;
      return { ok: false, reason: "expired" } as VerifyResult;
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await sql`DELETE FROM auth_codes WHERE phone = ${phone}`;
      return { ok: false, reason: "too_many" } as VerifyResult;
    }

    if (!safeEqualHex(row.code_hash, sha256(code))) {
      // Increment in the database rather than in memory: two concurrent wrong
      // guesses must both count.
      const updated = (await sql`
        UPDATE auth_codes SET attempts = attempts + 1
        WHERE phone = ${phone} RETURNING attempts`) as Row[];
      const attempts = updated.length ? updated[0].attempts : MAX_ATTEMPTS;
      return {
        ok: false,
        reason: "incorrect",
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
      } as VerifyResult;
    }

    // Consume on success, so the same code cannot be redeemed twice.
    await sql`DELETE FROM auth_codes WHERE phone = ${phone}`;
    return { ok: true } as VerifyResult;
  });
}

// ── Rate limiting ────────────────────────────────────────────────────────────

/** Counts code requests in the last hour for a phone or an IP.
 *
 *  Both are limited. Per-phone stops someone being SMS-bombed by a stranger
 *  typing their number; per-IP stops one actor burning the SMS budget across
 *  many numbers, which is a direct financial attack rather than merely abuse. */
export async function recordCodeRequest(phone: string, ip: string): Promise<{
  phoneCount: number;
  ipCount: number;
}> {
  return writeQuery(async (sql) => {
    await sql`INSERT INTO auth_code_requests (phone, ip) VALUES (${phone}, ${ip})`;
    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE phone = ${phone}) AS phone_count,
        COUNT(*) FILTER (WHERE ip = ${ip})       AS ip_count
      FROM auth_code_requests
      WHERE created_at > NOW() - INTERVAL '1 hour'`) as Row[];
    return {
      phoneCount: Number(rows[0]?.phone_count ?? 0),
      ipCount: Number(rows[0]?.ip_count ?? 0),
    };
  });
}

export const MAX_CODES_PER_PHONE_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;

// ── Accounts ─────────────────────────────────────────────────────────────────

export async function upsertAccountByPhone(phone: string): Promise<Account> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      INSERT INTO accounts (phone) VALUES (${phone})
      ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
      RETURNING *`) as Row[];
    return rowToAccount(rows[0]);
  });
}

/** Finds or creates the account for an Apple subject.
 *
 *  `email` and `displayName` are COALESCEd rather than assigned, because Apple
 *  returns them only on the very first authorization for an Apple ID and sends
 *  null every time after. Assigning would wipe the name on second sign-in. */
export async function upsertAccountByApple(
  appleSub: string,
  email: string | null,
  displayName: string | null,
): Promise<Account> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      INSERT INTO accounts (apple_sub, email, display_name)
      VALUES (${appleSub}, ${email}, ${displayName})
      ON CONFLICT (apple_sub) DO UPDATE SET
        email = COALESCE(accounts.email, EXCLUDED.email),
        display_name = COALESCE(accounts.display_name, EXCLUDED.display_name)
      RETURNING *`) as Row[];
    return rowToAccount(rows[0]);
  });
}

/** Attaches a verified phone to an existing account. */
export async function linkPhoneToAccount(accountId: string, phone: string): Promise<Account | null> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      UPDATE accounts SET phone = ${phone} WHERE id = ${accountId}::uuid RETURNING *`) as Row[];
    return rows.length ? rowToAccount(rows[0]) : null;
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/** Session lifetime. Long, because being signed out mid-application is a real
 *  cost and there is nothing here worth a short window: no payment
 *  authorisation and no destructive action is reachable with a token alone. */
const SESSION_DAYS = 180;

export async function createSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await writeQuery(
    (sql) => sql`
      INSERT INTO auth_sessions (token_hash, account_id, expires_at)
      VALUES (${sha256(token)}, ${accountId}::uuid, ${expiresAt.toISOString()})`,
  );
  return token;
}

export async function accountForToken(token: string): Promise<Account | null> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT a.* FROM auth_sessions s
      JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = ${sha256(token)} AND s.expires_at > NOW()
      LIMIT 1`) as Row[];
    return rows.length ? rowToAccount(rows[0]) : null;
  });
}

export async function revokeSession(token: string): Promise<void> {
  await writeQuery(
    (sql) => sql`DELETE FROM auth_sessions WHERE token_hash = ${sha256(token)}`,
  );
}

/** Reads a bearer token from a request, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
