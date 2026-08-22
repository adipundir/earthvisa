import { NextResponse } from "next/server";
import { FilingStoreUnavailableError, openCorridors } from "@/lib/filing/store";

// GET /api/corridors -> { corridors: [...] }
//
// Where Earth Visa can actually file. Deliberately PUBLIC and unauthenticated:
// the app asks at launch so it knows whether to offer filing on a given
// corridor at all, and someone deciding whether to sign up is entitled to see
// whether we can help them before creating an account.
//
// This list is short and will stay short. Every entry needs a hand-authored
// form and an operator who has filed that route once by hand, against 10,396
// corridor-and-visa-type combinations the app can merely describe. The gap
// between those two numbers is the honest state of the product, and this
// endpoint is what stops the app from papering over it.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const corridors = await openCorridors();
    return NextResponse.json(
      { corridors },
      {
        // Five minutes. Opening a corridor is a deliberate, infrequent act, and
        // a stale list costs at most one "we cannot file this yet" that the
        // draft endpoint would have said anyway.
        headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" },
      },
    );
  } catch (err) {
    if (err instanceof FilingStoreUnavailableError) {
      // An empty list, not a 503. The app degrades to the information product
      // it already is - which works entirely offline - rather than showing an
      // error for a feature the user has not asked for yet.
      //
      // no-store, unlike the success path's five minutes. This response is a
      // symptom of the database being unreachable, and it is indistinguishable
      // on the wire from "we genuinely file nowhere". Without an explicit
      // directive an intermediary is free to heuristically cache it, so a
      // thirty-second database blip would keep telling clients there are no
      // open corridors long after it recovered.
      return NextResponse.json(
        { corridors: [] },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    throw err;
  }
}
