import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { fmtDate } from "@/lib/format";
import RankingsTable, { type RankingRow } from "@/components/RankingsTable";
import type { AccessLevel } from "@/lib/types";
import ReportLine from "@/components/ReportLine";

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

// v2 ledger list (corridor idiom): hairline-divided rows - rank (tabular,
// muted), flag, name (bold ink), 13px four-way breakdown in the data-category
// hues, score (bold ink) with a quiet label.
function LedgerList({ list }: { list: RankingRow[] }) {
  return (
    <ol className="mt-5 max-w-3xl divide-y divide-hair border-y border-hair">
      {list.map((r) => (
        <li key={r.iso3}>
          <Link href={`/passport/${r.slug}`} className="group flex min-h-[56px] items-center gap-3 py-2.5">
            <span className="w-9 shrink-0 text-right text-[13px] font-medium tabular-nums text-ink-3">#{r.rank}</span>
            <span aria-hidden="true" className="text-lg leading-none">{r.flag}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink transition group-hover:text-accent">{r.name}</span>
              <span className="block text-[13px] font-medium tabular-nums text-ink-3">
                <span className="whitespace-nowrap text-verdict">{r.visaFree} visa-free</span>
                {" · "}
                <span className="whitespace-nowrap text-voa">{r.visaOnArrival} VoA</span>
                {" · "}
                <span className="whitespace-nowrap text-online">{r.eta} eTA</span>
                {" · "}
                <span className="whitespace-nowrap text-online">{r.eVisa} e-Visa</span>
              </span>
            </span>
            <span className="ml-auto shrink-0 text-right">
              <span className="block text-[17px] font-bold leading-tight tabular-nums text-ink">{r.score}</span>
              <span className="block text-[11px] font-medium leading-tight text-ink-3">score</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

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
        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Header */}
          <header>
            <nav aria-label="Breadcrumb" className="pt-6 text-[13px] font-medium text-ink-2">
              <ol className="flex flex-wrap items-center gap-x-2">
                <li><Link href="/" className="inline-flex min-h-[24px] items-center transition hover:text-ink">Earth Visa</Link></li>
                <li aria-hidden="true" className="text-ink-3">/</li>
                <li aria-current="page" className="font-semibold text-ink">Rankings</li>
              </ol>
            </nav>

            <div className="mt-8">
              <h1 className="max-w-3xl text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
                Passport Ranking 2026
                <span className="mt-3 block text-[18px] font-semibold leading-snug tracking-normal text-ink-2 sm:text-[21px]">
                  The Most Powerful Passports in the World
                </span>
              </h1>
              <p className="mt-4 text-[13px] font-medium tabular-nums text-ink-3">
                All {rows.length} passports ranked · official sources only
              </p>
            </div>

            {/* Stat band (corridor FactStrip idiom) */}
            <section aria-label="Ranking facts" className="mt-9 border-t border-hair">
              <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4">
                {[
                  { k: "Passports ranked", v: String(rows.length) },
                  { k: "Destinations tracked", v: String(destCount) },
                  { k: "#1 score", v: String(top1.score) },
                ].map(({ k, v }) => (
                  <div key={k} className="min-w-0 pr-4 pt-6 sm:border-l sm:border-hair sm:pl-7 sm:first:border-l-0 sm:first:pl-0">
                    <p className="stat-num text-[clamp(38px,4.2vw,60px)] text-ink">{v}</p>
                    <p className="stat-label mt-2">{k}</p>
                  </div>
                ))}
                <div className="min-w-0 pr-4 pt-6 sm:border-l sm:border-hair sm:pl-7">
                  <p className="stat-num flex min-h-[clamp(38px,4.2vw,60px)] items-end text-[clamp(23px,2vw,29px)] text-ink">
                    {fmtDate(dataset.meta.lastUpdated)}
                  </p>
                  <p className="stat-label mt-2">Data updated</p>
                </div>
              </div>
            </section>
          </header>

          {/* Intro - target queries answered up front */}
          <section className="mt-10 max-w-3xl">
            <p className="text-[15px] leading-relaxed text-ink-2">
              The <strong className="font-semibold text-ink">most powerful passport in 2026</strong> is the{" "}
              <Link href={`/passport/${top1.slug}`} className="font-semibold text-accent underline-offset-2 transition hover:underline">
                {top1.name} passport
              </Link>
              {tiedWithTop.length > 0 && <> (tied with {listNames(tiedWithTop)})</>}
              , scoring <strong className="font-semibold text-ink">{top1.score} destinations</strong> with no visa needed in advance -{" "}
              {top1.visaFree} visa-free, {top1.visaOnArrival} visa on arrival, and {top1.eta} with an eTA. e-Visas
              ({top1.eVisa} more for the leader) are listed but never counted: an e-visa is still a visa.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              We score visa-free + visa on arrival + eTA, list e-visa access separately, and use official government sources only - see
              the <a href="#methodology" className="font-semibold text-accent underline-offset-2 transition hover:underline">methodology</a> below.
              Reach is one axis; the other is cost - see{" "}
              <Link href="/rankings/visa-fees" className="font-semibold text-accent underline-offset-2 transition hover:underline">
                the real cost of a tourist visa
              </Link>
              , the same destinations ranked by their official published fee.
            </p>
          </section>

          {/* Top 10 - the "most powerful passport" answer */}
          <section className="mt-12">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              Top 10 Most Powerful Passports in 2026
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">
              Ranked by score: visa-free destinations plus visa on arrival and eTA. e-Visa counts are shown alongside but do not affect the rank. Tap any passport for its full destination list.
            </p>
            <LedgerList list={top10} />
          </section>

          {/* Full sortable table */}
          <section className="mt-14">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              Full Passport Index 2026: All {rows.length} Passports Ranked
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">
              Click a column header to sort, or filter by country name. Every passport links to its full visa-free country list.
            </p>
            <div className="mt-5">
              <RankingsTable rows={rows} />
            </div>
          </section>

          {/* Bottom 10 - "weakest passport" query */}
          <section className="mt-14">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              The 10 Weakest Passports in the World 2026
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">
              At the other end of the ranking, holders of these passports need an embassy visa for most international trips.
              A weak passport does not mean no options: visa-on-arrival and e-visa destinations still exist for every passport
              on this list, and holding credentials like a valid US or Schengen visa can unlock additional destinations.
            </p>
            <LedgerList list={bottom10} />
          </section>

          {/* Methodology */}
          <section id="methodology" className="mt-14 max-w-3xl scroll-mt-24">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              How This Passport Ranking Is Calculated
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Earth Visa builds its passport index from <strong className="font-semibold text-ink">official government sources only</strong>:
              each destination country&apos;s own published visa policy - foreign ministry pages, immigration and border authority
              portals, and bilateral agreements - inverted into per-passport access lists across {destCount} destinations, rather
              than pulled from a third-party aggregator or airline database.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              Passports with equal scores are listed in sequence, so adjacent ranks can share the same score. The dataset was
              last refreshed <strong className="font-semibold tabular-nums text-ink">{fmtDate(dataset.meta.lastUpdated)}</strong>.
            </p>
          </section>

          {/* Popular passport quick links */}
          <section className="mt-14">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              Look Up a Popular Passport
            </h2>
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">
              Jump straight to the full visa-free country list and 2026 rank for these frequently checked passports.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {popular.map((r) => (
                <li key={r.iso3}>
                  <Link href={`/passport/${r.slug}`} className="chip">
                    <span aria-hidden="true" className="text-base leading-none">{r.flag}</span>
                    {r.name} passport
                    <span className="tabular-nums text-ink-3">#{r.rank}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              Passport Ranking 2026 FAQ
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

          {/* CTA */}
          <section className="mt-16 border-t border-hair pt-10 text-center">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">
              Where does your passport rank?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Enter your passport to see its exact rank, every visa-free destination, and what a second passport or a held visa could unlock.
            </p>
            <Link
              href="/"
              className="btn-stamp mt-6"
            >
              Check your passport on Earth Visa →
            </Link>
          </section>

        </div>
        <ReportLine />
      </main>
    </>
  );
}
