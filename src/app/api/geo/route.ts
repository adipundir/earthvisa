import { NextResponse } from "next/server";

// Best-effort country detection from the edge/CDN geo header. No IP database,
// no third-party call, no browser permission prompt. Each CDN spells this
// differently, so every host this might sit behind is listed: whichever one is
// actually in front supplies its header and the rest are absent. Returns the
// ISO-3166 alpha-2 country code (or null in local dev, where none exists).
//
// CloudFront only sends `cloudfront-viewer-country` when the cache policy or
// origin request policy is configured to forward it. If this returns null
// after a move to CloudFront, that policy is what is missing, not this code.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const h = req.headers;
  const cc = (
    h.get("cloudfront-viewer-country") || // CloudFront
    h.get("cf-ipcountry") ||              // Cloudflare
    h.get("x-country-code") ||            // generic / some CDNs
    h.get("x-geo-country") ||
    ""
  ).toUpperCase();

  const country = /^[A-Z]{2}$/.test(cc) && cc !== "XX" ? cc : null;
  return NextResponse.json(
    { country },
    { headers: { "cache-control": "no-store" } },
  );
}
