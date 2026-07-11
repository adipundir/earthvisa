// The Earthling identity layer: users declare their passport(s) + held
// visas/permits, get their personal "reach" computed by the same engine that
// powers the rest of the site, and claim a username + spot on the leaderboard.
// Everything is SELF-DECLARED - reach is a game stat, not a certification.

export interface Earthling {
  /** canonical lowercase handle, unique */
  username: string;
  email: string;
  /** ISO3 passports held; first entry is the primary (shown on cards) */
  passports: string[];
  /** credential ids from dataset.credentials (US_VISA, SCHENGEN_VISA, ...) */
  credentials: string[];
  /** destinations reachable without an embassy visa - computed server-side at claim time */
  reach: number;
  /** share of the world's base passports this reach beats (0-100) */
  percentile: number;
  /** member number, 1-based claim order */
  seq: number;
  createdAt: string;
  /** whether holdings (passports/credentials) may be shown publicly.
   *  Defaults to false - profile + share card only ever show the NUMBER
   *  and the primary passport flag, never the credential list. */
  isPublic: boolean;
  /** false until the confirmation link in the claim email is clicked.
   *  Records created before email verification existed omit the field
   *  entirely and are treated as verified (grandfathered). */
  verified?: boolean;
  /** one-time token embedded in the confirmation link; cleared on verify */
  verifyToken?: string;
  /** ISO timestamp after which an unverified claim lapses and the name frees up */
  verifyExpires?: string;
}

export interface ReachResult {
  total: number;
  visaFree: number;
  visaOnArrival: number;
  etaOrEvisa: number;
  /** % of the world's 199 base passports whose reach this beats */
  percentile: number;
}
