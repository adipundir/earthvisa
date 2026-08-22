import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtDate } from "@/lib/format";
import { feesFor, fmtFee, type FeeEntry } from "@/lib/fees";
import FeesTable, { type FeeRow } from "@/components/FeesTable";

// Distinct destinations covered by the access data - same computation /rankings
// uses, so the two Rankings pages agree on how many destinations the site covers
// (dataset.allCountries.length counts passport-ISSUING countries, not
// destinations - 3 of the 199 have no inbound access data at all).
const TOTAL_DESTINATIONS = new Set(
  Object.values(dataset.passportAccess).flatMap((edges) => edges.map((e) => e.dest)),
).size;

// ── Fee computation ──────────────────────────────────────────────────────
// This page answers one question per destination: "what does a standard
// tourist actually pay to get in?" - the cheapest OFFICIAL, general-public
// fee among the four tourist-facing products (tourist visa, e-visa, visa on
// arrival, eTA). We deliberately exclude:
//   - unofficial/secondary-sourced fees (official !== true)
//   - fees with no published USD-comparable amount (varies-by-nationality
//     reciprocity schedules, discontinued programs, "see embassy" rows)
//   - narrow-scope rates that are not what a normal adult tourist pays:
//     child/infant discounts, group/collective/family-passport rates, and
//     bilateral single-nationality carve-outs ("for Indian nationals")
// Getting this wrong in the FREE direction is the worst error (a fee page
// that under-states cost is merely less useful; one that says a $100 visa
// is "free" is actively misleading), so every exclusion above is a rule
// that only ever removes a low number, never lowers one.
const TOURIST_KINDS = new Set(["tourist_visa", "e_visa", "visa_on_arrival", "eta"]);
const KIND_LABEL: Record<string, string> = {
  tourist_visa: "Tourist visa",
  e_visa: "e-Visa",
  visa_on_arrival: "Visa on arrival",
  eta: "eTA",
};
const NOT_RE = /^not?\s/i; // "No fee", "Not offered" data notes, not real products
const NARROW_RE = /\binfant\b|for \w+ nationals\b|\bgroup\b|\bfamily\b|\bcollective\b/i;
// Matched separately from NARROW_RE: a rate that also covers "adults and
// children" at the same price (Belgium, Norway) is the general rate, not a
// child discount - only a name with "child(ren)" and no "adult" is narrow.
const CHILD_ONLY_RE = /\bchild(ren)?\b/i;
const ADULTS_TOO_RE = /\badults?\b/i;
// A $0 row is only the general-public headline fee if its `applies` field
// doesn't read as a privileged-subset exemption - e.g. Australia's free
// eVisitor applies to "EU/EEA and certain other European passport holders"
// while everyone else pays AUD 250 for the Visitor visa. Scoped to amount_usd
// === 0 only: the same "eligible nationalities requiring a visa" phrasing
// appears on countless genuinely-general PAID fees across the dataset, and
// applying this check to those would wrongly drop their real headline fee.
const APPLIES_NARROW_RE =
  /\beligible\b[\s\S]{0,30}national|\bnationals?\s+of\b|\bdesignated\s+countr|\bwaived\s+for\b|\bcertain\s+other\b|\bwith\s+valid\b/i;

