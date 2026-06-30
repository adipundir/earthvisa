import { NextResponse } from "next/server";

// Best-effort country detection from the edge/CDN geo header. No IP database,
// no third-party call, no browser permission prompt. On Vercel this is
// `x-vercel-ip-country`; common alternatives are included as fallbacks. Returns
// the ISO-3166 alpha-2 country code (or null in local dev, where no header exists).
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const h = req.headers;
  const cc = (
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||           // Cloudflare
    h.get("x-country-code") ||         // generic / some CDNs
    h.get("x-geo-country") ||
    ""
  ).toUpperCase();

  const country = /^[A-Z]{2}$/.test(cc) && cc !== "XX" ? cc : null;
  return NextResponse.json(
    { country },
    { headers: { "cache-control": "no-store" } },
  );
}
