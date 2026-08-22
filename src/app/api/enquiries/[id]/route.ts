import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import { EnquiryStoreUnavailableError, getEnquiry, isUuid } from "@/lib/enquiries";

export const dynamic = "force-dynamic";

// GET /api/enquiries/[id] -> { enquiry }
//
// The whole thread, oldest message first. Identical 404 for "no such enquiry"
// and "not yours", so the endpoint cannot be used to learn which ids are real.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const enquiry = await getEnquiry(account.id, id);
    if (!enquiry) {
      return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ enquiry }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof EnquiryStoreUnavailableError) {
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}
