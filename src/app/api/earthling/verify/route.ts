import { NextResponse } from "next/server";
import { peekPendingClaim, verifyEarthling } from "@/lib/earthling/store";

// Email confirmation, scanner-safe. Corporate/consumer mail protection
// (Outlook SafeLinks, Mimecast, Gmail prefetch) GETs every link in an email -
// so the emailed GET link must NOT change state. Instead it renders a tiny
// confirmation page whose button POSTs the token; scanners follow GETs but
// never submit forms, so only a human click verifies the claim.

function origin(req: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

// GET /api/earthling/verify?token=... - read-only interstitial.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const rec = await peekPendingClaim(token);
  if (!rec) return NextResponse.redirect(`${origin(req)}/earthling?verify=invalid`, 302);
  // rec.username is store-validated against /^[a-z0-9][a-z0-9_-]{2,18}$/ and the
  // token is our own hex string, so interpolation below is injection-safe.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Confirm @${rec.username} - Earth Visa</title>
<style>
  body{margin:0;display:grid;min-height:100vh;place-items:center;background:#ffffff;color:#171d2b;font-family:-apple-system,'Segoe UI',sans-serif}
  @media (prefers-color-scheme:dark){body{background:#0b0c0e;color:#eaebed}}
  main{text-align:center;padding:24px;max-width:420px}
  p.k{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#b23528;font-weight:600;margin:0}
  h1{font-size:26px;margin:12px 0 8px}
  p.d{font-size:14px;line-height:1.6;opacity:.75;margin:0 0 24px}
  button{padding:13px 28px;background:#b23528;color:#fff;border:0;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
  button:hover{background:#7c241d}
</style>
</head>
<body>
<main>
  <p class="k">Earth Visa</p>
  <h1>Confirm @${rec.username}</h1>
  <p class="d">One click locks in your Earthling ID and your reach of ${rec.reach} destinations.</p>
  <form method="post" action="/api/earthling/verify">
    <input type="hidden" name="token" value="${token}">
    <button type="submit">Confirm @${rec.username}</button>
  </form>
</main>
</body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// POST /api/earthling/verify - the human click. One-time: a valid token flips
// the claim to verified and is cleared; anything else lands on the hub with an
// error flag.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const rec = await verifyEarthling(token).catch(() => null);
  if (!rec) return NextResponse.redirect(`${origin(req)}/earthling?verify=invalid`, 303);
  return NextResponse.redirect(`${origin(req)}/earthling/${rec.username}?welcome=1`, 303);
}
