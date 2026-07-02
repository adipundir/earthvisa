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

// region -> [countryName, programs[]][] (countries alphabetical, per-country programs kept in data order)
const byRegion = new Map<string, [string, RbiProgram[]][]>();
for (const region of REGION_ORDER) {
  const inRegion = programs.filter((p) => p.region === region);
  const byCountry = new Map<string, RbiProgram[]>();
  for (const p of inRegion) {
    if (!byCountry.has(p.name)) byCountry.set(p.name, []);
    byCountry.get(p.name)!.push(p);
  }
  byRegion.set(
    region,
    [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  );
}

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
  keywords: [
    "golden visa",
    "golden visa countries",
    "golden visa europe",
    "golden visa 2026",
    "residency by investment",
    "golden visa portugal",
    "golden visa greece",
    "investor visa",
    "residence permit by investment",
    "cheapest golden visa europe",
    "golden visa countries list 2026",
  ],
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
    a: `A golden visa is a residence permit granted in exchange for a qualifying investment - typically real estate, fund units, government bonds, a bank deposit, or a business investment. Unlike citizenship by investment, it grants residency first; many programs then publish a path to permanent residency and citizenship. Our dataset tracks ${programs.length} investment-linked residence routes across ${countryCount} countries, compiled from official government publications.`,
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
          a: `Among EUR-denominated programs actually named "golden visa" in our data, the lowest published minimum is ${fmtMoney(euGoldenOpen[0].min_amount, euGoldenOpen[0].currency)} (${euGoldenOpen[0].name} - ${euGoldenOpen[0].program_name}). Other investment-linked residence permits in the Europe list publish lower minimums - check each route's type and conditions above, and always verify the current figure on the official source.`,
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
  {
    q: "Golden visa vs citizenship by investment: what is the difference?",
    a: `A golden visa grants residency (a permit to live in the country) in exchange for investment; citizenship by investment grants a passport directly. Golden visas are usually cheaper to enter and often keep the investment recoverable, but citizenship arrives only after years of residence, if at all. See our citizenship by investment guide for the direct-passport routes.`,
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

function CountryBlock({ name, list }: { name: string; list: RbiProgram[] }) {
  const iso3 = list[0].iso3;
  const w = passportWorth(iso3);
  const slug = nameToSlug(name);
  return (
    <div className="rounded-sm border border-line bg-paper-2/70 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xl">{flagFor(iso3)}</span>
        <Link
          href={`/passport/${slug}`}
          className="inline-flex min-h-[44px] items-center font-display text-base font-semibold text-ink transition hover:text-stamp"
        >
          {name}
        </Link>
        {w && (
          <span className="mono ml-auto text-[11px] text-ink-soft">
            Passport worth: <strong className="text-ink">{w.visaFree} visa-free</strong> · #{w.rank} of{" "}
            {TOTAL_RANKED_PASSPORTS}
          </span>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {list.map((p, i) => {
          const closed = isClosedProgram(p);
          return (
            <li key={`${p.program_name}-${i}`} className="py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`font-display text-sm font-medium ${closed ? "text-ink-mute line-through decoration-stamp/60" : "text-ink"}`}>
                  {p.program_name}
                </span>
                {closed && (
                  <span className="mono rounded-[3px] bg-stamp/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
                    closed per official source
                  </span>
                )}
              </div>
              <p className="mono mt-1 text-[11px] text-ink-soft">
                {typeLabel(p.type)} ·{" "}
                {p.min_amount != null ? (
                  <>
                    from <strong className="text-ink">{fmtMoney(p.min_amount, p.currency)}</strong>
                  </>
                ) : (
                  <>minimum not published</>
                )}
                {p.path_to_pr_years != null && <> · PR path: {p.path_to_pr_years} yrs</>}
                {p.path_to_citizenship_years != null && <> · citizenship path: {p.path_to_citizenship_years} yrs</>}
              </p>
            </li>
          );
        })}
      </ul>
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
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center">Programs</span>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Golden Visa</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Golden Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Residency by Investment in {countryCount} Countries, by Region
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
              {openPrograms.length} open routes · {closedPrograms.length} recorded closed · data refreshed {lastUpdated}
            </p>

            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Investment routes", v: programs.length },
                { k: "Countries", v: countryCount },
                { k: "Europe routes", v: europePrograms.length },
                { k: "Publish citizenship path", v: withCitizenshipPath.length },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              A <strong className="text-ink">golden visa</strong> grants long-term residency in exchange for a
              qualifying investment - real estate, fund units, bonds, a deposit, or a business. Our dataset tracks{" "}
              <strong className="text-ink">{programs.length} investment-linked residence routes</strong> across{" "}
              <strong className="text-ink">{countryCount} countries</strong>, grouped by region below.{" "}
              {withCitizenshipPath.length} of them publish a residence-to-citizenship timeline, so for every country we
              also show <strong className="text-ink">what its passport is worth</strong>: the visa-free destination
              count and global rank from our <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink">passport rankings</Link>.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Golden visas have been retreating in Europe: our data records Spain&apos;s program as{" "}
              <strong className="text-ink">abolished</strong> and the Irish, UK and Australian investor routes as{" "}
              <strong className="text-ink">closed</strong>. Closed programs are kept in the list and clearly flagged,
              so you do not plan around a route that no longer exists.
            </p>
            <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Thresholds and routes change frequently. Figures compiled from official government publications, last
              refreshed {lastUpdated}. Verify on the official program page before committing funds.
            </p>
          </section>

          {/* Named golden visas */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Countries with a Program Named &quot;Golden Visa&quot; ({namedGolden.length})
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              These jurisdictions brand their investor residence route as a golden visa or golden residency in official
              sources.
            </p>
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
                    <span className="rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
                      closed
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* Regions */}
          {REGION_ORDER.map((region) => {
            const countries = byRegion.get(region) ?? [];
            if (countries.length === 0) return null;
            const total = countries.reduce((n, [, list]) => n + list.length, 0);
            return (
              <section key={region} className="mt-12">
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Golden Visa {region === "Europe" ? "Europe" : `Programs in ${region}`} ({total} Routes,{" "}
                  {countries.length} Countries)
                </h2>
                {region === "Europe" ? (
                  <>
                    <p className="mt-2 text-sm text-ink-soft">
                      Europe remains the busiest golden visa market. EU residence permits generally allow short stays
                      across the Schengen area, but the permit itself is national - conditions vary by country.
                    </p>
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {countries.map(([name, list]) => (
                        <CountryBlock key={name} name={name} list={list} />
                      ))}
                    </div>
                  </>
                ) : (
                  <details className="group mt-3">
                    <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Show {total} routes in {countries.length} {region} countries
                      </span>
                      <span className="hidden group-open:inline">Hide {region} routes</span>
                      <Chevron />
                    </summary>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {countries.map(([name, list]) => (
                        <CountryBlock key={name} name={name} list={list} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
            );
          })}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Golden Visa FAQ</h2>
            <div className="mt-5 divide-y divide-line">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  <p className="mt-1 max-w-3xl pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <ProgramsNav current="/programs/golden-visa" />

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check what residency could eventually unlock
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Use Earth Visa to see the visa-free map of any passport - including the one at the end of a golden visa
              path.
            </p>
            <Link
              href="/visit"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-paper-2"
            >
              Explore passports on Earth Visa →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
