import { NextResponse } from "next/server";
import { AuthStoreUnavailableError, bearerToken, revokeSession } from "@/lib/auth/store";

// POST /api/auth/signout
// Always reports success. The client clears its token regardless, and a failure
// here would only leave someone stuck on a screen they asked to leave.
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (token) {
    try {
      await revokeSession(token);
    } catch (err) {
      if (!(err instanceof AuthStoreUnavailableError)) throw err;
      console.error("[auth] sign-out could not revoke the session", err);
    }
  }
  return NextResponse.json({ ok: true });
}
