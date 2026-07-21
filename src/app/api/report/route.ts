import { NextResponse } from "next/server";
import { insertReport, recordReportAttempt, ReportStoreUnavailableError } from "@/lib/reports";
import { clientIp } from "@/lib/client-ip";

// POST /api/report { page, message, sourceUrl?, email?, website? }
// Public data-inaccuracy reports. Stored for review against official sources;
// nothing on the site changes automatically. `website` is a honeypot - bots
// that fill it get a fake success and no write.
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

  const page = typeof body.page === "string" ? body.page.trim().slice(0, 300) : "";
  if (!page.startsWith("/")) {
    return NextResponse.json({ error: "invalid page" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 10) {
    return NextResponse.json({ error: "Tell us what's wrong in a sentence or two (at least 10 characters)." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Keep the report under 2,000 characters." }, { status: 400 });
  }

  let sourceUrl: string | null = null;
  if (typeof body.sourceUrl === "string" && body.sourceUrl.trim()) {
    const raw = body.sourceUrl.trim().slice(0, 500);
    try {
      const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      sourceUrl = u.href;
    } catch {
      return NextResponse.json({ error: "That source URL doesn't look valid." }, { status: 400 });
    }
  }

  let email: string | null = null;
  if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look valid." }, { status: 400 });
    }
  }

  try {
    const ip = clientIp(req);
    if ((await recordReportAttempt(ip)) > 5) {
      return NextResponse.json({ error: "Too many reports from your network - try again in an hour." }, { status: 429 });
    }
    await insertReport({ page, message, sourceUrl, email, ip });
  } catch (err) {
    if (err instanceof ReportStoreUnavailableError) {
      return NextResponse.json({ error: "Reports are briefly unavailable - please try again later." }, { status: 503 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
