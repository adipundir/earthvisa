import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import {
  AuthStoreUnavailableError,
  MAX_CODES_PER_IP_PER_HOUR,
  MAX_CODES_PER_PHONE_PER_HOUR,
  issuePhoneCode,
  recordCodeRequest,
} from "@/lib/auth/store";
import { SmsUnavailableError, sendVerificationCode } from "@/lib/auth/sms";
import { normalisePhone } from "@/lib/auth/phone";

// POST /api/auth/phone/start { phone }
//
// Sends a one-time code. Deliberately does NOT reveal whether the number
// already has an account: the same response comes back either way, so this
// endpoint cannot be used to enumerate who has signed up.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const phone = normalisePhone(typeof body.phone === "string" ? body.phone : "");
  if (!phone) {
    return NextResponse.json(
      { error: "That does not look like a valid phone number.", code: "invalid_phone" },
      { status: 400 },
    );
  }

  try {
    const ip = clientIp(req);
    const { phoneCount, ipCount } = await recordCodeRequest(phone, ip);

    // Per-phone protects a person from being SMS-bombed by someone typing their
    // number. Per-IP protects the SMS budget, which is a direct financial
    // attack rather than merely abuse.
    if (phoneCount > MAX_CODES_PER_PHONE_PER_HOUR || ipCount > MAX_CODES_PER_IP_PER_HOUR) {
      return NextResponse.json(
        {
          error: "Too many code requests. Try again in an hour.",
          code: "rate_limited",
          retryAfter: 3600,
        },
        { status: 429 },
      );
    }

    const { code } = await issuePhoneCode(phone);
    await sendVerificationCode(phone, code);
  } catch (err) {
    if (err instanceof SmsUnavailableError) {
      return NextResponse.json(
        { error: "Could not send the code right now. Please try again shortly." },
        { status: 503 },
      );
    }
    if (err instanceof AuthStoreUnavailableError) {
      return NextResponse.json(
        { error: "Sign-in is briefly unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
