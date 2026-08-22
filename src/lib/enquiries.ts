import { makeSql, type Sql } from "@/lib/db";
import { randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Enquiries store - Postgres, via the shared wire-protocol client in lib/db.
//
// Backs the iOS app's "ask Earth Visa" surfaces: an investment-migration lead
// on a citizenship or residency programme, a request to handle a visa on a
// corridor the app can describe but not file, and plain support. Schema is
// created by scripts/init-enquiries-db.mjs; read that file first, because what
// an enquiry is and is not is decided there.
//
// The same three rules the filing store lives by, because they are the same
// kind of table:
//
//   - Authorization is `account_id` on every query. There is no lookup by id
//     alone; the moment one exists it is an IDOR onto a stranger's thread.
//   - Multi-table writes are single statements with data-modifying CTEs, not
//     BEGIN/COMMIT. `makeSql()` checks out a connection per call, so a
//     transaction issued through it can land on two connections and guarantee
//     nothing.
//   - The operator hears about work through the `outbox` table written in the
//     SAME statement as the row, or not at all. A notification sent inline can
//     succeed while the insert fails, or the reverse.
// ─────────────────────────────────────────────────────────────────────────────

export class EnquiryStoreUnavailableError extends Error {}

let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new EnquiryStoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = makeSql();
  return sqlClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof EnquiryStoreUnavailableError) throw err;
    console.error("[enquiries] store call failed", err);
    throw new EnquiryStoreUnavailableError(
      err instanceof Error ? err.message : "enquiry store call failed",
    );
  }
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export type EnquiryKind = "programme" | "visa_assist" | "support";
export type EnquiryState = "new" | "in_progress" | "replied" | "closed";
export type MessageAuthor = "applicant" | "operator" | "system";

export const ENQUIRY_KINDS: EnquiryKind[] = ["programme", "visa_assist", "support"];

export interface EnquiryMessage {
  /** BIGINT identity as a string: an identifier, not a quantity. */
  id: string;
  author: MessageAuthor;
  body: string;
  at: string;
}

export interface EnquirySummary {
  id: string;
  /** What a person reads out to support. NOT a capability - every query here
   *  is scoped by account_id, so knowing a code grants nothing. */
  referenceCode: string;
  kind: EnquiryKind;
  state: EnquiryState;
  subject: Record<string, unknown>;
  applicationId: string | null;
  messageCount: number;
  /** The newest message, so a list row can show the last thing said without
   *  fetching every thread. */
  lastMessage: EnquiryMessage | null;
  createdAt: string;
  updatedAt: string;
}

export interface Enquiry extends EnquirySummary {
  answers: Record<string, unknown>;
  /** Oldest first, by id. */
  messages: EnquiryMessage[];
}

const iso = (v: unknown): string => new Date(v as string).toISOString();

function rowToMessage(m: Row): EnquiryMessage {
  return { id: String(m.id), author: m.author, body: m.body, at: iso(m.at) };
}