function isGeneralPublicFee(f: FeeEntry): boolean {
  if (!TOURIST_KINDS.has(f.kind)) return false;
  if (!f.official) return false;
  if (f.amount_usd == null) return false;
  if (NOT_RE.test(f.name)) return false;
  if (NARROW_RE.test(f.name)) return false;
  if (CHILD_ONLY_RE.test(f.name) && !ADULTS_TOO_RE.test(f.name)) return false;
  if (f.amount_usd === 0 && APPLIES_NARROW_RE.test(f.applies ?? "")) return false;
  return true;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildRows(): FeeRow[] {
  const built = dataset.allCountries.flatMap((c) => {
    const d = feesFor(c.iso3);
    if (!d) return [];
    const candidates = d.fees.filter(isGeneralPublicFee);
    if (candidates.length === 0) return [];
    const best = candidates.reduce((a, b) => (a.amount_usd! <= b.amount_usd! ? a : b));
    return [
      {
        rank: 0,
        iso3: c.iso3,
        flag: flagFor(c.iso3),
        name: c.name,
        slug: nameToSlug(c.name),
        region: c.region,
        feeUsd: best.amount_usd!,
        feeLabel: fmtFee(best),
        kindLabel: KIND_LABEL[best.kind] ?? best.kind,
        sourceHost: hostOf(best.source_url),
        sourceUrl: best.source_url,
      },
    ];
  });
  return built.sort((a, b) => a.feeUsd - b.feeUsd).map((r, i) => ({ ...r, rank: i + 1 }));
}

const rows = buildRows();
const rankedCount = rows.length;
const unrankedCount = TOTAL_DESTINATIONS - rankedCount;
const freeRows = rows.filter((r) => r.feeUsd === 0);
const paidRows = rows.filter((r) => r.feeUsd > 0);
const cheapestPaid = paidRows.slice(0, 10);
const priciest10 = [...rows].slice(-10).reverse();
const medianPaid = median(paidRows.map((r) => r.feeUsd));
const priciest = rows[rows.length - 1];

interface RegionStat {
  region: string;
  count: number;
  freeCount: number;
  median: number;
  max: number;
  maxName: string;
}

function buildRegionStats(): RegionStat[] {
  const byRegion = new Map<string, FeeRow[]>();
  for (const r of rows) {
    if (!byRegion.has(r.region)) byRegion.set(r.region, []);
    byRegion.get(r.region)!.push(r);
  }
  return [...byRegion.entries()]
    .map(([region, rs]) => {
      const priciestInRegion = [...rs].sort((a, b) => b.feeUsd - a.feeUsd)[0];
      return {
        region,
        count: rs.length,
        freeCount: rs.filter((r) => r.feeUsd === 0).length,
        median: median(rs.map((r) => r.feeUsd)),
        max: priciestInRegion.feeUsd,
        maxName: priciestInRegion.name,
      };
    })
    .sort((a, b) => b.median - a.median);
}

const regionStats = buildRegionStats();

// ── VFS / outsourced application-centre markups ─────────────────────────
// A separate, additional charge - paid to the private company running the
// application centre, on top of the government visa fee - that most
// travellers never see quoted until they're at the counter. We only ever
// list entries where the crawl found one clean, single numeric amount in
// one currency; anywhere the source quoted a range, multiple centres or
// "not publicly verifiable", we leave the destination out (see /destination
// pages for the full per-country note) rather than guess.
const NUMERIC_RE = /^\d+(\.\d+)?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

interface VfsRow {
  iso3: string;
  name: string;
  flag: string;
  slug: string;
  operator: string;
  amount: number;
  currency: string;
  sourceUrl: string | null;
}

function buildVfsRows(): VfsRow[] {
  return dataset.allCountries.flatMap((c) => {
    const d = feesFor(c.iso3);
    if (!d?.vfs.used) return [];
    const sf = (d.vfs.service_fee ?? "").trim();
    const cur = (d.vfs.currency ?? "").trim();
    if (!NUMERIC_RE.test(sf) || !CURRENCY_RE.test(cur)) return [];
    return [
      {
        iso3: c.iso3,
        name: c.name,
        flag: flagFor(c.iso3),
        slug: nameToSlug(c.name),
        operator: d.vfs.operator ?? "a third-party visa centre",
        amount: Number(sf),
        currency: cur,
        sourceUrl: d.vfs.source_url ?? null,
      },
    ];
  });
}

const vfsClean = buildVfsRows();
const vfsInr = vfsClean.filter((v) => v.currency === "INR").sort((a, b) => a.amount - b.amount);
const vfsUsedCount = dataset.allCountries.filter((c) => feesFor(c.iso3)?.vfs.used).length;

// Fee data's own crawl date (not the broader dataset's lastUpdated, which
// tracks visa-policy refreshes) - derived, never hardcoded, so a future
// fee re-crawl updates this automatically.
const feeUpdated =
  [...new Set(dataset.allCountries.map((c) => feesFor(c.iso3)?.updated).filter((d): d is string => !!d))]
    .sort()
    .at(-1) ?? dataset.meta.lastUpdated;

const TITLE = "The Real Cost of a Tourist Visa 2026: Fees Compared Across 199 Destinations | Earth Visa";
const DESCRIPTION = `What a tourist visa actually costs, destination by destination: ${rankedCount} countries ranked by official published fee, from ${freeRows.length} that charge nothing to ${priciest.name} at $${priciest.feeUsd}. Sourced from government fee schedules, dated ${fmtDate(feeUpdated)}.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/rankings/visa-fees" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/rankings/visa-fees",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQS = [
  {
    q: "What is the most expensive tourist visa in the world in 2026?",
    a: `Among destinations with a single published flat fee, ${priciest.name} has the highest tourist-visa cost we could confirm from an official source in 2026, at ${priciest.feeLabel}. The United Kingdom's Standard Visitor visa and several embassy-issued African visas (Algeria, Niger, Sudan) also sit near the top. Destinations that price per requesting nationality on a reciprocity schedule aren't included.`,
  },
  {
    q: "Which countries have a completely free tourist visa or e-visa in 2026?",
    a: `${freeRows.length} destinations charge nothing for standard tourist entry in 2026, including ${freeRows.slice(0, 6).map((r) => r.name).join(", ")}. Some of these are free visas-on-arrival, others are mandatory-but-free digital arrival forms (an eTA or arrival card) rather than a visa in the traditional sense - the table above labels each one.`,
  },
  {
    q: "How much does the average tourist visa cost?",
    a: `Across the ${paidRows.length} destinations that charge something, the median published fee is $${medianPaid} in 2026. Including the ${freeRows.length} destinations that charge nothing at all, ${rankedCount} destinations in total have a directly comparable official fee.`,
  },
  {
    q: "Why do some countries charge an extra 'service fee' on top of the visa fee?",
    a: `${vfsUsedCount} destinations outsource visa-application logistics to a private company - almost always VFS Global - which charges its own service fee on top of the government's visa fee. It pays for biometrics collection, document handling and courier, not the visa itself. We could confirm one clean amount for ${vfsClean.length} destinations; see the outsourcing-fee table above.`,
  },
  {
    q: "Why isn't every destination in this ranking?",
    a: `${unrankedCount} destinations are left out because no single official fee figure could be confirmed: several (e.g. Turkey, Nigeria, Syria) price visas per requesting nationality on a reciprocity schedule rather than one public rate; others only publish a range, route applicants through embassy discretion, or had a program under review at crawl time. Each destination's own page lists whatever fee detail is officially published for it.`,
  },
  {
    q: "Does a cheap or free visa mean a country is easy to enter?",
    a: `Not necessarily. Fee is one input, not the whole picture - some free-entry destinations still require proof of funds, onward tickets, or a separate sustainability/tourism levy paid locally (Bhutan's nightly Sustainable Development Fee is a well-known example, charged in addition to a fee-free entry permit). Check the destination's own Earth Visa page for the full requirement, not just the sticker price.`,
  },
];

