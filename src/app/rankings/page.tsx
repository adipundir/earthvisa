import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { fmtDate } from "@/lib/format";
import RankingsTable, { type RankingRow } from "@/components/RankingsTable";
import type { AccessLevel } from "@/lib/types";

// ── Ranking computation ─────────────────────────────────────────────────────
// Every passport ranked by total reach (visa-free + VoA + eTA + e-visa).
// Sort order matches the rankOf map used on /passport/[slug] pages exactly
// (total reach descending, stable over dataset order) so the rank shown here
// agrees with the "#N of 199" stamped on each passport page.
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
        eta: counts.eta + counts.e_visa,
        total: edges.length,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const rows = buildRows();
const top10 = rows.slice(0, 10);
const bottom10 = rows.slice(-10);
const top1 = rows[0];
// Passports tied with the runner-up total (the "closely followed by" group).
const runnersUp = rows.filter((r) => r.rank > 1 && r.total === rows[1].total);
// Passports sharing the #1 total - when non-empty, the top spot is a tie and
// the copy must say so rather than crown top1 alone (rank order within a tie
// is dataset order, not a real distinction).
const tiedWithTop = rows.filter((r) => r.rank > 1 && r.total === top1.total);

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
const DESCRIPTION = `Passport index 2026: all ${TOTAL_PASSPORTS} passports ranked by visa-free access. The strongest passport (${top1.name}) reaches ${top1.total} destinations. Full sortable ranking from official government sources.`;

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
    a: `A passport index is a ranking of the world's passports by how much visa-free travel each one allows. Each passport is scored by counting the destinations its holders can enter without arranging a visa at an embassy first - whether fully visa-free, with a visa on arrival, or with an electronic authorisation (eTA or e-visa). The Earth Visa passport index 2026 ranks all ${TOTAL_PASSPORTS} passports by total reach across ${destCount} destinations, using official government sources only.`,
  },
  {
    q: "Which is the strongest visa in the world?",
    a: `People often say "strongest visa" when they mean the strongest passport - the document that grants the most visa-free travel. By that measure, the ${top1.name} passport${tiedWithTop.length > 0 ? ` (tied with ${listNames(tiedWithTop)})` : ""} is the strongest in the world in 2026, reaching ${top1.total} destinations without a pre-arranged embassy visa. (A "visa" itself is a permit to enter one country; a passport's strength is what determines how many countries you can enter visa-free.)`,
  },
  {
    q: "Which passport is the strongest in the world in 2026?",
    a: `The ${top1.name} passport ranks #1 in our 2026 passport index with a total reach of ${top1.total} destinations: ${top1.visaFree} visa-free, ${top1.visaOnArrival} visa on arrival, and ${top1.eta} via eTA or e-visa. ${
      tiedWithTop.length > 0
        ? `It shares the top spot with ${listNames(tiedWithTop)}, whose passport${tiedWithTop.length > 1 ? "s" : ""} also reach${tiedWithTop.length > 1 ? "" : "es"} ${top1.total} destinations.`
        : `It is closely followed by ${listNames(runnersUp)}, ${runnersUp.length > 1 ? "each " : ""}with a total reach of ${rows[1].total} destinations.`
    }`,
  },
  {
    q: "How is the passport ranking calculated?",
    a: `Earth Visa counts four access levels for every passport: visa-free entry, visa on arrival, eTA (electronic travel authorisation), and e-visa. A passport's total reach is the number of distinct destinations it can access through any of these levels, measured across ${destCount} destinations. Every access grant is sourced from official government publications - foreign ministry visa policy pages, immigration portals, and published bilateral agreements - rather than third-party aggregators. Passports with equal totals are listed in sequence, so adjacent ranks can share the same reach.`,
  },
  {
    q: `How many countries can the #1 passport visit?`,
    a: `The #1 ranked ${top1.name} passport can access ${top1.total} destinations in 2026 without a pre-arranged embassy visa: ${top1.visaFree} countries completely visa-free, ${top1.visaOnArrival} with a visa on arrival, and ${top1.eta} with an eTA or e-visa obtained online before travel.`,
  },
  {
    q: "What is the weakest passport in the world in 2026?",
    a: `The ${bottom10[9].name} passport ranks last (#${bottom10[9].rank} of ${rows.length}) in our 2026 index, with a total reach of ${bottom10[9].total} destinations, of which ${bottom10[9].visaFree} are visa-free. The bottom of the ranking also includes ${bottom10.slice(0, 4).map((r) => r.name).join(", ")} - passports whose holders need an embassy visa for most international trips.`,
  },
  {
    q: "Why do passport rankings differ between indexes?",
    a: `Different passport indexes use different methodologies. Some, like the Henley Passport Index, group visa-free and visa-on-arrival access into a single score; others weight e-visas differently or draw on airline industry databases rather than government sources. Earth Visa counts visa-free, visa on arrival, eTA, and e-visa access separately, across ${destCount} destinations, and takes every grant from official government publications. The exact rank of a passport can therefore differ by a few places between indexes, but the overall picture - which passports are strongest and weakest - is broadly consistent.`,
  },
];

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
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            {/* Breadcrumb */}
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Rankings</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
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
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Passports ranked", v: String(rows.length) },
                { k: "Destinations tracked", v: String(destCount) },
                { k: "#1 total reach", v: String(top1.total) },
                { k: "Data updated", v: fmtDate(dataset.meta.lastUpdated) },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro - target queries answered up front */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              The <strong className="text-ink">most powerful passport in 2026</strong> is the{" "}
              <Link href={`/passport/${top1.slug}`} className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                {top1.name} passport
              </Link>
              {tiedWithTop.length > 0 && <> (tied with {listNames(tiedWithTop)})</>}
              , with a total reach of <strong className="text-ink">{top1.total} destinations</strong> -{" "}
              {top1.visaFree} visa-free, {top1.visaOnArrival} visa on arrival, and {top1.eta} via eTA or e-visa.
              This passport index 2026 ranks all <strong className="text-ink">{rows.length} passports</strong> in the world by how far
              they travel without a pre-arranged embassy visa, across {destCount} destinations.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              What makes the <strong className="text-ink">strongest passport in the world</strong> strong is simple: the number of
              countries its holders can enter visa-free, with a visa stamped on arrival, or with an electronic authorisation
              applied for online. Our passport ranking 2026 counts each of those access levels separately, and every grant comes
              from <strong className="text-ink">official government sources</strong> - foreign ministry visa policy pages, immigration
              portals, and published bilateral agreements. Rankings differ slightly between indexes (Henley and others) because
              methodologies differ; ours is explained in the <a href="#methodology" className="font-medium text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">methodology</a> below.
            </p>
          </section>

          {/* Top 10 - the "most powerful passport" answer */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Top 10 Most Powerful Passports in 2026
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Ranked by total reach: visa-free destinations plus visa on arrival, eTA and e-visa access. Tap any passport for its full destination list.
            </p>
            <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {top10.map((r) => (
                <li key={r.iso3}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] flex-col rounded-sm border border-line bg-paper-2/70 px-3.5 py-3 transition hover:border-line-strong"
                  >
                    <span className="mono text-[11px] font-medium uppercase tracking-[0.18em] text-stamp">#{r.rank}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="text-2xl">{r.flag}</span>
                      <span className="font-display text-sm font-semibold text-ink transition group-hover:text-stamp">{r.name}</span>
                    </span>
                    <span className="mono mt-2 text-lg font-semibold tabular-nums text-ink">
                      {r.total}
                      <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.1em] text-ink-mute">reach</span>
                    </span>
                    <span className="mono mt-1 text-[11px] text-ink-mute">
                      {r.visaFree} visa-free · {r.visaOnArrival} VoA · {r.eta} eTA/e-visa
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Full sortable table */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Full Passport Index 2026: All {rows.length} Passports Ranked
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Click a column header to sort, or filter by country name. Every passport links to its full visa-free country list.
            </p>
            <div className="mt-5">
              <RankingsTable rows={rows} />
            </div>
          </section>

          {/* Bottom 10 - "weakest passport" query */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              The 10 Weakest Passports in the World 2026
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
              At the other end of the ranking, holders of these passports need an embassy visa for most international trips.
              A weak passport does not mean no options: visa-on-arrival and e-visa destinations still exist for every passport
              on this list, and holding credentials like a valid US or Schengen visa can unlock additional destinations.
            </p>
            <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {bottom10.map((r) => (
                <li key={r.iso3}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                  >
                    <span className="mono w-10 shrink-0 text-[11px] tabular-nums text-ink-mute">#{r.rank}</span>
                    <span className="text-xl">{r.flag}</span>
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{r.name}</span>
                    <span className="mono ml-auto text-sm tabular-nums text-ink-soft">
                      {r.total}
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-mute">reach</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Methodology */}
          <section id="methodology" className="mt-14 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">
              How This Passport Ranking Is Calculated
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Earth Visa builds its passport index from <strong className="text-ink">official government sources only</strong>:
              each destination country&apos;s own published visa policy - foreign ministry pages, immigration and border authority
              portals, and bilateral agreements - inverted into per-passport access lists. For every passport we count four
              access levels across {destCount} destinations:
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li><strong className="text-vfree">Visa-free</strong> - entry with just the passport; no application, no fee.</li>
              <li><strong className="text-voa">Visa on arrival</strong> - a visa stamped at the border on landing.</li>
              <li><strong className="text-eta">eTA</strong> - an electronic travel authorisation approved online before departure.</li>
              <li><strong className="text-evisa">e-Visa</strong> - a full visa applied for and issued online, no embassy visit.</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              A passport&apos;s <strong className="text-ink">total reach</strong> is the number of distinct destinations accessible
              through any of these levels, and the ranking sorts all {rows.length} passports by that total. Passports with equal
              totals are listed in sequence, so adjacent ranks can share the same reach. Other indexes (Henley Passport Index,
              Passport Index by Arton, and others) use different methodologies - some merge access levels into one score or rely
              on airline industry data - which is why the same passport can sit a few places apart across indexes. Data last
              updated {fmtDate(dataset.meta.lastUpdated)}.
            </p>
          </section>

          {/* Popular passport quick links */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Look Up a Popular Passport
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Jump straight to the full visa-free country list and 2026 rank for these frequently checked passports.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((r) => (
                <li key={r.iso3}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                  >
                    <span className="text-xl">{r.flag}</span>
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                      {r.name} passport
                    </span>
                    <span className="mono ml-auto text-[11px] tabular-nums text-ink-mute">#{r.rank}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Passport Ranking 2026 FAQ
            </h2>
            <div className="mt-5 divide-y divide-line">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <p className="mt-1 mb-3 max-w-3xl text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Where does your passport rank?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to see its exact rank, every visa-free destination, and what a second passport or a held visa could unlock.
            </p>
            <Link
              href="/"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Check your passport on Earth Visa →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
