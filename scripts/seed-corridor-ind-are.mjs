// Seeds the first fileable corridor: resident of India -> United Arab Emirates,
// 60-day tourist visa. Idempotent, and safe to re-run.
//
//   node scripts/seed-corridor-ind-are.mjs --verify   # no database, checks every quote
//   node scripts/seed-corridor-ind-are.mjs --emit     # the pair as JSON on stdout
//   DATABASE_URL="$(scripts/lib/rds-url.sh)" node scripts/seed-corridor-ind-are.mjs
//
// Requires scripts/init-filing-db.mjs to have run: this script writes rows, and
// deliberately creates no tables. A CREATE TABLE IF NOT EXISTS here would
// silently win the race against the real schema and leave a wrong-shaped
// `corridors` that init-filing-db then skips.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS HAND-WRITTEN, AND WHAT KEEPS IT HONEST
//
// The checklist Earth Visa holds for this corridor is PROSE: one string per visa
// type, written for a human to read. Excellent for telling someone what to
// bring; useless as a schema for collecting it. There are 10,396 corridor and
// visa-type combinations and no automated path from that prose to a form, so a
// form is DATA - a JSON Schema for shape and validation, a UI schema for order,
// grouping and conditionals - and one generic renderer on iOS draws it.
//
// Every field traces to a fragment of data/vfs/ind-are.json, visa_types[0]
// ("Tourist : 60 Days"). The fragment is quoted in `_source`, and
// verifySources() asserts at run time that each quote is still a verbatim
// substring of that file. If VFS rewords the page and the pipeline refreshes the
// JSON, this script FAILS rather than seeding a form whose citations have
// quietly become fiction. Without that check `_source` is a comment, and
// comments rot silently.
//
// The three derivations, so "derived" never means "assumed":
//   verbatim             the prose names this datum outright
//   implied-by-document  the prose requires a document that carries this datum,
//                        and no operator can fill the government form without it
//   operational          ours, not the government's (contact details, input
//                        bounds). Barred from `required`, and verifyRequired-
//                        AreTraced() enforces that rather than trusting it.
// Ambiguous prose gets `_ambiguity` and stays OPTIONAL - guessing a mandatory
// field invents a requirement the consulate never stated. NOTE at the bottom
// lists everything that could not be structured at all.
//
// PAYMENT IS DEFERRED. corridors carries govt_fee_minor and service_fee_minor as
// separate integer minor-unit columns so the ledger has somewhere to point, and
// this script writes neither a charge nor a checkout. The seam is a column, not
// a code path. The government fee is left at ZERO because the source's fee table
// did not survive the crawl - see NOTE 1 - and a zero that is quoted as a price
// is worse than no corridor at all, which is why this script will not open the
// corridor and warns loudly if it finds it already open.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { connect } from "./lib/db.mjs";

const DRY_RUN = process.argv.includes("--verify") || process.argv.includes("--dry-run");
// --emit prints the pair, so the iOS renderer's tests can hold a real corridor
// as a fixture rather than a hand-written imitation of one.
const EMIT = process.argv.includes("--emit");
// Opening a corridor makes it sellable. Explicit, never a side effect of seeding.
const OPEN = process.argv.includes("--open");

// ── The source of truth ──────────────────────────────────────────────────────

const SOURCE_FILE = "data/vfs/ind-are.json";
const SOURCE_INDEX = 0; // visa_types[0] — "Tourist : 60 Days"

const raw = JSON.parse(readFileSync(new URL(`../${SOURCE_FILE}`, import.meta.url), "utf8"));
const vt = raw.visa_types[SOURCE_INDEX];

if (vt.name !== "Tourist : 60 Days") {
  console.error(`visa_types[${SOURCE_INDEX}] is "${vt.name}", not "Tourist : 60 Days".`);
  console.error("The array was reordered upstream. Re-point SOURCE_INDEX and re-read the prose.");
  process.exit(1);
}

/** The prose fields this form was derived from, in the order they were read. */
const DERIVED_FROM = ["name", "category", "documents_required", "eligibility", "visa_fees", "overview"];

/**
 * Digest of exactly the prose this form version was derived from.
 *
 * Carried inside the schema, because form_versions.checksum is over the two
 * schemas and answers a different question ("did the form change?"). This one
 * answers "did the requirement change?", and those come apart: VFS can reword
 * the page without us noticing, which is the failure that matters.
 */
const sourceDigest = createHash("sha256")
  .update(DERIVED_FROM.map((k) => `${k} ${vt[k] ?? ""}`).join(""))
  .digest("hex");

/** Records where a field came from. `quote` is checked against the file. */
function src(field, quote, derivation = "verbatim", extra = {}) {
  return { file: SOURCE_FILE, path: `visa_types[${SOURCE_INDEX}].${field}`, quote, derivation, ...extra };
}
/** Ours, not the government's. Never permitted in `required`. */
function ours(why) {
  return { file: null, path: null, quote: null, derivation: "operational", note: why };
}

// ── Conditions, declared once ────────────────────────────────────────────────
//
// A conditional appears in two places — JSON Schema `if/then` for the validator
// and `visibleWhen` for the renderer — and two hand-written copies of one rule
// drift. So conditions are objects here and both forms are COMPILED from them.
// There is exactly one definition of "the host block applies".

const WHEN = {
  staysInHotel: { op: "equals", field: "stay.accommodation_type", value: "hotel" },
  staysWithHost: { op: "equals", field: "stay.accommodation_type", value: "family_or_friends" },
  routeTravel: { op: "equals", field: "eligibility.route", value: "travel_record" },
  routeFinancial: { op: "equals", field: "eligibility.route", value: "financial_records" },
  routeInvitation: { op: "equals", field: "eligibility.route", value: "uae_family_invitation" },
  basisForm16: { op: "equals", field: "eligibility.financial.basis", value: "form_16_2y" },
  basisItr: { op: "equals", field: "eligibility.financial.basis", value: "itr_2y" },
  basisDeposits: { op: "equals", field: "eligibility.financial.basis", value: "fixed_deposits" },
  priorVisit: { op: "equals", field: "eligibility.travel_record.kind", value: "visited" },
  priorValidVisa: { op: "equals", field: "eligibility.travel_record.kind", value: "valid_visa" },
  recentlyMarried: { op: "equals", field: "circumstances.recently_married", value: true },
};
// The host is described twice — once in documents_required ("If visiting Family
// or Friends") and once in eligibility ("Criteria III"). Either reaches the same
// block of questions.
WHEN.hostApplies = { op: "any_of", checks: [WHEN.staysWithHost, WHEN.routeInvitation] };
WHEN.incomeBasis = { op: "any_of", checks: [WHEN.basisForm16, WHEN.basisItr] };
WHEN.spouseNotEndorsed = {
  op: "all_of",
  checks: [WHEN.recentlyMarried, { op: "equals", field: "circumstances.spouse_name_endorsed_on_passport", value: false }],
};
// Nationality against residence. Two sibling fields, so JSON Schema cannot see
// it at all; it exists only as a rule and as renderer visibility.
WHEN.livesAbroad = {
  op: "not",
  of: { op: "equals", field: "applicant.nationality_iso3", valueFrom: "applicant.country_of_residence_iso3" },
};

/**
 * Compiles a condition into a JSON Schema `if` clause.
 *
 * Only conditions over one object's own properties can be expressed — JSON
 * Schema cannot compare two sibling fields and cannot do date arithmetic.
 * Anything it cannot express returns null and lives ONLY in x-evRules, which is
 * why the rules array is normative and the schema is a subset of it, never the
 * other way round.
 */
function toIf(cond) {
  if (cond.op === "equals" && cond.value !== undefined) {
    const parts = cond.field.split(".");
    let node = { const: cond.value };
    for (let i = parts.length - 1; i >= 0; i--) node = { properties: { [parts[i]]: node }, required: [parts[i]] };
    return node;
  }
  if (cond.op === "any_of") {
    const compiled = cond.checks.map(toIf);
    return compiled.every(Boolean) ? { anyOf: compiled } : null;
  }
  if (cond.op === "all_of") {
    const compiled = cond.checks.map(toIf);
    return compiled.every(Boolean) ? { allOf: compiled } : null;
  }
  return null;
}

/** `if <cond> then <these paths are required>`, for the JSON Schema root. */
function requireWhen(cond, paths) {
  const ifClause = toIf(cond);
  if (!ifClause) throw new Error("condition is not expressible in JSON Schema; use x-evRules instead");
  const then = {};
  for (const path of paths) {
    const parts = path.split(".");
    let cursor = then;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor.properties ??= {};
      cursor.properties[parts[i]] ??= {};
      cursor.required = [...new Set([...(cursor.required ?? []), parts[i]])];
      cursor = cursor.properties[parts[i]];
    }
    cursor.required = [...new Set([...(cursor.required ?? []), parts[parts.length - 1]])];
  }
  return { if: ifClause, then };
}

// ── Reusable pieces ──────────────────────────────────────────────────────────

const SCAN_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const PHOTO_TYPES = ["image/jpeg", "image/png"];

