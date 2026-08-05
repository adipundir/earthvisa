import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, accountForToken, bearerToken } from "@/lib/auth/store";

// GET /api/auth/me -> account, or 401.
// The app calls this at launch to restore a session. A 401 means the token is
// dead and the client clears it, rather than carrying a token that makes every
// later call fail confusingly.
export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });
    return NextResponse.json(account, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError) {
      // A 503 is important here rather than a 401: the client must not delete a
      // perfectly good token just because the database blinked.
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}
