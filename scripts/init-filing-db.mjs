// Creates the filing schema: corridors, forms, applications, documents, money,
// audit. Idempotent: safe to re-run.
//
//   node scripts/init-filing-db.mjs
//
// Sits alongside the auth schema (scripts/init-auth-db.mjs) and depends on it:
// every application belongs to an accounts row. Kept in a separate script for
// the same reason auth is separate from Earthling - a mistake while editing one
// schema should not be able to reach the other.
//
// Three facts shape almost every decision below, so they are stated once here
// rather than repeated at each table:
//
//   1. Filing is OPERATOR-FILED. A human submits on the government portal.
//      There is no government API, so nothing in this schema may assume we can
//      read status back; we only ever record what a person told us.
//   2. Forms are DATA. 10,396 corridor x visa-type combinations make
//      hand-built screens impossible, so a form_versions row carries a JSON
//      Schema plus a UI schema and one generic renderer on iOS draws it.
//   3. PAYMENT IS DEFERRED. Collecting the government fee bundled with a
//      service fee likely puts us inside RBI's payment-aggregator perimeter.
//      The money tables exist so the seam is in the right place; no capture,
//      gateway call or checkout is built against them yet.
import { connect } from "./lib/db.mjs";

// .env.local loading and the DATABASE_URL check live in the shared helper.
const [sql, close] = await connect();

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

// Half of this schema hangs off accounts(id). Run against a database where the
// auth script has not run and the first foreign key fails with "relation
// accounts does not exist" - true, but it reads like a bug in this file rather
// than a missing prerequisite, and by then some tables already exist.
const [{ has_accounts: hasAccounts }] = await sql`
  SELECT to_regclass('public.accounts') IS NOT NULL AS has_accounts`;
