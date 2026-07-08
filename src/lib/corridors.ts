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
  "BEL",
];
export const TOP_DESTINATIONS = [
  "ARE", "THA", "USA", "GBR", "DEU", "FRA", "ITA", "ESP", "NLD", "GRC",
  "CHE", "PRT", "AUT", "BEL", "SGP", "MYS", "IDN", "VNM", "LKA", "NPL",
  "MDV", "SAU", "QAT", "TUR", "OMN", "BHR", "KWT", "JOR", "CAN", "AUS",
  "NZL", "JPN", "KOR", "CHN", "HKG", "IND", "PHL", "EGY", "KEN", "ZAF",
  "MAR", "TZA", "BRA", "MEX", "ARG", "RUS", "GEO", "AZE", "KAZ", "UZB",
  "IRL",
];

// High-search-demand corridors that the thin-content prune would otherwise drop
// (visa-required, no grant/VFS docs). These render destination visa types + fee
// data instead, so they carry real content. "nat|dest" keys.
const FORCE_CORRIDORS = new Set([
  "IND|IRL", "PAK|IRL",
  "NGA|CAN",
  "IND|GBR", "PAK|GBR", "NGA|GBR",
  "CHN|JPN", "SAU|JPN", "ZAF|JPN", // reclassified visa-required (Japan eVISA is residence-based, not a nationality grant); keep - fee data + application note
  // Top Indian outbound destinations that are visa-required with no VFS
  // checklist - previously 404ed while Tuvalu got a page. All carry rich fee
  // + visa-type data (audit-verified); FRA/GRC also close the two holes in
  // /guide/schengen/india's destination links.
  "IND|USA", "IND|CAN", "IND|AUS", "IND|SAU", "IND|KWT", "IND|FRA", "IND|GRC",
  "IND|ESP", // previously existed only via the mis-mapped Malta VFS file; Spain is a top Indian destination with full fee + visa-type data
]);

/** Adjectival demonym, e.g. "Thailand Visa for Indian citizens". Copy that uses
 * this map must fall back to a phrasing that reads correctly with the bare
 * country name (e.g. "Palau passport holders", "citizens of Palau"). */