// v2 list vocabulary: hairline-ruled rows flowing into responsive grid columns
// (rules over boxes - no card wrapper). The nth-child guards remove the top
// rule from each column's first row so the grid opens cleanly.
const LIST_COL_OL = "mt-5 grid sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-x-10";
const LIST_COL_LI = "border-t border-hair first:border-t-0 sm:[&:nth-child(6)]:border-t-0";
const LIST_GRID_OL = "mt-5 grid sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3";
const LIST_GRID_LI =
  "border-t border-hair first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";

// Section idioms shared with the corridor pages.
const H2 = "text-[20px] font-bold tracking-tight text-ink";
const LEDE = "mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2";
const BODY = "mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-2";
const A_ACCENT = "font-semibold text-accent underline-offset-2 transition hover:underline";
const TH = "px-4 py-3 text-[13px] font-semibold text-ink-2";

export default function VisaFeesRankingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Rankings", item: "https://earthvisa.in/rankings" },
          { "@type": "ListItem", position: 3, name: "Visa Fee Comparison 2026", item: "https://earthvisa.in/rankings/visa-fees" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
      {
        "@type": "ItemList",
        name: "Most Expensive Tourist Visas in the World 2026",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: priciest10.length,
        itemListElement: priciest10.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${r.name} - ${r.feeLabel}`,
          url: `https://earthvisa.in/destination/${r.slug}`,
        })),
      },
      {
        "@type": "Dataset",
        name: "Global Tourist Visa Fee Comparison 2026",
        description: `Official tourist-visa, e-visa, visa-on-arrival and eTA fees for ${rankedCount} destinations, converted to USD, sourced from government fee schedules`,
        url: "https://earthvisa.in/rankings/visa-fees",
        creator: { "@type": "Organization", name: "Earth Visa" },
        temporalCoverage: "2026",
        dateModified: feeUpdated,
        variableMeasured: "Cheapest official published fee for standard tourist entry, in USD",
        measurementTechnique: "Official government and immigration-authority fee schedules",
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="pt-6 text-[13px] font-medium text-ink-2">
            <ol className="flex flex-wrap items-center gap-x-2">
              <li><Link href="/" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earth Visa</Link></li>
              <li aria-hidden="true" className="text-ink-3">/</li>
              <li><Link href="/rankings" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Rankings</Link></li>
              <li aria-hidden="true" className="text-ink-3">/</li>
              <li aria-current="page" className="font-semibold text-ink">Visa fees</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mt-8">
            <h1 className="max-w-3xl text-[clamp(32px,4.6vw,54px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
              The real cost of a tourist visa
              <span className="mt-3 block text-[17px] font-medium leading-relaxed tracking-normal text-ink-2 sm:text-[19px]">
                Fees compared across {TOTAL_DESTINATIONS} destinations, 2026
              </span>
            </h1>
            <p className="mt-3 text-[13px] font-medium tabular-nums text-ink-3">
              {rankedCount} destinations ranked by fee · official sources only
            </p>

            {/* Stat band (FactStrip idiom: giant numerals, hairline column rules) */}
            <section aria-label="Fee facts" className="mt-9 border-t border-hair">
              <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4">
                {[
                  { num: String(rankedCount), label: "Destinations ranked", cls: "text-ink", word: false },
                  { num: String(freeRows.length), label: "Charge nothing", cls: "text-verdict", word: false },
                  { num: `$${medianPaid}`, label: "Median fee (paid)", cls: "text-ink", word: false },
                  { num: fmtDate(feeUpdated), label: "Data updated", cls: "text-ink", word: true },
                ].map((c) => (
                  <div key={c.label} className="min-w-0 pr-4 pt-6 sm:border-l sm:border-hair sm:pl-7 sm:first:border-l-0 sm:first:pl-0">
                    <p className={`stat-num ${c.cls} ${c.word ? "flex min-h-[clamp(34px,3.6vw,52px)] items-end text-[clamp(20px,1.8vw,26px)]" : "text-[clamp(34px,3.6vw,52px)]"}`}>
                      {c.num}
                    </p>
                    <p className="stat-label mt-2">{c.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </header>

          {/* Intro - answers the core query up front */}
          <section className="mt-10 max-w-3xl">
            <p className="text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
              Passport-power rankings measure how many countries you can enter. This measures something no one else has
              indexed: <strong className="font-semibold text-ink">what it costs</strong>. Across {rankedCount} destinations with a
              directly comparable, official published fee, {freeRows.length} charge nothing at all, the median paid fee
              is <strong className="font-semibold text-ink">${medianPaid}</strong>, and the priciest confirmed fee is{" "}
              <Link href={`/destination/${priciest.slug}`} className={A_ACCENT}>
                {priciest.name}
              </Link>{" "}
              at {priciest.feeLabel}.
            </p>
            <p className="mt-3 text-[13.5px] font-medium text-ink-3">
              <a href="#methodology" className={A_ACCENT}>Methodology</a>
              {" · "}
              <Link href="/guide/japan-visa-fee-increase-2026" className={A_ACCENT}>
                Japan&apos;s first fee revision since 1978, effective 1 July 2026
              </Link>
            </p>
          </section>

          {/* Free destinations */}
          <section className="mt-12">
            <h2 className={H2}>
              {freeRows.length} destinations with no tourist visa fee
            </h2>
            <p className={LEDE}>
              No visa fee, no e-visa charge, no arrival levy - the destination charges nothing for the product listed,
              which is not the same as visa-free access for every nationality.
            </p>
            <ol className={LIST_GRID_OL}>
              {freeRows.map((r) => (
                <li key={r.iso3} className={LIST_GRID_LI}>
                  <Link
                    href={`/destination/${r.slug}`}
                    className="group flex min-h-[48px] items-center gap-2.5 py-1.5"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink transition group-hover:text-accent">{r.name}</span>
                      <span className="block text-[12.5px] font-medium text-ink-3">{r.kindLabel}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-[14px] font-bold text-verdict">Free</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Most expensive */}
          <section className="mt-14">
            <h2 className={H2}>
              The 10 most expensive tourist visas in 2026
            </h2>
            <ol className={LIST_COL_OL}>
              {priciest10.map((r) => (
                <li key={r.iso3} className={LIST_COL_LI}>
                  <Link
                    href={`/destination/${r.slug}`}
                    className="group flex min-h-[52px] items-center gap-3 py-2"
                  >
                    <span className="w-6 shrink-0 text-right text-[13px] font-medium tabular-nums text-ink-3">{r.rank}</span>
                    <span aria-hidden="true" className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink transition group-hover:text-accent">{r.name}</span>
                      <span className="block text-[12.5px] font-medium text-ink-3">{r.kindLabel}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-[16px] font-bold tabular-nums text-ink">
                      ${r.feeUsd.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Full sortable table */}
          <section className="mt-14">
            <h2 className={H2}>
              Full visa fee comparison: {rankedCount} destinations ranked
            </h2>
            <div className="mt-5">
              <FeesTable rows={rows} />
            </div>
            {unrankedCount > 0 && (
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-3">
                {unrankedCount}{" "}further destinations aren&apos;t ranked: their fee isn&apos;t one public number.{" "}
                <a href="#methodology" className={A_ACCENT}>Why</a>
              </p>
            )}
          </section>

          {/* Cheapest paid - the "you don't need $0 to travel cheap" complement to the free list */}
          <section className="mt-14 max-w-3xl">
            <h2 className={H2}>
              Cheapest paid tourist visas in 2026
            </h2>
            <p className={LEDE}>
              The ten lowest confirmed paid fees: {cheapestPaid.map((r) => `${r.name} ($${r.feeUsd})`).join(", ")}.
            </p>
          </section>

          {/* Regional patterns */}
          <section className="mt-14">
            <h2 className={H2}>
              Visa fees by region
            </h2>
            <p className={LEDE}>
              Europe&apos;s median is the flat Schengen short-stay fee. Africa&apos;s runs well above Asia&apos;s and the
              Americas&apos; despite far lower average incomes - the same {"$"}50-100 is a very different share of a
              traveller&apos;s budget depending on where they&apos;re from.
            </p>
            <div className="mt-5 overflow-x-auto rounded-xl border border-hair bg-surface">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hair-strong">
                    <th scope="col" className={`${TH} text-left`}>Region</th>
                    <th scope="col" className={`${TH} text-right`}>Destinations</th>
                    <th scope="col" className={`${TH} text-right`}>Median fee</th>
                    <th scope="col" className={`${TH} text-right`}>Charge nothing</th>
                    <th scope="col" className={`${TH} text-left`}>Priciest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  {regionStats.map((rs) => (
                    <tr key={rs.region} className="transition hover:bg-ground">
                      <td className="px-4 py-3 text-[14.5px] font-semibold text-ink">{rs.region}</td>
                      <td className="px-4 py-3 text-right text-[14px] tabular-nums text-ink-2">{rs.count}</td>
                      <td className="px-4 py-3 text-right text-[14.5px] font-bold tabular-nums text-ink">${rs.median}</td>
                      <td className="px-4 py-3 text-right text-[14px] font-semibold tabular-nums text-verdict">{rs.freeCount}</td>
                      <td className="px-4 py-3 text-left text-[12.5px] font-medium text-ink-3">{rs.maxName} (${rs.max.toLocaleString()})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Hidden markup: VFS / outsourced application-centre fees */}
          {vfsInr.length > 0 && (
            <section className="mt-14">
              <h2 className={H2}>
                The hidden markup: outsourced application-centre fees
              </h2>
              <p className={LEDE}>
                {vfsUsedCount}{" "}destinations outsource visa-application handling to a private company - almost always
                VFS Global - which charges its own fee for biometrics, document handling and courier, on top of the
                government fee ranked above. The {vfsInr.length}{" "}below are the amounts we could confirm cleanly at
                India-based centres, so they compare in one currency; {vfsClean.length - vfsInr.length} more are confirmed
                in other local currencies on their own destination pages, and the same operator charges a different
                locally-set fee at each.
              </p>
              <div className="mt-5 overflow-x-auto rounded-xl border border-hair bg-surface">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hair-strong">
                      <th scope="col" className={`${TH} text-left`}>Destination</th>
                      <th scope="col" className={`${TH} text-right`}>Service fee</th>
                      <th scope="col" className={`${TH} text-left`}>Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hair">
                    {vfsInr.map((v) => (
                      <tr key={v.iso3} className="transition hover:bg-ground">
                        <td className="px-4 py-2 text-[14.5px] font-semibold text-ink">
                          <Link href={`/destination/${v.slug}`} className="flex min-h-[44px] items-center gap-2 transition hover:text-accent">
                            <span aria-hidden="true">{v.flag}</span>
                            {v.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-[14.5px] font-bold tabular-nums text-ink">
                          {v.currency} {v.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-left text-[12.5px] font-medium text-ink-3">{v.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Methodology */}
          <section id="methodology" className="mt-14 max-w-3xl scroll-mt-24">
            <h2 className={H2}>
              Methodology: how this fee comparison is built
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">
              Earth Visa crawled the <strong className="font-semibold text-ink">official fee schedule</strong>{" "}published by each
              destination&apos;s own immigration authority, foreign ministry, or e-visa/eTA portal - not third-party
              visa-agency markups - and takes the lowest amount among four tourist products: tourist visa (embassy or
              consulate-issued), e-visa (a full visa applied for and issued online), visa on arrival (issued at the border
              on landing), and eTA (an electronic authorisation or mandatory digital arrival form). Last refreshed{" "}
              <strong className="font-semibold tabular-nums text-ink">{fmtDate(feeUpdated)}</strong>.
            </p>
            <p className={BODY}>
              Excluded: business, transit and student/work visas; multiple-entry and expedited rates; any fee without a
              published amount; and narrow-scope rates that aren&apos;t what a standard adult tourist pays - child and
              infant discounts, group/collective and family-passport rates, single-nationality carve-outs. Amounts are
              converted to USD at the rate recorded at crawl time, with native-currency figures on each destination&apos;s
              own page. The {unrankedCount}{" "}destinations left out are those whose fee genuinely isn&apos;t one number: it
              varies by the traveller&apos;s nationality under a reciprocity schedule, or only a range or &quot;contact
              embassy&quot; is published, and a single misleading average would be worse than omitting them.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className={H2}>
              Visa fee comparison 2026: FAQ
            </h2>
            <div className="mt-3 max-w-3xl divide-y divide-hair border-y border-hair">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <p className="mt-1 mb-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA - the one action on this page */}
          <section className="mt-14 border-t border-hair pt-10">
            <h2 className={H2}>
              Check the exact fee for your passport
            </h2>
            <p className="mt-2 text-[13.5px] font-medium text-ink-3">
              Fee is only half the story - reach is the other:{" "}
              <Link href="/rankings" className={A_ACCENT}>
                the 2026 passport ranking
              </Link>
            </p>
            <Link
              href="/visit"
              className="mt-6 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-accent px-6 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep dark:bg-accent-deep dark:hover:bg-accent"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