/**
 * A slot's value: a pointer to a document, never the bytes.
 *
 * Documents go phone → S3 by presigned PUT. The application row holds an id and
 * the object never passes through the app server, so a form submission cannot be
 * the thing that leaks a passport scan.
 */
function documentRef(accepts = SCAN_TYPES, extra = {}) {
  return {
    type: "object",
    additionalProperties: false,
    "x-evAccepts": accepts,
    properties: {
      document_id: { type: "string", format: "uuid" },
      filename: { type: "string" },
      content_type: { type: "string" },
      uploaded_at: { type: "string", format: "date-time" },
      ...(extra.properties ?? {}),
    },
    required: ["document_id"],
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "properties")),
  };
}

/**
 * The name rule, stated by the prose and stated only as far as it goes.
 *
 * "special characters such as brackets" — "such as" means the rejected set is
 * open. So brackets are BLOCKED (the prose names them) and anything else outside
 * plain Latin letters is only WARNED about (x-evWarnPattern, rendered as a
 * caution, never a rejection). Blocking the full set we imagine VFS meant would
 * be a guess, and this particular guess stops a legitimate applicant whose name
 * carries an accent.
 */
const passportName = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  not: { pattern: "[()\\[\\]{}<>]" },
  "x-evWarnPattern": "[^A-Za-z .'\\-]",
};

const iso3 = { type: "string", pattern: "^[A-Z]{3}$" };
const isoDate = { type: "string", format: "date" };

// ── JSON Schema: the data an applicant must supply ───────────────────────────

const jsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://earthvisa.in/schemas/corridor/IND-ARE/tourist-60d/v1.json",
  title: "India to United Arab Emirates — tourist, 60 days",
  description:
    "Applicant data for a 60-day UAE tourist visa filed from India. Derived from " +
    `${SOURCE_FILE} visa_types[${SOURCE_INDEX}]. Every entry in "required" traces to a quoted fragment of that prose.`,

  "x-evSource": {
    file: SOURCE_FILE,
    index: SOURCE_INDEX,
    visa_type: vt.name,
    provider: raw.provider,
    url: raw.source_url,
    official: raw.source_official,
    fetched_via: raw.fetched_via,
    digest: sourceDigest,
  },

  // Corridor facts the source states and the corridors table has no column for.
  // They belong to the version, not to the row, because they are read off prose
  // that can change under us.
  "x-evCorridor": {
    entry_validity_days: 58,
    max_stay_days: 60,
    single_entry: true,
    extension: { count: 2, days_each: 30, fee_minor: 85000, currency: "AED" },
    cancellation_fee_minor: 346500,
    cancellation_fee_currency: "INR",
    govt_fee_minor: null, // see NOTE 1
    _source: [
      src("overview", "The entry validity for all types of tourist visa is 58 days from the date of issue"),
      src("visa_fees", "Duration of stay: 60 days"),
      src("documents_required", "For 60-day single entry visa"),
      src("overview", "stay validity of visa can be extended twice for 30days each. Extension fee is AED 850 each time."),
      src("visa_fees", "The cancellation charge per visa is 3465 (INR)"),
    ],
  },

  type: "object",
  additionalProperties: false,
  required: ["applicant", "travel", "stay", "eligibility", "documents"],

  properties: {
    // ── Passport identity ────────────────────────────────────────────────────
    applicant: {
      type: "object",
      additionalProperties: false,
      required: [
        "surname",
        "given_names",
        "date_of_birth",
        "nationality_iso3",
        "country_of_residence_iso3",
        "passport_number",
        "passport_expiry_date",
      ],
      properties: {
        surname: {
          ...passportName,
          _source: src(
            "documents_required",
            "Passports containing special characters such as brackets in the name will not be accepted and must be amended prior to visa submission.",
          ),
        },
        given_names: {
          ...passportName,
          _source: src(
            "documents_required",
            "Confirmed Return/Onward Emirates ticket, highlighting the applicant's name, entry and exit from the UAE in yellow.",
            "verbatim",
            {
              note:
                "The ticket, the hotel voucher and the passport must all carry the same name; it is the one datum " +
                "the prose asks to be matched across three separate documents.",
            },
          ),
        },
        date_of_birth: {
          ...isoDate,
          _source: src(
            "eligibility",
            "Dubai immigration will consider applications from minors and students only if they are travelling with parents.",
            "verbatim",
            { note: "Required because minor status is a filing condition, and only a date of birth can decide it." },
          ),
        },
        sex: {
          type: "string",
          enum: ["M", "F", "X"],
          _source: src(
            "documents_required",
            "Coloured photocopy of the Passport Front/External Cover page and Bio page",
            "implied-by-document",
            {
              note:
                "Optional. The bio page is a required document and ICAO 9303 fixes its Sex field to M, F or X, so " +
                "the enumeration is read off the document rather than invented — but the prose never asks for it, " +
                "so it cannot be required.",
            },
          ),
          _ambiguity:
            "The downloadable application form (visa_types[0].application_form) is a PDF outside this dataset, so " +
            "we cannot confirm whether it asks for sex or how it enumerates it.",
        },
        nationality_iso3: {
          ...iso3,
          _source: src(
            "documents_required",
            "Coloured photocopy of a valid visa or residence proof if the Nationality is different from the Country of Residence.",
          ),
        },
        country_of_residence_iso3: {
          ...iso3,
          default: "IND",
          _source: src("documents_required", "if the Nationality is different from the Country of Residence", "verbatim", {
            note:
              "Residence, not nationality, decides which centre and which document list applies. This corridor is " +
              "keyed on residence IND; the field exists because the prose makes the two comparable.",
          }),
        },
        passport_number: {
          type: "string",
          minLength: 1,
          maxLength: 20,
          _source: src(
            "documents_required",
            "Coloured photocopy of the Passport Front/External Cover page and Bio page",
            "implied-by-document",
            { note: "The number is the bio page's identifier; no filing can name a passport without it." },
          ),
        },
        passport_issue_date: {
          ...isoDate,
          _source: src("documents_required", "Coloured photocopy of the Passport Front/External Cover page and Bio page", "implied-by-document"),
          _ambiguity:
            "Optional. No rule in the prose depends on the issue date — the only passport-date rule is the six-month " +
            "validity, which needs the expiry. Asking is cheap; requiring would not trace.",
        },
        passport_expiry_date: {
          ...isoDate,
          _source: src("documents_required", "(Valid for minimum period of 6 months at the time of travel)"),
        },
        passport_place_of_issue: {
          type: "string",
          maxLength: 64,
          _source: src("documents_required", "Coloured photocopy of the Passport Front/External Cover page and Bio page", "implied-by-document"),
          _ambiguity: "Optional. Present on the bio page, never named in the prose, and no rule turns on it.",
        },
      },
    },

    // ── Contact: ours, not the government's ─────────────────────────────────
    contact: {
      type: "object",
      additionalProperties: false,
      // Deliberately no `required`. The prose asks for no contact detail at all.
      // Email and phone come from the account, which already holds both, and
      // exist so a `blocked` application has somewhere to send a message.
      properties: {
        email: { type: "string", format: "email", _source: ours("Delivery channel for a blocked application. Prefilled from the account.") },
        phone_e164: { type: "string", pattern: "^\\+[1-9]\\d{6,14}$", _source: ours("Prefilled from the account; the sign-in identifier.") },
      },
    },

    // ── The trip ────────────────────────────────────────────────────────────
    travel: {
      type: "object",
      additionalProperties: false,
      required: ["purpose", "carrier_is_emirates", "entry_date", "exit_date"],
      properties: {
        purpose: {
          const: "tourism",
          _source: src("category", "tourist", "verbatim", {
            note: `Fixed by the product, not asked. The visa type is "${vt.name}" and its category is "${vt.category}".`,
          }),
        },
        carrier_is_emirates: {
          type: "boolean",
          _source: src("eligibility", "Selection / determination of a visa category are based on Emirates ticket itinerary.", "verbatim", {
            note:
              "This is an Emirates-sponsored visa; documents_required opens with \"Confirmed Return/Onward Emirates " +
              "ticket\". A ticket on another airline is not a document problem, it is the wrong product, so a false " +
              "answer blocks rather than fails validation.",
          }),
        },
        entry_date: { ...isoDate, _source: src("documents_required", "entry and exit from the UAE in yellow") },
        exit_date: { ...isoDate, _source: src("documents_required", "entry and exit from the UAE in yellow") },
      },
    },

    // ── Where the applicant sleeps ──────────────────────────────────────────
    stay: {
      type: "object",
      additionalProperties: false,
      required: ["accommodation_type"],
      properties: {
        accommodation_type: {
          type: "string",
          enum: ["hotel", "family_or_friends"],
          _source: src(
            "documents_required",
            "If visiting Family or Friends: Provide a valid tenancy contract /Ejari or title deed of the host",
            "verbatim",
            { note: "The prose splits the document list exactly here. This is the real branch, not a designed one." },
          ),
        },
        hotel_bookings: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          _source: src("documents_required", "Note that only up to two hotel bookings are allowed for the entire stay period.", "verbatim", {
            note: "maxItems 2 is the prose's number, not a UI convenience.",
          }),
          items: {
            type: "object",
            additionalProperties: false,
            required: ["hotel_name", "confirmation_number", "check_in", "check_out"],
            properties: {
              hotel_name: {
                type: "string",
                maxLength: 120,
                _source: src("documents_required", "Confirmed hotel voucher with confirmation number", "implied-by-document", {
                  note: "The voucher names the hotel and the government form wants a UAE address; the operator transcribes it from the voucher.",
                }),
              },
              confirmation_number: {
                type: "string",
                maxLength: 40,
                _source: src("documents_required", "Confirmed hotel voucher with confirmation number"),
              },
              check_in: { ...isoDate, _source: src("documents_required", "check-in, check-out dates highlighted in yellow for the entire stay") },
              check_out: { ...isoDate, _source: src("documents_required", "check-in, check-out dates highlighted in yellow for the entire stay") },
              city: {
                type: "string",
                maxLength: 60,
                _source: ours("Helps the operator fill the address block on the government form."),
                _ambiguity: "Optional. The prose lists four things the voucher must show, and the city is not one of them.",
              },
            },
          },
        },
        host: {
          type: "object",
          additionalProperties: false,
          properties: {
            full_name: {
              type: "string",
              maxLength: 100,
              _source: src("documents_required", "( Highlight the tenant's name in yellow)", "verbatim", {
                note: "The tenant on the contract is the host, and the prose asks for that name to be identified.",
              }),
            },
            relationship: {
              type: "string",
              maxLength: 60,
              _source: src("eligibility", "Relationship with the Host."),
              _ambiguity:
                "Free text, not an enum. The two passages disagree about who may host: documents_required says " +
                "\"If visiting Family or Friends\", eligibility Criteria III says \"Invitation from immediate family " +
                "member residing in UAE on family status\". A closed list would encode whichever reading we picked.",
            },
            bedrooms: {
              type: "integer",
              minimum: 2,
              _source: src("eligibility", "**Host should have an apartment with two or more bedrooms."),
            },
            emirate: {
              type: "string",
              maxLength: 40,
              _source: ours("Address block on the government form."),
              _ambiguity: "Optional. Never named in the prose.",
            },
            address: {
              type: "string",
              maxLength: 200,
              _source: ours("Address block on the government form."),
              _ambiguity: "Optional. Never named in the prose.",
            },
          },
        },
      },
    },

    // ── Which of the three criteria the applicant meets ─────────────────────
    eligibility: {
      type: "object",
      additionalProperties: false,
      required: ["route"],
      properties: {
        route: {
          type: "string",
          enum: ["travel_record", "financial_records", "uae_family_invitation"],
          _source: src("eligibility", "Applicant can qualify from any one of the below criteria for Dubai visa application.", "verbatim", {
            note: "Three criteria, any one of them. The enum is Criteria I, II and III in order.",
          }),
        },
        travel_record: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: {
              type: "string",
              enum: ["visited", "valid_visa"],
              _source: src("eligibility", "who have travelled at least once in the last 3 years to or has a valid visa for", "verbatim", {
                note: "Two distinct qualifications in one sentence: a past visit, or a visa still held. They are checked differently.",
              }),
            },
            country: {
              type: "string",
              maxLength: 60,
              _source: src("eligibility", "countries like USA, UK, Schengen countries, European Union, Australia, New Zealand, Russia, Canada and Japan"),
              _ambiguity:
                "\"countries like\" makes the list open. The named countries are offered as suggestions in the UI " +
                "schema, but the field is not an enum, because closing it would refuse someone the centre would accept.",
              "x-evSuggestions": [
                "USA", "UK", "Schengen countries", "European Union", "Australia",
                "New Zealand", "Russia", "Canada", "Japan",
              ],
            },
            travelled_on: { ...isoDate, _source: src("eligibility", "travelled at least once in the last 3 years") },
            visa_valid_until: { ...isoDate, _source: src("eligibility", "has a valid visa for") },
          },
        },
        financial: {
          type: "object",
          additionalProperties: false,
          properties: {
            basis: {
              type: "string",
              enum: ["form_16_2y", "itr_2y", "fixed_deposits"],
              _source: src(
                "eligibility",
                "either last 2 Years Form 16 or last 2 Years Income Tax return with a minimum gross income from business, profession or employment, which should exceed INR 2 lakhs Per annum or Investments amounting to INR 5 Lakhs or above in form of fixed deposits in Banks or Post Office.",
              ),
              _ambiguity:
                "The prose offers a fourth route — \"In some case Security Deposit of USD 1000\" — which is NOT in " +
                "this enum. \"In some case\" says the centre may impose it; nothing says an applicant may elect it. " +
                "It is surfaced as a notice in the UI schema instead of as a choice.",
            },
            // Money is integer minor units. The INR minor unit is the paisa.
            gross_annual_income_inr_minor: {
              type: "integer",
              exclusiveMinimum: 20000000, // INR 2,00,000 → paise. "exceed", so strictly greater.
              _source: src("eligibility", "which should exceed INR 2 lakhs Per annum", "verbatim", {
                note: "20,000,000 paise = INR 2 lakh. exclusiveMinimum because the prose says exceed, not meet.",
              }),
            },
            investment_value_inr_minor: {
              type: "integer",
              minimum: 50000000, // INR 5,00,000 → paise. "or above", so inclusive.
              _source: src("eligibility", "Investments amounting to INR 5 Lakhs or above in form of fixed deposits in Banks or Post Office", "verbatim", {
                note: "50,000,000 paise = INR 5 lakh. minimum, inclusive, because the prose says or above.",
              }),
            },
            investment_institution_type: {
              type: "string",
              enum: ["bank", "post_office"],
              _source: src("eligibility", "Investments in Co-operative Banks or Societies are not acceptable.", "verbatim", {
                note: "The enum is the prose's two acceptable forms; the exclusion sentence is why this list is closed where others are open.",
              }),
            },
            investment_opened_on: { ...isoDate, _source: src("eligibility", "Investments to be a year prior from the date of application") },
            investment_matures_on: { ...isoDate, _source: src("eligibility", "with a validity of more than 12 months") },
          },
        },
      },
    },

    // ── Things that add documents rather than decide eligibility ────────────
    circumstances: {
      type: "object",
      additionalProperties: false,
      // No `required`: every question here is a filter the prose describes but
      // never says how to trigger. Asked, never assumed.
      properties: {
        recently_married: {
          type: "boolean",
          _source: src("eligibility", "Newly Married Couple:In case of the spouse’s name not endorsed on the passport;"),
          _ambiguity:
            "The prose gives no window for \"newly\" or for \"traveling immediately after marriage\" — no days, no " +
            "months. A marriage date therefore cannot compute this, so we ask, and the operator judges.",
        },
        spouse_name_endorsed_on_passport: {
          type: "boolean",
          _source: src("eligibility", "In case of the spouse’s name not endorsed on the passport"),
        },
        is_student: {
          type: "boolean",
          _source: src("eligibility", "Emirates regret its inability to sponsor unaccompanied minors and students."),
          _ambiguity:
            "\"students\" is undefined — no age, no level, no full-time test. A 34-year-old doctoral candidate reads " +
            "as one. Asked so the rule can flag for operator review; never used to refuse.",
        },
        travelling_with_parents: {
          type: "boolean",
          _source: src("eligibility", "Dubai immigration will consider applications from minors and students only if they are travelling with parents."),
        },
      },
    },

    // ── Document slots the prose actually names ─────────────────────────────
    documents: {
      type: "object",
      additionalProperties: false,
      required: ["passport_front_cover", "passport_bio_page", "photograph", "flight_ticket"],
      properties: {
        visa_application_form: {
          ...documentRef(SCAN_TYPES),
          "x-evProvidedBy": "operator",
          _source: src("documents_required", "Visa Application form duly filled*", "verbatim", {
            note:
              "Not an applicant upload. application_form says the form must be filled offline and submitted at the " +
              "centre; under operator-filed fulfilment a human produces it FROM this data — in that sense this schema " +
              "IS that form. The slot exists so the filing packet is complete, and it is not in `required` because " +
              "the applicant cannot supply it.",
          }),
        },
        passport_front_cover: {
          ...documentRef(SCAN_TYPES, { "x-evScan": { colour: true } }),
          _source: src("documents_required", "Coloured photocopy of the Passport Front/External Cover page", "verbatim", {
            note: "Two separate pages are named in one bullet, so two slots: a scan of one is not the other.",
          }),
        },
        passport_bio_page: {
          ...documentRef(SCAN_TYPES, { "x-evScan": { colour: true } }),
          _source: src(
            "documents_required",
            "Coloured photocopy of the Passport Front/External Cover page and Bio page (Valid for minimum period of 6 months at the time of travel)",
          ),
        },
        photograph: {
          ...documentRef(PHOTO_TYPES, {
            // aspect_ratio is measured by the client at upload. It is the ONLY
            // clause of the spec below a machine can check, which is why it is a
            // property and the rest is text.
            properties: { aspect_ratio: { type: "number" } },
            // The literal specification, carried whole. Dimensions first: it is
            // the requirement most often got wrong and the one stated most
            // precisely.
            "x-evPhotoSpec": {
              dimensions_text: "2 × 2 inches",
              width_in: 2,
              height_in: 2,
              aspect_ratio: 1,
              colour: true,
              recency: "recent",
              background: "plain white, shadow-free",
              facing: "front-facing",
              framing: "close-up of the head and partial shoulders, face centred, fully visible from forehead to chin",
              expression: "neutral",
              eyes: "open",
              obstructions_not_allowed: ["hair covering the face", "frames covering the face"],
              filters_not_allowed: true,
              quality: "clear, sharp, with adequate brightness and contrast",
              print_not_accepted: ["Polaroid photos", "photos printed on ordinary printers"],
              _source: src(
                "documents_required",
                "A coloured recent passport-size photograph with a white background, must be front-facing and measure 2 × 2 inches, clear, sharp, with adequate brightness and contrast, without any colour filter, showing a close-up of the head and partial shoulders with the face centred and a neutral expression, fully visible from forehead to chin with eyes open, without hair or frames covering the face, against a plain white shadow-free background. Polaroid photos or those printed on ordinary printers are not accepted.",
              ),
              _ambiguity:
                "No DPI, no minimum pixel dimensions, no file size, no head-height percentage. A digital upload can " +
                "therefore only be checked for squareness (2 × 2 gives aspect ratio 1) and for being colour. Every " +
                "other clause is stated to the applicant and judged by a human.",
            },
          }),
          _source: src("documents_required", "A coloured recent passport-size photograph with a white background"),
        },
        flight_ticket: {
          ...documentRef(SCAN_TYPES, {
            "x-evAnnotation": { highlight: "yellow", fields: ["applicant name", "entry from the UAE", "exit from the UAE"] },
          }),
          _source: src(
            "documents_required",
            "Confirmed Return/Onward Emirates ticket, highlighting the applicant's name, entry and exit from the UAE in yellow.",
          ),
        },
        hotel_voucher: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: documentRef(SCAN_TYPES, { "x-evAnnotation": { highlight: "yellow", fields: ["check-in date", "check-out date"] } }),
          _source: src(
            "documents_required",
            "Confirmed hotel voucher with confirmation number, applicant's name, check-in, check-out dates highlighted in yellow for the entire stay.",
          ),
        },
        host_tenancy_or_title_deed: {
          ...documentRef(SCAN_TYPES, { "x-evAnnotation": { highlight: "yellow", fields: ["tenant's name"] } }),
          _source: src("eligibility", "Valid tenancy contract /Ejari or title deed of the host."),
        },
        host_emirates_id: { ...documentRef(SCAN_TYPES), _source: src("eligibility", "UAE resident card of the Host.") },
        host_relationship_proof: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "Relationship with the Host.", "verbatim", {
            note: "Listed under Criteria III as a supporting document in its own right, so it is a slot and not only a text field.",
          }),
        },
        residence_permit_or_visa: {
          ...documentRef(SCAN_TYPES, { "x-evScan": { colour: true } }),
          _source: src(
            "documents_required",
            "Coloured photocopy of a valid visa or residence proof if the Nationality is different from the Country of Residence.",
          ),
        },
        previous_passport_travel_pages: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "Pages exhibiting the evidence of the travel and Visa in current or previous Passport."),
        },
        form_16_last_2_years: { ...documentRef(SCAN_TYPES), _source: src("eligibility", "last 2 Years Form 16") },
        income_tax_returns_last_2_years: { ...documentRef(SCAN_TYPES), _source: src("eligibility", "last 2 Years Income Tax return") },
        fixed_deposit_certificates: { ...documentRef(SCAN_TYPES), _source: src("eligibility", "fixed deposits in Banks or Post Office") },
        bank_statement: {
          ...documentRef(SCAN_TYPES, { "x-evPhysicalOriginal": true }),
          _source: src("eligibility", "Original Bank Statement.", "verbatim", {
            note:
              "The prose says ORIGINAL. An upload is a scan and cannot satisfy that; the slot exists so the operator " +
              "can prepare and check the packet, and the UI says the paper original goes to the centre.",
          }),
        },
        marriage_certificate_or_affidavit: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "Marriage Certificate / Notarised Affidavit."),
        },
        noc_from_parents: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "required to submit NOC from parents with photo id proof"),
          _ambiguity: "Never made required: \"traveling immediately after marriage\" has no stated window to test against.",
        },
        parent_photo_id: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "NOC from parents with photo id proof"),
          _ambiguity: "Same window problem as the NOC.",
        },
        wedding_card: {
          ...documentRef(SCAN_TYPES),
          _source: src("eligibility", "Wedding card"),
          _ambiguity: "Same window problem as the NOC.",
        },
        marriage_photograph: {
          ...documentRef(PHOTO_TYPES),
          _source: src("eligibility", "Marriage photograph of the couple."),
          _ambiguity: "Same window problem as the NOC.",
        },
      },
    },
  },

  // Conditional requirements JSON Schema CAN express. The rest are rules.
  allOf: [
    requireWhen(WHEN.staysInHotel, ["stay.hotel_bookings", "documents.hotel_voucher"]),
    requireWhen(WHEN.hostApplies, [
      "stay.host",
      "stay.host.full_name",
      "stay.host.relationship",
      "stay.host.bedrooms",
      "documents.host_tenancy_or_title_deed",
      "documents.host_emirates_id",
    ]),
    requireWhen(WHEN.routeInvitation, ["documents.host_relationship_proof"]),
    requireWhen(WHEN.routeTravel, [
      "eligibility.travel_record",
      "eligibility.travel_record.kind",
      "eligibility.travel_record.country",
      "documents.previous_passport_travel_pages",
    ]),
    requireWhen(WHEN.priorVisit, ["eligibility.travel_record.travelled_on"]),
    requireWhen(WHEN.priorValidVisa, ["eligibility.travel_record.visa_valid_until"]),
    requireWhen(WHEN.routeFinancial, ["eligibility.financial", "eligibility.financial.basis", "documents.bank_statement"]),
    requireWhen(WHEN.incomeBasis, ["eligibility.financial.gross_annual_income_inr_minor"]),
    requireWhen(WHEN.basisForm16, ["documents.form_16_last_2_years"]),
    requireWhen(WHEN.basisItr, ["documents.income_tax_returns_last_2_years"]),
    requireWhen(WHEN.basisDeposits, [
      "eligibility.financial.investment_value_inr_minor",
      "eligibility.financial.investment_institution_type",
      "eligibility.financial.investment_opened_on",
      "eligibility.financial.investment_matures_on",
      "documents.fixed_deposit_certificates",
    ]),
    requireWhen(WHEN.recentlyMarried, ["circumstances.spouse_name_endorsed_on_passport"]),
    requireWhen(WHEN.spouseNotEndorsed, ["documents.marriage_certificate_or_affidavit"]),
  ],

  // ── Rules JSON Schema cannot state ─────────────────────────────────────────
  //
  // Date arithmetic, comparisons between two fields, anything spanning an array.
  // The op set is CLOSED: an iOS evaluator implements exactly these and no more,
  // and a corridor that needs a new op adds it here first.
  "x-evRuleOps": [
    "equals", "present", "not", "all_of", "any_of",
    "date_after", "date_before", "date_equals", "days_between_lte",
    "number_gt", "number_gte",
    "array_days_total_gte", "array_covers_range", "array_first_equals", "array_last_equals",
  ],
  // Path conventions, stated because getting them wrong is silent.
  //   field, than, from, to        dotted paths from the ROOT of the instance
  //   item_field, range_from/_to   `item_field` is relative to one element of
  //                                `items`; range_from and range_to are root paths
  //   than: "today"                the literal string, evaluated at check time
  //   valueFrom                    compare against ANOTHER field, not a constant
  //   plus: {years|months|days}    signed offset applied to `than`
  "x-evRulePaths": {
    root: ["field", "than", "from", "to", "items", "range_from", "range_to"],
    relative_to_item: ["item_field", "item_from", "item_to"],
  },
  "x-evRules": [
    {
      id: "passport_valid_6_months_at_travel",
      effect: "block",
      override: null,
      assert: { op: "date_after", field: "applicant.passport_expiry_date", than: "travel.entry_date", plus: { months: 6 }, inclusive: true },
      message: "Your passport has to be valid for at least six months on the day you enter the UAE.",
      _source: src("documents_required", "(Valid for minimum period of 6 months at the time of travel)"),
    },
    {
      id: "exit_after_entry",
      effect: "block",
      override: null,
      assert: { op: "date_after", field: "travel.exit_date", than: "travel.entry_date" },
      message: "The date you leave has to be after the date you arrive.",
      _source: src("documents_required", "entry and exit from the UAE in yellow", "implied-by-rule"),
    },
    {
      id: "stay_within_60_days",
      effect: "block",
      override: null,
      assert: { op: "days_between_lte", from: "travel.entry_date", to: "travel.exit_date", days: 60 },
      message: "This visa allows a stay of 60 days.",
      _source: src("visa_fees", "Duration of stay: 60 days"),
    },
    {
      id: "ticket_must_be_emirates",
      effect: "block",
      override: null,
      assert: { op: "equals", field: "travel.carrier_is_emirates", value: true },
      message: "This visa is issued against an Emirates ticket. If you are flying another airline, this is not the right application.",
      _source: src("eligibility", "Selection / determination of a visa category are based on Emirates ticket itinerary."),
    },
    {
      id: "hotel_check_in_matches_flight",
      effect: "block",
      override: "operator",
      when: WHEN.staysInHotel,
      assert: { op: "array_first_equals", items: "stay.hotel_bookings", item_field: "check_in", than: "travel.entry_date" },
      message: "Your first check-in has to be the day you arrive.",
      _source: src("documents_required", "(Check- in, Check- out dates on the hotel confirmation must match the dates on flight tickets)"),
    },
    {
      id: "hotel_check_out_matches_flight",
      effect: "block",
      override: "operator",
      when: WHEN.staysInHotel,
      assert: { op: "array_last_equals", items: "stay.hotel_bookings", item_field: "check_out", than: "travel.exit_date" },
      message: "Your last check-out has to be the day you leave.",
      _source: src("documents_required", "(Check- in, Check- out dates on the hotel confirmation must match the dates on flight tickets)"),
    },
    {
      id: "hotel_covers_whole_stay",
      effect: "block",
      override: "operator",
      when: WHEN.staysInHotel,
      assert: {
        op: "array_covers_range",
        items: "stay.hotel_bookings",
        item_from: "check_in",
        item_to: "check_out",
        range_from: "travel.entry_date",
        range_to: "travel.exit_date",
      },
      message: "Your bookings have to cover every night between arrival and departure, with no gap.",
      _source: src("documents_required", "check-in, check-out dates highlighted in yellow for the entire stay"),
    },
    {
      id: "hotel_booking_at_least_31_days",
      effect: "block",
      override: "operator",
      when: WHEN.staysInHotel,
      assert: { op: "array_days_total_gte", items: "stay.hotel_bookings", item_from: "check_in", item_to: "check_out", days: 31 },
      message: "For the 60-day visa the hotel booking has to run 31 days or more.",
      _source: src("documents_required", "For 60-day single entry visa, Hotel booking should be 31days or more."),
      _ambiguity:
        "Stated flatly, and it collides with a short trip: the prose does not say what happens when the trip itself " +
        "is under 31 days. Not softened here, because softening would be a guess — hence override: operator.",
    },
    {
      id: "host_home_has_two_bedrooms",
      effect: "block",
      override: null,
      when: WHEN.hostApplies,
      assert: { op: "number_gte", field: "stay.host.bedrooms", value: 2 },
      message: "Your host's home has to have two or more bedrooms.",
      _source: src("eligibility", "**Host should have an apartment with two or more bedrooms."),
    },
    {
      id: "residence_proof_when_nationality_differs",
      effect: "block",
      override: null,
      when: WHEN.livesAbroad,
      assert: { op: "present", field: "documents.residence_permit_or_visa" },
      message: "You live somewhere other than the country of your passport, so add your visa or residence proof.",
      _source: src(
        "documents_required",
        "Coloured photocopy of a valid visa or residence proof if the Nationality is different from the Country of Residence.",
        "verbatim",
        { note: "A rule and not an if/then, because JSON Schema cannot compare two sibling fields." },
      ),
    },
    {
      id: "prior_travel_within_3_years",
      effect: "block",
      override: null,
      when: { op: "all_of", checks: [WHEN.routeTravel, WHEN.priorVisit] },
      assert: { op: "date_after", field: "eligibility.travel_record.travelled_on", than: "today", plus: { years: -3 } },
      message: "The trip has to have been in the last three years.",
      _source: src("eligibility", "travelled at least once in the last 3 years"),
    },
    {
      id: "prior_visa_still_valid",
      effect: "block",
      override: null,
      when: { op: "all_of", checks: [WHEN.routeTravel, WHEN.priorValidVisa] },
      assert: { op: "date_after", field: "eligibility.travel_record.visa_valid_until", than: "today", inclusive: true },
      message: "That visa has to still be valid today.",
      _source: src("eligibility", "has a valid visa for"),
    },
    {
      id: "income_exceeds_2_lakh",
      effect: "block",
      override: null,
      when: WHEN.incomeBasis,
      assert: { op: "number_gt", field: "eligibility.financial.gross_annual_income_inr_minor", value: 20000000 },
      message: "Gross income has to be more than INR 2 lakh a year.",
      _source: src("eligibility", "which should exceed INR 2 lakhs Per annum"),
    },
    {
      id: "investment_at_least_5_lakh",
      effect: "block",
      override: null,
      when: WHEN.basisDeposits,
      assert: { op: "number_gte", field: "eligibility.financial.investment_value_inr_minor", value: 50000000 },
      message: "The deposit has to be INR 5 lakh or more.",
      _source: src("eligibility", "Investments amounting to INR 5 Lakhs or above"),
    },
    {
      id: "investment_at_least_a_year_old",
      effect: "block",
      override: null,
      when: WHEN.basisDeposits,
      assert: { op: "date_before", field: "eligibility.financial.investment_opened_on", than: "today", plus: { years: -1 }, inclusive: true },
      message: "The deposit has to have been opened at least a year ago.",
      _source: src("eligibility", "Investments to be a year prior from the date of application"),
    },
    {
      id: "investment_runs_another_12_months",
      effect: "block",
      override: null,
      when: WHEN.basisDeposits,
      assert: { op: "date_after", field: "eligibility.financial.investment_matures_on", than: "today", plus: { months: 12 } },
      message: "The deposit has to have more than 12 months left to run.",
      _source: src("eligibility", "with a validity of more than 12 months"),
      _ambiguity: "The prose does not say 12 months from WHEN. Read as from the date of application, matching the sentence it sits in.",
    },
    {
      id: "young_applicant_travels_with_parents",
      effect: "review", // never a refusal — see the ambiguity
      override: "operator",
      when: { op: "not", of: { op: "equals", field: "circumstances.travelling_with_parents", value: true } },
      assert: { op: "date_before", field: "applicant.date_of_birth", than: "travel.entry_date", plus: { years: -21 } },
      message: "Dubai immigration accepts applications from minors only when they travel with a parent.",
      _source: src(
        "eligibility",
        "Emirates regret its inability to sponsor unaccompanied minors and students. Dubai immigration will consider applications from minors and students only if they are travelling with parents.",
      ),
      _ambiguity:
        "The prose never defines \"minor\". India says 18, the UAE says 21. Guessing either would be wrong, so the " +
        "rule fires at the WIDER threshold (21) and only flags for operator review — it can never refuse anyone.",
    },
    {
      id: "student_travels_with_parents",
      effect: "review",
      override: "operator",
      when: { op: "equals", field: "circumstances.is_student", value: true },
      assert: { op: "equals", field: "circumstances.travelling_with_parents", value: true },
      message: "Dubai immigration accepts applications from students only when they travel with a parent.",
      _source: src("eligibility", "Emirates regret its inability to sponsor unaccompanied minors and students."),
      _ambiguity: "\"students\" is undefined in the prose. Review only.",
    },
    {
      id: "photograph_is_square",
      effect: "block",
      override: "operator",
      assert: { op: "equals", field: "documents.photograph.aspect_ratio", value: 1 },
      message: "The photo has to be square — the spec is 2 × 2 inches.",
      _source: src("documents_required", "must be front-facing and measure 2 × 2 inches"),
      _ambiguity:
        "The only clause of the photo spec a machine can check on an upload. The renderer should offer a crop rather " +
        "than refuse, which is why the override exists.",
    },
  ],
};

