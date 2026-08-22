import { makeSql, type Sql } from "@/lib/db";
import { randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Filing store - Postgres, via the shared wire-protocol client in lib/db.
//
// Backs the iOS app's application flow: start a draft, answer the form, attach
// documents, hand it to an operator. Schema is created by
// scripts/init-filing-db.mjs; read that file before changing anything here,
// because most of the rules this module relies on are enforced there and the
// comments explaining WHY live next to the constraints.
//
// Three facts from the schema shape every function below:
//
//   1. Filing is OPERATOR-FILED. `submitted` means a human filed it on the
//      government portal, and nothing an applicant does can cause that state.
//      The applicant's "submit" is `ready` - complete, waiting on an operator.
//      Getting this wrong would have the app announce a submission that had
//      not happened.
//   2. Forms are DATA. `form_version_id` is pinned at draft creation and the
//      row is immutable once published, so the questions cannot change under
//      someone half-way through.
//   3. PAYMENT IS DEFERRED. `quoted_govt_fee_minor` and
//      `quoted_service_fee_minor` are copied from the corridor at draft time so
//      the price cannot move mid-application, and NOTHING here writes to
//      `payments`, `refunds` or `ledger_entries`. The seam is marked in
//      submitApplication; the capture path is deliberately absent.
//
// THE CONCURRENCY RULE, which is the reason most of these queries look the way
// they do: every state transition is ONE conditional UPDATE whose WHERE clause
// carries both the ownership check and the expected current state. A zero-row
// result means the row is not yours, does not exist, or somebody else moved it
// first - and the caller must treat that as having LOST, not as a reason to
// read the row and try again. There is no read-then-write anywhere in this
// file, because read-then-write is how one application gets submitted twice.
//
// The multi-table writes are single statements with data-modifying CTEs rather
// than transactions, and that is not a style preference. `makeSql()` runs each
// call through `Pool.query`, which checks out a connection per call, so BEGIN
// and COMMIT issued through it can land on different connections and guarantee
// nothing. A CTE statement runs in one implicit transaction on one connection,
// which is the only atomicity this interface can actually deliver.
//
// Authorization is `account_id` on every single query, including the ones that
// look like plain reads. There is no lookup by id alone anywhere in this file;
// the moment one exists, it is an IDOR onto someone else's passport details.
// ─────────────────────────────────────────────────────────────────────────────

export class FilingStoreUnavailableError extends Error {}

let sqlClient: Sql | null = null;
function db(): Sql {
  if (!process.env.DATABASE_URL) throw new FilingStoreUnavailableError("DATABASE_URL is not set");
  if (!sqlClient) sqlClient = makeSql();
  return sqlClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

async function writeQuery<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await fn(db());
  } catch (err) {
    if (err instanceof FilingStoreUnavailableError) throw err;
    throw new FilingStoreUnavailableError(
      err instanceof Error ? err.message : "database write failed",
    );
  }
}

// ── Shapes ───────────────────────────────────────────────────────────────────

/** The ten states in the schema's CHECK constraint, in the order they occur. */
export type ApplicationState =
  | "draft"
  | "collecting"
  | "ready"
  | "submitted"
  | "in_progress"
  | "blocked"
  | "approved"
  | "refused"
  | "outcome_unknown"
  | "withdrawn";

/** The states in which an applicant may still change the application.
 *
 *  Everything from `ready` onwards is somebody else's to move: an operator is
 *  either about to file it or has already filed it, and an answer changing
 *  underneath them means the form we prepared is not the form we submitted.
 *
 *  A plain `string[]`, because it is passed as a bound parameter to
 *  `= ANY($n::text[])` and node-postgres needs a mutable array to encode. */
const EDITABLE_STATES: string[] = ["draft", "collecting"];

export type UploadScanState = "pending" | "clean" | "infected" | "failed";

