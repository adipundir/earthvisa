import raw from "@/data/proof-of-funds.json";

// Proof-of-funds ("how much bank balance to show") records per major visa.
// OFFICIAL figures (published government minimums / subsistence rates) are kept
// strictly separate from COMMUNITY reports (anecdotal applicant experience).
// Never present a community figure as an official requirement.

export interface Money {
  amount: number | null;
  currency: string | null;
  basis?: string;
  note?: string;
  source_url?: string | null;
  official?: boolean;
}

export interface PerMember {
  state: string;
  amount: number | null;
  currency: string | null;
  basis: string;
  note: string;
  source_url: string | null;
}

export interface ProofOfFunds {
  key: string;
  name: string;
  visa: string;
  scope: "bloc" | "country";
  /** null when the source record has no recorded check date - never substitute one. */
  updated: string | null;
  confidence: "high" | "medium" | "low";
  official: {
    published: boolean;
    daily_minimum: Money | null;
    total_example: Money | null;
    guidance: string;
    per_member: PerMember[];
  };
  community: {
    typical_approved: string;
    notes: string;
    sources: string[];
  };
  documents: string[];
  red_flags: string[];
  sources: string[];
}

const byKey = raw as unknown as Record<string, ProofOfFunds>;

export function pofFor(key: string): ProofOfFunds | null {
  return byKey[key] ?? null;
}

/** All records, official-published first, then alphabetical. */
export function allPof(): ProofOfFunds[] {
  return Object.values(byKey).sort((a, b) => {
    if (a.official.published !== b.official.published) return a.official.published ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function fmtMoney(m: { amount: number | null; currency: string | null }): string {
  if (m.amount == null) return "no fixed minimum";
  return `${m.currency ?? ""} ${m.amount.toLocaleString()}`.trim();
}
