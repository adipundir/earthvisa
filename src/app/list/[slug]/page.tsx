import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { compute, type CombinedEdge, type PassportResult } from "@/lib/compute";
import { DEMONYM, isUsefulCorridor } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";
import SearchableLedger from "@/components/SearchableLedger";
import type { AccessLevel } from "@/lib/types";
import ReportLine from "@/components/ReportLine";

// Only the slugs below are served; anything else 404s at build time.
export const dynamicParams = false;

type ListKind = "us_visa" | "voa" | "visa_free" | "e_visa";

interface ListConfig {
  slug: string;
  kind: ListKind;
  /** nationality iso3 the list is written for */
  nat: string;
  /** plural noun, sentence case ("Pakistani citizens") */
  people: string;
  /** plural noun, title case ("Pakistani Citizens") */
  peopleTitle: string;
}

const LISTS: ListConfig[] = [
  { slug: "visa-free-countries-for-indians", kind: "visa_free", nat: "IND", people: "Indians", peopleTitle: "Indians" },
  { slug: "visa-free-countries-for-pakistanis", kind: "visa_free", nat: "PAK", people: "Pakistanis", peopleTitle: "Pakistanis" },
  { slug: "visa-free-countries-for-filipinos", kind: "visa_free", nat: "PHL", people: "Filipinos", peopleTitle: "Filipinos" },
  { slug: "visa-free-countries-for-nigerians", kind: "visa_free", nat: "NGA", people: "Nigerians", peopleTitle: "Nigerians" },
  { slug: "visa-on-arrival-countries-for-indians", kind: "voa", nat: "IND", people: "Indians", peopleTitle: "Indians" },
  { slug: "visa-on-arrival-countries-for-pakistanis", kind: "voa", nat: "PAK", people: "Pakistanis", peopleTitle: "Pakistanis" },
  { slug: "visa-on-arrival-countries-for-filipinos", kind: "voa", nat: "PHL", people: "Filipinos", peopleTitle: "Filipinos" },
  { slug: "visa-on-arrival-countries-for-nigerians", kind: "voa", nat: "NGA", people: "Nigerians", peopleTitle: "Nigerians" },
  { slug: "visa-free-countries-for-indonesians", kind: "visa_free", nat: "IDN", people: "Indonesians", peopleTitle: "Indonesians" },
  { slug: "visa-free-countries-for-vietnamese-citizens", kind: "visa_free", nat: "VNM", people: "Vietnamese citizens", peopleTitle: "Vietnamese Citizens" },
  { slug: "visa-free-countries-for-brazilians", kind: "visa_free", nat: "BRA", people: "Brazilians", peopleTitle: "Brazilians" },
  { slug: "visa-free-countries-for-mexicans", kind: "visa_free", nat: "MEX", people: "Mexicans", peopleTitle: "Mexicans" },
  { slug: "visa-free-countries-for-egyptians", kind: "visa_free", nat: "EGY", people: "Egyptians", peopleTitle: "Egyptians" },
  { slug: "visa-free-countries-for-bangladeshis", kind: "visa_free", nat: "BGD", people: "Bangladeshis", peopleTitle: "Bangladeshis" },
  { slug: "visa-on-arrival-countries-for-indonesians", kind: "voa", nat: "IDN", people: "Indonesians", peopleTitle: "Indonesians" },
  { slug: "visa-on-arrival-countries-for-vietnamese-citizens", kind: "voa", nat: "VNM", people: "Vietnamese citizens", peopleTitle: "Vietnamese Citizens" },
  { slug: "visa-on-arrival-countries-for-brazilians", kind: "voa", nat: "BRA", people: "Brazilians", peopleTitle: "Brazilians" },
  { slug: "visa-on-arrival-countries-for-mexicans", kind: "voa", nat: "MEX", people: "Mexicans", peopleTitle: "Mexicans" },
  { slug: "visa-on-arrival-countries-for-egyptians", kind: "voa", nat: "EGY", people: "Egyptians", peopleTitle: "Egyptians" },
  { slug: "visa-on-arrival-countries-for-bangladeshis", kind: "voa", nat: "BGD", people: "Bangladeshis", peopleTitle: "Bangladeshis" },
  { slug: "e-visa-countries-for-indians", kind: "e_visa", nat: "IND", people: "Indians", peopleTitle: "Indians" },
  { slug: "countries-with-us-visa-for-indians", kind: "us_visa", nat: "IND", people: "Indians", peopleTitle: "Indians" },
  { slug: "countries-with-us-visa-for-pakistani-citizens", kind: "us_visa", nat: "PAK", people: "Pakistani citizens", peopleTitle: "Pakistani Citizens" },
  { slug: "countries-with-us-visa-for-filipino-citizens", kind: "us_visa", nat: "PHL", people: "Filipino citizens", peopleTitle: "Filipino Citizens" },
  // GSC-driven expansion (2026-07-21): voa/us_visa are the proven-winning list
  // patterns on this site (real CTR + page-1 positions - e.g. voa-for-pakistanis
  // at position ~14, us-visa-for-filipino-citizens at position ~10) vs. the
  // broad visa_free lists, which lose to established authority sites on that
  // exact head term (position ~47-61 despite exact-match intent). Expansion
  // criteria, computed from src/data/dataset.json: a nationality gets a new
  // voa list when its passport's visa-free count < 60 AND visa-on-arrival
  // count >= 15 (a "weak-to-medium" passport where VoA access is a genuinely
  // valuable finding, not a footnote); a nationality gets a new us_visa list
  // when compute([nat], ["US_VISA"], {}) yields >= 10 real unlocked
  // destinations (below that, a US visa isn't a meaningful travel-hack for
  // that passport). Strong passports (USA/GBR/DEU/FRA/CAN/AUS/...) were
  // excluded from both - the US_VISA compute run showed only 1-2 unlocks for
  // them, and VoA access is not their primary value proposition.
  { slug: "visa-on-arrival-countries-for-nepali-citizens", kind: "voa", nat: "NPL", people: "Nepali citizens", peopleTitle: "Nepali Citizens" },
  { slug: "visa-on-arrival-countries-for-sri-lankans", kind: "voa", nat: "LKA", people: "Sri Lankans", peopleTitle: "Sri Lankans" },
  { slug: "visa-on-arrival-countries-for-chinese-citizens", kind: "voa", nat: "CHN", people: "Chinese citizens", peopleTitle: "Chinese Citizens" },
  { slug: "visa-on-arrival-countries-for-thai-citizens", kind: "voa", nat: "THA", people: "Thai citizens", peopleTitle: "Thai Citizens" },
  { slug: "visa-on-arrival-countries-for-kenyans", kind: "voa", nat: "KEN", people: "Kenyans", peopleTitle: "Kenyans" },
  { slug: "visa-on-arrival-countries-for-ghanaians", kind: "voa", nat: "GHA", people: "Ghanaians", peopleTitle: "Ghanaians" },
  { slug: "visa-on-arrival-countries-for-south-africans", kind: "voa", nat: "ZAF", people: "South Africans", peopleTitle: "South Africans" },
  { slug: "visa-on-arrival-countries-for-moroccans", kind: "voa", nat: "MAR", people: "Moroccans", peopleTitle: "Moroccans" },
  { slug: "visa-on-arrival-countries-for-algerians", kind: "voa", nat: "DZA", people: "Algerians", peopleTitle: "Algerians" },
  { slug: "visa-on-arrival-countries-for-ethiopians", kind: "voa", nat: "ETH", people: "Ethiopians", peopleTitle: "Ethiopians" },
  { slug: "visa-on-arrival-countries-for-saudis", kind: "voa", nat: "SAU", people: "Saudis", peopleTitle: "Saudis" },
  { slug: "visa-on-arrival-countries-for-kazakh-citizens", kind: "voa", nat: "KAZ", people: "Kazakh citizens", peopleTitle: "Kazakh Citizens" },
  { slug: "visa-on-arrival-countries-for-jordanians", kind: "voa", nat: "JOR", people: "Jordanians", peopleTitle: "Jordanians" },
  { slug: "visa-on-arrival-countries-for-iranians", kind: "voa", nat: "IRN", people: "Iranians", peopleTitle: "Iranians" },
  { slug: "countries-with-us-visa-for-bangladeshi-citizens", kind: "us_visa", nat: "BGD", people: "Bangladeshi citizens", peopleTitle: "Bangladeshi Citizens" },
  { slug: "countries-with-us-visa-for-nepali-citizens", kind: "us_visa", nat: "NPL", people: "Nepali citizens", peopleTitle: "Nepali Citizens" },
  { slug: "countries-with-us-visa-for-sri-lankan-citizens", kind: "us_visa", nat: "LKA", people: "Sri Lankan citizens", peopleTitle: "Sri Lankan Citizens" },
  { slug: "countries-with-us-visa-for-indonesian-citizens", kind: "us_visa", nat: "IDN", people: "Indonesian citizens", peopleTitle: "Indonesian Citizens" },
  { slug: "countries-with-us-visa-for-vietnamese-citizens", kind: "us_visa", nat: "VNM", people: "Vietnamese citizens", peopleTitle: "Vietnamese Citizens" },
  { slug: "countries-with-us-visa-for-egyptian-citizens", kind: "us_visa", nat: "EGY", people: "Egyptian citizens", peopleTitle: "Egyptian Citizens" },
  { slug: "countries-with-us-visa-for-chinese-citizens", kind: "us_visa", nat: "CHN", people: "Chinese citizens", peopleTitle: "Chinese Citizens" },
  { slug: "countries-with-us-visa-for-nigerian-citizens", kind: "us_visa", nat: "NGA", people: "Nigerian citizens", peopleTitle: "Nigerian Citizens" },
  { slug: "countries-with-us-visa-for-algerian-citizens", kind: "us_visa", nat: "DZA", people: "Algerian citizens", peopleTitle: "Algerian Citizens" },
  { slug: "countries-with-us-visa-for-ethiopian-citizens", kind: "us_visa", nat: "ETH", people: "Ethiopian citizens", peopleTitle: "Ethiopian Citizens" },
  { slug: "countries-with-us-visa-for-iranian-citizens", kind: "us_visa", nat: "IRN", people: "Iranian citizens", peopleTitle: "Iranian Citizens" },
  { slug: "countries-with-us-visa-for-jordanian-citizens", kind: "us_visa", nat: "JOR", people: "Jordanian citizens", peopleTitle: "Jordanian Citizens" },
  { slug: "countries-with-us-visa-for-thai-citizens", kind: "us_visa", nat: "THA", people: "Thai citizens", peopleTitle: "Thai Citizens" },
  { slug: "countries-with-us-visa-for-kenyan-citizens", kind: "us_visa", nat: "KEN", people: "Kenyan citizens", peopleTitle: "Kenyan Citizens" },
  { slug: "countries-with-us-visa-for-moroccan-citizens", kind: "us_visa", nat: "MAR", people: "Moroccan citizens", peopleTitle: "Moroccan Citizens" },
  { slug: "countries-with-us-visa-for-ghanaian-citizens", kind: "us_visa", nat: "GHA", people: "Ghanaian citizens", peopleTitle: "Ghanaian Citizens" },
  { slug: "countries-with-us-visa-for-kazakh-citizens", kind: "us_visa", nat: "KAZ", people: "Kazakh citizens", peopleTitle: "Kazakh Citizens" },
  { slug: "countries-with-us-visa-for-south-african-citizens", kind: "us_visa", nat: "ZAF", people: "South African citizens", peopleTitle: "South African Citizens" },
  { slug: "countries-with-us-visa-for-saudi-citizens", kind: "us_visa", nat: "SAU", people: "Saudi citizens", peopleTitle: "Saudi Citizens" },
];

