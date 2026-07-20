import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { fmtDate } from "@/lib/format";
import RankingsTable, { type RankingRow } from "@/components/RankingsTable";
import type { AccessLevel } from "@/lib/types";

// ── Ranking computation ─────────────────────────────────────────────────────
// Score = visa-free + visa on arrival + eTA. An e-visa is still a visa
// application (just online), so it does NOT count toward the rank - the
// industry-standard treatment, and the reason the US no longer outranks
// Singapore on the strength of 40+ e-visa destinations. e-Visa access is
// listed alongside, and "total reach" (all four levels) stays as a column.
// Sort order MUST match rankOf in src/app/passport/[slug]/page.tsx and the
// ranks map in scripts/build-explorer-slices.mjs (score descending, stable
// over dataset order) so every "#N of 199" on the site agrees.
function buildRows(): RankingRow[] {
  return Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => {
      const counts: Record<AccessLevel, number> = { visa_free: 0, visa_on_arrival: 0, eta: 0, e_visa: 0 };
      for (const e of edges) counts[e.level]++;
      const name = nameFor(iso3);
      return {
        rank: 0,
        iso3,
        flag: flagFor(iso3),
        name,
        slug: nameToSlug(name),
        visaFree: counts.visa_free,
        visaOnArrival: counts.visa_on_arrival,
        eta: counts.eta,
        eVisa: counts.e_visa,
        score: counts.visa_free + counts.visa_on_arrival + counts.eta,
        total: edges.length,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const rows = buildRows();
const top10 = rows.slice(0, 10);
const bottom10 = rows.slice(-10);
const top1 = rows[0];
// Passports tied with the runner-up total (the "closely followed by" group).
const runnersUp = rows.filter((r) => r.rank > 1 && r.score === rows[1].score);
// Passports sharing the #1 total - when non-empty, the top spot is a tie and
// the copy must say so rather than crown top1 alone (rank order within a tie
// is dataset order, not a real distinction).
const tiedWithTop = rows.filter((r) => r.rank > 1 && r.score === top1.score);

/** "A", "A and B", or "A, B and C" - name lists for FAQ and intro sentences. */
function listNames(rs: RankingRow[]): string {
  const names = rs.map((r) => r.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Distinct destinations covered by the access data - computed, never assumed.
const destCount = new Set(
  Object.values(dataset.passportAccess).flatMap((edges) => edges.map((e) => e.dest)),
).size;

// High-traffic passports surfaced as quick links below the table.
const POPULAR_ISO3 = ["IND", "USA", "GBR", "PAK", "CHN", "NGA", "PHL", "DEU", "CAN", "AUS", "ARE", "BRA"];
const popular = POPULAR_ISO3.map((iso3) => rows.find((r) => r.iso3 === iso3)).filter(
  (r): r is RankingRow => r != null,
);

const TITLE = "Passport Ranking 2026: The Most Powerful Passports in the World | Earth Visa";
const DESCRIPTION = `Passport index 2026: all ${TOTAL_PASSPORTS} passports ranked by visa-free access. The strongest passport (${top1.name}) scores ${top1.score} destinations without needing a visa in advance. Full sortable ranking from official government sources.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "most powerful passport 2026",
    "strongest passport in the world",
    "passport index 2026",
    "passport ranking 2026",
    "passport ranking",
    "world passport ranking",
    "best passport in the world",
    "top 10 most powerful passports",
    "weakest passport in the world",
    "passport strength index",
    "visa free countries by passport",
    "passport power rank",
    "strongest visa in the world",
    "most powerful visa in the world",
    "which is the strongest visa",
  ],
  alternates: { canonical: "https://earthvisa.in/rankings" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/rankings",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Reusable FAQ copy - rendered on the page and mirrored into FAQPage JSON-LD.
const FAQS = [
  {
    q: "What is a passport index?",
    a: `A passport index is a ranking of the world's passports by how much visa-free travel each one allows. Each passport is scored by counting the destinations its holders can enter without arranging a visa at an embassy first - fully visa-free, with a visa on arrival, or with a lightweight eTA. The Earth Visa passport index 2026 ranks all ${TOTAL_PASSPORTS} passports this way across ${destCount} destinations; e-visa access is tracked and shown separately, but an e-visa is still a visa application, so it does not add to the score.`,
  },
  {
    q: "Which is the strongest visa in the world?",
    a: `People often say "strongest visa" when they mean the strongest passport - the document that grants the most visa-free travel. By that measure, the ${top1.name} passport${tiedWithTop.length > 0 ? ` (tied with ${listNames(tiedWithTop)})` : ""} is the strongest in the world in 2026, with ${top1.score} destinations that require no visa in advance. (A "visa" itself is a permit to enter one country; a passport's strength is what determines how many countries you can enter visa-free.)`,
  },
  {
    q: "Which passport is the strongest in the world in 2026?",
    a: `The ${top1.name} passport ranks #1 in our 2026 passport index, scoring ${top1.score}: ${top1.visaFree} destinations completely visa-free, ${top1.visaOnArrival} with a visa on arrival, and ${top1.eta} with a lightweight eTA. Its holders can also apply online for an e-visa to ${top1.eVisa} more destinations. ${
      tiedWithTop.length > 0
        ? `It shares the top spot with ${listNames(tiedWithTop)}, whose passport${tiedWithTop.length > 1 ? "s" : ""} also score${tiedWithTop.length > 1 ? "" : "s"} ${top1.score}.`
        : `It is closely followed by ${listNames(runnersUp)}, ${runnersUp.length > 1 ? "each " : ""}with a score of ${rows[1].score} destinations.`
    }`,
  },
  {
    q: "How is the passport ranking calculated?",
    a: `Earth Visa tracks four access levels for every passport: visa-free entry, visa on arrival, eTA (electronic travel authorisation), and e-visa. The ranking score counts the first three - destinations where you can travel without applying for a visa in advance. An e-visa is a real visa application, just submitted online, so e-visa destinations are listed separately and do not add to the score. Every access grant is sourced from official government publications - foreign ministry visa policy pages, immigration portals, and published bilateral agreements - rather than third-party aggregators. Passports with equal scores are listed in sequence, so adjacent ranks can share the same score.`,
  },
  {
    q: "What is the weakest passport in the world in 2026?",
    a: `The ${bottom10[9].name} passport ranks last (#${bottom10[9].rank} of ${rows.length}) in our 2026 index, with a score of ${bottom10[9].score} destinations, of which ${bottom10[9].visaFree} are visa-free. The bottom of the ranking also includes ${bottom10.slice(0, 4).map((r) => r.name).join(", ")} - passports whose holders need an embassy visa for most international trips.`,
  },
  {
    q: "Why do passport rankings differ between indexes?",
    a: `Different passport indexes use different methodologies. Some, like the Henley Passport Index, group visa-free and visa-on-arrival access into a single score; others count e-visas toward the score or draw on airline industry databases rather than government sources. Earth Visa scores visa-free + visa on arrival + eTA (e-visas shown separately, never counted), across ${destCount} destinations. The exact rank of a passport can therefore differ by a few places between indexes, but the overall picture - which passports are strongest and weakest - is broadly consistent.`,
  },
];

// Ledger-row vocabulary (spec §12): compact rows inside a document card.
// Ten-row lists run column-major on sm+ (ranks 1-5 left, 6-10 right), so the
// nth-child(6) reset clears the top hairline of the second column's first row.
const LEDGER_COL_OL = "card-doc mt-5 grid px-4 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-x-8 sm:px-5";
const LEDGER_COL_LI = "border-t border-line first:border-t-0 sm:[&:nth-child(6)]:border-t-0";
const LEDGER_GRID_UL = "card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3";
const LEDGER_ROW_LI =
  "border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";

export default function RankingsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Passport Ranking 2026", item: "https://earthvisa.in/rankings" },
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
        name: "Most Powerful Passports in the World 2026",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: top10.length,
        itemListElement: top10.map((r) => ({
          "@type": "ListItem",
          position: r.rank,
          name: `${r.name} passport`,
          url: `https://earthvisa.in/passport/${r.slug}`,
        })),
      },
      {
        "@type": "Dataset",
        name: "Global Passport Ranking 2026",
        description: `All ${rows.length} passports ranked by visa-free, visa-on-arrival, eTA and e-visa access across ${destCount} destinations`,
        url: "https://earthvisa.in/rankings",
        creator: { "@type": "Organization", name: "Earth Visa" },
        temporalCoverage: "2026",
        variableMeasured: "Total destinations accessible without a pre-arranged embassy visa",
        measurementTechnique: "Official government visa policy publications",
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Rankings</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                Passport Ranking 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  The Most Powerful Passports in the World
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                All {rows.length} passports ranked · official sources only
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Passports ranked", v: String(rows.length) },
                { k: "Destinations tracked", v: String(destCount) },
                { k: "#1 score", v: String(top1.score) },
                { k: "Data updated", v: fmtDate(dataset.meta.lastUpdated) },
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

          {/* Intro - target queries answered up front */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              The <strong className="text-ink">most powerful passport in 2026</strong> is the{" "}
              <Link href={`/passport/${top1.slug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                {top1.name} passport
              </Link>
              {tiedWithTop.length > 0 && <> (tied with {listNames(tiedWithTop)})</>}
              , scoring <strong className="text-ink">{top1.score} destinations</strong> with no visa needed in advance -{" "}
              {top1.visaFree} visa-free, {top1.visaOnArrival} visa on arrival, and {top1.eta} with an eTA. e-Visas
              ({top1.eVisa} more for the leader) are listed but never counted: an e-visa is still a visa.
            </p>
            <p className="text-body mt-4 text-ink-soft">
              We score visa-free + visa on arrival + eTA, list e-visa access separately, and use official government sources only - see
              the <a href="#methodology" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">methodology</a> below.
              Reach is one axis; the other is cost - see{" "}
              <Link href="/rankings/visa-fees" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                the real cost of a tourist visa
              </Link>
              , the same destinations ranked by their official published fee.
            </p>
          </section>

          {/* Top 10 - the "most powerful passport" answer */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Top 10 Most Powerful Passports in 2026
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Ranked by score: visa-free destinations plus visa on arrival and eTA. e-Visa counts are shown alongside but do not affect the rank. Tap any passport for its full destination list.
            </p>
            <ol className={LEDGER_COL_OL}>
              {top10.map((r) => (
                <li key={r.iso3} className={LEDGER_COL_LI}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[52px] items-center gap-3 py-2 transition hover:bg-paper-2/50"
                  >
                    <span className="mono w-9 shrink-0 text-[13px] font-semibold tabular-nums text-stamp">#{r.rank}</span>
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{r.name}</span>
                      <span className="mono block text-[11px] text-ink-mute">
                        {r.visaFree} visa-free · {r.visaOnArrival} VoA · {r.eta} eTA · {r.eVisa} e-Visa
                      </span>
                    </span>
                    <span className="mono ml-auto shrink-0 text-lg font-semibold tabular-nums text-ink">
                      {r.score}
                      <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.1em] text-ink-mute">score</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Full sortable table */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Full Passport Index 2026: All {rows.length} Passports Ranked
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Click a column header to sort, or filter by country name. Every passport links to its full visa-free country list.
            </p>
            <div className="mt-5">
              <RankingsTable rows={rows} />
            </div>
          </section>

          {/* Bottom 10 - "weakest passport" query */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              The 10 Weakest Passports in the World 2026
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              At the other end of the ranking, holders of these passports need an embassy visa for most international trips.
              A weak passport does not mean no options: visa-on-arrival and e-visa destinations still exist for every passport
              on this list, and holding credentials like a valid US or Schengen visa can unlock additional destinations.
            </p>
            <ol className={LEDGER_COL_OL}>
              {bottom10.map((r) => (
                <li key={r.iso3} className={LEDGER_COL_LI}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-3 py-1 transition hover:bg-paper-2/50"
                  >
                    <span className="mono w-9 shrink-0 text-[13px] tabular-nums text-ink-mute">#{r.rank}</span>
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{r.name}</span>
                    <span className="mono ml-auto shrink-0 text-sm tabular-nums text-ink-soft">
                      {r.score}
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-mute">score</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Methodology */}
          <section id="methodology" className="mt-14 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">
              How This Passport Ranking Is Calculated
            </h2>
            <p className="text-body mt-3 text-ink-soft">
              Earth Visa builds its passport index from <strong className="text-ink">official government sources only</strong>:
              each destination country&apos;s own published visa policy - foreign ministry pages, immigration and border authority
              portals, and bilateral agreements - inverted into per-passport access lists. For every passport we count four
              access levels across {destCount} destinations:
            </p>
            <ul className="text-body mt-4 space-y-2 text-ink-soft">
              <li><strong className="text-vfree">Visa-free</strong> - entry with just the passport; no application, no fee.</li>
              <li><strong className="text-voa">Visa on arrival</strong> - a visa stamped at the border on landing.</li>
              <li><strong className="text-eta">eTA</strong> - an electronic travel authorisation approved online before departure.</li>
              <li><strong className="text-evisa">e-Visa</strong> - a full visa applied for and issued online, no embassy visit.</li>
            </ul>
            <p className="text-body mt-4 text-ink-soft">
              The ranking <strong className="text-ink">score counts the first three</strong> - visa-free, visa on arrival, and
              eTA - the destinations you can head to without applying for a visa first. An e-visa is a real visa application,
              just submitted online, so e-visa destinations are listed in their own column and never counted toward the score.
              <strong className="text-ink"> Total reach</strong> (all four levels) is shown alongside. Passports with equal
              scores are listed in sequence, so adjacent ranks can share the same score.
            </p>
          </section>

          {/* Popular passport quick links */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Look Up a Popular Passport
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Jump straight to the full visa-free country list and 2026 rank for these frequently checked passports.
            </p>
            <ul className={LEDGER_GRID_UL}>
              {popular.map((r) => (
                <li key={r.iso3} className={LEDGER_ROW_LI}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5 py-1 transition hover:bg-paper-2/50"
                  >
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                      {r.name} passport
                    </span>
                    <span className="mono-chrome shrink-0 tabular-nums">#{r.rank}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Passport Ranking 2026 FAQ
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

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Where does your passport rank?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Enter your passport to see its exact rank, every visa-free destination, and what a second passport or a held visa could unlock.
            </p>
            <Link
              href="/"
              className="btn-stamp mt-5"
            >
              Check your passport on Earth Visa →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
