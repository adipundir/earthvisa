import type { Metadata } from "next";
import Link from "next/link";
import PassportExplorer from "@/components/PassportExplorer";
import { dataset } from "@/lib/dataset";

export const metadata: Metadata = {
  title: {
    absolute: "What Can My Passport Do? Visa-Free Countries Checker",
  },
  description:
    "Enter your passport to see visa-free countries, visa on arrival, eTA, freedom-of-movement rights, golden visas and citizenship by investment - all from official government sources.",
  alternates: { canonical: "https://earthvisa.in" },
  openGraph: {
    title: "What Can My Passport Do? Visa-Free Countries Checker",
    description:
      "See visa-free travel, visa on arrival, golden visas and citizenship by investment for your passport - from official government sources.",
    url: "https://earthvisa.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "What Can My Passport Do? Visa-Free Countries Checker",
    description:
      "See visa-free travel, visa on arrival, golden visas and citizenship by investment for your passport - from official government sources.",
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
      a: `As of ${dataYear}, European passports from Luxembourg, Germany, France, Italy, Spain, Denmark, Finland, Netherlands, and several others consistently rank at the top, offering visa-free or visa-on-arrival access to 170+ destinations. Japanese and Singaporean passports are also among the world's strongest.`,
    },
    {
      q: "Can holding a US visa increase my travel options?",
      a: "Yes. Holding a valid US visa (B1/B2 tourist or business visa, or a US Green Card) unlocks additional visa-free or visa-on-arrival access to dozens of countries including Mexico, Costa Rica, Guatemala, Albania, Kosovo, and several others - destinations that may otherwise require a visa for your nationality.",
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

      {/* ── Tool-first hero (spec §10): copy left, the checker itself right.
          The hero band + tool card live inside PassportExplorer so the tool
          state stays client-side while this copy stays server-rendered. ── */}
      <PassportExplorer
        hero={
          <div className="lg:pt-2">
            <p className="mono text-[11px] font-medium uppercase tracking-[0.22em] text-stamp">
              {/* tail hidden on mobile so the kicker never wraps to a lone word */}
              Official government sources<span className="hidden sm:inline"> · nothing else</span>
            </p>
            <h1 className="text-display mt-4 max-w-3xl text-ink">
              What can your passport <span className="italic text-stamp">actually</span>&nbsp;do?
            </h1>
            <p className="text-body mt-4 max-w-xl text-ink-soft">
              Every visa-free country, fee and entry rule for your passport - and what a US or
              Schengen visa in it unlocks on top.
            </p>
            <p className="mono-chrome mt-6 hidden sm:block">
              {meta.countriesWithData} passports · {meta.destinationsWithVisaPolicy} visa policies
              <span className="hidden lg:inline"> · {dataset.cbi.length} citizenship programs · {dataset.rbi.length} residency routes</span>
            </p>
          </div>
        }
      />

      {/* ── Most-checked corridors + deeper entry points ── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-4 sm:px-8">
          <h2 className="eyebrow">Most checked routes</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_CORRIDORS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="mono inline-flex min-h-[40px] items-center gap-2 rounded-[2px] border border-line-strong bg-card px-3.5 py-1.5 text-[12.5px] text-ink-soft transition hover:border-stamp hover:text-stamp"
              >
                <span aria-hidden="true">{c.flag}</span>
                {c.from} <span aria-hidden="true" className="text-ink-mute">→</span> {c.to}
              </Link>
            ))}
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-5 sm:grid-cols-3">
            <Link href="/rankings" className="group">
              <p className="text-sub text-ink transition group-hover:text-stamp">Passport Ranking {dataYear} <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">All {meta.countriesWithData} passports ranked by real reach.</p>
            </Link>
            <Link href="/guide/visa-types" className="group">
              <p className="text-sub text-ink transition group-hover:text-stamp">Visa types, explained <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">Visa-free vs on arrival vs eTA vs e-visa - one plain-language glossary.</p>
            </Link>
            <Link href="/earthling" className="group">
              <p className="text-sub text-ink transition group-hover:text-stamp">How far can you go? <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">Claim your Earthling ID and take a seat on the leaderboard.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-2 sm:px-8">
          <p className="eyebrow">FAQ</p>
          <h2 className="text-section mt-3 text-ink">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-line">
            {faq.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                  {q}
                  <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <p className="text-body measure mt-3 pb-3 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