export async function generateStaticParams() {
  return LISTS.map((l) => ({ slug: l.slug }));
}

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

const SHORT_LEVEL: Record<AccessLevel, string> = {
  visa_free: "Visa-free",
  visa_on_arrival: "On arrival",
  eta: "eTA",
  e_visa: "e-Visa",
};

/**
 * Destinations genuinely unlocked or improved by holding a valid US visa.
 *
 * The raw US_VISA credential bucket contains a handful of edges that must NOT
 * be sold as "you can visit this country with a US visa": airport-transit-only
 * exemptions missing the transit flag (Germany, Portugal), rules that only
 * apply to refugee/stateless travel documents (Belgium, Kosovo), edges whose
 * qualifying credential is not actually a US visa (Austria/Cyprus/Russia), and
 * a rule limited to the Caribbean parts of the Kingdom of the Netherlands.
 * A false "visa-free" claim is the worst possible error on this site, so we
 * keep only edges whose official-source notes describe straightforward entry
 * with a US visa. Dropping a true-but-ambiguous edge is safe; the reverse is not.
 */
function usVisaUnlocks(nat: string): CombinedEdge[] {
  const withUs = compute([nat], ["US_VISA"], {});
  return withUs.reach
    .filter((e) => e.viaCredential === "US_VISA")
    .filter((e) => {
      const notes = e.notes ?? "";
      const conditions = (e as CombinedEdge & { conditions?: string }).conditions ?? "";
      const text = `${notes} ${conditions}`.toLowerCase();
      if (!notes.startsWith("US:")) return false; // qualifying credential is not a US visa
      if (text.includes("airport transit")) return false; // transit-only, not entry
      if (text.includes("refugee")) return false; // refugee travel documents, not visas
      if (text.includes("caribbean parts")) return false; // NLD Caribbean territories only
      return true;
    });
}

