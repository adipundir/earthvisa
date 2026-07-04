import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import {
  cbiMinUsd,
  cheapestUsdOption,
  isAnnouncedOnly,
  passportWorth,
  TOTAL_RANKED_PASSPORTS,
  typeLabel,
} from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { CbiProgram } from "@/lib/types";

// ---------------------------------------------------------------------------
// Data (all derived from dataset.cbi - nothing invented)
// ---------------------------------------------------------------------------

const programs = [...dataset.cbi].sort((a, b) => a.name.localeCompare(b.name));
const lastUpdated = dataset.meta.lastUpdated;

const cheapest = programs
  .map((p) => ({ p, min: cbiMinUsd(p) }))
  .filter((x): x is { p: CbiProgram; min: number } => x.min != null)
  .sort((a, b) => a.min - b.min);

// Cheapest program that is actually enacted (not merely announced), for headline claims.
const cheapestEnacted = cheapest.find((x) => !isAnnouncedOnly(x.p)) ?? cheapest[0];

const worth = programs
  .map((p) => ({ p, w: passportWorth(p.iso3) }))
  .filter((x): x is { p: CbiProgram; w: NonNullable<ReturnType<typeof passportWorth>> } => x.w != null)
  .sort((a, b) => b.w.visaFree - a.w.visaFree);

// Programs priced only in non-USD currencies (kept out of the USD ranking, never converted).
const nonUsdPriced = programs.filter((p) => cbiMinUsd(p) == null && p.options.some((o) => o.min_amount != null));
// Programs with no published minimum at all (discretionary / not yet regulated).
const noPublishedMin = programs.filter((p) => p.options.every((o) => o.min_amount == null));

const dualAllowedCount = programs.filter((p) => p.dual_citizenship_allowed === true).length;

// Programs whose official source states a concrete timeline, for the FAQ.
const timedExamples = programs
  .filter((p) => /day|month|week/i.test(p.processing_time) && p.processing_time.length <= 90)
  .slice(0, 4)
  .map((p) => `${p.name}: ${p.processing_time}`)
  .join("; ");

const OPTION_LABEL: Record<string, string> = {
  donation: "Donation",
  real_estate: "Real estate",
  bonds: "Government bonds",
  business: "Business investment",
  fund: "Fund contribution",
  other: "Other qualifying investment",
};
function optionLabel(type: string): string {
  return OPTION_LABEL[type] ?? typeLabel(type);
}

/** rewrites crawl-pipeline provenance phrasing in source rows into reader-facing copy */
function processingLabel(t: string): string {
  const m = t.match(/^Not stated verbatim on ([\w.-]+) fetched pages$/i);
  return m ? `Not published on the official programme site (${m[1]})` : t;
}

const announcedCaveat = isAnnouncedOnly(cheapest[0].p)
  ? ` Per our source notes, ${cheapest[0].p.name}'s figure is an announced amount that had not been formally enacted at our last data refresh.`
  : "";

