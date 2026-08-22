import raw from "@/data/visa-fees.json";
import fx from "@/data/fx-rates.json";

// Official visa fees per destination, crawled from government / official-portal
// sources (see data/visa-fees/ for the raw per-country records with full notes).
// Fees are stored in their ORIGINAL currency; approximate USD figures are
// derived at render time from the fx-rates snapshot (scripts/update-fx-rates.mjs).
// Fees change; every entry carries its source URL and crawl date.

export interface FeeEntry {
  kind: string; // tourist_visa | e_visa | visa_on_arrival | eta | business_visa | transit_visa
  name: string;
  amount: number | null;
  currency: string | null;
  amount_usd: number | null;
  validity: string | null;
  official: boolean;
  source_url: string | null;
  notes: string;
  /** who/where this row's own text says it covers, e.g. "most nationalities (non-US)
   * applying at Chinese missions in the US" - a location-scoped reference, not a
   * general one, even when it also says "most nationalities". */
  applies?: string | null;
  /** when present, this fee row only applies to (and only renders for) these nationalities */
  applies_nationalities?: string[];
}

export interface FeeVariationItem {
  label: string;
  amount: number;
}

export interface FeeVariation {
  nationalities: string[];
  kind: string | null;
  amount: number | null;
  currency: string | null;
  note: string;
  source_url?: string;
  /** itemized per-category schedule (entry/duration tiers) in the variation's currency */
  items?: FeeVariationItem[];
}

const FX_RATES = (fx as { rates: Record<string, number>; date: string }).rates;

// Staleness guard: the ~USD figures are derived from this FX snapshot, so an old
// one makes them silently drift. Warn loudly in server/build logs (never in the
// user's browser console) so a maintainer runs `node scripts/update-fx-rates.mjs`.
// Past a hard threshold callers can hide ~USD via `fxTooStale`.
export const fxSnapshotDate = (fx as { date: string }).date;
const fxAgeDays = (() => {
  const t = Date.parse(fxSnapshotDate);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 86_400_000;
})();
export const fxIsStale = fxAgeDays > 45;
export const fxTooStale = fxAgeDays > 120;
if (fxIsStale && typeof window === "undefined") {
  console.warn(
    `[fx] fx-rates.json is ${Number.isFinite(fxAgeDays) ? Math.round(fxAgeDays) + " days" : "of unknown age"} old (${fxSnapshotDate}); ~USD figures may drift. Run: node scripts/update-fx-rates.mjs`,
  );
}

/** Convert an amount in an original currency to approximate USD via the rates snapshot. */
export function toUsd(amount: number | null, currency: string | null): number | null {
  if (amount == null) return null;
  if (!currency || currency === "USD") return amount;
  const rate = FX_RATES[currency];
  if (!rate || rate <= 0) return null;
  // whole dollars - these are approximations, not quotes, and decimals read as false precision
  return Math.round(amount / rate);
}

export interface VfsInfo {
  used: boolean;
  operator?: string;
  service_fee?: string | null;
  currency?: string | null;
  note?: string;
  source_url?: string | null;
}

export interface DestinationFees {
  updated: string | null;
  confidence: "high" | "medium" | "low";
  fees: FeeEntry[];
  variations: FeeVariation[];
  vfs: VfsInfo;
  free_visa_notes: string;
}

const feesByIso3 = raw as unknown as Record<string, DestinationFees>;

export function feesFor(destIso3: string): DestinationFees | null {
  return feesByIso3[destIso3] ?? null;
}

/** Map a corridor access level to the fee kinds that answer "what will I pay". */
const KIND_FOR_LEVEL: Record<string, string[]> = {
  e_visa: ["e_visa"],
  eta: ["eta"],
  visa_on_arrival: ["visa_on_arrival"],
  visa_required: ["tourist_visa", "e_visa"],
};

/**
 * Placeholder rows record that a product does NOT exist ("No e-visa system",
 * "not offered", applies: "none") or carry neither an amount nor a source URL  - 
 * they are data notes, not renderable fees, and must never surface as a fee
 * card (e.g. Germany/Portugal carried an applies:"none" e-visa stub whose own
 * notes say no e-visa exists, yet it rendered as "E-visa - Fee not published").
 */
function isRenderableFee(f: FeeEntry & { applies?: string | null }): boolean {
  if (/^not?\s/i.test(f.name)) return false;
  if ((f.applies ?? "").trim().toLowerCase() === "none") return false;
  return f.amount != null || !!f.source_url;
}

/** The fee entries relevant to one nationality's access status at a destination. */
export function relevantFees(destIso3: string, statusKind: string, natIso3?: string): FeeEntry[] {
  const d = feesByIso3[destIso3];
  if (!d) return [];
  const kinds = KIND_FOR_LEVEL[statusKind];
  if (!kinds) return [];
  // Nationality-scoped rows (e.g. China's flat US-citizen fee) must never render
  // on another nationality's corridor.
  const applies = (f: FeeEntry) => !f.applies_nationalities || (natIso3 != null && f.applies_nationalities.includes(natIso3));
  const hits = d.fees.filter((f) => kinds.includes(f.kind) && isRenderableFee(f) && applies(f));
  // visa_required fallback: if no tourist/e-visa recorded, show whatever paid entry kinds exist
  if (hits.length === 0 && statusKind === "visa_required") {
    return d.fees.filter((f) => f.kind !== "transit_visa" && isRenderableFee(f) && applies(f)).slice(0, 2);
  }
  // e-visa / eTA fallback: when the matching kind has no published amount, the
  // destination's tourist-visa fee is what the online applicant actually pays
  // (e.g. UAE records its AED tourist-visa fees with no separate e_visa row).
  if ((statusKind === "e_visa" || statusKind === "eta") && !hits.some((f) => f.amount != null)) {
    const tourist = d.fees.filter((f) => f.kind === "tourist_visa" && f.amount != null && applies(f));
    if (tourist.length > 0) return [...hits, ...tourist];
  }
  return hits;
}

/** Reciprocity variation for one nationality, if the destination publishes one. */
export function variationFor(destIso3: string, natIso3: string): FeeVariation | null {
  const d = feesByIso3[destIso3];
  if (!d) return null;
  return d.variations.find((v) => v.nationalities.includes(natIso3)) ?? null;
}

export function fmtFee(f: { amount: number | null; currency: string | null; amount_usd?: number | null }): string {
  if (f.amount === 0) return "Free"; // genuinely free products, not "AUD 0 (~$0)"
  if (f.amount == null) return "see official source";
  const base = `${f.currency ?? ""} ${f.amount.toLocaleString()}`.trim();
  if (f.currency === "USD") return base;
  // Live-rate conversion from the original currency; stored amount_usd is the
  // fallback for currencies missing from the rates snapshot.
  const usd = toUsd(f.amount, f.currency) ?? f.amount_usd ?? null;
  return usd != null ? `${base} (~$${usd.toLocaleString()})` : base;
}