// ── UI schema: order, grouping, and Earth Visa's voice ───────────────────────
//
// Labels are plain and sentence case. Help text appears only where the
// government's requirement is genuinely non-obvious, and where it does it quotes
// rather than paraphrases. Nothing here sells anything.

const uiSchema = {
  version: 1,
  locale: "en-IN",
  schema_id: jsonSchema.$id,
  submit_label: "Send it to us to check",
  // The renderer implements exactly these widgets and no others.
  "x-evWidgets": ["text", "name", "date", "country", "choice", "boolean", "integer", "money", "document", "fixed"],
  steps: [
    {
      id: "passport",
      title: "Your passport",
      subtitle: "Type these exactly as they are printed. A mismatch is the most common reason a file comes back.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              path: "applicant.surname",
              label: "Surname",
              widget: "name",
              help: "As printed on the bio page.",
              warn: "Brackets in a name are refused outright, and the passport has to be amended before the visa can be submitted.",
              _source: src("documents_required", "Passports containing special characters such as brackets in the name will not be accepted"),
            },
            { path: "applicant.given_names", label: "Given names", widget: "name", help: "All of them, in the order the passport prints them." },
            { path: "applicant.date_of_birth", label: "Date of birth", widget: "date" },
            {
              path: "applicant.sex",
              label: "Sex",
              widget: "choice",
              optional: true,
              options: [
                { value: "M", label: "Male" },
                { value: "F", label: "Female" },
                { value: "X", label: "Unspecified" },
              ],
            },
            { path: "applicant.nationality_iso3", label: "Nationality", widget: "country" },
            {
              path: "applicant.country_of_residence_iso3",
              label: "Where you live",
              widget: "country",
              help: "This decides which centre takes your file, which is not always the country on your passport.",
            },
            { path: "applicant.passport_number", label: "Passport number", widget: "text" },
            { path: "applicant.passport_issue_date", label: "Date of issue", widget: "date", optional: true },
            {
              path: "applicant.passport_expiry_date",
              label: "Date of expiry",
              widget: "date",
              help: "It has to be at least six months away on the day you enter the UAE.",
              _source: src("documents_required", "(Valid for minimum period of 6 months at the time of travel)"),
            },
            { path: "applicant.passport_place_of_issue", label: "Place of issue", widget: "text", optional: true },
          ],
        },
      ],
    },

    {
      id: "contact",
      title: "How we reach you",
      subtitle: "Only so we can tell you if something in your file needs fixing. The UAE asks for neither.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { path: "contact.email", label: "Email", widget: "text", optional: true, prefill: "account.email" },
            { path: "contact.phone_e164", label: "Phone", widget: "text", optional: true, prefill: "account.phone" },
          ],
        },
      ],
    },

    {
      id: "trip",
      title: "Your trip",
      blocks: [
        {
          kind: "notice",
          tone: "info",
          text: "This visa is issued against an Emirates ticket, and the category is decided from that itinerary.",
          _source: src("eligibility", "Selection / determination of a visa category are based on Emirates ticket itinerary."),
        },
        {
          kind: "fields",
          fields: [
            { path: "travel.purpose", label: "Purpose", widget: "fixed", value_label: "Tourism" },
            {
              path: "travel.carrier_is_emirates",
              label: "Your flights are booked on Emirates",
              widget: "boolean",
              help: "Return or onward, and the ticket has to be confirmed — not held.",
              _source: src("documents_required", "Confirmed Return/Onward Emirates ticket"),
            },
            { path: "travel.entry_date", label: "Date you arrive in the UAE", widget: "date" },
            { path: "travel.exit_date", label: "Date you leave", widget: "date" },
          ],
        },
        {
          kind: "notice",
          tone: "info",
          text: "You can stay 60 days. The visa itself has to be used within 58 days of being issued.",
          _source: src("overview", "The entry validity for all types of tourist visa is 58 days from the date of issue"),
        },
      ],
    },

    {
      id: "stay",
      title: "Where you will stay",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              path: "stay.accommodation_type",
              label: "Where you are staying",
              widget: "choice",
              options: [
                { value: "hotel", label: "A hotel" },
                { value: "family_or_friends", label: "With family or friends" },
              ],
            },
          ],
        },
        {
          kind: "repeater",
          path: "stay.hotel_bookings",
          visibleWhen: WHEN.staysInHotel,
          min: 1,
          max: 2,
          add_label: "Add a second booking",
          item_title: "Booking",
          help: "Two bookings at most, and together they have to cover the whole stay. For the 60-day visa they have to run 31 days or more.",
          _source: src(
            "documents_required",
            "Note that only up to two hotel bookings are allowed for the entire stay period. For 60-day single entry visa, Hotel booking should be 31days or more.",
          ),
          fields: [
            { path: "hotel_name", label: "Hotel", widget: "text" },
            { path: "confirmation_number", label: "Confirmation number", widget: "text", help: "The voucher has to show it." },
            { path: "check_in", label: "Check-in", widget: "date", help: "Has to match the date on your ticket." },
            { path: "check_out", label: "Check-out", widget: "date", help: "Has to match the date on your ticket." },
            { path: "city", label: "City", widget: "text", optional: true },
          ],
        },
        {
          kind: "fields",
          visibleWhen: WHEN.hostApplies,
          title: "Your host",
          fields: [
            { path: "stay.host.full_name", label: "Host's full name", widget: "name", help: "As it appears on the tenancy contract or title deed." },
            {
              path: "stay.host.relationship",
              label: "How you know them",
              widget: "text",
              help: "The centre asks for the relationship. Say it plainly — brother, mother-in-law, friend from work.",
              warn: "The two published lists disagree about whether a friend qualifies or only immediate family. Say what is true; we will check it before filing.",
              _source: src("eligibility", "Criteria III: Invitation from immediate family member residing in UAE on family status"),
            },
            {
              path: "stay.host.bedrooms",
              label: "Bedrooms in their home",
              widget: "integer",
              help: "Two or more, or the host cannot accommodate the application.",
              _source: src("eligibility", "**Host should have an apartment with two or more bedrooms."),
            },
            { path: "stay.host.emirate", label: "Emirate", widget: "text", optional: true },
            { path: "stay.host.address", label: "Address", widget: "text", optional: true },
          ],
        },
      ],
    },

    {
      id: "eligibility",
      title: "How you qualify",
      subtitle: "Any one of the three is enough.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              path: "eligibility.route",
              label: "Which one applies to you",
              widget: "choice",
              options: [
                { value: "travel_record", label: "I have travelled to, or hold a visa for, one of the listed countries" },
                { value: "financial_records", label: "I can show income or a fixed deposit" },
                { value: "uae_family_invitation", label: "Family in the UAE are inviting me" },
              ],
              _source: src("eligibility", "Applicant can qualify from any one of the below criteria for Dubai visa application."),
            },
          ],
        },
        {
          kind: "fields",
          visibleWhen: WHEN.routeTravel,
          title: "Your travel record",
          fields: [
            {
              path: "eligibility.travel_record.kind",
              label: "Which is it",
              widget: "choice",
              options: [
                { value: "visited", label: "I travelled there in the last three years" },
                { value: "valid_visa", label: "I hold a valid visa for there" },
              ],
            },
            {
              path: "eligibility.travel_record.country",
              label: "Which country",
              widget: "text",
              help: "USA, UK, Schengen countries, European Union, Australia, New Zealand, Russia, Canada and Japan are the ones named. The list is written as examples, so others may count.",
              _source: src("eligibility", "countries like USA, UK, Schengen countries, European Union, Australia, New Zealand, Russia, Canada and Japan"),
            },
            { path: "eligibility.travel_record.travelled_on", label: "When you travelled", widget: "date", visibleWhen: WHEN.priorVisit },
            { path: "eligibility.travel_record.visa_valid_until", label: "Valid until", widget: "date", visibleWhen: WHEN.priorValidVisa },
          ],
        },
        {
          kind: "fields",
          visibleWhen: WHEN.routeFinancial,
          title: "Your financial record",
          fields: [
            {
              path: "eligibility.financial.basis",
              label: "What you can show",
              widget: "choice",
              options: [
                { value: "form_16_2y", label: "Form 16 for the last two years" },
                { value: "itr_2y", label: "Income tax returns for the last two years" },
                { value: "fixed_deposits", label: "A fixed deposit" },
              ],
            },
            {
              path: "eligibility.financial.gross_annual_income_inr_minor",
              label: "Gross income a year",
              widget: "money",
              currency: "INR",
              visibleWhen: WHEN.incomeBasis,
              help: "It has to be more than INR 2 lakh. Business, profession or employment all count.",
              _source: src("eligibility", "which should exceed INR 2 lakhs Per annum"),
            },
            {
              path: "eligibility.financial.investment_value_inr_minor",
              label: "Value of the deposit",
              widget: "money",
              currency: "INR",
              visibleWhen: WHEN.basisDeposits,
              help: "INR 5 lakh or above.",
            },
            {
              path: "eligibility.financial.investment_institution_type",
              label: "Held with",
              widget: "choice",
              visibleWhen: WHEN.basisDeposits,
              options: [
                { value: "bank", label: "A bank" },
                { value: "post_office", label: "A post office" },
              ],
              help: "Co-operative banks and societies are not accepted.",
              _source: src("eligibility", "Investments in Co-operative Banks or Societies are not acceptable."),
            },
            {
              path: "eligibility.financial.investment_opened_on",
              label: "Opened on",
              widget: "date",
              visibleWhen: WHEN.basisDeposits,
              help: "At least a year before you apply.",
            },
            {
              path: "eligibility.financial.investment_matures_on",
              label: "Matures on",
              widget: "date",
              visibleWhen: WHEN.basisDeposits,
              help: "More than 12 months away.",
            },
          ],
        },
        {
          kind: "notice",
          tone: "caution",
          visibleWhen: WHEN.routeFinancial,
          text:
            "In some cases the centre asks for a refundable security deposit of USD 1,000 instead. It comes back after " +
            "you return and show the UAE entry and exit stamps. It is not something you can choose — they ask, or they do not.",
          _source: src("eligibility", "In some case Security Deposit of USD 1000 (Refundable upon return and after producing the entry & exit stamp in UAE)."),
        },
        {
          kind: "notice",
          tone: "info",
          visibleWhen: WHEN.routeInvitation,
          text: "Your host's details are on the previous step.",
        },
      ],
    },

    {
      id: "circumstances",
      title: "Your circumstances",
      subtitle: "Four questions that change which documents you need. Skip any that do not apply.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              path: "circumstances.recently_married",
              label: "You married recently",
              widget: "boolean",
              optional: true,
              help: "The centre has extra requirements for couples travelling soon after a wedding. It does not say how soon, so we ask.",
              _source: src(
                "eligibility",
                "Newly married couples traveling immediately after marriage are required to submit NOC from parents with photo id proof, Wedding card and Marriage photograph of the couple.",
              ),
            },
            {
              path: "circumstances.spouse_name_endorsed_on_passport",
              label: "Your spouse's name is endorsed in your passport",
              widget: "boolean",
              visibleWhen: WHEN.recentlyMarried,
              help: "If it is not, a marriage certificate or a notarised affidavit is needed.",
              _source: src("eligibility", "In case of the spouse’s name not endorsed on the passport"),
            },
            { path: "circumstances.is_student", label: "You are a student", widget: "boolean", optional: true },
            {
              path: "circumstances.travelling_with_parents",
              label: "You are travelling with a parent",
              widget: "boolean",
              optional: true,
              help: "Dubai immigration considers applications from minors and students only when they travel with parents.",
              _source: src("eligibility", "Dubai immigration will consider applications from minors and students only if they are travelling with parents."),
            },
          ],
        },
      ],
    },

    {
      id: "documents",
      title: "Your documents",
      subtitle: "Photograph or scan each one. They go straight to storage from your phone — they never sit on our servers.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { path: "documents.passport_front_cover", label: "Passport front cover", widget: "document", help: "In colour." },
            { path: "documents.passport_bio_page", label: "Passport bio page", widget: "document", help: "In colour." },
            {
              path: "documents.photograph",
              label: "Passport photograph",
              widget: "document",
              help:
                "2 × 2 inches, colour, recent, white background. Front-facing, head and partial shoulders, face centred, " +
                "neutral expression, forehead to chin visible, eyes open, nothing across the face. No filters. Polaroids " +
                "and photos run off an ordinary printer are refused.",
              _source: src("documents_required", "must be front-facing and measure 2 × 2 inches"),
            },
            {
              path: "documents.flight_ticket",
              label: "Emirates ticket",
              widget: "document",
              help: "Confirmed, return or onward. Your name and both UAE dates get highlighted in yellow — we do that part.",
            },
            {
              path: "documents.hotel_voucher",
              label: "Hotel voucher",
              widget: "document",
              multiple: true,
              max: 2,
              visibleWhen: WHEN.staysInHotel,
              help: "One per booking, showing the confirmation number and your name.",
            },
            { path: "documents.host_tenancy_or_title_deed", label: "Host's tenancy contract, Ejari or title deed", widget: "document", visibleWhen: WHEN.hostApplies },
            { path: "documents.host_emirates_id", label: "Host's UAE resident card", widget: "document", visibleWhen: WHEN.hostApplies },
            { path: "documents.host_relationship_proof", label: "Proof of how you are related", widget: "document", visibleWhen: WHEN.routeInvitation },
            {
              path: "documents.residence_permit_or_visa",
              label: "Your visa or residence proof",
              widget: "document",
              help: "In colour. Needed because you live outside the country of your passport.",
              visibleWhen: WHEN.livesAbroad,
            },
            {
              path: "documents.previous_passport_travel_pages",
              label: "Passport pages showing that travel",
              widget: "document",
              visibleWhen: WHEN.routeTravel,
              help: "Current or previous passport — whichever carries the stamp or the visa.",
            },
            { path: "documents.form_16_last_2_years", label: "Form 16, last two years", widget: "document", visibleWhen: WHEN.basisForm16 },
            { path: "documents.income_tax_returns_last_2_years", label: "Income tax returns, last two years", widget: "document", visibleWhen: WHEN.basisItr },
            { path: "documents.fixed_deposit_certificates", label: "Fixed deposit certificates", widget: "document", visibleWhen: WHEN.basisDeposits },
            {
              path: "documents.bank_statement",
              label: "Bank statement",
              widget: "document",
              visibleWhen: WHEN.routeFinancial,
              help: "The centre wants the original on paper. Send us a scan so we can check it, and carry the original in.",
              _source: src("eligibility", "Original Bank Statement."),
            },
            {
              path: "documents.marriage_certificate_or_affidavit",
              label: "Marriage certificate or notarised affidavit",
              widget: "document",
              visibleWhen: WHEN.spouseNotEndorsed,
            },
            { path: "documents.noc_from_parents", label: "NOC from parents", widget: "document", optional: true, visibleWhen: WHEN.recentlyMarried },
            { path: "documents.parent_photo_id", label: "Parents' photo ID", widget: "document", optional: true, visibleWhen: WHEN.recentlyMarried },
            { path: "documents.wedding_card", label: "Wedding card", widget: "document", optional: true, visibleWhen: WHEN.recentlyMarried },
            { path: "documents.marriage_photograph", label: "Marriage photograph", widget: "document", optional: true, visibleWhen: WHEN.recentlyMarried },
          ],
        },
        {
          kind: "notice",
          tone: "info",
          visibleWhen: WHEN.recentlyMarried,
          text: "The last four are asked of couples travelling immediately after the wedding. The centre does not say how soon counts, so add them if it might be you.",
          _source: src(
            "eligibility",
            "Newly married couples traveling immediately after marriage are required to submit NOC from parents with photo id proof, Wedding card and Marriage photograph of the couple.",
          ),
        },
        {
          kind: "notice",
          tone: "info",
          text: "We fill and print the application form itself from what you have entered.",
          _source: src("documents_required", "Visa Application form duly filled*"),
        },
      ],
    },
  ],

  review: {
    title: "Check before you send",
    // Said at the point of handing over, because that is the moment the promise
    // matters and the moment it would be easiest to overstate.
    note: "Earth Visa checks your application and files it for you. The consulate decides the outcome, and no one can promise a visa.",
  },

  // Shown once, before submission. Both are stated by the source and both cost
  // money, so neither is buried in a linked page.
  closing_notices: [
    {
      tone: "caution",
      text: "The visa fee is not refundable once it is paid, whatever the outcome.",
      _source: src("visa_fees", "Visa fee once paid remains non-refundable under any circumstances"),
    },
    {
      tone: "caution",
      text: "Cancelling an approved application costs INR 3,465 per visa, and only the centre you filed at can cancel it.",
      _source: src("visa_fees", "The cancellation charge per visa is 3465 (INR)"),
    },
  ],
};

