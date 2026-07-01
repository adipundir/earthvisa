import { dataset } from "./dataset";
import { compute } from "./compute";

// Highest-search-volume visa corridors ("<destination> visa for <nationality>").
// Curated subset (top nationalities × top destinations) so the build stays lean
// and Google can crawl/index quickly; expandable later.
export const TOP_NATIONALITIES = [
  "IND", "PAK", "BGD", "NPL", "LKA", "CHN", "PHL", "IDN", "VNM", "MYS",
  "THA", "NGA", "EGY", "KEN", "GHA", "ZAF", "MAR", "DZA", "ETH", "USA",
  "CAN", "MEX", "BRA", "GBR", "DEU", "FRA", "ITA", "ESP", "NLD", "RUS",
  "TUR", "UKR", "POL", "SAU", "ARE", "QAT", "IRN", "JOR", "AUS", "KAZ",
];
export const TOP_DESTINATIONS = [
  "ARE", "THA", "USA", "GBR", "DEU", "FRA", "ITA", "ESP", "NLD", "GRC",
  "CHE", "PRT", "AUT", "BEL", "SGP", "MYS", "IDN", "VNM", "LKA", "NPL",
  "MDV", "SAU", "QAT", "TUR", "OMN", "BHR", "KWT", "JOR", "CAN", "AUS",
  "NZL", "JPN", "KOR", "CHN", "HKG", "IND", "PHL", "EGY", "KEN", "ZAF",
  "MAR", "TZA", "BRA", "MEX", "ARG", "RUS", "GEO", "AZE", "KAZ", "UZB",
];

/** Adjectival demonym for the top nationalities, e.g. "Thailand Visa for Indian citizens". */
export const DEMONYM: Record<string, string> = {
  IND: "Indian", PAK: "Pakistani", BGD: "Bangladeshi", NPL: "Nepali", LKA: "Sri Lankan",
  CHN: "Chinese", PHL: "Filipino", IDN: "Indonesian", VNM: "Vietnamese", MYS: "Malaysian",
  THA: "Thai", NGA: "Nigerian", EGY: "Egyptian", KEN: "Kenyan", GHA: "Ghanaian",
  ZAF: "South African", MAR: "Moroccan", DZA: "Algerian", ETH: "Ethiopian", USA: "American",
  CAN: "Canadian", MEX: "Mexican", BRA: "Brazilian", GBR: "British", DEU: "German",
  FRA: "French", ITA: "Italian", ESP: "Spanish", NLD: "Dutch", RUS: "Russian",
  TUR: "Turkish", UKR: "Ukrainian", POL: "Polish", SAU: "Saudi", ARE: "Emirati",
  QAT: "Qatari", IRN: "Iranian", JOR: "Jordanian", AUS: "Australian", KAZ: "Kazakh",
};

export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const byIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c]));

export interface CorridorPair { nat: string; dest: string; natSlug: string; destSlug: string }

let _pairs: CorridorPair[] | null = null;
let _useful: Set<string> | null = null;

/**
 * Curated (nationality, destination) corridors — but ONLY the ones that carry
 * genuinely differentiated content: an access grant (visa-free / VoA / eTA /
 * e-visa), freedom of movement, OR a VFS document checklist. Corridors that
 * would only say a generic "visa required, apply at an embassy" (no grant, no
 * documents) are skipped so we never publish thin, near-duplicate pages.
 * Memoized so the build computes it once per worker.
 */
export function corridorPairs(): CorridorPair[] {
  if (_pairs) return _pairs;
  const vfs = dataset.vfsCorridors ?? {};
  const out: CorridorPair[] = [];
  for (const nat of TOP_NATIONALITIES) {
    const n = byIso3.get(nat);
    if (!n) continue;
    const r = compute([nat], [], {});
    const reach = new Set(r.reach.map((e) => e.dest));
    const fom = new Set(r.freedomOfMovement.map((e) => e.dest));
    for (const dst of TOP_DESTINATIONS) {
      if (dst === nat) continue;
      const d = byIso3.get(dst);
      if (!d) continue;
      const hasVfs = (vfs[dst] ?? []).some((c) => c.sourceIso3 === nat);
      if (!reach.has(dst) && !fom.has(dst) && !hasVfs) continue; // skip thin/generic
      out.push({ nat, dest: dst, natSlug: nameToSlug(n.name), destSlug: nameToSlug(d.name) });
    }
  }
  _pairs = out;
  return out;
}

/** Fast membership check for the internal link mesh (so we never link to a pruned page). */
export function isUsefulCorridor(nat: string, dest: string): boolean {
  if (!_useful) _useful = new Set(corridorPairs().map((c) => `${c.nat}|${c.dest}`));
  return _useful.has(`${nat}|${dest}`);
}