if (!hasAccounts) {
  console.error("accounts table is missing - run scripts/init-auth-db.mjs first");
  await close();
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Append-only guard
// ─────────────────────────────────────────────────────────────────────────────

// status_events, ledger_entries and access_log are the three tables whose value
// is that they cannot be rewritten. "Append-only by convention" survives exactly
// until the first support ticket where correcting the row looks easier than
// appending the correction, and after that no answer to "what did we know, and
// when" is trustworthy again. So the database refuses.
//
// UPDATE only. DELETE is deliberately still allowed, because account deletion
// (App Store 5.1.1(v)) cascades through these tables and a blanket refusal
// would turn "we deleted everything" into a lie that fails loudly at the worst
// possible moment.
await sql`
  CREATE OR REPLACE FUNCTION filing_refuse_update() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION '% is append-only; correct it by appending, not by UPDATE', TG_TABLE_NAME;
  END
  $$`;

// ─────────────────────────────────────────────────────────────────────────────
// Config: what we can file, and what the form looks like
// ─────────────────────────────────────────────────────────────────────────────

// A corridor is (residence, destination, visa product) - residence, NOT
// nationality. Nationality decides whether a visa is needed; RESIDENCE decides
// which mission has jurisdiction, which centre takes biometrics and which
// document list applies. An Indian national living in Dubai applies under UAE
// rules at a Dubai centre, and keying this table on nationality would route
// them to the wrong process with no error anywhere.
//
// visa_product_id is our own minted identifier. It is not a name from the
// catalogue or from VFS: measured overlap between those two naming schemes is
// 25 of 3,275 pairs (0.8%), so any join on a source's name silently produces
// almost nothing and looks like missing data rather than a broken key.
//
// is_open defaults to FALSE. A corridor exists in the dataset long before it is
// legally cleared, and a default of true would put a regulated destination
// (OISC, MARA, US UPL) on sale the moment someone ran an import.
await sql`
  CREATE TABLE IF NOT EXISTS corridors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    residence_iso3         CHAR(3) NOT NULL CHECK (residence_iso3 ~ '^[A-Z]{3}$'),
    destination_iso3       CHAR(3) NOT NULL CHECK (destination_iso3 ~ '^[A-Z]{3}$'),
    visa_product_id        TEXT NOT NULL,
    visa_type              TEXT NOT NULL,
    display_name           TEXT NOT NULL,
    channel                TEXT NOT NULL CHECK (channel IN ('eta', 'e_visa', 'embassy', 'vfs')),
    govt_fee_minor         BIGINT NOT NULL CHECK (govt_fee_minor >= 0),
    service_fee_minor      BIGINT NOT NULL CHECK (service_fee_minor >= 0),
    currency               CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    govt_fee_paid_by       TEXT NOT NULL DEFAULT 'applicant'
                             CHECK (govt_fee_paid_by IN ('applicant', 'earthvisa')),
    refusal_rate_bp        INT CHECK (refusal_rate_bp BETWEEN 0 AND 10000),
    refusal_rate_source    TEXT,
    processing_days_p50    INT,
    is_open                BOOLEAN NOT NULL DEFAULT FALSE,
    closed_reason          TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
// The natural key, and the exact lookup the app makes when someone picks where
// they live and where they are going. Unique because two rows for one product
// would let two different prices be quoted for the same thing.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS corridors_product_key
    ON corridors (residence_iso3, destination_iso3, visa_product_id)`;
// The browse list only ever asks for open corridors out of one residence.
// Partial, because the closed rows are the overwhelming majority and never
// appear in that query.
await sql`
  CREATE INDEX IF NOT EXISTS corridors_open_by_residence
    ON corridors (residence_iso3, destination_iso3) WHERE is_open`;

// The form itself, as data. json_schema carries shape and validation; ui_schema
// carries order, grouping and conditionals. Two documents rather than one
// because the renderer needs layout it must not invent, and the validator needs
// rules that must not depend on layout.
//
// Rows are IMMUTABLE once published. Editing a published version in place would
// retroactively change the form an application was already validated against,
// which is the single failure this whole versioning scheme exists to prevent;
// a change is a new row with a higher version, always.
//
// checksum is over the two schemas. It is what lets the iOS client cache a form
// by identity and detect a tampered or truncated download, rather than
// rendering half a form and blaming the user for the missing fields.
await sql`
  CREATE TABLE IF NOT EXISTS form_versions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corridor_id  UUID NOT NULL REFERENCES corridors(id) ON DELETE RESTRICT,
    version      INT NOT NULL CHECK (version >= 1),
    status       TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'retired')),
    json_schema  JSONB NOT NULL,
    ui_schema    JSONB NOT NULL,
    checksum     TEXT NOT NULL,
    notes        TEXT,
    published_at TIMESTAMPTZ,
    retired_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status <> 'published' OR published_at IS NOT NULL)
  )`;
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS form_versions_corridor_version
    ON form_versions (corridor_id, version)`;
// Exactly one publishable form per corridor. Without this, two published
// versions make "the current form" a race decided by ORDER BY, and two people
// starting the same application on the same day get different questions.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS form_versions_one_published
    ON form_versions (corridor_id) WHERE status = 'published'`;

// ─────────────────────────────────────────────────────────────────────────────
// Applications
// ─────────────────────────────────────────────────────────────────────────────

// The state column is TEXT with a CHECK rather than an enum: adding a state to a
// Postgres enum is a migration that cannot run inside a transaction with other
// DDL in older versions, and removing one is worse. A CHECK is edited by
// dropping and re-adding a constraint, which is boring, and boring is the point
// for a list that will grow.
//
// The states, and why each earns its place:
//   draft            - form_version_id is already pinned here (see below)
//   collecting       - answers and documents arriving
//   ready            - complete, waiting on an operator
//   submitted        - a human filed it on the government portal
//   in_progress      - the government has it
//   blocked          - we need something from the applicant; requires an
//                      outbound channel, which is why email is mandatory
//   approved         - terminal
//   refused          - TERMINAL. Never reopened. A second attempt is a NEW row
//                      pointing back via parent_application_id, because the
//                      refusal history is the most decision-relevant fact in
//                      the category and overwriting the first attempt destroys
//                      exactly the record that mattered.
//   outcome_unknown  - TERMINAL, and it exists because we have no read access
//                      to government status. Approved customers go quiet;
//                      refused customers reply. Folding silence into 'approved'
//                      makes every statistic built on it refusal-biased.
//   withdrawn        - terminal, applicant pulled out
//
// state is a CACHE of the fold over status_events. status_events is the truth;
// this column exists so the operator queue does not have to replay a timeline
// per row to sort a list.
//
// The quoted_* columns pin price at draft time for the same reason
// form_version_id pins schema: corridors.service_fee_minor can change while
// someone is halfway through, and a total that moves between the screen that
// quoted it and the screen that charges it is the complaint, not the product.
await sql`
  CREATE TABLE IF NOT EXISTS applications (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id             UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    corridor_id            UUID NOT NULL REFERENCES corridors(id) ON DELETE RESTRICT,
    form_version_id        UUID NOT NULL REFERENCES form_versions(id) ON DELETE RESTRICT,
    parent_application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
    attempt_no             INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    reference_code         TEXT NOT NULL,
    state                  TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (
                             'draft', 'collecting', 'ready', 'submitted', 'in_progress',
                             'blocked', 'approved', 'refused', 'outcome_unknown', 'withdrawn'
                           )),
    answers                JSONB NOT NULL DEFAULT '{}'::jsonb,
    quoted_govt_fee_minor  BIGINT NOT NULL DEFAULT 0 CHECK (quoted_govt_fee_minor >= 0),
    quoted_service_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (quoted_service_fee_minor >= 0),
    quoted_currency        CHAR(3) NOT NULL CHECK (quoted_currency ~ '^[A-Z]{3}$'),
    intended_entry_at      DATE,
    appearance_at          TIMESTAMPTZ,
    appearance_tz          TEXT,
    government_reference   TEXT,
    submitted_at           TIMESTAMPTZ,
    decided_at             TIMESTAMPTZ,
    retention_delete_after TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (parent_application_id IS DISTINCT FROM id),
    CHECK ((attempt_no = 1) = (parent_application_id IS NULL)),
    CHECK (state NOT IN ('approved', 'refused', 'outcome_unknown') OR decided_at IS NOT NULL),
    CHECK (state NOT IN ('submitted', 'in_progress') OR submitted_at IS NOT NULL)
  )`;
// The code a person reads out on the phone to support. Unique because two
// applications answering to one code makes every support conversation ambiguous.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS applications_reference_code
    ON applications (reference_code)`;
// The app's own list screen: everything I have, newest first. This is the single
// most-run query in the product.
await sql`
  CREATE INDEX IF NOT EXISTS applications_by_account
    ON applications (account_id, created_at DESC)`;
// The operator queue. Partial on the live states because the terminal rows
// accumulate forever and are never in the work list; without the predicate this
// index grows without bound while answering a query that only ever wants the
// small live set.
await sql`
  CREATE INDEX IF NOT EXISTS applications_live_queue
    ON applications (state, updated_at)
    WHERE state IN ('ready', 'submitted', 'in_progress', 'blocked')`;
// Both FK parents are ON DELETE RESTRICT, and Postgres does not index the child
// side of a foreign key for you. Without these, retiring a corridor or a form
// version sequential-scans the whole applications table to prove it is safe.
await sql`CREATE INDEX IF NOT EXISTS applications_corridor ON applications (corridor_id)`;
await sql`CREATE INDEX IF NOT EXISTS applications_form_version ON applications (form_version_id)`;
// One re-application per refusal. A double-tap on "apply again" over a slow
// connection otherwise creates two live applications for the same refusal, and
// the second one is discovered only when someone is charged twice.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS applications_one_reattempt
    ON applications (parent_application_id) WHERE parent_application_id IS NOT NULL`;
// The retention job's only query. Retention is deadlined at SUBMISSION
// (processing time + grace), not at learning an outcome, because for a large
// share of applications we never learn one - see 'outcome_unknown'. Partial, so
// the job scans a queue rather than the table.
await sql`
  CREATE INDEX IF NOT EXISTS applications_retention_due
    ON applications (retention_delete_after)
    WHERE retention_delete_after IS NOT NULL`;

// ─────────────────────────────────────────────────────────────────────────────
// Applicants
// ─────────────────────────────────────────────────────────────────────────────

// One row per human on the application - a family files together, and a dual
// national is two passports, not an unrepresentable case.
//
// THERE IS NO PLAINTEXT PASSPORT NUMBER COLUMN, and there must never be one.
// passport_number_enc holds ciphertext produced by the app under a KMS-wrapped
// data key (alias/earthvisa-docs, ap-south-1); Postgres never sees the plaintext
// and never holds the key, so a database dump, a replica, a backup snapshot or a
// leaked read-only credential yields nothing.
//
// Ciphertext cannot be searched, and we still have to answer "is this passport
// already filing with us" - so passport_number_bidx is an HMAC of the normalised
// number under a server-held pepper. It is a lookup key and nothing else: equal
// values mean equal passports, and it reveals no digits.
//
// The two *_key_id columns are not bookkeeping. Rotating the pepper without
// recording which rows are on which version silently breaks every lookup written
// before the rotation, and there is no way afterwards to tell which rows those
// were; the same is true of the encryption key on restore.
//
// Names ARE stored in the clear, deliberately. The operator has to read them to
// file, an HMAC over a name is low-entropy enough to be reversed by guessing
// anyway, and pretending otherwise would buy nothing while making the console
// unusable.
await sql`
  CREATE TABLE IF NOT EXISTS applicants (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
    given_name            TEXT NOT NULL,
    family_name           TEXT NOT NULL,
    date_of_birth         DATE,
    nationality_iso3      CHAR(3) NOT NULL CHECK (nationality_iso3 ~ '^[A-Z]{3}$'),
    residence_iso3        CHAR(3) CHECK (residence_iso3 ~ '^[A-Z]{3}$'),
    passport_number_enc   BYTEA NOT NULL,
    passport_number_bidx  BYTEA NOT NULL,
    passport_enc_key_id   TEXT NOT NULL,
    passport_bidx_key_id  TEXT NOT NULL,
    passport_expiry       DATE,
    passport_issue_iso3   CHAR(3) CHECK (passport_issue_iso3 ~ '^[A-Z]{3}$'),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`CREATE INDEX IF NOT EXISTS applicants_application ON applicants (application_id)`;
// Exactly one primary applicant. The primary is who correspondence addresses and
// whose passport drives eligibility; two of them makes both questions ambiguous
// and neither answer is wrong enough to be caught in testing.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS applicants_one_primary
    ON applicants (application_id) WHERE is_primary`;
// The whole reason the blind index exists: "has this passport applied before,
// and was it refused". Not unique - the same passport legitimately appears on a
// re-application and on later trips.
await sql`
  CREATE INDEX IF NOT EXISTS applicants_passport_bidx
    ON applicants (passport_number_bidx)`;

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────

// A pointer and a provenance record. The BYTES ARE NOT HERE: the phone PUTs
// straight to S3 with a presigned URL and they never touch the app server, so
// there is nothing to stream, nothing to buffer, and no copy of a passport scan
// in a Postgres backup.
//
// Uploads land in earthvisa-docs-quarantine-aps1 and only reach
// earthvisa-docs-aps1 after scanning. scan_state gates that move. Modelling it
// as a column rather than inferring it from which bucket the object is in means
// a half-finished copy cannot read as clean.
//
// sha256 is over the bytes as uploaded. It is how we detect that the object at
// the key is not the object we were told was uploaded, and how a duplicate
// upload of the same file is recognised instead of billed twice.
//
// DELETING THIS ROW DOES NOT DELETE THE OBJECT. Every path that removes a
// document must enqueue an outbox row in the SAME transaction, or the bytes
// outlive the account that asked to be forgotten - which is precisely the
// failure the deletion promise is supposed to rule out.
await sql`
  CREATE TABLE IF NOT EXISTS documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    applicant_id   UUID REFERENCES applicants(id) ON DELETE SET NULL,
    kind           TEXT NOT NULL,
    requirement_id TEXT,
    s3_bucket      TEXT NOT NULL,
    s3_key         TEXT NOT NULL,
    content_type   TEXT NOT NULL,
    byte_size      BIGINT NOT NULL CHECK (byte_size > 0),
    sha256         BYTEA,
    scan_state     TEXT NOT NULL DEFAULT 'pending'
                     CHECK (scan_state IN ('pending', 'clean', 'infected', 'failed')),
    scanned_at     TIMESTAMPTZ,
    promoted_at    TIMESTAMPTZ,
    expires_on     DATE,
    uploaded_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (scan_state <> 'clean' OR scanned_at IS NOT NULL)
  )`;
// One row per object. Two rows claiming the same key means deleting one deletes
// the other's bytes, and neither row knows.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS documents_object_key
    ON documents (s3_bucket, s3_key)`;
// The checklist screen and the operator's file view both read every document for
// one application.
await sql`CREATE INDEX IF NOT EXISTS documents_application ON documents (application_id)`;
// The scanner sweep, and the alarm for uploads that were never scanned. Partial,
// because a healthy system has almost nothing in this state and the query should
// cost nothing when that is true.
await sql`
  CREATE INDEX IF NOT EXISTS documents_awaiting_scan
    ON documents (created_at) WHERE scan_state = 'pending'`;

// ─────────────────────────────────────────────────────────────────────────────
// Money. Modelled, not built.
// ─────────────────────────────────────────────────────────────────────────────

// NOTHING WRITES TO THESE TABLES YET, and that is the decision, not an omission.
// Bundling the government fee with our service fee likely makes us a payment
// aggregator under RBI's framework, which is an authorisation we do not hold. So
// the shape is here - it is cheap to get right now and expensive to retrofit -
// and the capture path is absent.
//
// The two fees are SEPARATE COLUMNS and are never summed into a stored total.
// The government fee is a pass-through we do not keep and never refund; the
// service fee is ours and is refunded in full on refusal. A single amount column
// makes those two facts inexpressible, which is exactly how the category's
// loudest complaint - "they kept the money" - gets built into a schema.
//
// collection_mode is the seam. 'applicant_pays_government' is the only mode
// phase 1 uses: the applicant pays the portal directly with their own card, so
// money we never hold cannot become money we are accused of keeping. The other
// value exists so the day we are authorised, it is a value change and not a
// migration.
//
// bigint MINOR UNITS everywhere. Not numeric, not float: a rupee is an integer
// number of paise, and every currency bug anyone has ever debugged started with
// a value that was almost the right amount.
await sql`
  CREATE TABLE IF NOT EXISTS payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id     UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    state              TEXT NOT NULL DEFAULT 'pending' CHECK (state IN (
                         'pending', 'authorized', 'captured', 'failed', 'voided', 'refunded'
                       )),
    collection_mode    TEXT NOT NULL DEFAULT 'applicant_pays_government'
                         CHECK (collection_mode IN ('applicant_pays_government', 'earthvisa_collects')),
    govt_fee_minor     BIGINT NOT NULL DEFAULT 0 CHECK (govt_fee_minor >= 0),
    service_fee_minor  BIGINT NOT NULL DEFAULT 0 CHECK (service_fee_minor >= 0),
    currency           CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    provider           TEXT,
    provider_ref       TEXT,
    authorized_at      TIMESTAMPTZ,
    captured_at        TIMESTAMPTZ,
    failed_at          TIMESTAMPTZ,
    failure_reason     TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (state <> 'captured' OR captured_at IS NOT NULL),
    CHECK (collection_mode <> 'applicant_pays_government' OR govt_fee_minor = 0)
  )`;
// ONE LIVE PAYMENT PER APPLICATION. This is the double-charge guard and it has
// to live in the database, because the two ways it happens are a retried request
// and two operators acting at once - and neither is prevented by a check in
// application code. Dead states are excluded so a failed or voided attempt can
// be followed by a fresh one.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS payments_one_live_per_application
    ON payments (application_id)
    WHERE state IN ('pending', 'authorized', 'captured')`;
