import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createEarthling,
  expirePendingClaim,
  isUsernameTaken,
  pendingClaimCount,
  recordClaimAttempt,
  verifyEarthling,
  StoreUnavailableError,
} from "@/lib/earthling/store";
import { sendClaimVerificationEmail } from "@/lib/earthling/email";
import { reachFor, sanitizeHoldings } from "@/lib/earthling/reach";
import { emailError, normalizeUsername, usernameError } from "@/lib/earthling/validate";

const unavailable = () =>
  NextResponse.json({ error: "Claims aren't open yet - check back soon." }, { status: 503 });

// GET /api/earthling/claim?u=name -> username availability
export async function GET(req: Request) {
  const u = normalizeUsername(new URL(req.url).searchParams.get("u"));
  const err = usernameError(u);
  if (err) return NextResponse.json({ available: false, reason: err });
  return NextResponse.json({ available: !(await isUsernameTaken(u)) });
}

// POST /api/earthling/claim { username, email, passports, credentials }
// The claim is created UNVERIFIED and only reserves the name for 24 hours;
// nothing is published until the confirmation link in the email is clicked.
// Reach is computed server-side from the declared holdings; client numbers
// are never trusted.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const username = normalizeUsername(body.username);
  const uErr = usernameError(username);
  if (uErr) return NextResponse.json({ error: uErr }, { status: 400 });

  const eErr = emailError(body.email);
  if (eErr) return NextResponse.json({ error: eErr }, { status: 400 });

  const holdings = sanitizeHoldings(body.passports, body.credentials ?? []);
  if (!holdings) return NextResponse.json({ error: "invalid passports/credentials" }, { status: 400 });

  const email = String(body.email).trim();

  // Abuse controls BEFORE any compute or email: this endpoint sends mail to a
  // caller-supplied address, so it must not be free to loop.
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const attempts = await recordClaimAttempt(ip);
    if (attempts > 5) {
      return NextResponse.json({ error: "Too many claim attempts from your network - try again in an hour." }, { status: 429 });
    }
    if ((await pendingClaimCount(email)) >= 2) {
      return NextResponse.json({ error: "This email already has pending claims - confirm one from your inbox first." }, { status: 429 });
    }
  } catch (err) {
    if (err instanceof StoreUnavailableError) return unavailable();
    throw err;
  }

  const reach = reachFor(holdings.passports, holdings.credentials);
  const token = randomBytes(24).toString("hex");
  let rec;
  try {
    rec = await createEarthling({
      username,
      email,
      passports: holdings.passports,
      credentials: holdings.credentials,
      reach: reach.total,
      percentile: reach.percentile,
      isPublic: false,
      verified: false,
      verifyToken: token,
      verifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    if (err instanceof StoreUnavailableError) return unavailable();
    throw err;
  }
  if (!rec) return NextResponse.json({ error: "That name was just taken." }, { status: 409 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const sent = await sendClaimVerificationEmail({
    to: rec.email,
    username: rec.username,
    reach: rec.reach,
    percentile: rec.percentile,
    verifyUrl: `${origin}/api/earthling/verify?token=${token}`,
  });

  // No RESEND_API_KEY: in development, auto-verify so the flow stays runnable
  // end-to-end without email. In production this would silently disable the
  // entire verification system (anyone could publish any username with anyone's
  // email), so there it fails closed instead.
  if (!sent.ok && "skipped" in sent) {
    if (process.env.NODE_ENV === "production") {
      await expirePendingClaim(token);
      return NextResponse.json({ error: "Claims are temporarily unavailable (email verification is not configured)." }, { status: 503 });
    }
    await verifyEarthling(token);
    console.warn("[earthling] RESEND_API_KEY not set - claim auto-verified (dev-only fallback)");
    return NextResponse.json({
      username: rec.username,
      reach: rec.reach,
      percentile: rec.percentile,
      seq: rec.seq,
      profileUrl: `/earthling/${rec.username}`,
    });
  }

  if (!sent.ok) {
    // The claim record would sit as a dead 24h reservation - free the name
    // immediately, then tell the user what actually happened.
    await expirePendingClaim(token);
    return NextResponse.json(
      { error: `Couldn't send the confirmation email (${sent.error}). The name was not claimed - try again.` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    pendingVerification: true,
    username: rec.username,
    email: rec.email,
    reach: rec.reach,
    percentile: rec.percentile,
  });
}
