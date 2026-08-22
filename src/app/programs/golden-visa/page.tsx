import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import {
  goldenVisaPrograms,
  isClosedProgram,
  passportWorth,
  REGION_ORDER,
  TOTAL_RANKED_PASSPORTS,
  typeLabel,
} from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { RbiProgram } from "@/lib/types";
import ReportLine from "@/components/ReportLine";

// ---------------------------------------------------------------------------
// Data (all derived from dataset.rbi - nothing invented)
// ---------------------------------------------------------------------------

const programs = goldenVisaPrograms();
const lastUpdated = dataset.meta.lastUpdated;
const openPrograms = programs.filter((p) => !isClosedProgram(p));
const closedPrograms = programs.filter((p) => isClosedProgram(p));
const countryCount = new Set(programs.map((p) => p.iso3)).size;
const europePrograms = programs.filter((p) => p.region === "Europe");
const europeOpenCountries = [
  ...new Set(europePrograms.filter((p) => !isClosedProgram(p)).map((p) => p.name)),
].sort();

// region -> { rows, countries } - one flat, country-alphabetical row list per region.
// Every route used to render as its own card inside a per-region <details>; the same
// facts now live in one compact table row each, so the whole page needs a single
// disclosure instead of five.
type RegionSlice = { rows: RbiProgram[]; countries: number };
const byRegion = new Map<string, RegionSlice>();
for (const region of REGION_ORDER) {
  const inRegion = programs.filter((p) => p.region === region);
  const byCountry = new Map<string, RbiProgram[]>();
  for (const p of inRegion) {
    if (!byCountry.has(p.name)) byCountry.set(p.name, []);
    byCountry.get(p.name)!.push(p);
  }
  const ordered = [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  byRegion.set(region, { rows: ordered.flatMap(([, list]) => list), countries: ordered.length });
}

const europe = byRegion.get("Europe") ?? { rows: [], countries: 0 };
const otherRegions = REGION_ORDER.filter((r) => r !== "Europe");

// Europe leads the page; the rest of its routes join the other regions behind one disclosure.
const EUROPE_PREVIEW = 18;
const hiddenRows =
  Math.max(europe.rows.length - EUROPE_PREVIEW, 0) +
  otherRegions.reduce((n, r) => n + (byRegion.get(r)?.rows.length ?? 0), 0);
const hiddenCountries =
  Math.max(europe.countries - new Set(europe.rows.slice(0, EUROPE_PREVIEW).map((p) => p.iso3)).size, 0) +
  otherRegions.reduce((n, r) => n + (byRegion.get(r)?.countries ?? 0), 0);

// Programs literally named "golden" (one representative per country, closed ones kept and badged).
const namedGolden = [
  ...new Map(programs.filter((p) => /golden/i.test(p.program_name)).map((p) => [p.iso3, p])).values(),
].sort((a, b) => a.name.localeCompare(b.name));

// Cheapest EUR-denominated program actually named "golden visa" in Europe (open only) - for the FAQ.
const euGoldenOpen = europePrograms
  .filter((p) => /golden/i.test(p.program_name) && !isClosedProgram(p) && p.min_amount != null && p.currency === "EUR")
  .sort((a, b) => (a.min_amount as number) - (b.min_amount as number));

const withCitizenshipPath = programs.filter((p) => p.path_to_citizenship_years != null);
const citPathYears = withCitizenshipPath.map((p) => p.path_to_citizenship_years as number);
const minCitPath = Math.min(...citPathYears);
const maxCitPath = Math.max(...citPathYears);

const esp = programs.find((p) => p.iso3 === "ESP" && /golden/i.test(p.program_name));

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Golden Visa Countries 2026: ${countryCount} Countries with Residency by Investment`;
const description = `Golden visa programs in 2026 across ${countryCount} countries: minimum investment, path to permanent residency and citizenship, and what each passport is worth. Includes ${europeOpenCountries.length} European countries and dataset-flagged closed programs (Spain, Ireland, UK). Official sources.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/programs/golden-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/golden-visa",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is a golden visa?",
    a: `A golden visa is a residence permit granted in exchange for a qualifying investment - typically real estate, fund units, government bonds, a bank deposit, or a business investment. Unlike citizenship by investment, which grants a passport directly, a golden visa grants residency first: it is usually cheaper to enter and often keeps the investment recoverable, but citizenship arrives only after years of residence, if at all. Our dataset tracks ${programs.length} investment-linked residence routes across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "Which countries offer golden visa programs in 2026?",
    a: `Our dataset tracks ${openPrograms.length} open investment-linked residence routes across ${countryCount} countries. Programs literally named "golden visa" or "golden residency" exist in ${namedGolden
      .filter((p) => !isClosedProgram(p))
      .map((p) => p.name)
      .join(", ")}. Spain's golden visa is recorded as abolished, and Ireland's and the UK's investor routes as closed, per official sources.`,
  },
  {
    q: "Which European countries have golden visas in 2026?",
    a: `${europeOpenCountries.length} European countries carry an open investment-linked residence route in our dataset: ${europeOpenCountries.join(", ")}.`,
  },
  ...(euGoldenOpen.length > 0
    ? [
        {
          q: "What is the cheapest golden visa in Europe?",
          a: `Among EUR-denominated programs actually named "golden visa" in our data, the lowest published minimum is ${fmtMoney(euGoldenOpen[0].min_amount, euGoldenOpen[0].currency)} (${euGoldenOpen[0].name} - ${euGoldenOpen[0].program_name}). Other investment-linked residence permits in the Europe list publish lower minimums - see each route's type and conditions above.`,
        },
      ]
    : []),
  ...(esp && isClosedProgram(esp)
    ? [
        {
          q: "Is the Spain golden visa still available?",
          a: `No. Our dataset records Spain's investor residence visa as abolished on April 3, 2025 by Organic Law 1/2025, which eliminated the relevant articles of Law 14/2013. Ireland's Immigrant Investor Programme (closed February 2023), the UK's Tier 1 Investor visa, and Australia's Business Innovation and Investment (Provisional) stream are also recorded as closed in our data.`,
        },
      ]
    : []),
  {
    q: "Does a golden visa lead to citizenship?",
    a: `Often, but indirectly. ${withCitizenshipPath.length} of the ${programs.length} routes in our dataset publish a residence-to-citizenship timeline, ranging from ${minCitPath} to ${maxCitPath} years. Naturalisation typically adds language, physical presence and good-character requirements on top of holding the permit - the published year count is an eligibility minimum, not a guarantee.`,
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Programs" },
        {
          "@type": "ListItem",
          position: 3,
          name: "Golden Visa Countries",
          item: "https://earthvisa.in/programs/golden-visa",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** published residence milestones for one route, as one short cell */
function pathText(p: RbiProgram): string {
  const parts: string[] = [];
  if (p.path_to_pr_years === 0) parts.push("PR immediate");
  else if (
    p.path_to_pr_years != null &&
    p.path_to_pr_years > 0 &&
    (p.path_to_citizenship_years == null || p.path_to_pr_years <= p.path_to_citizenship_years)
  ) {
    parts.push(`PR ${p.path_to_pr_years} yrs`);
  }
  if (p.path_to_citizenship_years != null) parts.push(`citizenship ${p.path_to_citizenship_years} yrs`);
  return parts.join(" · ");
}

function RouteRow({ p }: { p: RbiProgram }) {
  const closed = isClosedProgram(p);
  const w = passportWorth(p.iso3);
  const path = pathText(p);
  return (
    <tr className="border-b border-line align-top">
      <td className="py-1.5 pr-4">
        <Link
          href={`/passport/${nameToSlug(p.name)}`}
          className="inline-flex min-h-[44px] items-center gap-2 font-display text-sm font-medium text-ink transition hover:text-stamp"
        >
          <span className="text-base">{flagFor(p.iso3)}</span>
          {p.name}
        </Link>
      </td>
      <td className="py-3 pr-4 text-[13px] leading-snug text-ink-soft">
        <span className={closed ? "text-ink-mute line-through decoration-stamp/60" : ""}>{p.program_name}</span>
        {closed && (
          <span className="mono ml-1.5 whitespace-nowrap rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[11px] text-stamp ring-1 ring-stamp/30">
            closed
          </span>
        )}
      </td>
      <td className="mono py-3 pr-4 text-[12px] leading-snug text-ink-soft">
        {typeLabel(p.type)}
        {p.min_amount != null ? ` · from ${fmtMoney(p.min_amount, p.currency)}` : " · minimum not published"}
      </td>
      <td className="mono py-3 pr-4 text-[12px] leading-snug text-ink-soft">{path || "not published"}</td>
      <td className="mono py-3 text-right text-[12px] tabular-nums text-ink-soft">{w ? w.visaFree : "-"}</td>
    </tr>
  );
}

function RouteTable({ rows }: { rows: RbiProgram[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left text-[12px] text-ink-mute">
            <th scope="col" className="py-2.5 pr-4 font-medium">Country</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Route</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Type &amp; minimum</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Published path</th>
            <th scope="col" className="py-2.5 text-right font-medium">Visa-free</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <RouteRow key={`${p.iso3}-${p.program_name}-${i}`} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GoldenVisaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav
              aria-label="Breadcrumb"
              className="mb-4 flex flex-wrap items-center gap-x-2 text-[12px] font-medium text-ink-mute"
            >
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Programs</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Golden Visa</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Golden Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Residency by Investment in {countryCount} Countries, by Region
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {openPrograms.length} open · {closedPrograms.length} closed · refreshed {lastUpdated}
            </p>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Investment routes", v: programs.length },
                { k: "Countries", v: countryCount },
                { k: "Europe routes", v: europePrograms.length },
                { k: "Publish citizenship path", v: withCitizenshipPath.length },
              ].map(({ k, v }) => (
                <div key={k} className="bg-card px-4 py-2.5">
                  <dt className="text-[12px] font-medium text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              A <strong className="text-ink">golden visa</strong> grants long-term residency in exchange for a
              qualifying investment - real estate, fund units, bonds, a deposit, or a business. Each route below shows
              its published minimum, its path to permanent residency or citizenship, and what that passport is worth in
              our{" "}
              <Link
                href="/rankings"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                passport rankings
              </Link>
              . Spain&apos;s program is recorded as abolished and the Irish, UK and Australian investor routes as
              closed; they stay listed and flagged.
            </p>
          </section>

          {/* Named golden visas */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Countries with a Program Named &quot;Golden Visa&quot; ({namedGolden.length})
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {namedGolden.map((p) => (
                <Link
                  key={p.iso3}
                  href={`/passport/${nameToSlug(p.name)}`}
                  className="mono inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2 text-[12px] text-ink transition hover:border-line-strong hover:text-stamp"
                >
                  <span className="text-base">{flagFor(p.iso3)}</span>
                  {p.name}
                  {isClosedProgram(p) && (
                    <span className="rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[11px] text-stamp ring-1 ring-stamp/30">
                      closed
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* Europe leads; every other region sits behind one disclosure below */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Golden Visa Europe ({europe.rows.length} Routes, {europe.countries} Countries)
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              An EU residence permit generally allows short stays across the Schengen area, but the permit itself is
              national - conditions vary by country.
            </p>
            <RouteTable rows={europe.rows.slice(0, EUROPE_PREVIEW)} />
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-mute">
              Visa-free counts destinations that passport reaches without a pre-arranged visa, from our ranking of{" "}
              {TOTAL_RANKED_PASSPORTS} passports. Amounts are shown in the currency the official source publishes, and
              published paths are eligibility minimums, not guarantees.
            </p>
          </section>

          {hiddenRows > 0 && (
            <details className="group mt-8">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[13px] font-medium text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">
                  Show the remaining {hiddenRows} routes in {hiddenCountries} countries
                </span>
                <span className="hidden group-open:inline">Hide the remaining routes</span>
                <Chevron />
              </summary>

              {europe.rows.length > EUROPE_PREVIEW && (
                <section className="mt-8">
                  <h3 className="text-sub text-ink">More Europe Routes</h3>
                  <RouteTable rows={europe.rows.slice(EUROPE_PREVIEW)} />
                </section>
              )}

              {otherRegions.map((region) => {
                const slice = byRegion.get(region);
                if (!slice || slice.rows.length === 0) return null;
                return (
                  <section key={region} className="mt-10">
                    <h2 className="text-section text-ink">
                      Golden Visa Programs in {region} ({slice.rows.length} Routes, {slice.countries} Countries)
                    </h2>
                    <RouteTable rows={slice.rows} />
                  </section>
                );
              })}
            </details>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Golden Visa FAQ</h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  <p className="text-body mt-1 max-w-3xl pb-4 text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <ProgramsNav current="/programs/golden-visa" />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Check what residency could eventually unlock
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              See the visa-free map of any passport - including the one at the end of a golden visa path.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Explore passports on Earth Visa →
            </Link>
          </section>
        </div>
        <ReportLine />
      </main>
    </>
  );
}