await sql`CREATE INDEX IF NOT EXISTS payments_application ON payments (application_id)`;
// Provider references are the join to reconciliation and to webhooks. Unique so
// a redelivered webhook updates the payment it already created instead of a
// second one; partial because the reference does not exist until the provider
// issues it.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref
    ON payments (provider, provider_ref) WHERE provider_ref IS NOT NULL`;

// Refunds are their own rows, never a mutation of the payment, because a partial
// refund and a second partial refund are two facts and a mutated payment can
// only remember one of them.
//
// Refunds cover the SERVICE FEE ONLY. The invariant "sum of refunds <= the
// payment's service_fee_minor" is not expressible as a row CHECK; it is enforced
// by inserting the refund and its ledger entries in one transaction and asserting
// the sum there. The ledger, not this table, is the thing that would catch a
// violation after the fact.
//
// reason is constrained rather than free text because refunds are automatic on
// recording a refusal, not on request - a refund that must be chased is the
// complaint, not the remedy - and "automatic" means a machine reads this column.
await sql`
  CREATE TABLE IF NOT EXISTS refunds (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount_minor  BIGINT NOT NULL CHECK (amount_minor > 0),
    currency      CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    reason        TEXT NOT NULL CHECK (reason IN (
                    'refusal', 'missed_submission_deadline', 'withdrawn_before_filing',
                    'duplicate_charge', 'goodwill'
                  )),
    state         TEXT NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending', 'succeeded', 'failed')),
    provider_ref  TEXT,
    initiated_by  UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at    TIMESTAMPTZ,
    CHECK (state <> 'succeeded' OR settled_at IS NOT NULL)
  )`;
await sql`CREATE INDEX IF NOT EXISTS refunds_payment ON refunds (payment_id)`;
// Same webhook-redelivery reason as payments_provider_ref: a retried refund
// callback must not create a second refund.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_ref
    ON refunds (provider_ref) WHERE provider_ref IS NOT NULL`;

