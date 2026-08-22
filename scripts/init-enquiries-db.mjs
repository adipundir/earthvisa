// Creates the enquiries schema: the things a person asks Earth Visa that are
// NOT a filed visa application. Idempotent: safe to re-run.
//
//   node scripts/init-enquiries-db.mjs
//
// Depends on the auth schema (every enquiry belongs to an accounts row) and on
// the filing schema's `outbox` table, which is how an operator hears about new
// work. Kept separate from both for the reason the others are kept separate: a
// mistake while editing one schema must not be able to reach another.
//
// What an enquiry IS, and what it is not
// ---------------------------------------
// An application (scripts/init-filing-db.mjs) is a government form Earth Visa
// files on a person's behalf, and it exists only for the handful of corridors
// with a hand-authored form and an operator who has filed that route. An
// enquiry is everything else a person can ask for in the app:
//
//   programme     "Tell me what Saint Lucia's citizenship programme would need
//                  from me" - an investment-migration lead, with the person's
//                  own answers about budget, family and timing attached.
//   visa_assist   "Can you handle my Japan visa?" on a corridor the app can
//                  describe but not yet file. The honest product for 10,000-odd
//                  corridors: a person, not a form.
//   support       A question about an existing application, or anything else.
//
// All three are a CONVERSATION: the person writes, an operator replies, the
// person reads the reply in the app. The thread is the product; `state` is a
// cache of whose turn it is. Nothing here promises an outcome, a timeline or a
// price, because Earth Visa cannot know any of those when the enquiry is made.
//
// NO MONEY. An enquiry cannot be paid for and has no fee columns at all. If a
// programme enquiry ever becomes a paid engagement, that is an application
// under a corridor with a form, not a column added here.
import { connect } from "./lib/db.mjs";

const [sql, close] = await connect();

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

// Both prerequisites are checked up front, so the failure names the missing
// script rather than surfacing as a foreign-key error half way through.
const [{ has_accounts: hasAccounts, has_outbox: hasOutbox }] = await sql`
  SELECT to_regclass('public.accounts') IS NOT NULL AS has_accounts,
         to_regclass('public.outbox')   IS NOT NULL AS has_outbox`;
if (!hasAccounts) {
  console.error("accounts table is missing. Run scripts/init-auth-db.mjs first.");
  process.exit(1);
}
if (!hasOutbox) {
  console.error("outbox table is missing. Run scripts/init-filing-db.mjs first.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// enquiries
//
// `state` is whose turn it is, and nothing more:
//   new          the person wrote, nobody has read it yet
//   in_progress  an operator has it (or the person wrote again after a reply)
//   replied      an operator answered and is waiting on the person
//   closed       settled. A later message from the person reopens it.
//
// `subject` is what the enquiry is ABOUT, as JSON, because its shape differs by
// kind: a programme enquiry names {kind, iso3, programName}; a visa_assist one
// names {nationalityIso3, destinationIso3, visaType}; a support one names an
// application, or nothing. Validated by shape in the route, never trusted.
//
// `answers` is the person's structured answers to the app's OWN questions
// (budget band, family size, travel dates). They are ours, not a government's,
// which is why they are not a form_versions row: there is no consulate to be
// held to, and the questions can change without versioning anyone's draft.
//
// ON DELETE CASCADE from accounts, the same guarantee applications make: when
// a person deletes their account, what they wrote goes with it.
await sql`
  CREATE TABLE IF NOT EXISTS enquiries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    reference_code TEXT NOT NULL UNIQUE,
    kind           TEXT NOT NULL CHECK (kind IN ('programme', 'visa_assist', 'support')),
    state          TEXT NOT NULL DEFAULT 'new'
                   CHECK (state IN ('new', 'in_progress', 'replied', 'closed')),
    subject        JSONB NOT NULL DEFAULT '{}'::jsonb,
    answers        JSONB NOT NULL DEFAULT '{}'::jsonb,
    application_id UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS enquiries_by_account
    ON enquiries (account_id, created_at DESC)`;
// The operator's queue: everything that is somebody's turn at Earth Visa.
await sql`
  CREATE INDEX IF NOT EXISTS enquiries_open
    ON enquiries (state, updated_at) WHERE state IN ('new', 'in_progress')`;

// ─────────────────────────────────────────────────────────────────────────────
// enquiry_messages
//
// The thread. Append-only by convention and by trigger: a message, once sent,
// is what was said. A correction is another message.
//
// `author` carries the same three-way distinction status_events does, because
// the app renders an operator's reply differently from the person's own
// message and a system line ("Earth Visa has your enquiry") differently again.
await sql`
  CREATE TABLE IF NOT EXISTS enquiry_messages (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    author     TEXT NOT NULL CHECK (author IN ('applicant', 'operator', 'system')),
    body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS enquiry_messages_thread
    ON enquiry_messages (enquiry_id, id)`;

// Same refuse-update trigger function the filing schema installs, created here
// too so this script does not depend on that one having defined it. CREATE OR
// REPLACE with an identical body is idempotent across both.
await sql`
  CREATE OR REPLACE FUNCTION enquiries_refuse_update() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'enquiry_messages is append-only; send a correction instead';
  END
  $$ LANGUAGE plpgsql`;
await sql`DROP TRIGGER IF EXISTS enquiry_messages_no_update ON enquiry_messages`;
await sql`
  CREATE TRIGGER enquiry_messages_no_update
    BEFORE UPDATE ON enquiry_messages
    FOR EACH ROW EXECUTE FUNCTION enquiries_refuse_update()`;

// Per-account rate limiting for creation. A person can legitimately open a few
// enquiries in a sitting; twenty in an hour is a script.
await sql`
  CREATE TABLE IF NOT EXISTS enquiry_attempts (
    account_id UUID NOT NULL,
    at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS enquiry_attempts_by_account
    ON enquiry_attempts (account_id, at)`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM enquiries`;
console.log(`Schema ready. enquiries table has ${count} row(s).`);
await close();