/** "US: any valid multiple-entry visa - ..." -> "any valid multiple-entry visa".
 * Mandatory prior-use clauses ("visa shall have been used at least once") live
 * past the " - " separator the head drops - without them the condition is
 * materially wrong (e.g. Saudi rejects never-used visas), so pull them back in. */
function usVisaCondition(e: CombinedEdge): string | null {
  const notes = e.notes ?? "";
  const head = notes.split(" - ")[0]?.replace(/^US:\s*/, "").trim();
  if (!head) return null;
  const priorUse = /[^.]*\bused at least once\b[^.]*\./i.exec(notes)?.[0]?.trim();
  const t = `US visa condition: ${head}${priorUse ? `. ${priorUse}` : ""}`;
  return t.length > 220 ? `${t.slice(0, 217)}...` : t;
}

/** Split a note into sentences without cutting inside a legal citation: skip
 * any ". " that leaves parentheses unbalanced or follows an abbreviation, so
 * "Comoros law (Loi n°88-025, Art. 2) requires..." is never cut at "Art.". */
function splitSentences(notes: string): string[] {
  const out: string[] = [];
  let rest = notes.trim();
  while (rest) {
    let end = -1;
    for (let from = 0; ; ) {
      const idx = rest.indexOf(". ", from);
      if (idx === -1) break;
      const frag = rest.slice(0, idx + 1);
      const balanced = (frag.match(/\(/g)?.length ?? 0) === (frag.match(/\)/g)?.length ?? 0);
      const abbrev = /\b(?:Art|No|Nos|St|Approx|Vol|Cap|Para|Sec|Reg|Fig)\.$/i.test(frag);
      if (balanced && !abbrev) {
        end = idx;
        break;
      }
      from = idx + 1;
    }
    if (end === -1) {
      out.push(rest);
      break;
    }
    out.push(rest.slice(0, end + 1).trim());
    rest = rest.slice(end + 1).trim();
  }
  return out.filter(Boolean);
}

/** First sentence of the official-source note, when short enough to be useful. */
function firstSentence(notes: string): string | null {
  const s = splitSentences(notes)[0] ?? "";
  if (!s || s.length > 150) return null;
  return s;
}

/** A visa-on-arrival card should answer "what do I get at the border?" - prefer
 * the sentence describing the arrival visa (where issued, fee, permit) over a
 * statute citation like "Loi n°88-025, Art. 2 requires ... a Comorian visa",
 * which belongs on the destination page, not a VOA list. */