// The append-only money record. There is NO BALANCE COLUMN anywhere in this
// schema: a balance is SUM(amount_minor) over these rows, filtered by account.
// A stored balance is a cache of arithmetic that will eventually disagree with
// the events that produced it, and when it does there is no way to tell which
// one is wrong.
//
// amount_minor is SIGNED and never zero. Entries are written in groups
// (entry_group) that must sum to zero across accounts, so every movement has a
// source and a destination and a lost entry is detectable by arithmetic rather
// than by a customer noticing.
//
// NO FOREIGN KEYS to applications or payments, on purpose. Financial records
// have to outlive the operational rows they describe - account deletion cascades
// through applications and would take the books with it. A bare uuid with
// nothing left to join to is not personal data; a missing ledger is a missing
// tax record.
await sql`
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entry_group    UUID NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_code   TEXT NOT NULL CHECK (account_code IN (
                     'customer_receivable', 'cash', 'govt_fee_payable',
                     'service_fee_revenue', 'refund_payable', 'processor_fee'
                   )),
    entry_type     TEXT NOT NULL CHECK (entry_type IN (
                     'quote', 'charge', 'capture', 'govt_fee_paid', 'refund', 'adjustment'
                   )),
    amount_minor   BIGINT NOT NULL CHECK (amount_minor <> 0),
    currency       CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    application_id UUID,
    payment_id     UUID,
    refund_id      UUID,
    memo           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
// "Show me the money history of this application" - the support question behind
// every billing dispute. Ordered by id, not occurred_at: entries written in one
// transaction share NOW() to the microsecond, and id is the only real order.
await sql`
  CREATE INDEX IF NOT EXISTS ledger_entries_application
    ON ledger_entries (application_id, id)`;
// The balance check: group the entries and assert each group sums to zero. This
// index is what makes that a routine sweep rather than a full scan.
await sql`CREATE INDEX IF NOT EXISTS ledger_entries_group ON ledger_entries (entry_group)`;
// Period close and reconciliation read by date across all applications.
await sql`
  CREATE INDEX IF NOT EXISTS ledger_entries_period
    ON ledger_entries (occurred_at, account_code)`;
await sql`DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries`;
await sql`
  CREATE TRIGGER ledger_entries_no_update
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION filing_refuse_update()`;

// ─────────────────────────────────────────────────────────────────────────────
// History, operators, audit
// ─────────────────────────────────────────────────────────────────────────────

// The timeline the app draws is a PROJECTION OF THIS TABLE, not a separate
// record kept alongside it. applications.state is the fold; these rows are what
// was folded.
//
// Append-only, enforced below. After a refusal the only question that matters is
// what we knew and when, and a timeline that can be edited answers it with
// whatever the last person to touch it preferred.
//
// Rows are ordered by id, never by at: several events are legitimately written
// in one transaction (submitted, then assigned, then notified) and they all carry
// the same NOW(). Sorting by timestamp shuffles them and the story reads wrong.
//
// actor_type is not decoration either - "who moved this to blocked" has three
// very different answers (the applicant, an operator, a timeout) and support
// cannot tell them apart from the state alone.
await sql`
  CREATE TABLE IF NOT EXISTS status_events (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    kind           TEXT NOT NULL CHECK (kind IN (
                     'transition', 'note', 'document', 'payment', 'contact', 'system'
                   )),
    from_state     TEXT,
    to_state       TEXT,
    actor_type     TEXT NOT NULL CHECK (actor_type IN ('applicant', 'operator', 'system')),
    actor_id       UUID,
    summary        TEXT NOT NULL,
    detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
    at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (kind <> 'transition' OR to_state IS NOT NULL)
  )`;
// The timeline read, in the order the timeline is drawn.
await sql`
  CREATE INDEX IF NOT EXISTS status_events_timeline
    ON status_events (application_id, id)`;
await sql`DROP TRIGGER IF EXISTS status_events_no_update ON status_events`;
await sql`
  CREATE TRIGGER status_events_no_update
    BEFORE UPDATE ON status_events
    FOR EACH ROW EXECUTE FUNCTION filing_refuse_update()`;

// Who is responsible for filing this, by name. The fulfilment console reads the
// entire vault by design, which makes it the most privileged surface in the
// system; it cannot ship behind a shared admin token, because a shared token
// makes every row in access_log say "admin" and the log stops being evidence.
//
// operator_id references accounts with ON DELETE RESTRICT, not CASCADE. Staff are
// accounts too, and deleting a staff account must not quietly erase who touched
// which applications. Customers are never operators, so this does not weaken the
// customer-deletion guarantee that the CASCADE on applications.account_id makes.
await sql`
  CREATE TABLE IF NOT EXISTS operator_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    operator_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    role           TEXT NOT NULL CHECK (role IN ('preparer', 'reviewer', 'filer')),
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by    UUID,
    unassigned_at  TIMESTAMPTZ,
    unassign_reason TEXT,
    CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
  )`;
// One live holder per role per application. Two preparers on one file is how the
// same form gets submitted to the portal twice, and the government fee for the
// second one is not coming back.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS operator_assignments_one_live_per_role
    ON operator_assignments (application_id, role) WHERE unassigned_at IS NULL`;
