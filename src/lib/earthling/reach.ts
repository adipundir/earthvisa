import { compute } from "@/lib/compute";
import { dataset } from "@/lib/dataset";
import type { ReachResult } from "./types";

// Sorted base reach (no credentials) of every passport we track - the honest
// comparison population for the percentile: "your reach beats N% of the
// world's passports". Base-passport reaches, equally weighted; credentials
// are how an individual beats their own passport's baseline, which is the
// entire point of the game. Computed lazily once per server instance.
let dist: number[] | null = null;
export function baseReachDistribution(): number[] {
  if (!dist) {
    dist = dataset.allCountries
      .map((c) => compute([c.iso3], [], {}).reach.length)
      .sort((a, b) => a - b);
  }
  return dist;
}

const VALID_ISO3 = new Set(dataset.allCountries.map((c) => c.iso3));
const VALID_CREDS = new Set(dataset.credentials.map((c) => c.id));

export const MAX_PASSPORTS = 3;
export const MAX_CREDENTIALS = 6;

/** Validates + canonicalises holdings; returns null when anything is off. */
export function sanitizeHoldings(
  passports: unknown,
  credentials: unknown,
): { passports: string[]; credentials: string[] } | null {
  if (!Array.isArray(passports) || !Array.isArray(credentials)) return null;
  // Reject oversized arrays BEFORE any per-element work: this is an
  // unauthenticated endpoint, and mapping a multi-million-element body through
  // String()/Set would burn CPU for free. Generous raw caps, then dedupe.
  if (passports.length > 20 || credentials.length > 40) return null;
  const p = [...new Set(passports.map((x) => String(x).toUpperCase()))];
  const c = [...new Set(credentials.map((x) => String(x).toUpperCase()))];
  if (p.length < 1 || p.length > MAX_PASSPORTS) return null;
  if (c.length > MAX_CREDENTIALS) return null;
  if (!p.every((x) => VALID_ISO3.has(x))) return null;
  if (!c.every((x) => VALID_CREDS.has(x))) return null;
  return { passports: p, credentials: c };
}

/** Reach + percentile for a set of holdings, via the site's one compute() engine. */
export function reachFor(passports: string[], credentials: string[]): ReachResult {
  const r = compute(passports, credentials, {});
  const total = r.reach.length;
  const d = baseReachDistribution();
  const below = d.filter((x) => x < total).length;
  return {
    total,
    visaFree: r.reachByLevel.visa_free.length,
    visaOnArrival: r.reachByLevel.visa_on_arrival.length,
    etaOrEvisa: r.reachByLevel.eta.length + r.reachByLevel.e_visa.length,
    percentile: Math.round((below / d.length) * 100),
  };
}
