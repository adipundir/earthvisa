// Trusted client IP for rate limiting.
//
// The LEFTMOST X-Forwarded-For entry is client-supplied and therefore
// spoofable - keying a limiter on it lets an attacker mint a fresh bucket per
// request and bypass the throttle entirely. So only an edge-observed value is
// trusted.
//
// `cloudfront-viewer-address` is that value, but it is only trustworthy
// because of a control that lives OUTSIDE this file: the ALB security group
// admits the CloudFront origin-facing prefix list and nothing else
// (deploy/02-app.yml). CloudFront overwrites any viewer-supplied copy of its
// own CloudFront-* headers, so a forged one cannot survive the edge - but a
// request that never passes through the edge keeps whatever it sent. Open the
// ALB to the world and this header becomes attacker-controlled, which turns
// the OTP limiter into unmetered paid SMS. The two controls are one mechanism.
//
// Getting this wrong does not fail loudly. It silently collapses callers into
// too few buckets, so the first person to hit the OTP throttle locks out
// everyone else.
export function clientIp(req: Request): string {
  // CloudFront sends "IP:port", and an IPv6 address contains colons of its
  // own, so the port is split off from the RIGHT.
  const cf = req.headers.get("cloudfront-viewer-address")?.trim();
  if (cf) {
    const portAt = cf.lastIndexOf(":");
    return portAt > 0 ? cf.slice(0, portAt) : cf;
  }
  // Past this point there is no edge-observed value, and the remaining headers
  // are all attacker-supplied.
  //
  // `x-real-ip` in particular is NOT set by anything in the AWS path - not
  // CloudFront, not the ALB - so in production it can only have come from the
  // caller. Worse, it survives the ALB lockdown: the /api/* origin request
  // policy forwards all viewer headers, so a request through CloudFront
  // carries whatever `X-Real-IP` the attacker typed. Trusting it would restore
  // exactly the bypass the security group closes - a fresh rate-limit bucket
  // per request, and unmetered paid SMS out of /api/auth/phone/start.
  //
  // So in production we fail CLOSED to a single shared bucket. That throttles
  // everyone, which is bad - but it is loud, self-announcing, and recoverable,
  // whereas silently trusting a forged header is none of those. Reaching here
  // in production means the origin request policy is not sending
  // cloudfront-viewer-address, which is a deploy fault to be fixed, not
  // absorbed.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[client-ip] no cloudfront-viewer-address; rate limiting is degraded to " +
        "one shared bucket. Check the CloudFront origin request policy.",
    );
    return "unknown";
  }

  // Development and direct-origin probes only, where spoofing buys nothing.
  //
  // Note the index: the rightmost entry is NOT the viewer. In a
  // viewer -> CloudFront -> ALB chain, CloudFront puts the viewer's address at
  // the LEFT and the ALB appends the CloudFront edge node's address on the
  // right, so the rightmost entry buckets everyone served by the same POP
  // together - and it still looks like a plausible IPv4, so nothing flags it.
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    if (parts.length === 1) return parts[0];
  }
  return "unknown";
}