// ── The gates ────────────────────────────────────────────────────────────────

/** Walks any structure and yields every `_source`-shaped object with a quote. */
function* sourceAnnotations(node, trail = "$") {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* sourceAnnotations(node[i], `${trail}[${i}]`);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (typeof node.quote === "string" && typeof node.path === "string") yield [trail, node];
  for (const [k, v] of Object.entries(node)) yield* sourceAnnotations(v, `${trail}.${k}`);
}

/**
 * Fails the seed if any quoted fragment is no longer a verbatim substring of the
 * prose it claims to come from. This is the whole reason to trust the
 * annotations: a VFS reword breaks the run instead of shipping a form that cites
 * text nobody wrote.
 */
function verifySources() {
  const failures = [];
  let checked = 0;
  for (const [trail, ann] of sourceAnnotations({ jsonSchema, uiSchema })) {
    const field = /^visa_types\[\d+\]\.(\w+)$/.exec(ann.path)?.[1];
    const prose = field ? vt[field] : undefined;
    if (typeof prose !== "string") {
      failures.push(`${trail}: ${ann.path} is not a prose field on this visa type`);
      continue;
    }
    checked++;
    if (!prose.includes(ann.quote)) failures.push(`${trail}: not found in ${ann.path}\n    quote: ${JSON.stringify(ann.quote)}`);
  }
  if (failures.length) {
    console.error(`${failures.length} of ${checked + failures.length} source quotes no longer match ${SOURCE_FILE}:\n`);
    for (const f of failures) console.error("  " + f);
    console.error("\nThe prose changed upstream. Re-read it and re-derive the fields before seeding.");
    process.exit(1);
  }
  return checked;
}