// "What is on my desk right now" - the operator's home screen. Partial, because
// the historical assignments dwarf the live ones within weeks.
await sql`
  CREATE INDEX IF NOT EXISTS operator_assignments_live_by_operator
    ON operator_assignments (operator_id, assigned_at DESC) WHERE unassigned_at IS NULL`;

// Every read of someone else's data, by whom, and why. This is the table that
// answers "who looked at this passport" - the question a DPDP inquiry actually
// asks, and one that cannot be answered retrospectively.
//
// It must be written by the same query path that performs the read, inside the
// same transaction. Best-effort logging bolted on afterwards is missing exactly
// the entries that matter, because the interesting read is the one someone did
// not want recorded.
//
// NO FOREIGN KEYS, deliberately. A cascade from applications would delete the
// evidence of access at precisely the moment it becomes important - read the
// vault, then delete the account, and the log erases itself. Bare uuids with
// nothing left to join to are not a re-identification risk; a self-erasing audit
// log is worse than no audit log, because it looks like one.
await sql`
  CREATE TABLE IF NOT EXISTS access_log (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator_id        UUID,
    subject_account_id UUID,
    application_id     UUID,
    applicant_id       UUID,
    document_id        UUID,
    action             TEXT NOT NULL CHECK (action IN (
                         'list', 'read', 'decrypt', 'download', 'export', 'print'
                       )),
    reason             TEXT,
    ip                 TEXT,
    user_agent         TEXT
  )`;
