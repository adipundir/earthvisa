import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import {
  AuthStoreUnavailableError,
  MAX_CODES_PER_IP_PER_HOUR,
  MAX_CODES_PER_PHONE_PER_HOUR,
  issuePhoneCode,
  recordCodeRequest,
} from "@/lib/auth/store";
import {
  SmsUnavailableError,
  SmsUnsupportedRegionError,
  UNSUPPORTED_REGION_MESSAGE,
  isSupportedSmsDestination,
  sendVerificationCode,
} from "@/lib/auth/sms";
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

  // Checked before ANY state is written. Further down we would consume this
  // number's hourly quota and store a one-time code, then discover at send
  // time that no route exists to deliver it - leaving a live code for a phone
  // that can never receive one, and quota spent on a request that was always
  // going to fail.
  if (!isSupportedSmsDestination(phone)) {
    return NextResponse.json(
      {
        error: UNSUPPORTED_REGION_MESSAGE + " Please use Sign in with Apple instead.",
        code: "region_unsupported",
      },
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
    // 400, not 503: the number is out of range for the registered sender and
    // no retry will change that. Name the alternative, because Sign in with
    // Apple genuinely does work for these users.
    if (err instanceof SmsUnsupportedRegionError) {
      return NextResponse.json(
        {
          error: err.message + " Please use Sign in with Apple instead.",
          code: "region_unsupported",
        },
        { status: 400 },
      );
    }
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