/**
 * Fails the seed if anything in `required` traces to an operational source
 * rather than to the prose — the rule stated at the top of this file, enforced
 * rather than merely intended.
 */
function verifyRequiredAreTraced() {
  const bad = [];
  (function walk(node, trail) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.required) && node.properties) {
      for (const name of node.required) {
        const prop = node.properties[name];
        if (!prop) continue;
        if (prop._source && prop._source.derivation === "operational") bad.push(`${trail}.${name}`);
        if (prop._ambiguity && !prop._source) bad.push(`${trail}.${name} (ambiguous and required)`);
      }
    }
    for (const [k, v] of Object.entries(node)) if (k !== "_source") walk(v, `${trail}.${k}`);
  })(jsonSchema, "$");
  if (bad.length) {
    console.error("These fields are required but do not trace to the source prose:\n  " + bad.join("\n  "));
    process.exit(1);
  }
}

const quotesChecked = verifySources();
verifyRequiredAreTraced();

// ── What could not be structured ─────────────────────────────────────────────
//
// Stored on the row, not only in a commit message, because the next person to
// touch this corridor needs to know what the prose refused to tell us.

const NOTE = `Authored by hand from ${raw.source_url} via ${SOURCE_FILE} visa_types[${SOURCE_INDEX}].
Source digest ${sourceDigest}.

Not structured, and why.

1. The government fee. visa_fees renders as "[Table:Duration Of Stay : 60 Days]" -
   the crawl kept the table's caption and lost its cells, so no amount exists in
   the source at all. corridors.govt_fee_minor is 0 because the column is NOT
   NULL, which means it is UNKNOWN and not free; the corridor must stay closed
   until someone reads the official schedule and enters it deliberately. The
   cancellation charge (INR 3,465) and the extension fee (AED 850) DID survive and
   are carried in json_schema["x-evCorridor"].

2. The application form's own fields. documents_required opens with "Visa
   Application form duly filled*" and application_form links a PDF that is not in
   this dataset, so every field on that PDF is invisible to us. This schema
   captures what the prose describes - the document list, plus the passport
   identity those documents carry - and the operator produces the PDF from it.
   Closing the gap needs the PDF itself.

3. "minor". Used twice, defined never. India sets majority at 18, the UAE at 21.
   The rule fires at 21 - the wider net - and only flags for operator review.

4. "students". No age, no level, no full-time test. Asked as a plain question and
   used only to flag.

5. "newly married" / "traveling immediately after marriage". No window given, so a
   marriage date cannot decide it. Asked. The four extra documents stay optional.

6. Who may host. documents_required says "If visiting Family or Friends";
   eligibility Criteria III says "immediate family member residing in UAE on family
   status". The two disagree, so relationship is free text and not an enum.

7. The USD 1,000 security deposit. "In some case" - imposed by the centre, not
   elected by the applicant. Shown as a notice, kept out of the eligibility enum.

8. The 58-day entry validity. It runs from the date of issue, which does not exist
   until after filing, so nothing at form time can check it. Stated to the
   applicant instead.

9. The photo spec beyond squareness. No DPI, no pixel minimum, no file size, no
   head-height percentage. "2 x 2 inches" gives aspect ratio 1 and nothing else a
   machine can test.

10. "Original Bank Statement". An upload is a scan by definition. The slot exists
    so the packet can be checked; the paper original is the applicant's to carry.

11. The yellow highlighting on tickets and vouchers. A preparation instruction, not
    applicant data. Recorded as x-evAnnotation on the slots so the operator's
    checklist can render it.

12. Hotel booking >= 31 days on a trip shorter than 31 days. The prose states the
    31-day floor flatly and says nothing about short trips. Left as stated, with an
    operator override rather than a softening we invented.

13. processing_time is null in the source, so processing_days_p50 is left NULL. A
    number here would be invented, and it is the number applicants plan around.`;

