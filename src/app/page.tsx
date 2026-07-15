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
  { flag: "🇮🇳", from: "India", to: "UAE", href: "/passport/india/uae" },
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
      {/* ── Hero: the question, then immediately the instrument ── */}
      <header className="border-b border-line">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="mono text-[11px] font-medium uppercase tracking-[0.22em] text-stamp">
              Official government sources · nothing else
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              What can your passport <span className="italic text-stamp">actually</span>&nbsp;do?
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Every visa-free country, fee and entry rule for your passport - and what a US or
              Schengen visa in it unlocks on top.
            </p>
            <p className="mono mt-6 border-t border-line pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mute">
              {meta.countriesWithData} passports · {meta.destinationsWithVisaPolicy} visa policies
              <span className="hidden sm:inline"> · {dataset.cbi.length} citizenship programs · {dataset.rbi.length} residency routes</span>
            </p>
          </div>

          <div className="hidden lg:flex lg:justify-center">
            <PassportIllustration />
          </div>
        </div>
      </header>

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

      <PassportExplorer />

      {/* ── Most-checked corridors + deeper entry points ── */}
      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <h2 className="mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-mute">
            Most checked routes
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_CORRIDORS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="mono inline-flex min-h-[40px] items-center gap-2 rounded-md border border-line-strong bg-card px-3.5 py-1.5 text-[12.5px] text-ink-soft transition hover:border-stamp hover:text-stamp"
              >
                <span aria-hidden="true">{c.flag}</span>
                {c.from} <span aria-hidden="true" className="text-ink-mute">→</span> {c.to}
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-4 border-t border-line pt-6 sm:grid-cols-3">
            <Link href="/rankings" className="group">
              <p className="font-display text-[15px] font-semibold text-ink transition group-hover:text-stamp">Passport Ranking {dataYear} <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">All {meta.countriesWithData} passports ranked by real reach.</p>
            </Link>
            <Link href="/guide/visa-types" className="group">
              <p className="font-display text-[15px] font-semibold text-ink transition group-hover:text-stamp">Visa types, explained <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Visa-free vs on arrival vs eTA vs e-visa - one plain-language glossary.</p>
            </Link>
            <Link href="/earthling" className="group">
              <p className="font-display text-[15px] font-semibold text-ink transition group-hover:text-stamp">How far can you go? <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Claim your Earthling ID and take a seat on the leaderboard.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <h2 className="font-display text-2xl font-semibold text-ink">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-line">
            {faq.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                  {q}
                  <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <p className="mt-3 max-w-3xl pb-3 text-sm leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// Hand-drawn passport spread (not a stock graphic): navy cover, bio page with
// guilloché security pattern, MRZ strip, and three entry/departure/transit
// stamps - the same visual language as the stamp badges used across the site.
function PassportIllustration() {
  return (
    <div className="relative select-none" aria-hidden="true">
      <div className="absolute inset-0 translate-x-2 translate-y-3 rounded-lg bg-black/25 blur-2xl dark:bg-white/10" />

      <svg
        viewBox="0 0 340 230"
        width="340"
        height="230"
        className="-rotate-1 drop-shadow-2xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="guilloche" patternUnits="userSpaceOnUse" width="6" height="6">
            <path d="M0 3 Q1.5 0 3 3 Q4.5 6 6 3" fill="none" stroke="#b23528" strokeWidth="0.25" opacity="0.12" />
          </pattern>
          <clipPath id="spread-clip">
            <rect x="0" y="0" width="340" height="230" rx="6" />
          </clipPath>
        </defs>

        <g clipPath="url(#spread-clip)">
          {/* ── LEFT COVER PAGE (navy) ── */}
          <rect x="0" y="0" width="96" height="230" fill="#1a2744" />
          <rect x="90" y="0" width="6" height="230" fill="#111d38" />
          <g transform="translate(48,90)" opacity="0.35">
            <circle cx="0" cy="0" r="26" fill="none" stroke="#c8b97a" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="20" fill="none" stroke="#c8b97a" strokeWidth="0.5" />
            <path d="M0-14 L10-8 L10 4 Q0 12 0 12 Q0 12 -10 4 L-10-8 Z" fill="none" stroke="#c8b97a" strokeWidth="1" />
            <path d="M0-6 L1.5-1.5 L6-1.5 L2.5 1.5 L4 6 L0 3.5 L-4 6 L-2.5 1.5 L-6-1.5 L-1.5-1.5Z" fill="#c8b97a" opacity="0.7" />
          </g>
          <text x="48" y="34" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#c8b97a" opacity="0.5" letterSpacing="3">TRAVEL</text>
          <text x="48" y="42" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#c8b97a" opacity="0.35" letterSpacing="2">DOCUMENT</text>
          <text x="48" y="192" textAnchor="middle" fontFamily="monospace" fontSize="4.5" fill="#c8b97a" opacity="0.3" letterSpacing="2">PASSPORT</text>

          {/* ── RIGHT BIO PAGE ── */}
          <rect x="96" y="0" width="244" height="230" fill="#f6f2e9" />
          <rect x="96" y="0" width="244" height="230" fill="url(#guilloche)" />
          <line x1="96" y1="0" x2="96" y2="230" stroke="#1a2744" strokeWidth="0.5" opacity="0.12" />

          <rect x="110" y="20" width="60" height="78" rx="2" fill="#e8e2d5" stroke="#1a2744" strokeWidth="0.8" opacity="0.4" />
          <g transform="translate(140,58)" opacity="0.25" fill="#1a2744">
            <circle cx="0" cy="-16" r="12" />
            <path d="M-20 18 Q-20 2 0 2 Q20 2 20 18 Z" />
          </g>
          <rect x="110" y="20" width="60" height="78" rx="2" fill="none" stroke="#1a2744" strokeWidth="0.5" opacity="0.2" strokeDasharray="2 2" />

          <text x="182" y="31" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">SURNAME / NOM</text>
          <rect x="182" y="35" width="110" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="52" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">GIVEN NAMES</text>
          <rect x="182" y="56" width="90" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="73" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">NATIONALITY</text>
          <rect x="182" y="77" width="70" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="94" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">DATE OF BIRTH</text>
          <rect x="182" y="98" width="80" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />

          <rect x="182" y="110" width="48" height="14" rx="3" fill="#1a2744" opacity="0.06" stroke="#1a2744" strokeWidth="0.5" />
          <text x="206" y="120" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#1a2744" opacity="0.25" letterSpacing="0.5">EVH 2026</text>

          <rect x="96" y="188" width="244" height="42" fill="#ede8d8" />
          <line x1="96" y1="188" x2="340" y2="188" stroke="#1a2744" strokeWidth="0.5" opacity="0.12" />
          <text x="102" y="202" fontFamily="monospace" fontSize="6.5" fill="#1a2744" opacity="0.22" letterSpacing="0.5">P&lt;EARTHVISA&lt;&lt;VISA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
          <text x="102" y="220" fontFamily="monospace" fontSize="6.5" fill="#1a2744" opacity="0.22" letterSpacing="0.5">A12345&lt;3EVH8901019M3012315&lt;&lt;&lt;&lt;&lt;&lt;</text>
        </g>

        {/* ── VISA STAMP 1 - Entry (green), top right ── */}
        <g transform="translate(292, 52) rotate(14)">
          <circle cx="0" cy="0" r="36" fill="#f0faf5" fillOpacity="0.85" stroke="#2a7a4a" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="29" fill="none" stroke="#2a7a4a" strokeWidth="0.6" opacity="0.5" />
          <path d="M-25 0 A25 25 0 0 1 25 0" fill="none" stroke="#2a7a4a" strokeWidth="0.8" opacity="0.4" />
          <text x="0" y="-10" textAnchor="middle" fontFamily="monospace" fontSize="6" fill="#2a7a4a" fontWeight="bold" letterSpacing="2">ADMITTED</text>
          <text x="0" y="2" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#2a7a4a" fontWeight="bold">ENTRY</text>
          <text x="0" y="14" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#2a7a4a" opacity="0.7" letterSpacing="1">25 JAN 2026</text>
          <text x="0" y="24" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#2a7a4a" opacity="0.5">PORT: INTL-A</text>
        </g>

        {/* ── VISA STAMP 2 - Departure (stamp red), mid right ── */}
        <g transform="translate(250, 148) rotate(-9)">
          <rect x="-32" y="-22" width="64" height="44" rx="4" fill="#fff8f7" fillOpacity="0.9" stroke="#b23528" strokeWidth="1.5" />
          <line x1="-28" y1="-12" x2="28" y2="-12" stroke="#b23528" strokeWidth="0.5" opacity="0.4" />
          <line x1="-28" y1="12" x2="28" y2="12" stroke="#b23528" strokeWidth="0.5" opacity="0.4" />
          <text x="0" y="-4" textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill="#b23528" fontWeight="bold" letterSpacing="1.5">DEPARTURE</text>
          <text x="0" y="8" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#b23528" opacity="0.75" letterSpacing="0.5">14 MAR 2026</text>
        </g>

        {/* ── VISA STAMP 3 - Transit (blue-grey), lower left of bio page ── */}
        <g transform="translate(138, 152) rotate(-12)">
          <circle cx="0" cy="0" r="28" fill="#f0f4ff" fillOpacity="0.8" stroke="#59647d" strokeWidth="1.4" />
          <circle cx="0" cy="0" r="22" fill="none" stroke="#59647d" strokeWidth="0.5" opacity="0.45" />
          <text x="0" y="-5" textAnchor="middle" fontFamily="monospace" fontSize="6" fill="#59647d" fontWeight="bold" letterSpacing="1">TRANSIT</text>
          <text x="0" y="7" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#59647d" opacity="0.7">48 HRS</text>
          <text x="0" y="17" textAnchor="middle" fontFamily="monospace" fontSize="4.5" fill="#59647d" opacity="0.5">08 FEB 2026</text>
        </g>
      </svg>
    </div>
  );
}
