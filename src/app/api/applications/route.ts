import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import {
  FilingStoreUnavailableError,
  createDraft,
  listApplications,
} from "@/lib/filing/store";

// Every handler here reads the Authorization header, so nothing about this
// route is static. Declared rather than inferred, because an application list
// served from a cache to the wrong account is the worst possible bug and the
// inference that prevents it should not be something a future edit can lose.
export const dynamic = "force-dynamic";

const ISO3 = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date that exists. `new Date("2026-02-31")` does not throw, it
 *  rolls over to March, so the round-trip is what actually validates it. */
function isRealDate(value: string): boolean {
  if (!YMD.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// GET /api/applications -> { applications: [...] }
//
// Summaries only, deliberately without the form schemas - see listApplications.
export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const applications = await listApplications(account.id);
    return NextResponse.json({ applications }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof FilingStoreUnavailableError) {
      // 503 and not 401, for the reason /api/auth/me gives: the client must not
      // throw away a good token because the database blinked.
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}

// POST /api/applications { residenceIso3, destinationIso3, visaProductId,
//                          intendedEntryAt? } -> 201 { application }
//
// Starts a draft. RESIDENCE, not nationality: nationality decides whether a visa
// is needed, residence decides which mission has jurisdiction, which centre
// takes biometrics and which document list applies. An Indian national living
// in Dubai applies under UAE rules at a Dubai centre, and keying this on
// nationality would route them to the wrong process with no error anywhere.
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const residenceIso3 = String(body.residenceIso3 ?? "").trim().toUpperCase();
  const destinationIso3 = String(body.destinationIso3 ?? "").trim().toUpperCase();
  const visaProductId = String(body.visaProductId ?? "").trim();

  if (!ISO3.test(residenceIso3)) {
    return NextResponse.json(
      { error: "Where do you live? A three-letter country code is required.", code: "invalid_residence" },
      { status: 400 },
    );
  }
  if (!ISO3.test(destinationIso3)) {
    return NextResponse.json(
      { error: "Where are you going? A three-letter country code is required.", code: "invalid_destination" },
      { status: 400 },
    );
  }
  if (!visaProductId || visaProductId.length > 128) {
    return NextResponse.json(
      { error: "Which visa is this for?", code: "invalid_visa_product" },
      { status: 400 },
    );
  }

  let intendedEntryAt: string | null = null;
  if (body.intendedEntryAt != null && body.intendedEntryAt !== "") {
    const raw = String(body.intendedEntryAt).trim();
    if (!isRealDate(raw)) {
      return NextResponse.json(
        { error: "That travel date is not a real date.", code: "invalid_entry_date" },
        { status: 400 },
      );
    }
    // Rejected here rather than at submission, because document constraints are
    // evaluated against this date - a date already in the past would quietly
    // make every "valid on the day you travel" rule pass.
    if (raw < new Date().toISOString().slice(0, 10)) {
      return NextResponse.json(
        { error: "That travel date has already passed.", code: "invalid_entry_date" },
        { status: 400 },
      );
    }
    intendedEntryAt = raw;
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const result = await createDraft(account.id, {
      residenceIso3,
      destinationIso3,
      visaProductId,
      intendedEntryAt,
    });

    if (!result.ok) {
      // Either the corridor is not open or it has no published form. Both mean
      // "we cannot file this for you yet", and 422 says that without implying
      // the request was malformed or the corridor does not exist - several are
      // deliberately closed because the destination regulates paid immigration
      // assistance and we hold no licence for it.
      return NextResponse.json(
        {
          error: "Earth Visa cannot file this application yet.",
          code: "corridor_unavailable",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { application: result.application },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof FilingStoreUnavailableError) {
      return NextResponse.json(
        { error: "Could not start the application right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