export const DEMONYM: Record<string, string> = {
  // Top corridor nationalities
  IND: "Indian", PAK: "Pakistani", BGD: "Bangladeshi", NPL: "Nepali", LKA: "Sri Lankan",
  CHN: "Chinese", PHL: "Filipino", IDN: "Indonesian", VNM: "Vietnamese", MYS: "Malaysian",
  THA: "Thai", NGA: "Nigerian", EGY: "Egyptian", KEN: "Kenyan", GHA: "Ghanaian",
  ZAF: "South African", MAR: "Moroccan", DZA: "Algerian", ETH: "Ethiopian", USA: "American",
  CAN: "Canadian", MEX: "Mexican", BRA: "Brazilian", GBR: "British", DEU: "German",
  FRA: "French", ITA: "Italian", ESP: "Spanish", NLD: "Dutch", RUS: "Russian",
  TUR: "Turkish", UKR: "Ukrainian", POL: "Polish", SAU: "Saudi", ARE: "Emirati",
  QAT: "Qatari", IRN: "Iranian", JOR: "Jordanian", AUS: "Australian", KAZ: "Kazakh",
  BEL: "Belgian",
  // Broader coverage for passport-page and guide copy
  JPN: "Japanese", KOR: "South Korean", TWN: "Taiwanese", SGP: "Singaporean",
  CHE: "Swiss", IRL: "Irish", PRT: "Portuguese", GRC: "Greek", AUT: "Austrian",
  NOR: "Norwegian", SWE: "Swedish", DNK: "Danish", FIN: "Finnish", ISL: "Icelandic",
  CZE: "Czech", HUN: "Hungarian", ROU: "Romanian", BGR: "Bulgarian", HRV: "Croatian",
  SVK: "Slovak", SVN: "Slovenian", EST: "Estonian", LVA: "Latvian", LTU: "Lithuanian",
  LUX: "Luxembourgish", MLT: "Maltese", CYP: "Cypriot", ALB: "Albanian", SRB: "Serbian",
  MNE: "Montenegrin", MKD: "Macedonian", BIH: "Bosnian", MDA: "Moldovan", BLR: "Belarusian",
  GEO: "Georgian", ARM: "Armenian", AZE: "Azerbaijani",
  ARG: "Argentine", CHL: "Chilean", COL: "Colombian", PER: "Peruvian", VEN: "Venezuelan",
  ECU: "Ecuadorian", URY: "Uruguayan", PRY: "Paraguayan", BOL: "Bolivian", CRI: "Costa Rican",
  PAN: "Panamanian", GTM: "Guatemalan", HND: "Honduran", SLV: "Salvadoran", NIC: "Nicaraguan",
  CUB: "Cuban", DOM: "Dominican", JAM: "Jamaican", HTI: "Haitian",
  ISR: "Israeli", LBN: "Lebanese", SYR: "Syrian", IRQ: "Iraqi", KWT: "Kuwaiti",
  OMN: "Omani", BHR: "Bahraini", YEM: "Yemeni", LBY: "Libyan", TUN: "Tunisian",
  SDN: "Sudanese", PSE: "Palestinian", AFG: "Afghan",
  TZA: "Tanzanian", UGA: "Ugandan", RWA: "Rwandan", ZMB: "Zambian", ZWE: "Zimbabwean",
  SEN: "Senegalese", CMR: "Cameroonian", CIV: "Ivorian", AGO: "Angolan", MOZ: "Mozambican",
  NAM: "Namibian", SOM: "Somali", ERI: "Eritrean",
  KHM: "Cambodian", LAO: "Lao", MNG: "Mongolian", UZB: "Uzbek", TJK: "Tajik",
  KGZ: "Kyrgyz", TKM: "Turkmen", BTN: "Bhutanese", MDV: "Maldivian", BRN: "Bruneian",
  PNG: "Papua New Guinean", FJI: "Fijian",
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
  // Every passport (not just the curated top nationalities) gets a corridor
  // page for every destination where IT has genuine content: an access grant,
  // freedom of movement, a VFS document checklist, or an explicit force-include.
  // Same thin-content bar as before - just no longer capped to a curated
  // nationality x destination grid, so "click any destination card" always
  // lands on a real per-passport page when one exists.
  for (const n of dataset.allCountries) {
    const nat = n.iso3;
    const r = compute([nat], [], {});
    const candidates = new Set<string>();
    for (const e of r.reach) candidates.add(e.dest);
    for (const e of r.freedomOfMovement) candidates.add(e.dest);
    for (const [dst, corrs] of Object.entries(vfs)) {
      if (corrs.some((c) => c.sourceIso3 === nat)) candidates.add(dst);
    }
    for (const key of FORCE_CORRIDORS) {
      const [fn, fd] = key.split("|");
      if (fn === nat) candidates.add(fd);
    }
    for (const dst of candidates) {
      if (dst === nat) continue;
      const d = byIso3.get(dst);
      if (!d) continue;
      out.push({ nat, dest: dst, natSlug: nameToSlug(n.name), destSlug: nameToSlug(d.name) });
    }
  }
  _pairs = out;
  return out;
}

/**
 * Small curated subset actually pre-rendered at build time - top nationality x
 * top destination, same quality bar as corridorPairs(). The full corridorPairs()
 * set (~23k) is still valid and reachable: the corridor page sets
 * dynamicParams=true, so any other real corridor renders on first visit and is
 * cached from then on, instead of every single one being built upfront (which
 * is what made builds take ~9 minutes and deploys fail on output size).
 */
export function preWarmCorridorPairs(): CorridorPair[] {
  const topNat = new Set(TOP_NATIONALITIES);
  const topDest = new Set(TOP_DESTINATIONS);
  return corridorPairs().filter((c) => topNat.has(c.nat) && topDest.has(c.dest));
}

/** Fast membership check for the internal link mesh (so we never link to a pruned page). */
export function isUsefulCorridor(nat: string, dest: string): boolean {
  if (!_useful) _useful = new Set(corridorPairs().map((c) => `${c.nat}|${c.dest}`));
  return _useful.has(`${nat}|${dest}`);
}

/** Corridor pages where this country is the nationality (for the passport page's link mesh). */
export function corridorsForNationality(natIso3: string): CorridorPair[] {
  return corridorPairs().filter((c) => c.nat === natIso3);
}

/** Corridor pages where this country is the destination (for the destination page's link mesh). */
export function corridorsForDestination(destIso3: string): CorridorPair[] {
  return corridorPairs().filter((c) => c.dest === destIso3);
}
