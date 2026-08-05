import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from "node:crypto";

// Verifies a Sign in with Apple identity token.
//
// Written against node:crypto rather than a JWT library on purpose. Node can
// import a JWK directly, so the whole verification is about forty lines, and
// this is an authentication path where a dependency is a place someone else's
// compromise becomes an account takeover.
//
// The client sends a token it received from Apple. It must NEVER be trusted on
// its face: a token is just a string, and anyone can post one. Four things are
// checked, and all four matter.
//   1. Signature, against Apple's published keys, matched by `kid`.
//   2. Issuer is Apple.
//   3. Audience is OUR bundle id. Without this, a token minted for any other
//      app that uses Sign in with Apple would be accepted here.
//   4. Not expired.

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";

/** Bundle id the token must be addressed to. */
const AUDIENCE = process.env.APPLE_BUNDLE_ID ?? "in.earthvisa.app";

interface AppleJwk {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

// Apple rotates keys, so the set is cached briefly rather than pinned. Short
// enough that a rotation heals by itself, long enough that sign-in is not one
// extra round trip to Apple every time.
let cachedKeys: { keys: AppleJwk[]; fetchedAt: number } | null = null;
const KEY_CACHE_MS = 10 * 60_000;

async function appleKeys(): Promise<AppleJwk[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_MS) return cachedKeys.keys;
  const res = await fetch(APPLE_KEYS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Apple key set unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { keys: AppleJwk[] };
  cachedKeys = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

export interface AppleIdentity {
  /** Stable subject claim. Survives the user changing their email, so this and
   *  not the email is the join key for an account. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  /** True when the address is an Apple private relay. Such an address forwards
   *  mail but is not a durable contact route, and it can be disabled by the
   *  user at any time, so it must not be the only way to reach someone about a
   *  filed application. */
  isPrivateRelay: boolean;
}

const b64urlToBuffer = (s: string) => Buffer.from(s, "base64url");

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed identity token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(b64urlToBuffer(headerB64).toString("utf8")) as {
    kid?: string;
    alg?: string;
  };
  // Only RS256 is accepted. Reading the algorithm from the token and honouring
  // whatever it says is the classic JWT confusion bug, and "alg": "none" is the
  // classic exploit of it.
  if (header.alg !== "RS256") throw new Error("unexpected token algorithm");
  if (!header.kid) throw new Error("identity token has no key id");

  const jwk = (await appleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("identity token signed by an unknown key");

  const publicKey = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const signed = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  if (!cryptoVerify("RSA-SHA256", signed, publicKey, b64urlToBuffer(signatureB64))) {
    throw new Error("identity token signature is not valid");
  }

  const payload = JSON.parse(b64urlToBuffer(payloadB64).toString("utf8")) as {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    is_private_email?: boolean | string;
  };

  if (payload.iss !== APPLE_ISSUER) throw new Error("identity token has the wrong issuer");

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(AUDIENCE)) throw new Error("identity token is for a different app");

  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    throw new Error("identity token has expired");
  }
  if (!payload.sub) throw new Error("identity token has no subject");

  // Apple sends these booleans as strings in some flows and as real booleans in
  // others, so both are accepted rather than assuming one.
  const asBool = (v: boolean | string | undefined) => v === true || v === "true";

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: asBool(payload.email_verified),
    isPrivateRelay: asBool(payload.is_private_email),
  };
}
