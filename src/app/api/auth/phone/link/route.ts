import { NextResponse } from "next/server";
import {
  AuthStoreUnavailableError,
  accountForToken,
  bearerToken,
  linkPhoneToAccount,
  verifyPhoneCode,
} from "@/lib/auth/store";
import { normalisePhone } from "@/lib/auth/phone";

// POST /api/auth/phone/link { phone, code } -> account
//
// Attaches a callable number to an account created through Apple. Required
// before Earth Visa can file an application on someone's behalf: an Apple
// private relay address forwards mail but is not something operations can ring
// when a consulate raises a question about a submission.
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const phone = normalisePhone(typeof body.phone === "string" ? body.phone : "");
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone) {
    return NextResponse.json(
      { error: "That does not look like a valid phone number.", code: "invalid_phone" },
      { status: 400 },
    );
  }

  try {
    const account = await accountForToken(token);
    if (!account) return NextResponse.json({ error: "session expired" }, { status: 401 });

    const result = await verifyPhoneCode(phone, code);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason === "expired" ? "That code has expired." : "That code is not right.",
          code: result.reason === "expired" ? "code_expired" : "code_incorrect",
          attemptsRemaining: result.reason === "incorrect" ? result.attemptsRemaining : 0,
        },
        { status: 400 },
      );
    }

    const linked = await linkPhoneToAccount(account.id, phone);
    if (linked.ok) return NextResponse.json(linked.account);
    if (linked.reason === "no_such_account") {
      return NextResponse.json({ error: "account not found" }, { status: 404 });
    }
    if (linked.reason === "already_linked") {
      // Idempotent: this number is already on this account. Nothing to do, and
      // certainly not an error worth making the user retry.
      return NextResponse.json(account);
    }
    // 409, not 503. The number belongs to another account and no amount of
    // retrying will change that - and each retry costs the user a fresh OTP.
    // The message has to be actionable, because the only way out is to sign in
    // as the account that already holds the number.
    return NextResponse.json(
      {
        error:
          "That number is already linked to a different Earth Visa account. " +
          "Sign in with the phone number instead, or use a different number.",
        code: "phone_taken",
      },
      { status: 409 },
    );
  } catch (err) {
    if (err instanceof AuthStoreUnavailableError) {
      return NextResponse.json({ error: "temporarily unavailable" }, { status: 503 });
    }
    throw err;
  }
}
