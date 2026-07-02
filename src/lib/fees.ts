import raw from "@/data/visa-fees.json";

// Official visa fees per destination, crawled from government / official-portal
// sources (see data/visa-fees/ for the raw per-country records with full notes).
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
}

export interface FeeVariation {
  nationalities: string[];
  kind: string | null;
  amount: number | null;
  currency: string | null;
  note: string;
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

/** The fee entries relevant to one nationality's access status at a destination. */
export function relevantFees(destIso3: string, statusKind: string): FeeEntry[] {
  const d = feesByIso3[destIso3];
  if (!d) return [];
  const kinds = KIND_FOR_LEVEL[statusKind];
  if (!kinds) return [];
  const hits = d.fees.filter((f) => kinds.includes(f.kind));
  // visa_required fallback: if no tourist/e-visa recorded, show whatever paid entry kinds exist
  if (hits.length === 0 && statusKind === "visa_required") {
    return d.fees.filter((f) => f.kind !== "transit_visa").slice(0, 2);
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
  if (f.amount == null) return "see official source";
  const base = `${f.currency ?? ""} ${f.amount.toLocaleString()}`.trim();
  return f.amount_usd != null && f.currency !== "USD" ? `${base} (~$${f.amount_usd.toLocaleString()})` : base;
}
