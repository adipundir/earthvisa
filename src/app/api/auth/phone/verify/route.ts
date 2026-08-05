import { NextResponse } from "next/server";
import {
  AuthStoreUnavailableError,
  createSession,
  upsertAccountByPhone,
  verifyPhoneCode,
} from "@/lib/auth/store";
import { normalisePhone } from "@/lib/auth/phone";

// POST /api/auth/phone/verify { phone, code } -> { token, account }
//
// Verifying a code is what creates the account. There is no separate sign-up:
// a number that has never been seen gets an account, a number that has gets its
// existing one, and from the app's side both are just "signed in".
export async function POST(req: Request) {
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
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code.", code: "code_incorrect", attemptsRemaining: 0 },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPhoneCode(phone, code);
    if (!result.ok) {
      switch (result.reason) {
        case "expired":
          return NextResponse.json(
            { error: "That code has expired. Ask for a new one.", code: "code_expired" },
            { status: 400 },
          );
        case "too_many":
          return NextResponse.json(
            {
              error: "Too many incorrect attempts. Ask for a new code.",
              code: "rate_limited",
              retryAfter: 600,
            },
            { status: 429 },
          );
        case "incorrect":
          return NextResponse.json(
            {
              error: "That code is not right.",
              code: "code_incorrect",
              attemptsRemaining: result.attemptsRemaining,
            },
            { status: 400 },
          );
      }
    }

    const account = await upsertAccountByPhone(phone);
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
