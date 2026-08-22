import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import {
  cbiMinUsd,
  cheapestUsdOption,
  isAnnouncedOnly,
  isSuspended,
  passportWorth,
  TOTAL_RANKED_PASSPORTS,
  typeLabel,
} from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { CbiProgram } from "@/lib/types";
import ReportLine from "@/components/ReportLine";

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

// Suspended programs (legally authorized but not currently usable) are excluded from the
// "strongest CBI passport" ranking below - the passport isn't obtainable via CBI right now.
const worth = programs
  .filter((p) => !isSuspended(p))
  .map((p) => ({ p, w: passportWorth(p.iso3) }))
  .filter((x): x is { p: CbiProgram; w: NonNullable<ReturnType<typeof passportWorth>> } => x.w != null)
  .sort((a, b) => b.w.visaFree - a.w.visaFree);

// Programs priced only in non-USD currencies (kept out of the USD ranking, never converted).
const nonUsdPriced = programs.filter((p) => cbiMinUsd(p) == null && p.options.some((o) => o.min_amount != null));
// Programs with no published minimum at all (discretionary / not yet regulated).
const noPublishedMin = programs.filter((p) => p.options.every((o) => o.min_amount == null));

// ONE table now carries everything the per-program cards used to repeat: price rank,
// every investment route, processing, conditions and what the passport is worth.
// USD-ranked programs first, then non-USD-priced (shown as published, never converted),
// then programs with no published minimum.
const priceRows = [
  ...cheapest.map(({ p }, i) => ({ p, rank: i + 1 as number | null, option: cheapestUsdOption(p) })),
  ...nonUsdPriced.map((p) => ({
    p,
    rank: null,
    option:
      [...p.options]
        .filter((o) => o.min_amount != null)
        .sort((a, b) => (a.min_amount as number) - (b.min_amount as number))[0] ?? null,
  })),
  ...noPublishedMin.map((p) => ({ p, rank: null, option: null })),
];

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

