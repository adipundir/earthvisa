import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import {
  cbiMinUsd,
  isAnnouncedOnly,
  isClosedProgram,
  passportWorth,
  TOTAL_RANKED_PASSPORTS,
} from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { CbiProgram, RbiProgram } from "@/lib/types";

// ---------------------------------------------------------------------------
// Data (all derived from dataset.cbi / dataset.rbi / dataset.fastTrack)
// ---------------------------------------------------------------------------

const lastUpdated = dataset.meta.lastUpdated;

// Route 1: citizenship by investment, cheapest USD-priced first, others after.
const cbiPriced = dataset.cbi
  .map((p) => ({ p, min: cbiMinUsd(p) }))
  .filter((x): x is { p: CbiProgram; min: number } => x.min != null)
  .sort((a, b) => a.min - b.min);
const cbiUnpriced = dataset.cbi
  .filter((p) => cbiMinUsd(p) == null)
  .sort((a, b) => a.name.localeCompare(b.name));

// Route 2: shortest published residence-to-citizenship path per country, from rbi.
// Programs the dataset itself marks as closed or abolished are not live paths - skip them.
const shortestPathByCountry = new Map<string, RbiProgram>();
for (const r of dataset.rbi) {
  if (r.path_to_citizenship_years == null || isClosedProgram(r)) continue;
  const cur = shortestPathByCountry.get(r.iso3);
  if (!cur || r.path_to_citizenship_years < (cur.path_to_citizenship_years as number)) {
    shortestPathByCountry.set(r.iso3, r);
  }
}
const pathRows = [...shortestPathByCountry.values()].sort(
  (a, b) =>
    (a.path_to_citizenship_years as number) - (b.path_to_citizenship_years as number) ||
    a.name.localeCompare(b.name),
);
const PATH_PREVIEW = 15;
const fastestPathYears = pathRows[0].path_to_citizenship_years as number;
const fastestPathNames = pathRows
  .filter((r) => r.path_to_citizenship_years === fastestPathYears)
  .map((r) => r.name);
const within3yrs = pathRows.filter((r) => (r.path_to_citizenship_years as number) <= 3);

// Route 3: fast-track naturalisation programs from the fast-track dataset.
const ftCitizenship = dataset.fastTrack.filter((f) => /citizenship|naturalis/i.test(f.category) || /naturalis/i.test(f.program_name));

// CBI programs with a concrete published timeline, for prose and FAQ.
const timedCbi = dataset.cbi
  .filter((p) => /day|month|week/i.test(p.processing_time) && p.processing_time.length <= 90)
  .slice(0, 3);
const timedCbiText = timedCbi.map((p) => `${p.name}: ${p.processing_time}`).join("; ");

// Europe angles, from data only.
const europeCbi = dataset.cbi.filter((p) => p.region === "Europe");
const europeFastestPaths = pathRows.filter((r) => r.region === "Europe").slice(0, 4);

// Passport worth range across CBI countries.
const cbiWorth = dataset.cbi
  .map((p) => ({ p, w: passportWorth(p.iso3) }))
  .filter((x): x is { p: CbiProgram; w: NonNullable<ReturnType<typeof passportWorth>> } => x.w != null)
  .sort((a, b) => b.w.visaFree - a.w.visaFree);

