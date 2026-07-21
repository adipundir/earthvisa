import { NextResponse } from "next/server";
import { insertSubscriber, recordSubscribeAttempt, SubscriberStoreUnavailableError } from "@/lib/subscribers";
import { clientIp } from "@/lib/client-ip";

// POST /api/subscribe { email, passports?, website? }
// "Notify me when my visa access changes" capture on the reach result. Stored
// so we can reach out when a corridor these passports rely on shifts; nothing
// is sent automatically. `website` is a honeypot - bots that fill it get a fake
// success and no write.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look valid." }, { status: 400 });
  }

  // Passport ISO3 codes for the selection this subscriber cares about (optional).
  const passports = Array.isArray(body.passports)
    ? body.passports
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim().toUpperCase())
        .filter((p) => /^[A-Z]{3}$/.test(p))
        .slice(0, 8)
    : [];

  try {
    const ip = clientIp(req);
    if ((await recordSubscribeAttempt(ip)) > 5) {
      return NextResponse.json({ error: "Too many sign-ups from your network - try again in an hour." }, { status: 429 });
    }
    await insertSubscriber({ email, passports, ip });
  } catch (err) {
    if (err instanceof SubscriberStoreUnavailableError) {
      return NextResponse.json({ error: "Sign-ups are briefly unavailable - please try again later." }, { status: 503 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