function rowToSummary(r: Row): EnquirySummary {
  return {
    id: r.id,
    referenceCode: r.reference_code,
    kind: r.kind,
    state: r.state,
    subject: (r.subject ?? {}) as Record<string, unknown>,
    applicationId: r.application_id ?? null,
    messageCount: Number(r.message_count ?? 0),
    lastMessage: r.last_message ? rowToMessage(r.last_message as Row) : null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function rowToEnquiry(r: Row): Enquiry {
  return {
    ...rowToSummary(r),
    answers: (r.answers ?? {}) as Record<string, unknown>,
    messages: ((r.messages ?? []) as Row[]).map(rowToMessage),
  };
}

// ── Identifiers ──────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** Same alphabet and reasoning as the filing store's reference code: nothing
 *  that reads back wrong down a phone line. Prefixed EQ so support can tell an
 *  enquiry from an application by the first two letters. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function referenceCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  const out: string[] = [];
  while (out.length < 8) {
    for (const b of randomBytes(16)) {
      if (b >= limit) continue;
      out.push(CODE_ALPHABET[b % n]);
      if (out.length === 8) break;
    }
  }
  return `EQ-${out.slice(0, 4).join("")}-${out.slice(4).join("")}`;
}

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

// ── Rate limiting ────────────────────────────────────────────────────────────

export const MAX_ENQUIRIES_PER_ACCOUNT_PER_HOUR = 20;

/** Records an attempt and returns this account's count for the last hour,
 *  INCLUDING this one. Cleanup, insert and count in one statement. */
export async function recordEnquiryAttempt(accountId: string): Promise<number> {
  if (!isUuid(accountId)) return Number.MAX_SAFE_INTEGER;
  return writeQuery(async (sql) => {
    const rows = (await sql`
      WITH cleanup AS (
        DELETE FROM enquiry_attempts WHERE at < now() - interval '2 hours'
      ), ins AS (
        INSERT INTO enquiry_attempts (account_id) VALUES (${accountId}::uuid) RETURNING at
      )
      SELECT (
        SELECT count(*)::int FROM enquiry_attempts
        WHERE account_id = ${accountId}::uuid AND at > now() - interval '1 hour'
      ) + 1 AS count`) as { count: number }[];
    return rows[0].count;
  });
}

// ── Creating ─────────────────────────────────────────────────────────────────

export interface CreateEnquiryInput {
  kind: EnquiryKind;
  subject: Record<string, unknown>;
  answers: Record<string, unknown>;
  /** The person's opening message. Optional for the structured kinds, where the
   *  answers carry the substance; required for support, where it IS the
   *  substance. The route enforces that. */
  message: string | null;
  applicationId: string | null;
}

/** Opens an enquiry, writes the opening message if there is one, and tells the
 *  operator through the outbox - all in one statement.
 *
 *  The system line ("Earth Visa has your enquiry...") is written as a message
 *  rather than rendered by the app, so the thread a person reads a year later
 *  still says what they were told at the time, and so changing the wording does
 *  not rewrite history. */
export async function createEnquiry(
  accountId: string,
  input: CreateEnquiryInput,
): Promise<Enquiry | null> {
  if (!isUuid(accountId)) return null;
  if (input.applicationId !== null && !isUuid(input.applicationId)) return null;

  const systemLine =
    input.kind === "support"
      ? "Earth Visa has your message. A person replies here, usually within one working day (IST)."
      : input.kind === "visa_assist"
        ? "Earth Visa has your request. A person reads it and replies here, usually within one working day, with whether we can take this on and what it would need from you."
        : "Earth Visa has your enquiry. A person replies here, usually within two working days, with what this programme would need from you and who is authorised to file it. Nothing is promised about the outcome.";

  const createdId = await writeQuery(async (sql) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const rows = (await sql`
          WITH created AS (
            INSERT INTO enquiries (account_id, reference_code, kind, subject, answers, application_id)
            VALUES (${accountId}::uuid, ${referenceCode()}, ${input.kind},
                    ${JSON.stringify(input.subject)}::jsonb,
                    ${JSON.stringify(input.answers)}::jsonb,
                    ${input.applicationId}::uuid)
            RETURNING id, reference_code
          ),
          opening AS (
            INSERT INTO enquiry_messages (enquiry_id, author, body)
            SELECT id, 'applicant', ${input.message}::text
            FROM created WHERE ${input.message}::text IS NOT NULL
          ),
          ack AS (
            INSERT INTO enquiry_messages (enquiry_id, author, body)
            SELECT id, 'system', ${systemLine} FROM created
          ),
          note AS (
            INSERT INTO outbox (topic, payload, dedupe_key)
            SELECT 'enquiry.created',
                   jsonb_build_object('enquiryId', c.id, 'referenceCode', c.reference_code,
                                      'kind', ${input.kind}),
                   'enquiry.created:' || c.id::text
            FROM created c
          )
          SELECT id FROM created`) as Row[];
        return rows.length ? (rows[0].id as string) : null;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  });

  if (!createdId) return null;
  return getEnquiry(accountId, createdId);
}

// ── Reading ──────────────────────────────────────────────────────────────────