// The two directions an investigation runs: everything that touched one file,
// and everything one person touched.
await sql`CREATE INDEX IF NOT EXISTS access_log_application ON access_log (application_id, at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS access_log_operator ON access_log (operator_id, at DESC)`;
await sql`DROP TRIGGER IF EXISTS access_log_no_update ON access_log`;
await sql`
  CREATE TRIGGER access_log_no_update
    BEFORE UPDATE ON access_log
    FOR EACH ROW EXECUTE FUNCTION filing_refuse_update()`;

// ─────────────────────────────────────────────────────────────────────────────
// Request plumbing
// ─────────────────────────────────────────────────────────────────────────────

// Retry safety. The client is a phone on an Indian mobile network: a request
// that times out has very often already succeeded, and the app has no way to
// know. Without this table the retry creates a second application, a second
// document, and eventually a second charge.
//
// request_hash is what makes the key honest. A key replayed with a DIFFERENT
// body is a bug or an attack, not a retry, and must be rejected loudly rather
// than served the first call's answer for a request nobody made.
//
// The key is scoped by account, so one customer cannot guess, collide with or
// probe another's keys. account_id is NOT NULL because every endpoint that
// changes anything here is authenticated.
//
// state distinguishes "in flight" from "done": two concurrent retries must not
// both execute, and the loser needs to wait or be told to retry rather than
// receive an empty success.
await sql`
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,
    key             TEXT NOT NULL,
    request_hash    BYTEA NOT NULL,
    state           TEXT NOT NULL DEFAULT 'in_flight'
                      CHECK (state IN ('in_flight', 'done')),
    response_status INT,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    PRIMARY KEY (account_id, endpoint, key),
    CHECK (state <> 'done' OR response_status IS NOT NULL)
  )`;
