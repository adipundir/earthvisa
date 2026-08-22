import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import { FilingStoreUnavailableError, getApplication, saveAnswers } from "@/lib/filing/store";

export const dynamic = "force-dynamic";

/** A ceiling on the answers blob, enforced on the PATCH body.
 *
 *  Not a guess at how big a visa form is - the largest one in the catalogue is
 *  a few kilobytes of answers. It is there because `answers` is a JSONB column
 *  the client writes directly, and an unbounded one is free storage for anyone
 *  with an account: 256 KB is far more than any form needs and far less than
 *  anything worth hosting. */
const MAX_PATCH_BYTES = 256 * 1024;

/** Rejects arrays, null and class instances - `typeof [] === "object"` is the
 *  trap here. Merging an array into a JSONB object would replace the object
 *  wholesale, so this is a correctness check as much as a validation one. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// GET /api/applications/[id] -> { application }
//
// The full record, INCLUDING the pinned form version's JSON Schema and UI
// schema. That is not incidental: there are 10,396 corridor x visa-type
// combinations, hand-built screens are impossible, and one generic renderer on
// iOS draws whatever this returns. The schemas come from the form version
// pinned to the application at creation, so the questions cannot change under
// someone half-way through.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const application = await getApplication(account.id, id);
    // Identical answer for "no such application" and "not yours". Telling them
    // apart would make this endpoint an oracle for which ids are real.
    if (!application) {
      return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ application }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof FilingStoreUnavailableError) {
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}

// PATCH /api/applications/[id] { answers: { ... } } -> { application }
//
// Saves a section of the form. The patch is merged into the stored answers BY
// POSTGRES, at the top level: send a section complete, because
// `{"traveller": {...}}` replaces the whole `traveller` object rather than
// merging into it.
//
// Answers are NOT validated against the form's JSON Schema here, deliberately.
// A partial save is incomplete by definition - that is what makes it a draft -
// and validating each screen against the whole-form schema would reject every
// save until the last one. Validation happens once, at submit.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const answers = body.answers;
  if (!isPlainObject(answers)) {
    return NextResponse.json(
      { error: "answers must be a JSON object.", code: "invalid_answers" },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(JSON.stringify(answers), "utf8") > MAX_PATCH_BYTES) {
    return NextResponse.json(
      { error: "That is too much data for one save.", code: "answers_too_large" },
      { status: 413 },
    );
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const result = await saveAnswers(account.id, id, answers);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
      }
      // The application has moved past the point where the applicant owns it -
      // an operator is preparing or has already filed it. 409 rather than 403
      // because nothing is wrong with the caller's authority; the row simply is
      // not in a state that accepts edits, and the client should refetch to see
      // what happened rather than re-authenticate.
      return NextResponse.json(
        {
          error: "This application has already been sent for filing and can no longer be edited.",
          code: "not_editable",
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
        { error: "Could not save right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