// The five Caribbean CBI jurisdictions, for the passport-worth comparison.
const caribbeanWorth = cbiWorth.filter((x) => ["KNA", "ATG", "DMA", "GRD", "LCA"].includes(x.p.iso3));

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = "Easiest Country to Get Citizenship 2026: Fastest Legal Routes Ranked by Data";
const description = `Easiest countries to get citizenship in 2026, from the data: ${dataset.cbi.length} citizenship by investment programs (months, not years), countries with published ${fastestPathYears}-year residence-to-citizenship paths, and fast-track naturalisation routes. Official sources only.`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "easiest country to get citizenship",
    "easiest citizenship",
    "easiest citizenship to get 2026",
    "fastest citizenship",
    "fastest way to get second citizenship",
    "citizenship after 2 years",
    "easiest second passport",
    "quickest citizenship by investment",
    "easiest european citizenship",
    "shortest naturalization time",
  ],
  alternates: { canonical: "https://earthvisa.in/programs/easiest-citizenship" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/easiest-citizenship",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is the easiest country to get citizenship?",
    a: `It depends on whether you are spending money or time. The fastest legal route is citizenship by investment - the ${dataset.cbi.length} programs in our data are measured in months, not years (for example ${timedCbiText}). If you are naturalising through residence, the shortest published residence-to-citizenship paths in our dataset are ${fastestPathYears} years, in ${fastestPathNames.join(", ")}. Published timelines are eligibility minimums, not guarantees - language, presence and character requirements typically apply.`,
  },
  {
    q: "Which country gives citizenship fastest?",
    a: `Through investment: published processing times in our data include ${timedCbiText}. Through residence: ${fastestPathNames.join(", ")} publish ${fastestPathYears}-year residence-to-citizenship paths per program sources in our dataset. Actual grants remain discretionary everywhere.`,
  },
  {
    q: "What is the cheapest way to get a second citizenship?",
    a: `The lowest USD-denominated published minimum among citizenship by investment programs in our data is ${fmtMoney(cbiPriced[0].min, "USD")} (${cbiPriced[0].p.name})${isAnnouncedOnly(cbiPriced[0].p) ? ", though our source notes flag that program as announced but not yet enacted" : ""}, followed by ${fmtMoney(cbiPriced[1].min, "USD")} (${cbiPriced[1].p.name}) and ${fmtMoney(cbiPriced[2].min, "USD")} (${cbiPriced[2].p.name}). Residence routes are cheaper upfront but take years. See our full citizenship by investment comparison.`,
  },
  {
    q: "Which countries offer citizenship after 2 or 3 years?",
    a: `Per published program data in our dataset, ${within3yrs.length} countries carry a residence route with a ${fastestPathYears}-to-3-year path to citizenship eligibility: ${within3yrs.map((r) => `${r.name} (${r.path_to_citizenship_years} yrs)`).join(", ")}. These are statutory minimums before you can apply - naturalisation itself adds conditions and processing time.`,
  },
  {
    q: "What is the easiest European citizenship?",
    a: `Within Europe, our data records ${europeCbi.length} citizenship by investment routes: ${europeCbi.map((p) => p.name).join(" and ")}. ${europeCbi.map((p) => `${p.name}'s route: ${p.options.some((o) => o.min_amount != null) ? `published minimums from ${fmtMoney(Math.min(...p.options.filter((o) => o.min_amount != null).map((o) => o.min_amount as number)), p.options.find((o) => o.min_amount != null)?.currency ?? "USD")}` : "no published investment schedule (discretionary)"}`).join(". ")}. For residence-based naturalisation, the shortest published European paths in our data are ${europeFastestPaths.map((r) => `${r.name} (${r.path_to_citizenship_years} yrs)`).join(", ")}.`,
  },
  {
    q: "Is an easy citizenship worth it? What is the passport worth?",
    a: `Among citizenship by investment countries in our data, passport strength ranges from ${cbiWorth[cbiWorth.length - 1].w.visaFree} to ${cbiWorth[0].w.visaFree} visa-free destinations. The strongest is ${cbiWorth[0].p.name} (${cbiWorth[0].w.visaFree} visa-free, ranked #${cbiWorth[0].w.rank} of ${TOTAL_RANKED_PASSPORTS})${caribbeanWorth.length > 0 ? `; the five Caribbean programs range from ${Math.min(...caribbeanWorth.map((x) => x.w.visaFree))} to ${Math.max(...caribbeanWorth.map((x) => x.w.visaFree))} visa-free destinations` : ""}. Check any passport on the Earth Visa rankings before you commit.`,
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
          name: "Easiest Citizenship",
          item: "https://earthvisa.in/programs/easiest-citizenship",
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

/** shared column widths so the preview table and the expanded continuation table stay aligned */
function PathCols() {
  return (
    <colgroup>
      <col className="w-[72px]" />
      <col className="w-[200px]" />
      <col />
      <col className="w-[140px]" />
    </colgroup>
  );
}

function PathRow({ r }: { r: RbiProgram }) {
  const w = passportWorth(r.iso3);
  return (
    <tr className="border-b border-line">
      <td className="mono py-2 pr-4 text-right tabular-nums text-ink">{r.path_to_citizenship_years} yrs</td>
      <td className="py-2 pr-4">
        <Link
          href={`/passport/${nameToSlug(r.name)}`}
          className="inline-flex min-h-[44px] items-center gap-2.5 font-display font-medium text-ink transition hover:text-stamp"
        >
          <span className="text-lg">{flagFor(r.iso3)}</span>
          {r.name}
        </Link>
      </td>
      <td className="py-2 pr-4 text-[13px] italic text-ink-soft">
        {r.program_name}
        {r.iso3 === "ARG" && (
          <>
            {" "}
            <Link href="/guide/argentina-citizenship" className="not-italic font-medium text-stamp underline-offset-2 hover:underline">
              Full guide →
            </Link>
          </>
        )}
      </td>
      <td className="mono py-2 text-right tabular-nums text-ink-soft">{w ? `${w.visaFree} visa-free` : "-"}</td>
    </tr>
  );
}

export default function EasiestCitizenshipPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Programs</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Easiest Citizenship</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Easiest Country to Get Citizenship 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                The Fastest Legal Routes, Ranked from the Data
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              3 legal routes compared · official publications · data refreshed {lastUpdated}
            </p>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "CBI programs (months)", v: String(dataset.cbi.length) },
                { k: "Shortest residence path", v: `${fastestPathYears} yrs` },
                { k: "Countries with path data", v: String(pathRows.length) },
                {
                  k: "Cheapest CBI minimum",
                  v: `${fmtMoney(cbiPriced[0].min, "USD")}${isAnnouncedOnly(cbiPriced[0].p) ? " (announced)" : ""}`,
                },
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
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              &quot;Easiest&quot; means different things depending on what you are spending.{" "}
              <strong className="text-ink">Money:</strong> citizenship by investment grants a passport in months.{" "}
              <strong className="text-ink">Time:</strong> some countries publish residence-to-citizenship paths short
              enough to plan around. <strong className="text-ink">Merit:</strong> a handful of fast-track
              naturalisation routes reward specific skills or contributions. Where a number is not published, we say
              so instead of inventing one.
            </p>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Published timelines are eligibility minimums, not guarantees. Naturalisation everywhere adds language,
              physical presence and good-character conditions, and grants remain discretionary.
            </p>
          </section>

          {/* Route 1: CBI */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Route 1 - Citizenship by Investment: Months, Not Years
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              The fastest legal route to a second passport, sorted by lowest published USD minimum; each entry shows
              what the passport is worth.
            </p>
            <div className="mono mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
              <span className="mono-chrome">
                Fastest published processing
              </span>
              {timedCbi.map((p) => (
                <span
                  key={p.iso3}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-paper-2/70 px-2.5 py-1"
                >
                  <span className="text-sm">{flagFor(p.iso3)}</span>
                  {p.name} · <strong className="text-ink">{p.processing_time}</strong>
                </span>
              ))}
            </div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {cbiPriced.map(({ p, min }) => {
                const w = passportWorth(p.iso3);
                return (
                  <Link
                    key={p.iso3}
                    href={`/passport/${nameToSlug(p.name)}`}
                    className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
                  >
                    <span className="text-xl">{flagFor(p.iso3)}</span>
                    <div className="min-w-0">
                      <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                        {p.name}
                      </span>
                      <div className="mono text-[11px] text-ink-mute">
                        from {fmtMoney(min, "USD")}
                        {isAnnouncedOnly(p) ? " · announced" : ""}
                      </div>
                    </div>
                    {w && (
                      <span className="mono ml-auto rounded-[3px] bg-vfree/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-vfree ring-1 ring-vfree/30">
                        {w.visaFree} visa-free
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            {cbiUnpriced.length > 0 && (
              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-mute">
                Also tracked, without a USD-published minimum (priced in other currencies or discretionary):{" "}
                {cbiUnpriced.map((p) => p.name).join(", ")}.
              </p>
            )}
            <p className="text-body mt-4 max-w-3xl text-ink-soft">
              Full comparison with every investment option and processing time:{" "}
              <Link
                href="/programs/citizenship-by-investment"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                Citizenship by Investment 2026 →
              </Link>
            </p>
          </section>

          {/* Route 2: shortest residence paths */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Route 2 - Shortest Published Residence-to-Citizenship Paths
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              {pathRows.length} countries in our residency dataset publish a residence-to-citizenship timeline for at
              least one program. The shortest per country, ranked:
            </p>
            <p className="mono-chrome mt-5 sm:hidden">
              Scroll sideways for all columns →
            </p>
            <div className="mt-1.5 overflow-x-auto sm:mt-5">
              <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
                <PathCols />
                <thead>
                  <tr className="mono-chrome border-b border-line-strong text-left">
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">Path</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Country</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Program (shortest route)</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Passport worth</th>
                  </tr>
                </thead>
                <tbody>
                  {pathRows.slice(0, PATH_PREVIEW).map((r) => (
                    <PathRow key={r.iso3} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
            {pathRows.length > PATH_PREVIEW && (
              <details className="group mt-2.5">
                <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show all {pathRows.length} countries</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                  <Chevron />
                </summary>
                <div className="mt-2.5 overflow-x-auto">
                  <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
                    <PathCols />
                    <tbody>
                      {pathRows.slice(PATH_PREVIEW).map((r) => (
                        <PathRow key={r.iso3} r={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-mute">
              Years shown are the published minimum residence before naturalisation eligibility for that program, per
              the official sources in our dataset. Programs our sources record as closed or abolished are excluded.
              Language, physical-presence and character requirements apply on top, and approval is discretionary.
            </p>
          </section>

          {/* Route 3: fast-track naturalisation */}
          {ftCitizenship.length > 0 && (
            <section className="mt-12">
              <h2 className="text-section text-ink">
                Route 3 - Fast-Track Naturalisation for Skills &amp; Contributions
              </h2>
              <p className="text-body mt-2 max-w-3xl text-ink-soft">
                {ftCitizenship.length === 1
                  ? "Accelerated naturalisation for specific profiles is rare - one route in our fast-track dataset currently qualifies:"
                  : "A small number of countries run accelerated naturalisation for specific profiles. From our fast-track dataset:"}
              </p>
              <div className={ftCitizenship.length === 1 ? "mt-5 max-w-xl" : "mt-5 grid gap-3 sm:grid-cols-2"}>
                {ftCitizenship.map((f) => (
                  <article key={`${f.iso3}-${f.program_name}`} className="card-doc p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{flagFor(f.iso3)}</span>
                      <Link
                        href={`/passport/${nameToSlug(f.name)}`}
                        className="inline-flex min-h-[44px] items-center font-display font-semibold text-ink transition hover:text-stamp"
                      >
                        {f.name}
                      </Link>
                    </div>
                    <p className="mt-1 text-sm italic leading-snug text-ink-soft">{f.program_name}</p>
                    {f.eligibility && (
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{f.eligibility}</p>
                    )}
                    {f.processing_time && (
                      <p className="mono mt-2 text-[11px] text-ink-mute">Processing: {f.processing_time}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Worth */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Easy to Get vs Worth Having: Passport Power Check
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              An easy citizenship is only a good deal if the passport delivers. Among CBI countries in our data,
              visa-free access ranges from{" "}
              <strong className="text-ink">{cbiWorth[cbiWorth.length - 1].w.visaFree}</strong> destinations (
              <Link
                href={`/passport/${nameToSlug(cbiWorth[cbiWorth.length - 1].p.name)}`}
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                {cbiWorth[cbiWorth.length - 1].p.name}
              </Link>
              ) to <strong className="text-ink">{cbiWorth[0].w.visaFree}</strong> (
              <Link
                href={`/passport/${nameToSlug(cbiWorth[0].p.name)}`}
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                {cbiWorth[0].p.name}
              </Link>
              , ranked #{cbiWorth[0].w.rank} of {TOTAL_RANKED_PASSPORTS}). Before committing to any route, compare the
              target passport on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink">
                Earth Visa passport rankings
              </Link>{" "}
              and browse its full visa-free list on its passport page.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Easiest Citizenship FAQ</h2>
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

          <ProgramsNav current="/programs/easiest-citizenship" />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Compare before you commit
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Select any passport on Earth Visa and see its full visa-free map, sourced from official government
              publications.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Open the passport tool →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
