import type { Metadata } from "next";
import Link from "next/link";
import PassportExplorer from "@/components/PassportExplorer";
import { dataset, nameFor } from "@/lib/dataset";
import type { AccessLevel } from "@/lib/types";

// Score = visa-free + visa on arrival + eTA, e-visa never counted - same rule
// as /rankings (see that page's buildRows for the full ranking). This FAQ only
// needs the top of that order, computed here rather than hardcoded so it can
// never drift from what /rankings actually shows.
function topPassports() {
  const scored = Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => {
      const counts: Record<AccessLevel, number> = { visa_free: 0, visa_on_arrival: 0, eta: 0, e_visa: 0 };
      for (const e of edges) counts[e.level]++;
      return { name: nameFor(iso3), score: counts.visa_free + counts.visa_on_arrival + counts.eta };
    })
    .sort((a, b) => b.score - a.score);
  const top1 = scored[0];
  const tied = scored.filter((r) => r.score === top1.score);
  return { top1, tied };
}

export const metadata: Metadata = {
  title: {
    // Lead with the brand: a bare "What Can My Passport Do?" title contained
    // the word "Earth Visa" nowhere, so on a brand query ("earthvisa") every
    // corridor page (each ends "| Earth Visa") out-matched the homepage. Brand
    // first, primary keyword kept.
    absolute: "Earth Visa: What Can My Passport Do? Visa-Free Checker",
  },
  description:
    "Enter your passport to see visa-free countries, visa on arrival, eTA, freedom-of-movement rights, golden visas and citizenship by investment, all from official government sources.",
  alternates: { canonical: "https://earthvisa.in" },
  openGraph: {
    title: "Earth Visa: What Can My Passport Do?",
    description:
      "See visa-free travel, visa on arrival, golden visas and citizenship by investment for your passport, from official government sources.",
    url: "https://earthvisa.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earth Visa: What Can My Passport Do?",
    description:
      "See visa-free travel, visa on arrival, golden visas and citizenship by investment for your passport, from official government sources.",
  },
};

// Corridors real visitors actually search for (Search Console) - the strip
// doubles as instant utility and an entry into the corridor corpus.
const POPULAR_CORRIDORS = [
  { flag: "🇮🇳", from: "India", to: "UAE", href: "/passport/india/united-arab-emirates" },
  { flag: "🇮🇳", from: "India", to: "Thailand", href: "/passport/india/thailand" },
  { flag: "🇩🇪", from: "Germany", to: "Japan", href: "/passport/germany/japan" },
  { flag: "🇦🇺", from: "Australia", to: "Egypt", href: "/passport/australia/egypt" },
  { flag: "🇵🇭", from: "Philippines", to: "Macau", href: "/passport/philippines/macau" },
  { flag: "🇷🇺", from: "Russia", to: "Indonesia", href: "/passport/russia/indonesia" },
  { flag: "🇹🇭", from: "Thailand", to: "South Korea", href: "/passport/thailand/south-korea" },
  { flag: "🇳🇱", from: "Netherlands", to: "United States", href: "/passport/netherlands/united-states" },
  { flag: "🇮🇳", from: "India", to: "Argentina", href: "/passport/india/argentina" },
  { flag: "🇵🇰", from: "Pakistan", to: "Nepal", href: "/passport/pakistan/nepal" },
];

export default function Home() {
  const { meta } = dataset;
  // Year for dated FAQ copy/JSON-LD - derived from the dataset so it can't go stale.
  const dataYear = meta.lastUpdated.slice(0, 4);
  const { top1, tied } = topPassports();

  // One QA array feeds the visible accordions AND the FAQPage JSON-LD, so they
  // can never drift apart. Ranking/program questions live on /rankings and
  // /programs - this page keeps only what the tool itself answers.
  const faq = [
    {
      q: "What is passport strength and how is it measured?",
      a: "Passport strength refers to how many countries a passport holder can visit without obtaining a visa in advance. It is measured by counting the number of destinations offering visa-free access, visa on arrival, or electronic travel authorisation (eTA) to holders of a given passport.",
    },
    {
      q: `Which passport gives the most visa-free countries in ${dataYear}?`,
      a: `As of ${dataYear}, the ${top1.name} passport${tied.length > 1 ? ` (tied with ${tied.length - 1} other${tied.length > 2 ? "s" : ""})` : ""} scores highest in our index, with visa-free, visa-on-arrival and eTA access to ${top1.score} destinations combined. See the full ranking, including how e-visas are tracked separately, at /rankings.`,
    },
    {
      q: "Can holding a US visa increase my travel options?",
      a: "Yes. Holding a valid US visa (B1/B2 tourist or business visa, or a US Green Card) unlocks additional visa-free or visa-on-arrival access to dozens of countries including Mexico, Costa Rica, Guatemala, and Albania - destinations that may otherwise require a visa for your nationality. The exact list depends on your own nationality, since these rules are scoped per passport, not universal.",
    },
    {
      q: "What is the difference between visa-free and visa on arrival?",
      a: "Visa-free access means you can enter a country with just your passport - no advance application, no fee, no paperwork at the border. Visa on arrival means you receive an entry stamp or sticker at the airport upon landing and pay a small fee there. Both allow entry without pre-arranged appointments at embassies or consulates.",
    },
    {
      q: "How accurate is this passport data?",
      a: "Earth Visa sources visa policy data exclusively from official government sources - foreign ministry pages, border authority portals, and published bilateral visa agreements. Each entry links to its official source. Data is updated continuously. Where governments do not publish structured visa-free lists, we do not extrapolate - so reach counts are conservative lower bounds.",
    },
  ];

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faq.map(({ q, a }) => ({
              "@type": "Question",
              "name": q,
              "acceptedAnswer": { "@type": "Answer", "text": a },
            })),
          }),
        }}
      />

      {/* The instrument. Empty: one question + one input, full viewport.
          Selected: the same page becomes the answer grid. */}
      <PassportExplorer />

      {/* ── Below the fold: most-checked routes + deeper entry points ── */}
      <section>
        <div className="mx-auto w-full max-w-6xl border-t border-hair px-5 pb-16 pt-12 sm:px-8">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">Most checked routes</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_CORRIDORS.map((c) => (
              <Link key={c.href} href={c.href} className="chip">
                <span aria-hidden="true">{c.flag}</span>
                {c.from} <span aria-hidden="true" className="text-ink-3">→</span> {c.to}
              </Link>
            ))}
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-6 sm:grid-cols-3">
            <Link href="/rankings" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">Passport Ranking {dataYear} <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">All {meta.countriesWithData} passports ranked by real reach.</p>
            </Link>
            <Link href="/guide/visa-types" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">Visa types, explained <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">Visa-free vs on arrival vs eTA vs e-visa - one plain-language glossary.</p>
            </Link>
            <Link href="/earthling" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">How far can you go? <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">Claim your Earthling ID and take a seat on the leaderboard.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-hair border-y border-hair">
            {faq.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {q}
                  <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <p className="measure mt-1 pb-4 text-[15px] leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