// ── Corridor identity ────────────────────────────────────────────────────────
//
// Keyed on RESIDENCE x destination, because residence decides where and how you
// apply. data/vfs is keyed source_iso3 x destination_iso3 and `source` there is
// the application-centre jurisdiction, so source IND means "applying from India",
// not "Indian passport".
//
// visa_product_id is OURS. VFS names and the catalogue's names overlap on 0.8% of
// pairs, so no spec may ever key on a name from either.

const CORRIDOR = {
  residence_iso3: "IND",
  destination_iso3: "ARE",
  visa_product_id: "are-tourist-60d-single",
  visa_type: vt.name, // the source's own name, kept for tracing back
  display_name: "United Arab Emirates — 60-day tourist visa",
  channel: "vfs", // VFS Global: appointment plus biometrics, so never automatable
  govt_fee_minor: 0, // UNKNOWN, not free. See NOTE 1
  service_fee_minor: 0, // not priced. PAYMENT IS DEFERRED
  currency: "INR",
  govt_fee_paid_by: "applicant", // we never hold the government fee
  processing_days_p50: null, // source's processing_time is null. See NOTE 13
};

// ── Output modes that need no database ───────────────────────────────────────

if (EMIT) {
  process.stdout.write(
    JSON.stringify(
      { corridor: CORRIDOR, source_digest: sourceDigest, json_schema: jsonSchema, ui_schema: uiSchema, notes: NOTE },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`${quotesChecked} source quotes verified against ${SOURCE_FILE}`);
  console.log(`source digest  ${sourceDigest.slice(0, 16)}…`);
  console.log(`corridor       ${CORRIDOR.residence_iso3} → ${CORRIDOR.destination_iso3}  ${CORRIDOR.visa_product_id}`);
  console.log(`json schema    ${Object.keys(jsonSchema.properties).length} groups, ${jsonSchema["x-evRules"].length} rules, ${jsonSchema.allOf.length} conditionals`);
  console.log(`ui schema      ${uiSchema.steps.length} steps`);
  console.log("dry run: nothing written");
  process.exit(0);
}

// ── Write ────────────────────────────────────────────────────────────────────

const [sql, close] = await connect();

// No DDL here on purpose - see the header. Fail loudly instead of creating a
// table shaped like this script's assumptions.
const [present] = await sql`
  SELECT to_regclass('public.corridors')     IS NOT NULL AS corridors,
         to_regclass('public.form_versions') IS NOT NULL AS form_versions`;
if (!present.corridors || !present.form_versions) {
  console.error("corridors / form_versions do not exist. Run: node scripts/init-filing-db.mjs");
  await close();
  process.exit(1);
}

// checksum is over the two schemas, per the schema's own contract: it answers
// "did the form change", which is what decides whether a new version is needed.
const checksum = createHash("sha256").update(JSON.stringify(jsonSchema) + JSON.stringify(uiSchema)).digest("hex");

// Money and openness are set on INSERT and never touched by an update. A seed
// script that can re-price a live corridor, or re-open one somebody closed, is a
// seed script that can move money by being run twice.
const [corridor] = await sql`
  INSERT INTO corridors
    (residence_iso3, destination_iso3, visa_product_id, visa_type, display_name,
     channel, govt_fee_minor, service_fee_minor, currency, govt_fee_paid_by,
     processing_days_p50, is_open, closed_reason)
  VALUES
    (${CORRIDOR.residence_iso3}, ${CORRIDOR.destination_iso3}, ${CORRIDOR.visa_product_id},
     ${CORRIDOR.visa_type}, ${CORRIDOR.display_name}, ${CORRIDOR.channel},
     ${CORRIDOR.govt_fee_minor}, ${CORRIDOR.service_fee_minor}, ${CORRIDOR.currency},
     ${CORRIDOR.govt_fee_paid_by}, ${CORRIDOR.processing_days_p50}, FALSE,
     ${"Government fee unknown: the source's fee table did not survive the crawl. Payment is deferred and no fee has been entered from the official schedule."})
  ON CONFLICT (residence_iso3, destination_iso3, visa_product_id) DO UPDATE SET
    visa_type    = EXCLUDED.visa_type,
    display_name = EXCLUDED.display_name,
    channel      = EXCLUDED.channel,
    -- Included deliberately, and it can only ever set this back to NULL: the
    -- source states no processing time, and a number here is one an applicant
    -- plans a trip around. An invented 4 or 5 days is worse than "we don't know".
    processing_days_p50 = EXCLUDED.processing_days_p50,
    updated_at   = NOW()
  RETURNING id, is_open, govt_fee_minor`;

if (OPEN && !corridor.is_open) {
  await sql`UPDATE corridors SET is_open = TRUE, closed_reason = NULL, updated_at = NOW() WHERE id = ${corridor.id}`;
  corridor.is_open = true;
}

// A published form is immutable: editing one in place retroactively changes the
// questions an application was already validated against. A change is a new
// version, and the old one is retired so the one-published index stays satisfied.
const [same] = await sql`
  SELECT version, status FROM form_versions
  WHERE corridor_id = ${corridor.id} AND checksum = ${checksum}
  ORDER BY version DESC LIMIT 1`;

let version;
if (same) {
  version = same.version;
  console.log(`form v${version} already current (${same.status})`);
} else {
  const [{ next_version }] = await sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM form_versions WHERE corridor_id = ${corridor.id}`;
  version = next_version;
  await sql`
    UPDATE form_versions SET status = 'retired', retired_at = NOW()
    WHERE corridor_id = ${corridor.id} AND status = 'published'`;
  await sql`
    INSERT INTO form_versions
      (corridor_id, version, status, json_schema, ui_schema, checksum, notes, published_at)
    VALUES (${corridor.id}, ${version}, 'published',
            ${JSON.stringify(jsonSchema)}::jsonb, ${JSON.stringify(uiSchema)}::jsonb,
            ${checksum}, ${NOTE}, NOW())`;
  console.log(`form v${version} published`);
}

console.log(`corridor ${corridor.id}  ${CORRIDOR.residence_iso3} → ${CORRIDOR.destination_iso3}  ${CORRIDOR.visa_product_id}  ${corridor.is_open ? "OPEN" : "closed"}`);
console.log(`  ${quotesChecked} source quotes verified, digest ${sourceDigest.slice(0, 16)}…`);
console.log(`  ${jsonSchema["x-evRules"].length} rules, ${jsonSchema.allOf.length} conditionals, ${uiSchema.steps.length} steps`);

if (corridor.is_open && Number(corridor.govt_fee_minor) === 0) {
  console.log("");
  console.log("  WARNING: this corridor is OPEN with govt_fee_minor = 0.");
  console.log("  createDraft() copies that into quoted_govt_fee_minor, so every application");
  console.log("  quotes a government fee of zero - a figure the source never gave us.");
  console.log("  Enter the fee from the official schedule, or close the corridor.");
} else if (!corridor.is_open) {
  console.log("  closed: the government fee is unknown. Re-run with --open once it is entered.");
}

await close();