const suspendedPrograms = programs.filter((p) => isSuspended(p));
const suspendedCaveat = suspendedPrograms.length
  ? ` Of these, ${suspendedPrograms.map((p) => p.name).join(", ")} ${suspendedPrograms.length === 1 ? "is" : "are"} legally authorized but currently suspended, with applications not open - see its entry below.`
  : "";

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Citizenship by Investment 2026: ${programs.length} Countries Compared by Cost & Passport Power`;
const description = `Full citizenship by investment countries list for 2026: all ${programs.length} CBI programs with minimum investment, processing time, and how many visa-free countries each passport unlocks. Published minimums from ${fmtMoney(cheapestEnacted.min, "USD")}. Compiled from official publications.`;

export const metadata: Metadata = {
  title,
  description,
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
    a: `Our dataset (last refreshed ${lastUpdated}) tracks ${programs.length} countries with an operating, announced, or legally-authorized citizenship by investment route: ${programs.map((p) => p.name).join(", ")}.${suspendedCaveat}`,
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

/** one programme = one row: price rank, every route, processing, conditions, passport power */
function ProgramRow({
  p,
  rank,
  option,
}: {
  p: CbiProgram;
  rank: number | null;
  option: CbiProgram["options"][number] | null;
}) {
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
  const conditions = [
    p.residency_required === false ? "no residency requirement" : null,
    p.residency_required === true ? "residency required" : null,
    p.dual_citizenship_allowed === true ? "dual citizenship allowed" : null,
  ].filter(Boolean);
  const status = isSuspended(p) ? "suspended" : isAnnouncedOnly(p) ? "announced, not enacted" : null;
  return (
    <tr className="border-b border-line align-top">
      <td className="mono py-3 pr-3 text-right tabular-nums text-ink-mute">{rank ?? "-"}</td>
      <td className="py-3 pr-4">
        <Link
          href={`/passport/${slug}`}
          className="inline-flex items-center gap-2 font-display font-medium text-ink transition hover:text-stamp"
        >
          <span className="text-lg">{flagFor(p.iso3)}</span>
          {p.name}
        </Link>
        {status && (
          <span
            className={`mono ml-2 whitespace-nowrap rounded-[3px] px-1.5 py-0.5 text-[10px] ring-1 ${
              isSuspended(p) ? "bg-change/10 text-change ring-change/30" : "bg-stamp/10 text-stamp ring-stamp/30"
            }`}
          >
            {status}
          </span>
        )}
        <span className="mt-0.5 block text-[12px] italic leading-snug text-ink-soft">{p.program_name}</span>
        <span className="mt-0.5 block text-[12px] text-ink-mute">
          {p.region}
          {p.official_url && (
            <>
              {" · "}
              <a
                href={p.official_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                official source ↗
              </a>
            </>
          )}
        </span>
      </td>
      <td className="mono py-3 pr-4 text-right tabular-nums">
        {option && option.min_amount != null ? (
          <strong className="text-ink">{fmtMoney(option.min_amount, option.currency)}</strong>
        ) : (
          <span className="text-ink-soft">not published</span>
        )}
      </td>
      <td className="mono py-3 pr-4 text-[11px] leading-relaxed text-ink-soft">
        {options.length === 0
          ? "-"
          : options
              .map((o) => `${optionLabel(o.type)} ${o.min_amount != null ? fmtMoney(o.min_amount, o.currency) : "(not published)"}`)
              .join(" · ")}
      </td>
      <td className="py-3 pr-4 text-[12px] leading-relaxed text-ink-soft">
        {p.processing_time ? processingLabel(p.processing_time) : "not published"}
        {conditions.length > 0 && <span className="mt-0.5 block text-ink-mute">{conditions.join(" · ")}</span>}
      </td>
      <td className="mono py-3 text-right text-[12px] tabular-nums">
        {w ? (
          <>
            <span className="text-ink">{w.visaFree} visa-free</span>
            <span className="block text-ink-soft">#{w.rank} of {TOTAL_RANKED_PASSPORTS}</span>
          </>
        ) : (
          <span className="text-ink-soft">-</span>
        )}
        <span className="mt-1 block whitespace-nowrap">
          <Link href={`/passport/${slug}`} className="text-stamp transition hover:text-ink">
            passport
          </Link>
          {" · "}
          <Link href={`/destination/${slug}`} className="text-stamp transition hover:text-ink">
            entry rules
          </Link>
        </span>
      </td>
    </tr>
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Citizenship by Investment</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Citizenship by Investment 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                {`All ${programs.length} Programs Compared by Cost & Passport Power`}
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              Official publications · refreshed {lastUpdated}
            </p>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Programs tracked", v: String(programs.length) },
                {
                  k: "Lowest published minimum",
                  v: `${fmtMoney(cheapest[0].min, "USD")}${isAnnouncedOnly(cheapest[0].p) ? " (announced)" : ""}`,
                },
                { k: "Strongest CBI passport", v: `${worth[0].w.visaFree} visa-free` },
                { k: "Allow dual citizenship", v: String(dualAllowedCount) },
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
              <strong className="text-ink">Citizenship by investment (CBI)</strong> grants a full second passport in
              exchange for a qualifying investment - a donation to a national fund, approved real estate, or a
              business stake - and every program below sits next to what its passport is actually worth in our{" "}
              <Link
                href="/rankings"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                passport rankings
              </Link>
              .
              {isAnnouncedOnly(cheapest[0].p) && (
                <> The lowest enacted minimum is {fmtMoney(cheapestEnacted.min, "USD")}.</>
              )}
            </p>
          </section>

          {/* One table: the cheapest ranking, every route, and what each passport is worth */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Citizenship by Investment Countries List 2026: All {programs.length} Programs, Cheapest First
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Ranked by lowest published USD minimum, which excludes processing, due diligence and dependant fees.
              Amounts in other currencies are shown as published, never converted, and sit unranked at the bottom.
            </p>
            <p className="mt-4 text-[12px] font-medium text-ink-mute sm:hidden">Scroll sideways for all columns →</p>
            <div className="mt-1.5 overflow-x-auto sm:mt-5">
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-strong text-left text-[12px] text-ink-mute">
                    <th scope="col" className="py-2.5 pr-3 text-right font-medium">#</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Passport &amp; programme</th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">From</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Investment routes</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Processing &amp; conditions</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Passport power</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRows.map(({ p, rank, option }) => (
                    <ProgramRow key={p.iso3} p={p} rank={rank} option={option} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-mute">
              Passport power counts every destination reachable without a pre-arranged visa (visa-free + visa on
              arrival + eTA) - compare all {TOTAL_RANKED_PASSPORTS} passports in the{" "}
              <Link
                href="/rankings"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                Earth Visa passport rankings
              </Link>
              .
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Citizenship by Investment FAQ</h2>
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

          <ProgramsNav current="/programs/citizenship-by-investment" />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              See exactly what a second passport would add
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Pick any combination of passports on Earth Visa and see the combined visa-free map - before you spend a
              cent.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Compare passports on Earth Visa →
            </Link>
          </section>
        </div>
        <ReportLine />
      </main>
    </>
  );
}