export interface CorridorSummary {
  id: string;
  residenceIso3: string;
  destinationIso3: string;
  visaProductId: string;
  visaType: string;
  displayName: string;
  channel: "eta" | "e_visa" | "embassy" | "vfs";
  /** Who actually pays the government. Phase 1 is always "applicant". */
  govtFeePaidBy: "applicant" | "earthvisa";
  /** Official refusal rate in basis points, where a government publishes one. */
  refusalRateBp: number | null;
  processingDaysP50: number | null;
}

export interface FormVersionRef {
  id: string;
  version: number;
  /** Over the two schemas, so the client can cache a form by identity and
   *  notice a truncated download instead of rendering half a form. */
  checksum: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

export interface DocumentRecord {
  id: string;
  kind: string;
  requirementId: string | null;
  contentType: string;
  byteSize: number;
  scanState: UploadScanState;
  uploadedAt: string | null;
  createdAt: string;
}

export interface ApplicationSummary {
  id: string;
  /** The code a person reads out to support. NOT a capability: every query in
   *  this file is scoped by account_id, so knowing a code grants nothing. */
  referenceCode: string;
  state: ApplicationState;
  attemptNo: number;
  corridor: CorridorSummary;
  /** Minor units, always integers. Quoted at draft time and never recomputed,
   *  because a total that moves between the screen that quoted it and the
   *  screen that confirms it is the complaint, not the product. */
  quotedGovtFeeMinor: number;
  quotedServiceFeeMinor: number;
  quotedCurrency: string;
  intendedEntryAt: string | null;
  documentCount: number;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One row of the timeline, as the app draws it.
 *
 *  `status_events` is the truth and `applications.state` is a cache of the fold
 *  over it (see the schema), so this is the ONLY honest account of what happened
 *  to an application and when. The app renders every row with who recorded it:
 *  "Earth Visa filed this" and "the government approved this" are claims of
 *  very different weight, and `actorType` is how the screen tells them apart. */
export interface StatusEventRecord {
  /** BIGINT identity, as a string - see `int()` for why BIGINT arrives as a
   *  string; here it is an identifier rather than a quantity, so it stays one. */
  id: string;
  kind: "transition" | "note" | "document" | "payment" | "contact" | "system";
  fromState: ApplicationState | null;
  toState: ApplicationState | null;
  actorType: "applicant" | "operator" | "system";
  summary: string;
  detail: Record<string, unknown>;
  at: string;
}

export interface Application extends ApplicationSummary {
  answers: Record<string, unknown>;
  form: FormVersionRef;
  documents: DocumentRecord[];
  /** Oldest first, in insertion order (by id, not timestamp - the schema says
   *  why: several rows can share one NOW()). */
  events: StatusEventRecord[];
}

// ── Row mapping ──────────────────────────────────────────────────────────────

/** BIGINT arrives from node-postgres as a STRING, because an int8 does not fit
 *  a JS number in general. Money in minor units does - paise up to 2^53 is more
 *  rupees than this company will ever see - so these are converted here, once,
 *  rather than leaking a string that silently concatenates when something adds
 *  two of them together. */
const int = (v: unknown): number => Number(v ?? 0);

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

/** DATE columns must NOT go through `new Date().toISOString()`: that reads a
 *  bare date as UTC midnight and hands back a timestamp, which in the app's own
 *  timezone renders as the previous day. node-postgres gives us a Date at local
 *  midnight for a DATE column, so the calendar parts are taken directly. */
function dateOnly(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function rowToCorridor(r: Row): CorridorSummary {
  return {
    id: r.corridor_id,
    residenceIso3: r.residence_iso3,
    destinationIso3: r.destination_iso3,
    visaProductId: r.visa_product_id,
    visaType: r.visa_type,
    displayName: r.display_name,
    channel: r.channel,
    govtFeePaidBy: r.govt_fee_paid_by,
    refusalRateBp: r.refusal_rate_bp == null ? null : Number(r.refusal_rate_bp),
    processingDaysP50: r.processing_days_p50 == null ? null : Number(r.processing_days_p50),
  };
}

function rowToSummary(r: Row): ApplicationSummary {
  return {
    id: r.id,
    referenceCode: r.reference_code,
    state: r.state,
    attemptNo: Number(r.attempt_no),
    corridor: rowToCorridor(r),
    quotedGovtFeeMinor: int(r.quoted_govt_fee_minor),
    quotedServiceFeeMinor: int(r.quoted_service_fee_minor),
    quotedCurrency: r.quoted_currency,
    intendedEntryAt: dateOnly(r.intended_entry_at),
    documentCount: int(r.document_count),
    submittedAt: iso(r.submitted_at),
    decidedAt: iso(r.decided_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function rowToApplication(r: Row): Application {
  return {
    ...rowToSummary(r),
    answers: (r.answers ?? {}) as Record<string, unknown>,
    form: {
      id: r.form_version_id,
      version: Number(r.form_version),
      checksum: r.form_checksum,
      jsonSchema: r.json_schema as Record<string, unknown>,
      uiSchema: r.ui_schema as Record<string, unknown>,
    },
    documents: ((r.documents ?? []) as Row[]).map((d) => ({
      id: d.id,
      kind: d.kind,
      requirementId: d.requirement_id ?? null,
      contentType: d.content_type,
      byteSize: int(d.byte_size),
      scanState: d.scan_state,
      uploadedAt: iso(d.uploaded_at),
      createdAt: iso(d.created_at)!,
    })),
    events: ((r.events ?? []) as Row[]).map((e) => ({
      id: String(e.id),
      kind: e.kind,
      fromState: e.from_state ?? null,
      toState: e.to_state ?? null,
      actorType: e.actor_type,
      summary: e.summary,
      detail: (e.detail ?? {}) as Record<string, unknown>,
      at: iso(e.at)!,
    })),
  };
}

// ── Identifiers ──────────────────────────────────────────────────────────────

/** Guards every id that reaches a `::uuid` cast.
 *
 *  Postgres raises 22P02 on a malformed uuid, `writeQuery` would wrap that into
 *  FilingStoreUnavailableError, and the route would answer 503 - telling the
 *  caller our database is down because they typed a bad id. A non-uuid simply
 *  is not a row we have, so it is a miss. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** Crockford-ish alphabet: no 0/O, no 1/I/L, no U. This code gets read down a
 *  phone line to support, and every excluded character is one that gets read
 *  back wrong.
 *
 *  It is NOT a secret and carries no authority - authorization is always the
 *  account_id on the query - so the only property that matters is that
 *  collisions are rare, and the unique index catches the ones that are not. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function referenceCode(): string {
  const n = CODE_ALPHABET.length;
  // Rejection sampling. 256 is not a multiple of 30, so plain modulo would make
  // the first sixteen letters slightly likelier; cheap to avoid, so avoid it.
  const limit = 256 - (256 % n);
  const out: string[] = [];
  while (out.length < 8) {
    for (const b of randomBytes(16)) {
      if (b >= limit) continue;
      out.push(CODE_ALPHABET[b % n]);
      if (out.length === 8) break;
    }
  }
  return `EV-${out.slice(0, 4).join("")}-${out.slice(4).join("")}`;
}

/** Postgres unique-violation. The reference code is the only place we insert a
 *  value that can collide by chance rather than by a caller's mistake. */
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

// ── Creating a draft ─────────────────────────────────────────────────────────

export interface CreateDraftInput {
  residenceIso3: string;
  destinationIso3: string;
  visaProductId: string;
  /** YYYY-MM-DD, or null. Document constraints are evaluated against this, not
   *  against upload time: a bank statement valid today can be stale on the
   *  appointment date. */
  intendedEntryAt?: string | null;
}

export type CreateDraftResult =
  | { ok: true; application: Application }
  | { ok: false; reason: "corridor_unavailable" };

/** Starts an application, pinning both the price and the form.
 *
 *  One statement. The corridor lookup, the published-form lookup, the insert and
 *  the opening timeline event either all happen or none do; a draft that exists
 *  with no `status_events` row would be an application with no beginning, and
 *  the timeline the app draws is a projection of that table.
 *
 *  `is_open` is part of the corridor lookup rather than a check afterwards. A
 *  corridor exists in the dataset long before it is legally cleared, and the
 *  five regulated destinations (OISC, MARA, US UPL, ICCRC, IAA) must be
 *  unreachable by construction, not by a conditional someone can forget. */
export async function createDraft(
  accountId: string,
  input: CreateDraftInput,
): Promise<CreateDraftResult> {
  if (!isUuid(accountId)) return { ok: false, reason: "corridor_unavailable" };

  const createdId = await writeQuery(async (sql) => {
    // Retried only for a reference-code collision, which is a chance event at
    // roughly 30^8 and not a condition the caller can provoke. Any other error
    // propagates on the first attempt rather than being tried three times.
    for (let attempt = 0; ; attempt++) {
      try {
        const rows = (await sql`
          WITH corridor AS (
            SELECT c.id, c.govt_fee_minor, c.service_fee_minor, c.currency
            FROM corridors c
            WHERE c.residence_iso3 = ${input.residenceIso3}
              AND c.destination_iso3 = ${input.destinationIso3}
              AND c.visa_product_id = ${input.visaProductId}
              AND c.is_open
          ),
          form AS (
            SELECT f.id, f.corridor_id
            FROM form_versions f
            JOIN corridor c ON c.id = f.corridor_id
            WHERE f.status = 'published'
          ),
          created AS (
            INSERT INTO applications (
              account_id, corridor_id, form_version_id, reference_code,
              quoted_govt_fee_minor, quoted_service_fee_minor, quoted_currency,
              intended_entry_at
            )
            SELECT ${accountId}::uuid, c.id, f.id, ${referenceCode()},
                   c.govt_fee_minor, c.service_fee_minor, c.currency,
                   ${input.intendedEntryAt ?? null}::date
            FROM corridor c JOIN form f ON f.corridor_id = c.id
            RETURNING *
          ),
          ev AS (
            INSERT INTO status_events (
              application_id, kind, to_state, actor_type, actor_id, summary
            )
            SELECT id, 'transition', 'draft', 'applicant', ${accountId}::uuid,
                   'Application started'
            FROM created
          )
          SELECT id FROM created`) as Row[];

        // No open corridor, or no published form for it. Both are "we do not
        // file this yet" and neither is the caller's error to fix.
        return rows.length ? (rows[0].id as string) : null;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  });

  if (!createdId) return { ok: false, reason: "corridor_unavailable" };

  // Read back through the one query that knows how to assemble an Application.
  // A plain read after an already-committed insert, not a read-then-write:
  // nothing above depends on what comes back.
  const application = await getApplication(accountId, createdId);
  return application
    ? { ok: true, application }
    : { ok: false, reason: "corridor_unavailable" };
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** Fetches one application, WITH the form schemas the renderer needs and the
 *  documents attached to it.
 *
 *  Scoped to the owning account, and returns null identically for "does not
 *  exist" and "is not yours". Distinguishing them would turn this endpoint into
 *  an oracle for whether an id is real. */
export async function getApplication(
  accountId: string,
  applicationId: string,
): Promise<Application | null> {
  if (!isUuid(accountId) || !isUuid(applicationId)) return null;

  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT
        a.id, a.reference_code, a.state, a.attempt_no, a.answers,
        a.quoted_govt_fee_minor, a.quoted_service_fee_minor, a.quoted_currency,
        a.intended_entry_at, a.submitted_at, a.decided_at, a.created_at, a.updated_at,
        a.corridor_id, a.form_version_id,
        c.residence_iso3, c.destination_iso3, c.visa_product_id, c.visa_type,
        c.display_name, c.channel, c.govt_fee_paid_by, c.refusal_rate_bp,
        c.processing_days_p50,
        fv.version AS form_version, fv.checksum AS form_checksum,
        fv.json_schema, fv.ui_schema,
        COALESCE(d.docs, '[]'::json) AS documents,
        COALESCE(d.n, 0) AS document_count,
        COALESCE(ev.events, '[]'::json) AS events
      FROM applications a
      JOIN corridors c ON c.id = a.corridor_id
      JOIN form_versions fv ON fv.id = a.form_version_id
      LEFT JOIN LATERAL (
        SELECT json_agg(x ORDER BY x.created_at) AS docs, count(*) AS n
        FROM (
          SELECT id, kind, requirement_id, content_type, byte_size,
                 scan_state, uploaded_at, created_at
          FROM documents WHERE application_id = a.id
        ) x
      ) d ON TRUE
      LEFT JOIN LATERAL (
        -- ORDER BY id, not at: the schema's own note says several rows can
        -- share one NOW(), and the timeline must read in the order things
        -- happened. actor_id is deliberately not selected - it is an
        -- operator's account id and the applicant has no business seeing it.
        SELECT json_agg(y ORDER BY y.id) AS events
        FROM (
          SELECT id, kind, from_state, to_state, actor_type, summary, detail, at
          FROM status_events WHERE application_id = a.id
        ) y
      ) ev ON TRUE
      WHERE a.id = ${applicationId}::uuid AND a.account_id = ${accountId}::uuid
      LIMIT 1`) as Row[];
    return rows.length ? rowToApplication(rows[0]) : null;
  });
}

/** Everything this account has, newest first - the app's list screen, and the
 *  single most-run query in the product (`applications_by_account` exists for
 *  it).
 *
 *  Deliberately WITHOUT the form schemas. A JSON Schema plus a UI schema is
 *  tens of kilobytes, it is identical for every application on the same
 *  corridor, and shipping N copies of it to draw a list of rows that show a
 *  destination and a state is how a list screen becomes the slowest thing in
 *  the app. */
export async function listApplications(accountId: string): Promise<ApplicationSummary[]> {
  if (!isUuid(accountId)) return [];

  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT
        a.id, a.reference_code, a.state, a.attempt_no,
        a.quoted_govt_fee_minor, a.quoted_service_fee_minor, a.quoted_currency,
        a.intended_entry_at, a.submitted_at, a.decided_at, a.created_at, a.updated_at,
        a.corridor_id,
        c.residence_iso3, c.destination_iso3, c.visa_product_id, c.visa_type,
        c.display_name, c.channel, c.govt_fee_paid_by, c.refusal_rate_bp,
        c.processing_days_p50,
        (SELECT count(*) FROM documents dd WHERE dd.application_id = a.id) AS document_count
      FROM applications a
      JOIN corridors c ON c.id = a.corridor_id
      WHERE a.account_id = ${accountId}::uuid
      ORDER BY a.created_at DESC`) as Row[];
    return rows.map(rowToSummary);
  });
}

// ── Answering the form ───────────────────────────────────────────────────────

export type SaveAnswersResult =
  | { ok: true; application: Application }
  | { ok: false; reason: "not_found" | "not_editable" };

/** Merges a patch into the answers and, on the first save, moves the
 *  application from `draft` to `collecting`.
 *
 *  The merge is `answers || patch`, done BY POSTGRES, at the TOP LEVEL ONLY.
 *
 *  Server-side merge because the alternative is read-modify-write in the app:
 *  two devices saving different sections would each write back a whole answers
 *  blob built from what they last read, and the second one would silently erase
 *  the first one's section. With `||`, disjoint sections both land and no
 *  version token is needed to make that safe.
 *
 *  Top level only, which the client has to know: sending
 *  `{"traveller": {"givenName": "A"}}` REPLACES the whole `traveller` object
 *  rather than merging into it. So a section is always sent complete. A deep
 *  merge was the alternative and is worse: there would then be no way to clear
 *  a field, because an absent key and a cleared key become the same request.
 *
 *  One statement, one conditional UPDATE. Zero rows means not yours, gone, or
 *  no longer editable, and the caller must not "fix" that by reading and
 *  retrying. */
export async function saveAnswers(
  accountId: string,
  applicationId: string,
  patch: Record<string, unknown>,
): Promise<SaveAnswersResult> {
  if (!isUuid(accountId) || !isUuid(applicationId)) {
    return { ok: false, reason: "not_found" };
  }

  const updated = await writeQuery(async (sql) => {
    const rows = (await sql`
      WITH before AS (
        SELECT id, state FROM applications
        WHERE id = ${applicationId}::uuid AND account_id = ${accountId}::uuid
      ),
      saved AS (
        UPDATE applications a
        SET answers = a.answers || ${JSON.stringify(patch)}::jsonb,
            state = CASE WHEN a.state = 'draft' THEN 'collecting' ELSE a.state END,
            updated_at = NOW()
        WHERE a.id = ${applicationId}::uuid
          AND a.account_id = ${accountId}::uuid
          AND a.state = ANY(${EDITABLE_STATES as unknown as string[]}::text[])
        RETURNING a.id
      ),
      ev AS (
        INSERT INTO status_events (
          application_id, kind, from_state, to_state, actor_type, actor_id, summary
        )
        SELECT s.id, 'transition', 'draft', 'collecting', 'applicant', ${accountId}::uuid,
               'Started filling the form'
        FROM saved s JOIN before b ON b.id = s.id
        WHERE b.state = 'draft'
      )
      SELECT id FROM saved`) as Row[];
    return rows.length > 0;
  });

  if (updated) {
    const application = await getApplication(accountId, applicationId);
    // A delete racing this save is the only way the row can vanish between the
    // update and the re-read, and "gone" is the honest answer to that.
    return application
      ? { ok: true, application }
      : { ok: false, reason: "not_found" };
  }

  // The UPDATE already decided. This read only NAMES the failure so the route
  // can answer 404 or 409 instead of a shrug - it never retries the write, and
  // nothing is re-derived from it.
  const existing = await getApplication(accountId, applicationId);
  return { ok: false, reason: existing ? "not_editable" : "not_found" };
}

// ── Documents ────────────────────────────────────────────────────────────────

export interface RecordDocumentInput {
  /** What this is, in our vocabulary: "passport_bio_page", "photo", and so on.
   *  Free text in the schema because the requirement list is per-corridor data,
   *  not an enum somebody has to migrate to add a country. */
  kind: string;
  /** Which requirement in the form's checklist this fills, when it fills one. */
  requirementId?: string | null;
  bucket: string;
  key: string;
  contentType: string;
  byteSize: number;
}

export type RecordDocumentResult =
  | { ok: true; document: DocumentRecord }
  | { ok: false; reason: "not_found" | "not_editable" };

/** Records the pending document row for an upload that is about to happen.
 *
 *  THE BYTES NEVER COME HERE. This row is a pointer and a provenance record;
 *  the phone PUTs straight to the quarantine bucket with a presigned URL, so
 *  there is no passport scan in a Postgres backup and nothing for this server
 *  to buffer.
 *
 *  The insert is guarded by a SELECT over `applications` that carries the
 *  ownership and state check, so a caller who does not own the application
 *  inserts nothing. That ordering matters to the route: it must call this
 *  BEFORE it signs anything, so an upload URL is only ever minted after the
 *  database has confirmed, in the same statement that wrote the row, that this
 *  account owns this application.
 *
 *  `scan_state` starts at 'pending' and only the scanner may move it. The row
 *  existing is not a claim that the object exists, let alone that it is clean. */
export async function recordDocument(
  accountId: string,
  applicationId: string,
  input: RecordDocumentInput,
): Promise<RecordDocumentResult> {
  if (!isUuid(accountId) || !isUuid(applicationId)) {
    return { ok: false, reason: "not_found" };
  }

  const inserted = await writeQuery(async (sql) => {
    const rows = (await sql`
      WITH target AS (
        SELECT id FROM applications
        WHERE id = ${applicationId}::uuid
          AND account_id = ${accountId}::uuid
          AND state = ANY(${EDITABLE_STATES as unknown as string[]}::text[])
      ),
      created AS (
        INSERT INTO documents (
          application_id, kind, requirement_id, s3_bucket, s3_key,
          content_type, byte_size
        )
        SELECT t.id, ${input.kind}, ${input.requirementId ?? null},
               ${input.bucket}, ${input.key}, ${input.contentType}, ${input.byteSize}
        FROM target t
        RETURNING *
      ),
      ev AS (
        INSERT INTO status_events (
          application_id, kind, actor_type, actor_id, summary, detail
        )
        SELECT c.application_id, 'document', 'applicant', ${accountId}::uuid,
               'Upload requested',
               jsonb_build_object('documentId', c.id, 'kind', c.kind,
                                  'requirementId', c.requirement_id)
        FROM created c
      )
      SELECT id, kind, requirement_id, content_type, byte_size, scan_state,
             uploaded_at, created_at
      FROM created`) as Row[];
    return rows.length ? rows[0] : null;
  });

  if (!inserted) {
    const existing = await getApplication(accountId, applicationId);
    return { ok: false, reason: existing ? "not_editable" : "not_found" };
  }

  return {
    ok: true,
    document: {
      id: inserted.id,
      kind: inserted.kind,
      requirementId: inserted.requirement_id ?? null,
      contentType: inserted.content_type,
      byteSize: int(inserted.byte_size),
      scanState: inserted.scan_state,
      uploadedAt: iso(inserted.uploaded_at),
      createdAt: iso(inserted.created_at)!,
    },
  };
}

// ── Handing it over ──────────────────────────────────────────────────────────

export type SubmitResult =
  | { ok: true; application: Application }
  | { ok: false; reason: "not_found" | "not_editable" };

/** The applicant's "I am done": moves the application to `ready`.
 *
 *  NOT to `submitted`. `submitted` means a human filed it on the government
 *  portal, it sets `submitted_at`, and no applicant action can cause it - the
 *  schema's CHECK constraint enforces the timestamp, and an app that announced
 *  "submitted" here would be telling people their visa application had been
 *  filed when it was sitting in a queue.
 *
 *  One conditional UPDATE guarded on the editable states, so a double-tap over
 *  a slow Indian mobile connection moves the row once and the second call gets
 *  zero rows. The outbox row goes in the same statement, because that is the
 *  only way the operator is guaranteed to hear about work that exists: sending
 *  inline would let the notification succeed while the transaction rolled back,
 *  or the reverse - an application moved with nobody told. Its `dedupe_key`
 *  makes a second announcement of the same event impossible even if a producer
 *  runs twice.
 *
 *  ── THE PAYMENT SEAM ──
 *  This is where a charge would go, and it is deliberately not here. Collecting
 *  the government fee bundled with our service fee likely puts Earth Visa inside
 *  RBI's payment-aggregator perimeter, an authorisation we do not hold. The two
 *  quoted_* amounts are already pinned on the row and the `payments` table
 *  already has the right shape, so the day that changes it is an insert on this
 *  statement - not a migration, and not a redesign of this transition. */
export async function submitApplication(
  accountId: string,
  applicationId: string,
): Promise<SubmitResult> {
  if (!isUuid(accountId) || !isUuid(applicationId)) {
    return { ok: false, reason: "not_found" };
  }

  const moved = await writeQuery(async (sql) => {
    const rows = (await sql`
      WITH before AS (
        SELECT id, state FROM applications
        WHERE id = ${applicationId}::uuid AND account_id = ${accountId}::uuid
      ),
      moved AS (
        UPDATE applications a
        SET state = 'ready', updated_at = NOW()
        WHERE a.id = ${applicationId}::uuid
          AND a.account_id = ${accountId}::uuid
          AND a.state = ANY(${EDITABLE_STATES as unknown as string[]}::text[])
        RETURNING a.id, a.reference_code
      ),
      ev AS (
        INSERT INTO status_events (
          application_id, kind, from_state, to_state, actor_type, actor_id, summary
        )
        SELECT m.id, 'transition', b.state, 'ready', 'applicant', ${accountId}::uuid,
               'Sent to Earth Visa for filing'
        FROM moved m JOIN before b ON b.id = m.id
      ),
      note AS (
        INSERT INTO outbox (topic, payload, application_id, dedupe_key)
        SELECT 'application.ready',
               jsonb_build_object('applicationId', m.id,
                                  'referenceCode', m.reference_code),
               m.id,
               'application.ready:' || m.id::text
        FROM moved m
      )
      SELECT id FROM moved`) as Row[];
    return rows.length > 0;
  });

  if (!moved) {
    const existing = await getApplication(accountId, applicationId);
    return { ok: false, reason: existing ? "not_editable" : "not_found" };
  }

  const application = await getApplication(accountId, applicationId);
  return application ? { ok: true, application } : { ok: false, reason: "not_found" };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export interface StatusEventInput {
  kind: "transition" | "note" | "document" | "payment" | "contact" | "system";
  fromState?: ApplicationState | null;
  toState?: ApplicationState | null;
  actorType: "applicant" | "operator" | "system";
  actorId?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
}

/** Appends to the timeline.
 *
 *  `status_events` is the truth and `applications.state` is a cache of the fold
 *  over it, so this table is append-only and the database enforces that with a
 *  trigger: an UPDATE raises. Correct a mistake by appending the correction.
 *
 *  Every transition in this file already writes its own event inside the same
 *  statement as the state change - that is the point of the CTEs, and it is why
 *  a state can never exist without the event that produced it. This export is
 *  for the events that are NOT transitions: an operator's note, a contact
 *  attempt, a scanner result. It deliberately does not touch `state`, because a
 *  function that could write an event and a state separately is the seam
 *  through which the two drift apart. */
export async function appendStatusEvent(
  applicationId: string,
  event: StatusEventInput,
): Promise<boolean> {
  if (!isUuid(applicationId)) return false;
  if (event.kind === "transition" && !event.toState) {
    // The schema's CHECK says the same thing; failing here names it properly
    // instead of surfacing a constraint violation as a 503.
    throw new FilingStoreUnavailableError("a transition event needs a to_state");
  }

  return writeQuery(async (sql) => {
    const rows = (await sql`
      INSERT INTO status_events (
        application_id, kind, from_state, to_state, actor_type, actor_id,
        summary, detail
      )
      SELECT ${applicationId}::uuid, ${event.kind}, ${event.fromState ?? null},
             ${event.toState ?? null}, ${event.actorType},
             ${event.actorId ?? null}::uuid, ${event.summary},
             ${JSON.stringify(event.detail ?? {})}::jsonb
      WHERE EXISTS (SELECT 1 FROM applications WHERE id = ${applicationId}::uuid)
      RETURNING id`) as Row[];
    return rows.length > 0;
  });
}

/** Every corridor Earth Visa can actually file, with what it costs.
 *
 *  Public and cacheable: the app asks once at launch so it knows where to offer
 *  filing at all. Offering it everywhere and failing at `createDraft` would put
 *  a "we can do this for you" button on 198 destinations where the honest
 *  answer is no.
 *
 *  Returns the open ones only. `is_open` defaults to false precisely so that
 *  importing a corridor never puts it on sale, and this query is where that
 *  default does its work. */
export async function openCorridors(): Promise<(CorridorSummary & {
  govtFeeMinor: number; serviceFeeMinor: number; currency: string;
})[]> {
  return writeQuery(async (sql) => {
    const rows = (await sql`
      SELECT id AS corridor_id, residence_iso3, destination_iso3, visa_product_id,
             visa_type, display_name, channel, govt_fee_paid_by, refusal_rate_bp,
             processing_days_p50, govt_fee_minor, service_fee_minor, currency
      FROM corridors
      WHERE is_open
        AND EXISTS (SELECT 1 FROM form_versions f
                    WHERE f.corridor_id = corridors.id AND f.status = 'published')
      ORDER BY display_name`) as Row[];
    // The EXISTS is not belt-and-braces. An open corridor with no published
    // form takes a draft and then has no questions to ask, which surfaces to
    // the applicant as an empty screen rather than as the configuration
    // mistake it is.
    return rows.map((r) => ({
      ...rowToCorridor(r),
      govtFeeMinor: int(r.govt_fee_minor),
      serviceFeeMinor: int(r.service_fee_minor),
      currency: r.currency,
    }));
  });
}