// Only the expiry sweep reads this way; the hot path always arrives with the
// full primary key.
await sql`CREATE INDEX IF NOT EXISTS idempotency_keys_expiry ON idempotency_keys (expires_at)`;

// Transactional outbox. A state change and the message announcing it are written
// in ONE transaction; a separate poller sends. Sending inline is the bug this
// prevents: the send succeeds, the transaction rolls back, and the customer has
// an email about something that did not happen - or the reverse, an application
// that moved with nobody told.
//
// It is also the only correct way to delete S3 objects. The row goes with the
// account; the purge job needs to survive it.
//
// NO FOREIGN KEY to applications, for exactly that reason. If outbox rows
// cascaded, deleting an account would delete the job that erases that account's
// documents, and the bytes would sit in the bucket forever with nothing left
// pointing at them.
await sql`
  CREATE TABLE IF NOT EXISTS outbox (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    topic          TEXT NOT NULL,
    payload        JSONB NOT NULL,
    application_id UUID,
    dedupe_key     TEXT,
    available_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts       INT NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    published_at   TIMESTAMPTZ,
    last_error     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
// The poller's only query: the oldest unpublished row that is due. Partial on
// unpublished, because the published rows are the ones that pile up and they are
// never selected again.
await sql`
  CREATE INDEX IF NOT EXISTS outbox_pending
    ON outbox (available_at) WHERE published_at IS NULL`;
// At-least-once delivery plus a producer that runs twice equals two emails to a
// customer about one event. The dedupe key makes the second insert fail instead.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS outbox_dedupe
    ON outbox (dedupe_key) WHERE dedupe_key IS NOT NULL`;

