import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtDate } from "@/lib/format";
import { feesFor, fmtFee, type FeeEntry } from "@/lib/fees";
import FeesTable, { type FeeRow } from "@/components/FeesTable";

const TOTAL_DESTINATIONS = dataset.allCountries.length;

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
const NARROW_RE = /\bchild\b|\binfant\b|for \w+ nationals\b|\bgroup\b|\bfamily\b|\bcollective\b/i;

function isGeneralPublicFee(f: FeeEntry): boolean {
  if (!TOURIST_KINDS.has(f.kind)) return false;
  if (!f.official) return false;
  if (f.amount_usd == null) return false;
  if (NOT_RE.test(f.name)) return false;
  if (NARROW_RE.test(f.name)) return false;
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
  keywords: [
    "visa fee comparison 2026",
    "most expensive tourist visa",
    "cheapest tourist visa countries",
    "visa fees by country",
    "how much does a tourist visa cost",
    "free e-visa countries 2026",
    "vfs global service fee",
    "visa on arrival cost",
    "e-visa cost by country",
    "eta fee comparison",
    "cost of a visa 2026",
    "which country has the most expensive visa",
  ],
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
    a: `Among destinations with a single published flat fee, ${priciest.name} has the highest tourist-visa cost we could confirm from an official source in 2026, at ${priciest.feeLabel}. The United Kingdom's Standard Visitor visa and several embassy-issued African visas (Algeria, Niger, Sudan) also sit near the top - see the full ranking above. Some destinations set fees per requesting nationality (reciprocity schedules) rather than one public figure, so they aren't included in this comparison.`,
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
    a: `${vfsUsedCount} destinations in our dataset outsource visa-application logistics to a private company - almost always VFS Global - which charges its own service fee separately from, and on top of, the government's visa fee. That charge pays for the outsourcing company's operations (biometrics collection, document handling, courier), not the visa itself. We could only confirm one clean, unambiguous amount for ${vfsClean.length} destinations; see the outsourcing-fee table below.`,
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

// Ledger-row vocabulary (spec §12): compact rows inside a document card.
const LEDGER_COL_OL = "card-doc mt-5 grid px-4 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-x-8 sm:px-5";
const LEDGER_COL_LI = "border-t border-line first:border-t-0 sm:[&:nth-child(6)]:border-t-0";
const LEDGER_GRID_OL = "card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3";
const LEDGER_ROW_LI =
  "border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";

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
        {/* Header */}
        <header className="bg-grid-paper border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/rankings" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Rankings</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Visa Fees</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                The Real Cost of a Tourist Visa
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  Fees Compared Across {TOTAL_DESTINATIONS} Destinations, 2026
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                {rankedCount} destinations ranked by fee · official sources only
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Destinations ranked", v: String(rankedCount) },
                { k: "Charge nothing", v: String(freeRows.length) },
                { k: "Median fee (paid)", v: `$${medianPaid}` },
                { k: "Data updated", v: fmtDate(feeUpdated) },
              ].map(({ k, v }) => (
                <div key={k} className="bg-card px-4 py-2.5">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro - answers the core query up front */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              Passport-power rankings measure how many countries you can enter. This measures something no one else has
              indexed: <strong className="text-ink">what it costs</strong>. Across {rankedCount} destinations with a
              directly comparable, official published fee, {freeRows.length} charge nothing at all, the median paid fee
              is <strong className="text-ink">${medianPaid}</strong>, and the priciest confirmed fee is{" "}
              <Link href={`/destination/${priciest.slug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                {priciest.name}
              </Link>{" "}
              at {priciest.feeLabel}.
            </p>
            <p className="text-body mt-4 text-ink-soft">
              Every figure is the destination&apos;s own lowest published rate for a standard adult tourist product - see
              the <a href="#methodology" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">methodology</a> for exactly what is (and isn&apos;t) counted.
              These schedules do move: Japan&apos;s first fee revision since 1978 took effect 1 July 2026 - see{" "}
              <Link href="/guide/japan-visa-fee-increase-2026" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                the Japan visa fee increase, explained
              </Link>.
            </p>
          </section>

          {/* Free destinations */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              {freeRows.length} Destinations With No Tourist Visa Fee
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              No visa fee, no e-visa charge, no arrival levy - just a passport, and in some cases a free digital arrival
              form. This is not the same as visa-free access for every nationality; it means the destination itself
              charges nothing for the product listed.
            </p>
            <ol className={LEDGER_GRID_OL}>
              {freeRows.map((r) => (
                <li key={r.iso3} className={LEDGER_ROW_LI}>
                  <Link
                    href={`/destination/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5 py-1 transition hover:bg-paper-2/50"
                  >
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{r.name}</span>
                      <span className="mono block text-[11px] text-ink-mute">{r.kindLabel}</span>
                    </span>
                    <span className="mono ml-auto shrink-0 text-sm font-semibold text-vfree">Free</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Most expensive */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              The 10 Most Expensive Tourist Visas in 2026
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Ranked by the destination&apos;s own lowest published standard-entry fee - some publish steeper rates for
              multiple-entry or expedited service, which are not counted here.
            </p>
            <ol className={LEDGER_COL_OL}>
              {priciest10.map((r) => (
                <li key={r.iso3} className={LEDGER_COL_LI}>
                  <Link
                    href={`/destination/${r.slug}`}
                    className="group flex min-h-[52px] items-center gap-3 py-2 transition hover:bg-paper-2/50"
                  >
                    <span className="mono w-9 shrink-0 text-[13px] font-semibold tabular-nums text-stamp">#{r.rank}</span>
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{r.name}</span>
                      <span className="mono block text-[11px] text-ink-mute">{r.kindLabel}</span>
                    </span>
                    <span className="mono ml-auto shrink-0 text-lg font-semibold tabular-nums text-stamp">
                      ${r.feeUsd.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Full sortable table */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Full Visa Fee Comparison: {rankedCount} Destinations Ranked
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Click a column header to sort, or filter by country or region. Every row links to the destination&apos;s
              full fee breakdown and official source.
            </p>
            <div className="mt-5">
              <FeesTable rows={rows} />
            </div>
            {unrankedCount > 0 && (
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
                {unrankedCount} further destinations aren&apos;t ranked here because no single official fee could be
                confirmed - typically because the fee varies by requesting nationality on a reciprocity schedule, or
                only a range/embassy-discretion figure is published. See each destination&apos;s own page for detail.
              </p>
            )}
          </section>

          {/* Cheapest paid - the "you don't need $0 to travel cheap" complement to the free list */}
          <section className="mt-14 max-w-3xl">
            <h2 className="text-section text-ink">
              Cheapest Paid Tourist Visas in 2026
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Just above free: {cheapestPaid.slice(0, 5).map((r) => `${r.name} ($${r.feeUsd})`).join(", ")}
              {cheapestPaid.length > 5 ? `, and ${cheapestPaid.slice(5).map((r) => `${r.name} ($${r.feeUsd})`).join(", ")}` : ""} round out
              the ten lowest confirmed paid fees - see the full table above for every destination in between.
            </p>
          </section>

          {/* Regional patterns */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Visa Fees by Region
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Europe&apos;s median is driven almost entirely by the flat Schengen short-stay fee. The more striking
              pattern is Africa: its median published tourist-visa fee runs well above Asia&apos;s and Americas&apos;,
              despite far lower average incomes in many of its constituent countries - the same {"$"}50-100 fee is a
              very different share of a traveller&apos;s (or a visiting relative&apos;s) budget depending on where they&apos;re from.
            </p>
            <div className="card-doc mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong bg-paper-2">
                    <th scope="col" className="mono-chrome px-3.5 py-2.5 text-left">Region</th>
                    <th scope="col" className="mono-chrome px-3.5 py-2.5 text-right">Destinations</th>
                    <th scope="col" className="mono-chrome px-3.5 py-2.5 text-right">Median fee</th>
                    <th scope="col" className="mono-chrome px-3.5 py-2.5 text-right">Charge nothing</th>
                    <th scope="col" className="mono-chrome px-3.5 py-2.5 text-left">Priciest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {regionStats.map((rs) => (
                    <tr key={rs.region} className="transition hover:bg-paper-2/70">
                      <td className="px-3.5 py-2.5 font-display text-sm font-medium text-ink">{rs.region}</td>
                      <td className="mono px-3.5 py-2.5 text-right text-sm tabular-nums text-ink-soft">{rs.count}</td>
                      <td className="mono px-3.5 py-2.5 text-right text-sm font-semibold tabular-nums text-ink">${rs.median}</td>
                      <td className="mono px-3.5 py-2.5 text-right text-sm tabular-nums text-ink-soft">{rs.freeCount}</td>
                      <td className="mono px-3.5 py-2.5 text-left text-[11px] text-ink-mute">{rs.maxName} (${rs.max.toLocaleString()})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Hidden markup: VFS / outsourced application-centre fees */}
          {vfsInr.length > 0 && (
            <section className="mt-14">
              <h2 className="text-section text-ink">
                The Hidden Markup: Outsourced Application-Centre Fees
              </h2>
              <p className="text-body mt-2 max-w-3xl text-ink-soft">
                {vfsUsedCount} destinations in this dataset outsource visa-application handling to a private company -
                almost always VFS Global - which charges its own service fee, separately from and on top of the
                government&apos;s visa fee above. That charge doesn&apos;t appear in most &quot;visa cost&quot; comparisons because
                it&apos;s paid to a different party for a different thing (biometrics, document handling, courier), not
                the entry permit itself. We could confirm one clean, unambiguous amount for {vfsClean.length} destinations;
                the {vfsInr.length} below are reported from India-based application centres, so they&apos;re directly comparable
                in one currency - a further {vfsClean.length - vfsInr.length} are confirmed in other local currencies on their own destination pages.
              </p>
              <div className="card-doc mt-5 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-strong bg-paper-2">
                      <th scope="col" className="mono-chrome px-3.5 py-2.5 text-left">Destination</th>
                      <th scope="col" className="mono-chrome px-3.5 py-2.5 text-right">Service fee</th>
                      <th scope="col" className="mono-chrome px-3.5 py-2.5 text-left">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {vfsInr.map((v) => (
                      <tr key={v.iso3} className="transition hover:bg-paper-2/70">
                        <td className="px-3.5 py-2 font-display text-sm font-medium text-ink">
                          <Link href={`/destination/${v.slug}`} className="flex items-center gap-2 transition hover:text-stamp">
                            <span>{v.flag}</span>
                            {v.name}
                          </Link>
                        </td>
                        <td className="mono px-3.5 py-2 text-right text-sm font-semibold tabular-nums text-ink">
                          {v.currency} {v.amount.toLocaleString()}
                        </td>
                        <td className="mono px-3.5 py-2 text-left text-[11px] text-ink-mute">{v.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
                All figures reported from India-based application centres for consistency of currency; the same
                operator charges a different, locally-set fee at centres in other countries. Amounts are additional
                to the destination&apos;s own visa fee in the ranking above, not a substitute for it.
              </p>
            </section>
          )}

          {/* Methodology */}
          <section id="methodology" className="mt-14 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">
              Methodology: How This Fee Comparison Is Built
            </h2>
            <p className="text-body mt-3 text-ink-soft">
              Earth Visa crawled the <strong className="text-ink">official fee schedule</strong> published by each
              destination&apos;s own immigration authority, foreign ministry, or e-visa/eTA portal - not third-party
              visa-agency markups. The dataset was last refreshed <strong className="text-ink">{fmtDate(feeUpdated)}</strong>.
            </p>
            <p className="text-body mt-4 text-ink-soft">For each destination we take the lowest amount among four tourist-facing products:</p>
            <ul className="text-body mt-4 space-y-2 text-ink-soft">
              <li><strong className="text-ink">Tourist visa</strong> - a standard embassy/consulate-issued visa.</li>
              <li><strong className="text-ink">e-Visa</strong> - a full visa applied for and issued entirely online.</li>
              <li><strong className="text-ink">Visa on arrival</strong> - a visa issued at the border on landing.</li>
              <li><strong className="text-ink">eTA</strong> - an electronic travel authorisation or mandatory digital arrival form.</li>
            </ul>
            <p className="text-body mt-4 text-ink-soft">
              We exclude business, transit and student/work visas (different product, different price), any fee without
              a published amount, and narrow-scope rates that don&apos;t reflect what a standard adult tourist pays - child
              and infant discounts, group/collective and family-passport rates, and one-off bilateral carve-outs for a
              single nationality. Amounts are converted to USD at the rate recorded at crawl time; native-currency figures
              are shown alongside on each destination&apos;s own page.
            </p>
            <p className="text-body mt-4 text-ink-soft">
              {unrankedCount} destinations are left out of the ranking entirely because their fee genuinely isn&apos;t one
              number - it varies by the traveller&apos;s own nationality under a reciprocity schedule (common for embassy-issued
              visas), or only a range, &quot;contact embassy&quot;, or since-discontinued figure is published. Publishing a single
              misleading average for those would be worse than omitting them.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Visa Fee Comparison 2026: FAQ
            </h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <p className="text-body mt-1 mb-3 max-w-3xl text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Cross-link to the passport-power ranking */}
          <section className="mt-12 max-w-3xl">
            <p className="text-body text-ink-soft">
              Fee is only half the story - see how many destinations your passport can reach without any visa at all in
              the{" "}
              <Link href="/rankings" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                2026 passport ranking
              </Link>
              , or check your own passport&apos;s exact requirements and fees for any destination below.
            </p>
          </section>

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Check the exact fee for your passport
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Select your passport and a destination to see the visa type, fee, and documents required - sourced from
              official government pages.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