const strongestCaveat = worth[0].p.options.every((o) => o.min_amount == null)
  ? ` Note that ${worth[0].p.name}'s route has no published investment schedule and is granted at government discretion per the official source.`
  : "";

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Citizenship by Investment 2026: ${programs.length} Countries Compared by Cost & Passport Power`;
const description = `Full citizenship by investment countries list for 2026: all ${programs.length} CBI programs with minimum investment, processing time, and how many visa-free countries each passport unlocks. Published minimums from ${fmtMoney(cheapestEnacted.min, "USD")}. Compiled from official publications.`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "citizenship by investment",
    "citizenship by investment countries list",
    "cheapest citizenship by investment",
    "citizenship by investment 2026",
    "cbi programs",
    "second passport by investment",
    "buy citizenship",
    "caribbean citizenship by investment",
    "citizenship by investment cost",
    "fastest citizenship by investment",
    "cbi passport ranking",
  ],
  alternates: { canonical: "https://earthvisa.in/programs/citizenship-by-investment" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/citizenship-by-investment",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is citizenship by investment?",
    a: `Citizenship by investment (CBI) is a legal route to a second passport: a country grants full citizenship in exchange for a qualifying investment, typically a non-refundable donation to a national fund, an approved real estate purchase, or a business investment. Earth Visa tracks ${programs.length} such programs in 2026, compiled from official government publications.`,
  },
  {
    q: "What is the cheapest citizenship by investment in 2026?",
    a: `The lowest USD-denominated published minimums in our data are ${fmtMoney(cheapest[0].min, "USD")} (${cheapest[0].p.name}), ${fmtMoney(cheapest[1].min, "USD")} (${cheapest[1].p.name}) and ${fmtMoney(cheapest[2].min, "USD")} (${cheapest[2].p.name}).${announcedCaveat} Fees for due diligence, processing and dependants come on top of the headline minimum.`,
  },
  {
    q: "How many countries offer citizenship by investment in 2026?",
    a: `Our dataset (last refreshed ${lastUpdated}) tracks ${programs.length} countries with an operating or announced citizenship by investment route: ${programs.map((p) => p.name).join(", ")}.`,
  },
  {
    q: "How long does citizenship by investment take?",
    a: `It varies by program, and many official sources do not publish a timeline. Examples of published processing times in our data - ${timedExamples}. Timelines run from application submission and exclude document preparation and due diligence delays.`,
  },
  {
    q: "Which citizenship by investment passport is the strongest?",
    a: `Among CBI countries in our data, the ${worth[0].p.name} passport has the highest visa-free count: ${worth[0].w.visaFree} destinations, ranked #${worth[0].w.rank} of ${TOTAL_RANKED_PASSPORTS} passports. It is followed by ${worth[1].p.name} (${worth[1].w.visaFree} visa-free) and ${worth[2].p.name} (${worth[2].w.visaFree} visa-free).${strongestCaveat}`,
  },
  {
    q: "Do citizenship by investment countries allow dual citizenship?",
    a: `${dualAllowedCount} of the ${programs.length} programs in our data explicitly allow dual citizenship per their official sources; for the remainder the official source does not state a position. Also check the rules of your current country of citizenship - some countries restrict their own citizens from holding a second passport.`,
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
          name: "Citizenship by Investment",
          item: "https://earthvisa.in/programs/citizenship-by-investment",
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
    {
      "@type": "ItemList",
      name: `Citizenship by Investment Countries List ${new Date(lastUpdated).getFullYear()}`,
      numberOfItems: programs.length,
      itemListElement: programs.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${p.name} - ${p.program_name}`,
        url: `https://earthvisa.in/passport/${nameToSlug(p.name)}`,
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

function ProgramCard({ p }: { p: CbiProgram }) {
  const w = passportWorth(p.iso3);
  const slug = nameToSlug(p.name);
  // Some source rows repeat an option that renders to the same label + amount; collapse them for display.
  const options = p.options.filter(
    (o, i, arr) =>
      i ===
      arr.findIndex(
        (x) =>
          optionLabel(x.type) === optionLabel(o.type) && x.min_amount === o.min_amount && x.currency === o.currency,
      ),
  );
  return (
    <article className="flex flex-col rounded-sm border border-line bg-paper-2/70 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flagFor(p.iso3)}</span>
        <div className="min-w-0">
          <Link
            href={`/passport/${slug}`}
            className="inline-flex min-h-[44px] items-center font-display font-semibold text-ink transition hover:text-stamp"
          >
            {p.name}
          </Link>
          <div className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">{p.region}</div>
        </div>
      </div>
      <p className="mt-1 text-sm italic leading-snug text-ink-soft">{p.program_name}</p>

      <ul className="mono mt-3 space-y-1 text-[11px] text-ink-soft">
        {options.map((o, i) => (
          <li key={`${o.type}-${i}`}>
            {optionLabel(o.type)} ·{" "}
            {o.min_amount != null ? <>from {fmtMoney(o.min_amount, o.currency)}</> : <>minimum not published</>}
          </li>
        ))}
      </ul>

      {p.processing_time && (
        <p className="mono mt-2 text-[11px] text-ink-mute">Processing: {processingLabel(p.processing_time)}</p>
      )}

      <div className="mono mt-3 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-[0.1em]">
        {p.residency_required === false && (
          <span className="rounded-[3px] bg-vfree/10 px-2 py-0.5 text-vfree ring-1 ring-vfree/30">
            No residency requirement
          </span>
        )}
        {p.residency_required === true && (
          <span className="rounded-[3px] bg-eta/10 px-2 py-0.5 text-eta ring-1 ring-eta/30">Residency required</span>
        )}
        {p.dual_citizenship_allowed === true && (
          <span className="rounded-[3px] bg-voa/10 px-2 py-0.5 text-voa ring-1 ring-voa/30">
            Dual citizenship allowed
          </span>
        )}
        {isAnnouncedOnly(p) && (
          <span className="rounded-[3px] bg-stamp/10 px-2 py-0.5 text-stamp ring-1 ring-stamp/30">
            Announced - not yet enacted per source notes
          </span>
        )}
      </div>

      {w && (
        <div className="mt-auto border-t border-line pt-3">
          <p className="mono mt-1 text-[11px] text-ink-soft">
            Passport: <strong className="text-ink">{w.visaFree} visa-free</strong> destinations · #{w.rank} of{" "}
            {TOTAL_RANKED_PASSPORTS}
          </p>
          <div className="mono mt-1 flex flex-wrap gap-x-4 text-[11px]">
            <Link
              href={`/passport/${slug}`}
              className="inline-flex min-h-[44px] items-center uppercase tracking-[0.12em] text-stamp transition hover:text-ink"
            >
              Passport details →
            </Link>
            <Link
              href={`/destination/${slug}`}
              className="inline-flex min-h-[44px] items-center uppercase tracking-[0.12em] text-stamp transition hover:text-ink"
            >
              Entry rules →
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

export default function CitizenshipByInvestmentPage() {
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Citizenship by Investment</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Citizenship by Investment 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                {`All ${programs.length} Programs Compared by Cost & Passport Power`}
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
              {programs.length} programs tracked · official publications · data refreshed {lastUpdated}
            </p>

            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Programs tracked", v: String(programs.length) },
                {
                  k: "Lowest published minimum",
                  v: `${fmtMoney(cheapest[0].min, "USD")}${isAnnouncedOnly(cheapest[0].p) ? " (announced)" : ""}`,
                },
                { k: "Strongest CBI passport", v: `${worth[0].w.visaFree} visa-free` },
                { k: "Allow dual citizenship", v: String(dualAllowedCount) },
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
              <strong className="text-ink">Citizenship by investment (CBI)</strong> grants a full second passport in
              exchange for a qualifying investment - most commonly a donation to a national development fund, an
              approved real estate purchase, or a business investment. Our dataset tracks{" "}
              <strong className="text-ink">{programs.length} programs</strong> in 2026, with published minimums
              starting from <strong className="text-ink">{fmtMoney(cheapest[0].min, "USD")}</strong>
              {isAnnouncedOnly(cheapest[0].p) && (
                <>
                  {" "}
                  (announced, not yet enacted - the lowest enacted minimum is{" "}
                  <strong className="text-ink">{fmtMoney(cheapestEnacted.min, "USD")}</strong>)
                </>
              )}
              .
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              What most comparison lists skip: <strong className="text-ink">what the passport you would get is
              actually worth</strong>. For every program below we show the passport&apos;s visa-free destination count
              and its global rank out of {TOTAL_RANKED_PASSPORTS} passports, computed from the same official-source
              visa data that powers our <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink">passport rankings</Link>.
            </p>
            <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              CBI programs change often - minimums, options and eligibility are revised, and programs open and close.
              Figures on this page were compiled from each program&apos;s official publications and last refreshed on{" "}
              {lastUpdated}. Verify on the official program page before committing funds.
            </p>
          </section>

          {/* Cheapest ranking */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Cheapest Citizenship by Investment in 2026 (Ranked)
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Ranked by the lowest USD-denominated published minimum per program. Headline minimums exclude
              government processing, due diligence and dependant fees.
            </p>
            <ol className="mt-5 space-y-2">
              {cheapest.map(({ p, min }, i) => {
                const opt = cheapestUsdOption(p);
                const w = passportWorth(p.iso3);
                return (
                  <li
                    key={p.iso3}
                    className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5"
                  >
                    <span className="mono w-6 text-right text-[11px] text-ink-mute">{i + 1}.</span>
                    <span className="text-xl">{flagFor(p.iso3)}</span>
                    <Link
                      href={`/passport/${nameToSlug(p.name)}`}
                      className="font-display text-sm font-medium text-ink transition hover:text-stamp"
                    >
                      {p.name}
                    </Link>
                    {isAnnouncedOnly(p) && (
                      <span className="mono rounded-[3px] bg-stamp/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
                        announced
                      </span>
                    )}
                    <span className="mono ml-auto text-[11px] text-ink-soft">
                      {opt ? `${optionLabel(opt.type)} · ` : ""}
                      <strong className="text-ink">{fmtMoney(min, "USD")}</strong>
                      {w ? ` · ${w.visaFree} visa-free` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
            {(nonUsdPriced.length > 0 || noPublishedMin.length > 0) && (
              <p className="mono mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
                {nonUsdPriced.length > 0 && (
                  <>
                    Not ranked above (priced in other currencies, shown as published, never converted):{" "}
                    {nonUsdPriced.map((p) => p.name).join(", ")}.{" "}
                  </>
                )}
                {noPublishedMin.length > 0 && (
                  <>No published minimum in official sources: {noPublishedMin.map((p) => p.name).join(", ")}.</>
                )}
              </p>
            )}
          </section>

          {/* Full list */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Citizenship by Investment Countries List 2026 ({programs.length} Programs)
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Every CBI route in our dataset, with investment options, processing time and program conditions from
              official publications.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {programs.map((p) => (
                <ProgramCard key={p.iso3} p={p} />
              ))}
            </div>
          </section>

          {/* Passport worth table */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              What Each CBI Passport Is Worth in 2026
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              The point of a second passport is access. Here is every CBI passport ranked by visa-free destinations,
              alongside its lowest published USD minimum - the price-to-power view.
            </p>
            <p className="mono mt-5 text-[10px] uppercase tracking-[0.12em] text-ink-mute sm:hidden">
              Scroll sideways for all columns →
            </p>
            <div className="mt-1.5 overflow-x-auto sm:mt-5">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="mono border-b border-line-strong text-left text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                    <th className="py-2.5 pr-4 font-medium">Passport</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Visa-free</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Global rank</th>
                    <th className="py-2.5 text-right font-medium">Min. investment (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {worth.map(({ p, w }) => {
                    const min = cbiMinUsd(p);
                    return (
                      <tr key={p.iso3} className="border-b border-line">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/passport/${nameToSlug(p.name)}`}
                            className="inline-flex min-h-[44px] items-center gap-2.5 font-display font-medium text-ink transition hover:text-stamp"
                          >
                            <span className="text-lg">{flagFor(p.iso3)}</span>
                            {p.name}
                          </Link>
                        </td>
                        <td className="mono py-2 pr-4 text-right tabular-nums text-ink">{w.visaFree}</td>
                        <td className="mono py-2 pr-4 text-right tabular-nums text-ink-soft">
                          #{w.rank} of {TOTAL_RANKED_PASSPORTS}
                        </td>
                        <td className="mono py-2 text-right tabular-nums text-ink-soft">
                          {min != null ? fmtMoney(min, "USD") : "not published"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mono mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
              Global rank is by total destinations reachable without a pre-arranged visa (visa-free + visa on arrival
              + eTA), so a passport can rank above another that has more strictly visa-free destinations.
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Compare these against all {TOTAL_RANKED_PASSPORTS} passports on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink">
                Earth Visa passport rankings
              </Link>
              .
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Citizenship by Investment FAQ</h2>
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

          <ProgramsNav current="/programs/citizenship-by-investment" />

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              See exactly what a second passport would add
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Pick any combination of passports on Earth Visa and see the combined visa-free map - before you spend a
              cent.
            </p>
            <Link
              href="/visit"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-paper-2"
            >
              Compare passports on Earth Visa →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
