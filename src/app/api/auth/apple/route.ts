import { NextResponse } from "next/server";
import { verifyAppleIdentityToken } from "@/lib/auth/apple";
import { AuthStoreUnavailableError, createSession, upsertAccountByApple } from "@/lib/auth/store";

// POST /api/auth/apple { identityToken, fullName?, email? } -> { token, account }
//
// The identity token is verified against Apple's published keys before anything
// is trusted; see src/lib/auth/apple.ts. `fullName` and `email` in the body are
// NOT trusted as identity - Apple only returns them to the client on the very
// first authorization for an Apple ID, so they are accepted purely as a
// convenience for populating a new account, and the verified `sub` from the
// token is what identifies the person.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const identityToken = typeof body.identityToken === "string" ? body.identityToken : "";
  if (!identityToken) {
    return NextResponse.json({ error: "missing identityToken" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyAppleIdentityToken(identityToken);
  } catch (err) {
    // Never echo the reason: the difference between "wrong audience" and "bad
    // signature" is useful to someone probing the endpoint and to nobody else.
    console.warn("[auth] Apple identity token rejected:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sign in with Apple could not be verified." }, { status: 401 });
  }

  // Prefer the address inside the verified token over anything the client sent.
  const email = identity.email ?? (typeof body.email === "string" ? body.email.trim() : null);
  const displayName =
    typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim().slice(0, 120) : null;

  try {
    const account = await upsertAccountByApple(identity.sub, email || null, displayName);
    const token = await createSession(account.id);
    return NextResponse.json({ token, account });
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError) {
      return NextResponse.json(
        { error: "Sign-in is briefly unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }
}