// ─────────────────────────────────────────────────────────────────────────────
// Housekeeping and summary
// ─────────────────────────────────────────────────────────────────────────────

// Same pattern as init-auth-db.mjs. Both of these grow forever and are only ever
// read over a short recent window; nothing here is the record of anything, so
// deleting it loses nothing. The append-only tables are NOT swept - that is the
// whole point of them.
const expiredKeys = await sql`
  DELETE FROM idempotency_keys WHERE expires_at < NOW() RETURNING key`;
const sentOutbox = await sql`
  DELETE FROM outbox
  WHERE published_at IS NOT NULL AND published_at < NOW() - INTERVAL '7 days'
  RETURNING id`;

const [counts] = await sql`
  SELECT
    (SELECT count(*) FROM corridors)::int      AS corridors,
    (SELECT count(*) FROM form_versions)::int  AS forms,
    (SELECT count(*) FROM applications)::int   AS applications,
    (SELECT count(*) FROM corridors WHERE is_open)::int AS open_corridors`;

console.log("filing schema ready");
console.log(`  cleaned ${expiredKeys.length} expired idempotency keys, ${sentOutbox.length} published outbox rows`);
console.log(`  ${counts.corridors} corridors (${counts.open_corridors} open), ${counts.forms} form versions, ${counts.applications} applications`);
console.log("  payment capture is deliberately not implemented; the tables exist so the seam does");
await close();