const ARRIVAL_RE = /\b(?:on arrival|upon arrival|landing visa|at the (?:airport|border|port)|port of entry|border crossing|visitor'?s permit|free of charge|gratis|fee|EUR|USD)\b/i;
const STATUTE_RE = /\b(?:law|loi|act|decree|ordinance|regulation|art\.|article)\b/i;

function voaCondition(notes: string): string | null {
  const sentences = splitSentences(notes);
  // Only the note's lead sentences qualify: a sentence plucked from deep in a
  // note loses its antecedent ("Children under 10 also receive gratis visas"),
  // as does anything hinging on "also".
  const arrival = sentences
    .slice(0, 3)
    .find((s) => s.length <= 150 && ARRIVAL_RE.test(s) && !/\balso\b/i.test(s));
  if (arrival) return arrival;
  const first = sentences[0];
  if (!first || first.length > 150 || STATUTE_RE.test(first)) return null;
  return first;
}

/** Pick up to n recognisable destinations for copy, preferring well-known ones. */
function pickNotable(edges: CombinedEdge[], preferred: string[], n = 3): string[] {
  const have = new Set(edges.map((e) => e.dest));
  const picks = preferred.filter((iso3) => have.has(iso3)).slice(0, n);
  for (const e of edges) {
    if (picks.length >= n) break;
    if (!picks.includes(e.dest)) picks.push(e.dest);
  }
  return picks.slice(0, n).map((iso3) => nameFor(iso3));
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface ListData {
  cfg: ListConfig;
  country: { iso2: string; iso3: string; name: string };
  natSlug: string;
  adj: string;
  base: PassportResult;
  /** the destinations this listicle is about, in display order */
  main: CombinedEdge[];
  /** filtered US-visa unlocks (used by every kind for cross-references) */
  usDelta: CombinedEdge[];
  title: string;
  description: string;
  keywords: string[];
  faqs: { q: string; a: string }[];
}

function byName(a: CombinedEdge, b: CombinedEdge): number {
  return nameFor(a.dest).localeCompare(nameFor(b.dest));
}

function buildListData(cfg: ListConfig): ListData | null {
  const country = dataset.allCountries.find((c) => c.iso3 === cfg.nat);
  if (!country) return null;
  const natSlug = nameToSlug(country.name);
  const adj = DEMONYM[cfg.nat] ?? country.name;
  const base = compute([cfg.nat], [], {});
  const usDelta = usVisaUnlocks(cfg.nat);

  const vfCount = base.reachByLevel.visa_free.length;
  const voaCount = base.reachByLevel.visa_on_arrival.length;
  const eCount = base.reachByLevel.eta.length + base.reachByLevel.e_visa.length;

  if (cfg.kind === "us_visa") {
    const dVf = usDelta.filter((e) => e.level === "visa_free").sort(byName);
    const dVoa = usDelta.filter((e) => e.level === "visa_on_arrival").sort(byName);
    const dE = usDelta.filter((e) => e.level === "eta" || e.level === "e_visa").sort(byName);
    const main = [...dVf, ...dVoa, ...dE];
    const n = main.length;
    const notableVf = pickNotable(dVf, ["MEX", "SRB", "ARG", "PER", "MNE", "PAN"]);
    const balkans = dVf.filter((e) => ["ALB", "SRB", "MNE", "MKD", "BIH"].includes(e.dest)).map((e) => nameFor(e.dest));
    const title = `Countries ${cfg.peopleTitle} Can Visit with a US Visa (2026) - Full List (${n})`;
    const description = `A valid US visa unlocks ${n} extra destinations for ${cfg.people} in 2026: ${dVf.length} become visa-free including ${joinNames(notableVf)}, plus ${dVoa.length} visa on arrival and ${dE.length} easier e-visas. Conditions from official sources.`;
    return {
      cfg, country, natSlug, adj, base, main, usDelta, title, description,
      keywords: [
        `countries ${cfg.people.toLowerCase()} can visit with us visa`,
        `us visa benefits for ${adj.toLowerCase()} passport`,
        `visa free countries with us visa for ${cfg.people.toLowerCase()}`,
        `countries you can visit with a us visa 2026`,
        `us visa ${adj.toLowerCase()} passport visa free countries`,
        `travel with us visa ${adj.toLowerCase()} passport`,
        `mexico with us visa ${adj.toLowerCase()} passport`,
        `${adj.toLowerCase()} passport us visa holder benefits 2026`,
      ],
      faqs: [
        {
          q: `How many countries can ${cfg.people} visit with a valid US visa in 2026?`,
          a: `A valid US visa unlocks ${n} additional destinations for ${adj} passport holders in 2026: ${dVf.length} become visa-free, ${dVoa.length} grant a visa on arrival, and ${dE.length} offer an easier e-visa or eTA. Each destination applies its own conditions - most require a multiple-entry visa physically affixed in the passport.`,
        },
        {
          q: `Which countries are visa-free for ${cfg.people} with a US visa?`,
          a: `With a valid US visa, ${adj} passport holders can enter ${dVf.length} countries visa-free in 2026: ${joinNames(dVf.map((e) => nameFor(e.dest)))}. Exact visa-type and validity conditions differ per destination and are listed on this page from official sources.`,
        },
        {
          q: `Does an ESTA or US visa waiver count as a US visa?`,
          a: `No. An ESTA is an electronic travel authorisation under the US Visa Waiver Program, not a visa. Destinations that admit US-visa holders generally require an actual visa vignette in the passport, and several specify a multiple-entry B1/B2 visitor visa. Check each destination's official conditions before booking.`,
        },
        {
          q: `Can ${cfg.people} enter the Schengen area with a US visa?`,
          a: `No. A US visa does not grant entry to the Schengen area - ${adj} citizens still need a Schengen visa for the EU. However, several European countries outside Schengen admit US-visa holders${balkans.length ? `, including ${joinNames(balkans)}` : ""}.`,
        },
        {
          q: `Do I need to have used my US visa before it unlocks these countries?`,
          a: `Several destinations require it. Albania requires a multiple-entry US visa that has previously been used in the United States, Egypt requires a valid and used visa, and Saudi Arabia's tourist visa-on-arrival requires the US visa to have been used at least once to enter the US. The exact condition for each destination is shown in the list above, taken from official sources.`,
        },
      ],
    };
  }

  if (cfg.kind === "voa") {
    const main = [...base.reachByLevel.visa_on_arrival].sort(byName);
    const n = main.length;
    const notable = pickNotable(main, ["MDV", "IDN", "JOR", "BHR", "ETH", "KEN", "MDG", "BOL"]);
    const usVoaNames = usDelta.filter((e) => e.level === "visa_on_arrival").map((e) => nameFor(e.dest));
    const title = `Visa on Arrival Countries for ${cfg.peopleTitle} 2026 - Full List (${n})`;
    const description = `${n} countries offer visa on arrival to ${cfg.people} in 2026, including ${joinNames(notable)}. The full list with maximum stays and entry conditions from official government sources.`;
    return {
      cfg, country, natSlug, adj, base, main, usDelta, title, description,
      keywords: [
        `visa on arrival countries for ${cfg.people.toLowerCase()}`,
        `visa on arrival for ${adj.toLowerCase()} passport 2026`,
        `${adj.toLowerCase()} passport visa on arrival list`,
        `countries with visa on arrival for ${cfg.people.toLowerCase()} 2026`,
        `visa on arrival ${adj.toLowerCase()} citizens`,
        `${country.name.toLowerCase()} passport visa on arrival countries`,
        `where can ${cfg.people.toLowerCase()} get visa on arrival`,
      ],
      faqs: [
        {
          q: `How many countries offer visa on arrival to ${cfg.people} in 2026?`,
          a: `${n} countries offer a visa on arrival to ${adj} passport holders in 2026, including ${joinNames(pickNotable(main, ["MDV", "IDN", "JOR", "BHR", "ETH"], 5))}.`,
        },
        {
          q: `What is a visa on arrival?`,
          a: `A visa on arrival (VOA) is a visa issued at the border when you land, instead of at an embassy beforehand. You typically queue at a dedicated counter, pay a fee, and receive a stamp or sticker on the spot. It is not the same as visa-free entry: a visa is still issued, and the border authority can refuse it.`,
        },
        {
          q: `What documents do I need for a visa on arrival?`,
          a: `Requirements vary by destination, but commonly include a passport with at least six months validity, a return or onward ticket, proof of accommodation and sufficient funds, and the visa fee (often payable in cash). Always check the destination's official immigration website before flying - each country's rules and fees differ.`,
        },
        {
          q: `What is the difference between visa on arrival and visa-free?`,
          a: `Visa-free means you board and enter with just your passport - no visa is issued at all. Visa on arrival means a visa is still required, but it is issued at the border rather than an embassy. ${adj} passport holders can enter ${vfCount} countries visa-free in 2026 in addition to the ${n} visa on arrival countries on this list.`,
        },
        {
          q: `Can a US visa unlock more visa on arrival countries for ${cfg.people}?`,
          a: usVoaNames.length
            ? `Yes. With a valid US visa, ${adj} passport holders also get a visa on arrival in ${joinNames(usVoaNames)}, and ${usDelta.filter((e) => e.level === "visa_free").length} further destinations become fully visa-free. Conditions apply per destination - typically a valid multiple-entry US visa.`
            : `Holding a valid US visa can improve access to some destinations. Use the Earth Visa checker to see exactly what your documents unlock.`,
        },
      ],
    };
  }

  if (cfg.kind === "e_visa") {
    const main = [...base.reachByLevel.e_visa].sort(byName);
    const n = main.length;
    const notable = pickNotable(main, ["VNM", "EGY", "GEO", "RUS", "AZE", "KEN", "TZA", "UZB"]);
    const title = `e-Visa Countries for ${cfg.peopleTitle} 2026 - Full List (${n})`;
    const description = `${n} countries let ${cfg.people} apply for a visa entirely online in 2026, including ${joinNames(notable)} - no embassy visit. The full e-visa list with stay limits from official government sources.`;
    return {
      cfg, country, natSlug, adj, base, main, usDelta, title, description,
      keywords: [
        `e visa countries for ${cfg.people.toLowerCase()}`,
        `evisa countries for ${cfg.people.toLowerCase()} 2026`,
        `e-visa for ${adj.toLowerCase()} passport`,
        `online visa countries for ${cfg.people.toLowerCase()}`,
        `countries with e visa for ${cfg.people.toLowerCase()}`,
        `${adj.toLowerCase()} passport e visa list 2026`,
      ],
      faqs: [
        {
          q: `How many countries offer an e-visa to ${cfg.people} in 2026?`,
          a: `${n} countries let ${adj} passport holders apply for a visa entirely online in 2026, including ${joinNames(pickNotable(main, ["VNM", "EGY", "GEO", "RUS", "AZE"], 5))}.`,
        },
        {
          q: `What is an e-visa and how is it different from an eTA?`,
          a: `An e-visa is an actual visa - a real entry permit - issued digitally: you apply online, upload documents, pay the fee, and receive an electronic approval instead of an embassy sticker. An eTA is lighter: a quick security pre-screening, not a visa. Both mean no embassy visit for eligible trips.`,
        },
        {
          q: `What do ${cfg.people} need to apply for an e-visa?`,
          a: `Typically a passport scan (usually with six months validity), a digital photo, an online form, and card payment of the fee. Some destinations also ask for onward tickets, accommodation proof, or bank statements. Each country's exact requirements and fees are on its Earth Visa guide page, linked below, with the official application portal.`,
        },
        {
          q: `How long does an e-visa take to be approved?`,
          a: `Most e-visas are processed in a few working days, though times vary by destination and season. Apply at least one to two weeks before travelling, and always use the official government portal - third-party sites charge markups for the same visa.`,
        },
      ],
    };
  }

  // visa_free
  const main = [...base.reachByLevel.visa_free].sort(byName);
  const n = main.length;
  // Strong passports (Brazil ~100+, Mexico ~90) would otherwise dump a
  // multi-thousand-character enumeration into the FAQ and its JSON-LD mirror.
  const vfNames = main.map((e) => nameFor(e.dest));
  const vfEnum =
    vfNames.length > 25
      ? `${vfNames.slice(0, 25).join(", ")} and ${vfNames.length - 25} more - see the full list above`
      : joinNames(vfNames);
  const notable = pickNotable(main, ["THA", "MYS", "NPL", "MUS", "KAZ", "PHL", "SGP", "IDN", "BRA", "KEN", "SYC", "BRB", "FJI"]);
  const longest = [...main].filter((e) => e.maxStayDays != null).sort((a, b) => (b.maxStayDays ?? 0) - (a.maxStayDays ?? 0));
  const usVf = usDelta.filter((e) => e.level === "visa_free");
  const title = `List of Visa Free Countries for ${cfg.peopleTitle} 2026 - All ${n} + ${voaCount} on Arrival`;
  const description = `${adj} passport holders can visit ${n} countries visa-free in 2026, including ${joinNames(notable)}. Plus ${voaCount} visa on arrival and ${eCount} e-visa destinations. The complete official-source list with stay limits.`;
  return {
    cfg, country, natSlug, adj, base, main, usDelta, title, description,
    keywords: [
      `visa free countries for ${cfg.people.toLowerCase()}`,
      `visa free countries for ${cfg.people.toLowerCase()} 2026 list`,
      `visa free countries for ${adj.toLowerCase()} passport 2026`,
      `list of visa free countries for ${cfg.people.toLowerCase()}`,
      `how many visa free countries for ${cfg.people.toLowerCase()}`,
      `${adj.toLowerCase()} passport visa free countries 2026`,
      `countries ${cfg.people.toLowerCase()} can visit without visa`,
      `no visa countries for ${adj.toLowerCase()} passport`,
    ],
    faqs: [
      {
        q: `How many visa free countries are there for ${cfg.people} in 2026?`,
        a: `${adj} passport holders can travel to ${n} countries completely visa-free in 2026${longest.length ? ` - the longest stay is ${nameFor(longest[0].dest)} at up to ${longest[0].maxStayDays} days` : ""}.`,
      },
      {
        q: `Which countries can ${cfg.people} visit without a visa?`,
        a: `The ${n} visa-free countries for ${adj} passport holders in 2026 are: ${vfEnum}. Stay limits vary per country - see the list above.`,
      },
      {
        q: `Which visa free country gives ${cfg.people} the longest stay?`,
        a: longest.length
          ? `${nameFor(longest[0].dest)} allows the longest visa-free stay for ${adj} passport holders at up to ${longest[0].maxStayDays} days${longest[1] ? `, followed by ${nameFor(longest[1].dest)} (${longest[1].maxStayDays} days)` : ""}${longest[2] ? ` and ${nameFor(longest[2].dest)} (${longest[2].maxStayDays} days)` : ""}. Some destinations do not publish a fixed limit.`
          : `Stay limits vary by destination - see the list above for each country's allowance.`,
      },
      {
        q: `What is the difference between visa free and visa on arrival?`,
        a: `Visa-free means no visa is issued at all - you enter with just your passport. Visa on arrival means a visa is still required but is issued at the border for a fee. ${adj} passport holders get a visa on arrival in ${voaCount} additional countries in 2026.`,
      },
      {
        q: `Does a US visa give ${cfg.people} more visa free countries?`,
        a: usVf.length
          ? `Yes. A valid US visa unlocks ${usDelta.length} additional destinations for ${adj} citizens in 2026, ${usVf.length} of which become fully visa-free - including ${joinNames(pickNotable(usVf, ["MEX", "PER", "ARG", "SRB", "COL"], 5))}. Conditions apply, typically a valid multiple-entry US visa.`
          : `Holding other visas or residence permits can unlock additional destinations. Use the Earth Visa checker to see what your documents unlock.`,
      },
    ],
  };
}

function listShortLabel(l: ListConfig): string {
  if (l.kind === "visa_free") return `Visa free countries for ${l.people}`;
  if (l.kind === "voa") return `Visa on arrival countries for ${l.people}`;
  if (l.kind === "e_visa") return `e-Visa countries for ${l.people}`;
  return `Countries ${l.people} can visit with a US visa`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cfg = LISTS.find((l) => l.slug === slug);
  if (!cfg) return { title: "Not Found" };
  const d = buildListData(cfg);
  if (!d) return { title: "Not Found" };
  const url = `https://earthvisa.in/list/${slug}`;
  return {
    title: d.title,
    description: d.description,
    keywords: d.keywords,
    alternates: { canonical: url },
    openGraph: { title: d.title, description: d.description, url, type: "article" },
    twitter: { card: "summary_large_image", title: d.title, description: d.description },
  };
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

// One destination ledger row (spec §12: compact rows in a document card with
// hairline dividers). The whole >=44px row is a single tappable link to the
// nationality-specific corridor guide when one exists (the page is written for
// exactly that reader), else the destination page. The level badge only
// renders in mixed-level sections (`showLevel`) - repeating an identical chip
// on every row of a single-level list restates the section h2 23 times.
// nth-child resets keep the first visual row of each column count clear of a
// top hairline (1 col base / 2 cols sm / 3 cols lg).
const LEDGER_ROW_LI =
  "border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";
const LEDGER_GRID_UL = "card-doc grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3";

function DestCard({ edge, condition, nat, natSlug, showLevel = false }: {
  edge: CombinedEdge;
  condition: string | null;
  nat: string;
  natSlug: string;
  showLevel?: boolean;
}) {
  const name = nameFor(edge.dest);
  const destSlug = nameToSlug(name);
  const href = isUsefulCorridor(nat, edge.dest) ? `/passport/${natSlug}/${destSlug}` : `/destination/${destSlug}`;
  return (
    <li className={LEDGER_ROW_LI} data-search={name.toLowerCase()}>
      <Link
        href={href}
        className="group flex min-h-[44px] items-start gap-2.5 py-2 transition hover:bg-paper-2/50"
      >
        <span className="pt-0.5 text-lg leading-none">{flagFor(edge.dest)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{name}</span>
            {edge.maxStayDays != null && <span className="mono-chrome shrink-0 tabular-nums">≤ {edge.maxStayDays} days</span>}
          </div>
          {condition && <p className="mt-0.5 text-[13px] leading-snug text-ink-mute">{condition}</p>}
        </div>
        {showLevel && (
          <span className={`mono mt-1 shrink-0 rounded-[3px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[edge.level]}`}>
            {SHORT_LEVEL[edge.level]}
          </span>
        )}
      </Link>
    </li>
  );
}

export default async function ListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = LISTS.find((l) => l.slug === slug);
  if (!cfg) notFound();
  const d = buildListData(cfg);
  if (!d) notFound();

  const { country, natSlug, adj, base, main, usDelta } = d;
  const flag = flagFor(cfg.nat);
  const url = `https://earthvisa.in/list/${slug}`;

  const vfCount = base.reachByLevel.visa_free.length;
  const voaCount = base.reachByLevel.visa_on_arrival.length;
  const eCount = base.reachByLevel.eta.length + base.reachByLevel.e_visa.length;
  const total = base.reach.length;

  const dVf = usDelta.filter((e) => e.level === "visa_free").sort(byName);
  const dVoa = usDelta.filter((e) => e.level === "visa_on_arrival").sort(byName);
  const dE = usDelta.filter((e) => e.level === "eta" || e.level === "e_visa").sort(byName);

  const stats =
    cfg.kind === "us_visa"
      ? [
          { k: "Unlocked with US visa", v: main.length },
          { k: "Become visa-free", v: dVf.length },
          { k: "Visa on arrival", v: dVoa.length },
          { k: "eTA / e-Visa", v: dE.length },
        ]
      : cfg.kind === "voa"
      ? [
          { k: "Visa on arrival", v: main.length },
          { k: "Visa-free", v: vfCount },
          { k: "eTA / e-Visa", v: eCount },
          { k: "Total reach", v: total },
        ]
      : cfg.kind === "e_visa"
      ? [
          { k: "e-Visa", v: main.length },
          { k: "Visa-free", v: vfCount },
          { k: "Visa on arrival", v: voaCount },
          { k: "Total reach", v: total },
        ]
      : [
          { k: "Visa-free", v: main.length },
          { k: "Visa on arrival", v: voaCount },
          { k: "eTA / e-Visa", v: eCount },
          { k: "Total reach", v: total },
        ];

  const h1 =
    cfg.kind === "us_visa"
      ? `Countries ${cfg.peopleTitle} Can Visit with a US Visa`
      : cfg.kind === "voa"
      ? `Visa on Arrival Countries for ${cfg.peopleTitle}`
      : cfg.kind === "e_visa"
      ? `e-Visa Countries for ${cfg.peopleTitle}`
      : `Visa Free Countries for ${cfg.peopleTitle}`;
  const h1Sub =
    cfg.kind === "us_visa"
      ? `${main.length} Extra Destinations Unlocked in 2026`
      : cfg.kind === "voa"
      ? `Get Stamped at the Border - the Full 2026 List (${main.length})`
      : cfg.kind === "e_visa"
      ? `Apply Online, Skip the Embassy - the Full 2026 List (${main.length})`
      : `The Complete ${adj} Passport List for 2026 (${main.length})`;
  const stampLine =
    cfg.kind === "us_visa"
      ? `${main.length} extra destinations with a valid US visa · official sources`
      : cfg.kind === "voa"
      ? `${main.length} countries stamp your visa at the border · official sources`
      : cfg.kind === "e_visa"
      ? `${main.length} visas issued fully online · official sources`
      : `${main.length} countries, zero paperwork · official sources`;

  const siblingLinks = LISTS.filter((l) => l.slug !== slug).map((l) => ({
    href: `/list/${l.slug}`,
    label: listShortLabel(l),
    iso3: l.nat,
  }));

  // Sibling lists for the same nationality (looked up, never hand-built).
  const usList = LISTS.find((l) => l.kind === "us_visa" && l.nat === cfg.nat);
  const vfList = LISTS.find((l) => l.kind === "visa_free" && l.nat === cfg.nat);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: `${country.name} Passport`, item: `https://earthvisa.in/passport/${natSlug}` },
          { "@type": "ListItem", position: 3, name: d.title, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: d.faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
      {
        "@type": "ItemList",
        name: d.title,
        numberOfItems: main.length,
        // Mirrors the visible cards' targets: corridor guide when one exists.
        itemListElement: main.map((e, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: nameFor(e.dest),
          url: isUsefulCorridor(cfg.nat, e.dest)
            ? `https://earthvisa.in/passport/${natSlug}/${nameToSlug(nameFor(e.dest))}`
            : `https://earthvisa.in/destination/${nameToSlug(nameFor(e.dest))}`,
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="bg-grid-paper border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href={`/passport/${natSlug}`} className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                {country.name} Passport
              </Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">
                {cfg.kind === "us_visa" ? "With a US Visa" : cfg.kind === "voa" ? "Visa on Arrival" : cfg.kind === "e_visa" ? "e-Visa" : "Visa Free"}
              </span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">{flag}</span>
                {h1}
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">{h1Sub}</span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">{stampLine}</p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {stats.map(({ k, v }) => (
                <div key={k} className="bg-card px-4 py-2.5">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            {cfg.kind === "us_visa" && (
              <>
                <p className="text-body text-ink-soft">
                  A valid US visa in a <Link href={`/passport/${natSlug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">{country.name} passport</Link>{" "}
                  unlocks <strong className="text-ink">extra destinations</strong> in 2026 that would otherwise require a full embassy visa - some waive it entirely, others switch to a visa on arrival or an easy e-visa.
                  On its own, the {country.name} passport reaches {total} destinations - see the{" "}
                  <Link href="/rankings" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">2026 passport rankings</Link> for how that compares.
                </p>
                <p className="card-doc mt-5 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                  Every entry below requires a valid US visa - typically a multiple-entry B1/B2 visitor visa physically affixed in your passport. An ESTA is not a visa.
                  Each destination sets its own conditions (visa type, remaining validity, prior use); the exact condition is shown on each row.
                  Verify with the destination&apos;s border authority before booking.
                </p>
              </>
            )}
            {cfg.kind === "voa" && (
              <p className="text-body text-ink-soft">
                <strong className="text-ink">{main.length} countries</strong> issue {cfg.people} a{" "}
                <strong className="text-ink">visa on arrival</strong> in 2026 - you land, pay the fee at the border counter, and get stamped in without an embassy appointment.
                Fees, stay limits and documents vary per country. See how the{" "}
                <Link href={`/passport/${natSlug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">{country.name} passport</Link>{" "}
                compares in the{" "}
                <Link href="/rankings" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">2026 passport rankings</Link>.
              </p>
            )}
            {cfg.kind === "visa_free" && (
              <p className="text-body text-ink-soft">
                {adj} passport holders can visit <strong className="text-ink">{main.length} countries without any visa</strong> in 2026 - no application, no fee, no embassy queue.
                See how the{" "}
                <Link href={`/passport/${natSlug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">{country.name} passport</Link>{" "}
                compares in the{" "}
                <Link href="/rankings" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">2026 passport rankings</Link>.
              </p>
            )}
          </section>

          {/* Main list(s) */}
          {cfg.kind === "us_visa" ? (
            <>
              {dVf.length > 0 && (
                <section className="mt-12">
                  <h2 className="text-section text-ink">
                    Visa-Free for {cfg.peopleTitle} with a US Visa ({dVf.length})
                  </h2>
                  <p className="text-body mt-2 max-w-3xl text-ink-soft">
                    These countries waive their visa entirely for {cfg.people} who hold a valid US visa - check the condition on each row.
                  </p>
                  <SearchableLedger count={dVf.length} noun="visa-free countries">
                    <ul className={`${LEDGER_GRID_UL} mt-3`}>
                      {dVf.map((e) => (
                        <DestCard key={e.dest} edge={e} condition={usVisaCondition(e)} nat={cfg.nat} natSlug={natSlug} />
                      ))}
                    </ul>
                  </SearchableLedger>
                </section>
              )}
              {dVoa.length > 0 && (
                <section className="mt-12">
                  <h2 className="text-section text-ink">
                    Visa on Arrival with a US Visa ({dVoa.length})
                  </h2>
                  <p className="text-body mt-2 max-w-3xl text-ink-soft">
                    With a valid US visa, {cfg.people} can get a visa stamped at the border in these countries instead of applying at an embassy.
                  </p>
                  <SearchableLedger count={dVoa.length} noun="visa-on-arrival countries">
                    <ul className={`${LEDGER_GRID_UL} mt-3`}>
                      {dVoa.map((e) => (
                        <DestCard key={e.dest} edge={e} condition={usVisaCondition(e)} nat={cfg.nat} natSlug={natSlug} />
                      ))}
                    </ul>
                  </SearchableLedger>
                </section>
              )}
              {dE.length > 0 && (
                <section className="mt-12">
                  <h2 className="text-section text-ink">
                    Easier e-Visa &amp; eTA with a US Visa ({dE.length})
                  </h2>
                  <p className="text-body mt-2 max-w-3xl text-ink-soft">
                    These destinations let US-visa holders apply through a simplified online e-visa or eTA instead of a full embassy process.
                  </p>
                  {/* Mixed e-Visa + eTA section: the badge distinguishes the two levels. */}
                  <SearchableLedger count={dE.length} noun="e-Visa / eTA countries">
                    <ul className={`${LEDGER_GRID_UL} mt-3`}>
                      {dE.map((e) => (
                        <DestCard key={e.dest} edge={e} condition={usVisaCondition(e)} nat={cfg.nat} natSlug={natSlug} showLevel />
                      ))}
                    </ul>
                  </SearchableLedger>
                </section>
              )}
            </>
          ) : (
            <section className="mt-12">
              <h2 className="text-section text-ink">
                {cfg.kind === "voa"
                  ? `All ${main.length} Visa on Arrival Countries for ${cfg.peopleTitle} (2026)`
                  : `All ${main.length} Visa Free Countries for ${cfg.peopleTitle} (2026)`}
              </h2>
              <p className="text-body mt-2 max-w-3xl text-ink-soft">
                {cfg.kind === "voa"
                  ? `Alphabetical list of every country issuing ${cfg.people} a visa on arrival in 2026, with the maximum stay where officially published.`
                  : `Alphabetical list of every country ${cfg.people} can enter with just a passport in 2026, with the maximum stay where officially published.`}
              </p>
              <SearchableLedger count={main.length} noun={cfg.kind === "voa" ? "visa-on-arrival countries" : "visa-free countries"}>
                <ul className={`${LEDGER_GRID_UL} mt-3`}>
                  {main.map((e) => (
                    <DestCard key={e.dest} edge={e} condition={cfg.kind === "voa" ? voaCondition(e.notes ?? "") : firstSentence(e.notes ?? "")} nat={cfg.nat} natSlug={natSlug} />
                  ))}
                </ul>
              </SearchableLedger>
            </section>
          )}

          {/* Cross-sell: what else the passport can do */}
          {cfg.kind === "visa_free" && usDelta.length > 0 && usList && (
            <section className="mt-12 max-w-3xl">
              <h2 className="text-section text-ink">Beyond Visa Free: {usDelta.length} More with a US Visa</h2>
              <p className="text-body mt-2 text-ink-soft">
                If you hold a valid US visa, {dVf.length} additional countries become visa-free for {cfg.people} - including{" "}
                {joinNames(pickNotable(dVf, ["MEX", "PER", "ARG", "SRB", "COL"], 4))} - and more open up on arrival or by e-visa.
                See the full list:{" "}
                <Link href={`/list/${usList.slug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                  countries {cfg.people} can visit with a US visa
                </Link>.
              </p>
            </section>
          )}
          {cfg.kind === "voa" && (
            <section className="mt-12 max-w-3xl">
              <h2 className="text-section text-ink">No Visa at All: {vfCount} Visa Free Countries</h2>
              <p className="text-body mt-2 text-ink-soft">
                Before queueing at a border counter, remember that {cfg.people} can enter{" "}
                <strong className="text-ink">{vfCount} countries with no visa whatsoever</strong> -{" "}
                {vfList ? (
                  <>
                    see the full{" "}
                    <Link href={`/list/${vfList.slug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                      list of visa free countries for {cfg.people}
                    </Link>
                    {" "}or the{" "}
                    <Link href={`/passport/${natSlug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                      {country.name} passport page
                    </Link>
                  </>
                ) : (
                  <>
                    see the full breakdown on the{" "}
                    <Link href={`/passport/${natSlug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                      {country.name} passport page
                    </Link>
                  </>
                )}
                . And {eCount} more destinations accept a quick online e-visa or eTA.
              </p>
            </section>
          )}

          {/* No separate "detailed guides" mesh: every card above already
              links to the nationality-specific corridor guide where one exists. */}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              {cfg.kind === "us_visa"
                ? `Travelling with a US Visa: ${adj} Passport FAQ`
                : cfg.kind === "voa"
                ? `Visa on Arrival for ${cfg.peopleTitle}: FAQ`
                : `Visa Free Travel for ${cfg.peopleTitle}: FAQ`}
            </h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {d.faqs.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  <p className="text-body mt-1 mb-3 max-w-3xl text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Sibling listicles */}
          <CorridorLinks
            title="More Earth Visa Lists"
            description="Hand-checked lists."
            links={siblingLinks}
          />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Check what your exact documents unlock
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Select your passport plus any visas or residence permits you hold - Earth Visa shows every destination you can enter, with conditions from official sources.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
        <ReportLine />
      </main>
    </>
  );
}
