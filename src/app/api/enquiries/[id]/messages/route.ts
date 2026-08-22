import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";
import { EnquiryStoreUnavailableError, addMessage, isUuid } from "@/lib/enquiries";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 4000;

// POST /api/enquiries/[id]/messages { body } -> { enquiry }
//
// The person's next message in the thread. Returns the whole enquiry as it now
// stands, so the app redraws from one truth rather than appending locally and
// hoping the server agrees.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 1) {
    return NextResponse.json(
      { error: "Write something first.", code: "message_required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Keep the message under ${MAX_MESSAGE_CHARS} characters.`, code: "message_too_long" },
      { status: 400 },
    );
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const result = await addMessage(account.id, id, text);
    if (!result.ok) {
      return NextResponse.json({ error: "not found", code: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { enquiry: result.enquiry },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError || err instanceof EnquiryStoreUnavailableError) {
      return NextResponse.json(
        { error: "Could not send that right now. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
