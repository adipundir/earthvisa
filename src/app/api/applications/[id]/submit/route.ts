import { NextResponse } from "next/server";
// The 2020-12 build, not the default one. Ajv's default export only knows
// draft-07, and the corridor form schemas declare 2020-12 - which fails at
// COMPILE time with "no schema with key or ref", i.e. on the submit path of a
// completed application rather than anywhere a form author would notice.
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import {
  FilingStoreUnavailableError,
  getApplication,
  submitApplication,
} from "@/lib/filing/store";

export const dynamic = "force-dynamic";

// `strict: false` because a UI-facing JSON Schema legitimately carries keywords
// Ajv does not know - the ui_schema is a separate document, but authors put
// hints in both and strict mode would turn an unrecognised annotation into a
// server error on a form that is perfectly valid.
//
// `allErrors` because the renderer highlights every bad field at once. Ajv's
// default stops at the first, which would walk someone through a long form one
// error at a time.
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

/** Compiled validators, cached by form version id.
 *
 *  Safe to cache forever, and that is a property of the schema rather than an
 *  assumption: `form_versions` rows are IMMUTABLE once published, and a change
 *  is a new row with a new id. So an id can never mean two different schemas,
 *  and a stale entry here is impossible rather than merely unlikely.
 *
 *  Compilation is the expensive part of Ajv; doing it per request would put it
 *  on the submit path of every application. */
const validators = new Map<string, ValidateFunction>();

function validatorFor(formVersionId: string, schema: Record<string, unknown>): ValidateFunction {
  let compiled = validators.get(formVersionId);
  if (!compiled) {
    compiled = ajv.compile(schema);
    validators.set(formVersionId, compiled);
  }
  return compiled;
}

export interface FieldError {
  /** JSON Pointer to the offending field, e.g. "/traveller/passportNumber".
   *  The renderer maps this straight onto the field it drew. */
  field: string;
  message: string;
  rule: string;
}

/** Turns Ajv's errors into something a form can highlight.
 *
 *  The `required` case is the one that matters: Ajv reports it against the
 *  PARENT object with the missing key in `params`, so passing `instancePath`
 *  through unchanged would point the renderer at the section rather than the
 *  empty field, and the user would be told "something in here is missing". */
function toFieldErrors(errors: ErrorObject[] | null | undefined): FieldError[] {
  if (!errors) return [];
  const seen = new Set<string>();
  const out: FieldError[] = [];
  for (const e of errors) {
    const missing = (e.params as { missingProperty?: string } | undefined)?.missingProperty;
    const field =
      e.keyword === "required" && missing ? `${e.instancePath}/${missing}` : e.instancePath;
    const key = `${field}:${e.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      field: field || "/",
      message: e.keyword === "required" ? "This is required." : (e.message ?? "This is not valid."),
      rule: e.keyword,
    });
  }
  return out;
}

// POST /api/applications/[id]/submit -> { application }
//
// The applicant's "I am done". Moves the application to `ready`.
//
// NOT to `submitted`. Filing is operator-filed: `submitted` means a human has
// entered this on the government portal, and nothing an applicant does can
// cause it. An app that reported "submitted" here would be telling someone
// their visa application had been filed while it sat in a queue - and the
// schema would not even permit it, because `submitted` requires a
// `submitted_at` that only the operator's action can honestly set.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const application = await getApplication(account.id, id);
    if (!application) {
      return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
    }

    // Validated against the form version PINNED TO THIS APPLICATION, not
    // against whatever is published today. If the corridor's form changed while
    // this draft was being filled, the rules that apply are the ones the person
    // was actually shown.
    const validate = validatorFor(application.form.id, application.form.jsonSchema);
    if (!validate(application.answers)) {
      return NextResponse.json(
        {
          error: "Some answers still need attention.",
          code: "incomplete",
          fields: toFieldErrors(validate.errors),
        },
        { status: 422 },
      );
    }

    // Validation read the answers a moment ago and this moves the row now, so a
    // PATCH landing in between would be submitted unvalidated. Deliberately not
    // defended against with a lock: it takes the same person editing on a second
    // device in the same second, and the consequence is bounded because filing
    // is operator-filed - a human reads the form before it reaches a government
    // portal. A lock here would buy a rare, already-caught case at the cost of
    // making the common path fail under contention.
    const result = await submitApplication(account.id, id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
      }
      // Zero rows from the conditional UPDATE. Somebody already moved it - the
      // overwhelmingly common cause being this same person's double-tap on a
      // slow connection, where the first request won and this one is the echo.
      return NextResponse.json(
        {
          error: "This application has already been sent to Earth Visa.",
          code: "already_submitted",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { application: result.application },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof FilingStoreUnavailableError) {
      return NextResponse.json(
        { error: "Could not send the application right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
