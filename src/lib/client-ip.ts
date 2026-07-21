// Trusted client IP for rate limiting.
//
// The LEFTMOST X-Forwarded-For entry is client-supplied and therefore
// spoofable - keying a limiter on it lets an attacker mint a fresh bucket per
// request and bypass the throttle entirely. On Vercel the real edge-observed
// client IP is exposed in `x-real-ip`; if that's absent we fall back to the
// RIGHTMOST XFF entry, which was appended by the closest trusted proxy.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]; // rightmost = closest trusted hop
  }
  return "unknown";
}
