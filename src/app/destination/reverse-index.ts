import { dataset, nameFor } from "@/lib/dataset";
import type { AccessLevel } from "@/lib/types";

// Reverse-index of dataset.passportAccess: which passports a destination
// admits at each access level. Unlike country.visaPolicyCounts, this folds in
// bloc / freedom-of-movement grants, so EVERY destination surface (index page,
// slug pages, metadata) must count from here or the figures disagree.

export function buildReverseIndex(destIso3: string) {
  const accessByLevel: Record<AccessLevel, { iso3: string; maxStayDays: number | null }[]> = {
    visa_free: [],
    visa_on_arrival: [],
    eta: [],
    e_visa: [],
  };
  for (const [passportIso3, edges] of Object.entries(dataset.passportAccess)) {
    const edge = edges.find((e) => e.dest === destIso3);
    if (edge) {
      accessByLevel[edge.level].push({ iso3: passportIso3, maxStayDays: edge.maxStayDays });
    }
  }
  // Alphabetical within each level so readers can find their own country in
  // long lists without scanning an arbitrary ordering.
  for (const level of Object.keys(accessByLevel) as AccessLevel[]) {
    accessByLevel[level].sort((a, b) => nameFor(a.iso3).localeCompare(nameFor(b.iso3)));
  }
  return accessByLevel;
}

/**
 * Visa-free admit count for every destination in one pass. Mirrors
 * buildReverseIndex exactly (first edge per passport→destination wins) so the
 * destination index shows the same number as each destination page.
 */
export function visaFreeAdmitCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edges of Object.values(dataset.passportAccess)) {
    const seen = new Set<string>();
    for (const e of edges) {
      if (seen.has(e.dest)) continue;
      seen.add(e.dest);
      if (e.level === "visa_free") counts.set(e.dest, (counts.get(e.dest) ?? 0) + 1);
    }
  }
  return counts;
}