export async function getEnquiry(accountId: string, enquiryId: string): Promise<Enquiry | null> {
  if (!isUuid(accountId) || !isUuid(enquiryId)) return null;
  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT e.id, e.reference_code, e.kind, e.state, e.subject, e.answers,
             e.application_id, e.created_at, e.updated_at,
             COALESCE(m.messages, '[]'::json) AS messages,
             COALESCE(m.n, 0) AS message_count,
             m.last_message
      FROM enquiries e
      LEFT JOIN LATERAL (
        SELECT json_agg(x ORDER BY x.id) AS messages, count(*) AS n,
               (SELECT row_to_json(y) FROM (
                  SELECT id, author, body, at FROM enquiry_messages
                  WHERE enquiry_id = e.id ORDER BY id DESC LIMIT 1) y) AS last_message
        FROM (
          SELECT id, author, body, at FROM enquiry_messages WHERE enquiry_id = e.id
        ) x
      ) m ON TRUE
      WHERE e.id = ${enquiryId}::uuid AND e.account_id = ${accountId}::uuid
      LIMIT 1`) as Row[];
    return rows.length ? rowToEnquiry(rows[0]) : null;
  });
}

/** Newest first. Without the thread - a list row shows the subject, the state
 *  and the last thing said, and shipping every message of every thread to draw
 *  that is how a list becomes the slowest screen in the app. */
export async function listEnquiries(accountId: string): Promise<EnquirySummary[]> {
  if (!isUuid(accountId)) return [];
  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT e.id, e.reference_code, e.kind, e.state, e.subject,
             e.application_id, e.created_at, e.updated_at,
             (SELECT count(*) FROM enquiry_messages mm WHERE mm.enquiry_id = e.id) AS message_count,
             (SELECT row_to_json(y) FROM (
                SELECT id, author, body, at FROM enquiry_messages
                WHERE enquiry_id = e.id ORDER BY id DESC LIMIT 1) y) AS last_message
      FROM enquiries e
      WHERE e.account_id = ${accountId}::uuid
      ORDER BY e.updated_at DESC`) as Row[];
    return rows.map(rowToSummary);
  });
}

// ── Writing into the thread ──────────────────────────────────────────────────

export type AddMessageResult =
  | { ok: true; enquiry: Enquiry }
  | { ok: false; reason: "not_found" };

/** Appends the person's message and hands the turn back to Earth Visa.
 *
 *  A message on a `replied` or `closed` enquiry moves it to `in_progress`: the
 *  person has said something new, and a closed thread they are still writing in
 *  is not closed. On `new` it stays `new` - nobody has read it yet either way.
 *
 *  One statement: the ownership check is the INSERT's own SELECT, and the state
 *  change, the outbox row and the insert all happen or none do. */
export async function addMessage(
  accountId: string,
  enquiryId: string,
  body: string,
): Promise<AddMessageResult> {
  if (!isUuid(accountId) || !isUuid(enquiryId)) return { ok: false, reason: "not_found" };

  const inserted = await writeQuery(async (sql) => {
    const rows = (await sql`
      WITH target AS (
        SELECT id FROM enquiries
        WHERE id = ${enquiryId}::uuid AND account_id = ${accountId}::uuid
      ),
      msg AS (
        INSERT INTO enquiry_messages (enquiry_id, author, body)
        SELECT id, 'applicant', ${body} FROM target
        RETURNING enquiry_id
      ),
      moved AS (
        UPDATE enquiries e
        SET state = CASE WHEN e.state IN ('replied', 'closed') THEN 'in_progress' ELSE e.state END,
            updated_at = NOW()
        WHERE e.id IN (SELECT enquiry_id FROM msg)
        RETURNING e.id, e.reference_code
      ),
      note AS (
        INSERT INTO outbox (topic, payload)
        SELECT 'enquiry.message',
               jsonb_build_object('enquiryId', m.id, 'referenceCode', m.reference_code)
        FROM moved m
      )
      SELECT id FROM moved`) as Row[];
    return rows.length > 0;
  });

  if (!inserted) return { ok: false, reason: "not_found" };
  const enquiry = await getEnquiry(accountId, enquiryId);
  return enquiry ? { ok: true, enquiry } : { ok: false, reason: "not_found" };
}
