import type { Metadata } from "next";
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

export default function Home() {
  const { meta } = dataset;
  const issued = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px]">
            {/* Left: headline + stats */}
            <div>
              <div className="mt-6">
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                  What can your passport <span className="italic text-stamp">actually</span> do?
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
                  Enter your passport below to instantly see visa-free travel, freedom-of-movement rights,
                  citizenship-by-investment, golden visas, and fast-track immigration - all from official government sources.
                </p>
              </div>

              <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-4 text-ink sm:flex sm:flex-wrap sm:items-start sm:justify-between">
                <Field k="Countries" v={meta.countriesWithData} />
                <Field k="Visa policies" v={meta.destinationsWithVisaPolicy} />
                <Field k="CBI · Golden-visa" v={`${dataset.cbi.length} · ${dataset.rbi.length}`} />
                <Field k="Fast-track programs" v={dataset.fastTrack.length} />
              </dl>
            </div>

            {/* Right: passport illustration */}
            <div className="hidden lg:flex lg:justify-center">
              <PassportIllustration />
            </div>
          </div>
        </div>
      </header>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "Which passport gives the most visa-free countries in 2025?", "acceptedAnswer": { "@type": "Answer", "text": "European passports (Luxembourg, Germany, France, Italy, Spain, Denmark, Finland, Netherlands) and Japan consistently top the passport index, offering visa-free or visa-on-arrival access to 170+ destinations in 2025." } },
              { "@type": "Question", "name": "Can holding a US visa increase my travel options?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. A valid US B1/B2 visa or Green Card unlocks visa-free or visa-on-arrival access to dozens of additional countries including Mexico, Costa Rica, Guatemala, Albania, Kosovo and more." } },
              { "@type": "Question", "name": "What is citizenship by investment?", "acceptedAnswer": { "@type": "Answer", "text": "Citizenship by investment (CBI) grants citizenship to foreign nationals who make a qualifying economic contribution - donations, real estate, or bond investments - in Caribbean nations, Malta, Turkey, and others." } },
              { "@type": "Question", "name": "What is a golden visa?", "acceptedAnswer": { "@type": "Answer", "text": "A golden visa grants residency rights (not citizenship) in exchange for a qualifying investment. Popular programs include Portugal, Greece, Spain, UAE, and Malta, with pathways to citizenship after residency." } },
              { "@type": "Question", "name": "What is the difference between visa-free and visa on arrival?", "acceptedAnswer": { "@type": "Answer", "text": "Visa-free means entry with just your passport - no application or fee. Visa on arrival means you get a stamp at the airport upon landing and pay a small fee there. Both avoid embassy appointments." } },
            ]
          })
        }}
      />

      <PassportExplorer />

      {/* ── SEO content: How it works + FAQ ── */}
      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
          <h2 className="font-display text-2xl font-semibold text-ink">How Earth Visa works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-stamp">01</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">Select your passport</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">Enter the country you hold citizenship in. Add multiple passports if you hold dual or multiple citizenships to see the combined reach.</p>
            </div>
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-stamp">02</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">Add any visas you hold</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">Holding a US visa, Schengen visa, or Japanese residence permit unlocks dozens of additional visa-free destinations beyond your passport alone.</p>
            </div>
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-stamp">03</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">Explore your options</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">See every destination you can reach visa-free, on arrival, or with an eTA - plus citizenship by investment, golden visas, and fast-track immigration programs.</p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Frequently asked questions</h2>
            <div className="mt-6 divide-y divide-line">
              {[
                {
                  q: "What is passport strength and how is it measured?",
                  a: "Passport strength refers to how many countries a passport holder can visit without obtaining a visa in advance. It is measured by counting the number of destinations offering visa-free access, visa on arrival, or electronic travel authorisation (eTA) to holders of a given passport. Stronger passports - typically those from the EU, US, Japan, UK, Australia, and Canada - can access 170+ destinations without prior visa arrangements."
                },
                {
                  q: "Which passport gives the most visa-free countries in 2025?",
                  a: "As of 2025, European passports from Luxembourg, Germany, France, Italy, Spain, Denmark, Finland, Netherlands, and several others consistently rank at the top, offering visa-free or visa-on-arrival access to 170+ destinations. Japanese and Singaporean passports are also among the world's strongest."
                },
                {
                  q: "Can holding a US visa increase my travel options?",
                  a: "Yes. Holding a valid US visa (B1/B2 tourist or business visa, or a US Green Card) unlocks additional visa-free or visa-on-arrival access to dozens of countries including Mexico, Costa Rica, Guatemala, Albania, Kosovo, and several others - destinations that may otherwise require a visa for your nationality."
                },
                {
                  q: "What is citizenship by investment (CBI)?",
                  a: "Citizenship by investment (CBI) is a legal process by which a country grants citizenship to foreign nationals who make a qualifying economic contribution - typically a donation to a national development fund, purchase of real estate, or investment in government bonds. Popular CBI programs include those offered by Caribbean nations (St Kitts and Nevis, Dominica, Grenada, Antigua and Barbuda, St Lucia), Malta, Turkey, Jordan, and Vanuatu."
                },
                {
                  q: "What is a golden visa and how does it differ from CBI?",
                  a: "A golden visa (also called residency by investment or RBI) grants residency rights - not citizenship - in exchange for a qualifying investment. Unlike citizenship by investment programs, golden visas typically offer a pathway to citizenship after a period of residency. Popular golden visa programs include those of Portugal, Greece, Spain, UAE, Malta, and several other EU and Gulf states."
                },
                {
                  q: "How accurate is this passport data?",
                  a: "Earth Visa sources visa policy data exclusively from official government sources - foreign ministry pages, border authority portals, and published bilateral visa agreements. Each entry links to its official source. Data is updated continuously. Where governments do not publish structured visa-free lists, we do not extrapolate - so reach counts are conservative lower bounds."
                },
                {
                  q: "What is the difference between visa-free and visa on arrival?",
                  a: "Visa-free access means you can enter a country with just your passport - no advance application, no fee, no paperwork at the border. Visa on arrival means you receive an entry stamp or sticker at the airport upon landing and pay a small fee there. Both allow entry without pre-arranged appointments at embassies or consulates, but visa on arrival typically involves a short queue and a fee at the port of entry."
                },
                {
                  q: "What is an eTA or e-Visa?",
                  a: "An Electronic Travel Authorisation (eTA) or e-Visa requires a brief online application - usually 5–15 minutes - and approval typically arrives within minutes to a few days. It costs a small fee but requires no embassy visit or paper visa. Countries offering eTAs to your passport include Australia, Canada, UK, and many others."
                },
              ].map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                    {q}
                    <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer / methodology with machine-readable zone ── */}
      <footer className="mt-auto border-t border-line bg-paper-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
            Methodology &amp; caveats
          </p>
          <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
            {meta.note} Each visa-free destination links to the official source that
            lists it - a{" "}
            <span className="font-medium text-vfree">green seal</span> marks a
            government domain, <span className="font-medium text-eta">amber</span>{" "}
            a non-official one. This ledger is informational only and not legal or
            immigration advice - always confirm requirements with the destination&apos;s
            authorities before travelling or applying.
          </p>

          <p className="mono mt-5 text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Data last updated{" "}
            <span className="font-semibold text-ink-soft">{meta.lastUpdated}</span>
          </p>

          <div className="mrz mt-8 select-none overflow-hidden rounded-sm border border-line bg-paper-2/70 px-4 py-3 text-xs text-ink-soft">
            <div>P&lt;EARTHVISA&lt;PASSPORT&lt;&lt;WHAT&lt;CAN&lt;YOURS&lt;DO&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
            <div>
              EVH{meta.totalCountries}
              {String(dataset.cbi.length).padStart(2, "0")}
              {String(dataset.rbi.length).padStart(3, "0")}&lt;OFFICIAL&lt;SOURCE&lt;FIRST&lt;&lt;&lt;&lt;{issued.replace(/-/g, "")}&lt;&lt;
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
    </div>
  );
}

function PassportIllustration() {
  return (
    <div className="relative select-none" aria-hidden="true">
      {/* Drop shadow layer */}
      <div className="absolute inset-0 translate-x-2 translate-y-3 rounded-lg bg-ink/20 blur-2xl" />

      {/* Passport open spread */}
      <svg
        viewBox="0 0 340 230"
        width="340"
        height="230"
        className="-rotate-1 drop-shadow-2xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Fine guilloché security pattern */}
          <pattern id="guilloche" patternUnits="userSpaceOnUse" width="6" height="6">
            <path d="M0 3 Q1.5 0 3 3 Q4.5 6 6 3" fill="none" stroke="#b23528" strokeWidth="0.25" opacity="0.12" />
          </pattern>
          {/* Clip for rounded corners on the spread */}
          <clipPath id="spread-clip">
            <rect x="0" y="0" width="340" height="230" rx="6" />
          </clipPath>
          {/* Clip for stamp circles */}
          <clipPath id="stamp1-clip"><circle cx="0" cy="0" r="36" /></clipPath>
          <clipPath id="stamp2-clip"><circle cx="0" cy="0" r="28" /></clipPath>
        </defs>

        <g clipPath="url(#spread-clip)">
          {/* ── LEFT COVER PAGE (navy) ── */}
          <rect x="0" y="0" width="96" height="230" fill="#1a2744" />
          {/* Spine highlight */}
          <rect x="90" y="0" width="6" height="230" fill="#111d38" />
          {/* Cover embossed crest */}
          <g transform="translate(48,90)" opacity="0.35">
            <circle cx="0" cy="0" r="26" fill="none" stroke="#c8b97a" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="20" fill="none" stroke="#c8b97a" strokeWidth="0.5" />
            {/* Shield */}
            <path d="M0-14 L10-8 L10 4 Q0 12 0 12 Q0 12 -10 4 L-10-8 Z" fill="none" stroke="#c8b97a" strokeWidth="1" />
            {/* Star */}
            <path d="M0-6 L1.5-1.5 L6-1.5 L2.5 1.5 L4 6 L0 3.5 L-4 6 L-2.5 1.5 L-6-1.5 L-1.5-1.5Z" fill="#c8b97a" opacity="0.7" />
          </g>
          {/* Cover text */}
          <text x="48" y="34" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#c8b97a" opacity="0.5" letterSpacing="3">TRAVEL</text>
          <text x="48" y="42" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#c8b97a" opacity="0.35" letterSpacing="2">DOCUMENT</text>
          <text x="48" y="192" textAnchor="middle" fontFamily="monospace" fontSize="4.5" fill="#c8b97a" opacity="0.3" letterSpacing="2">PASSPORT</text>

          {/* ── RIGHT BIO PAGE ── */}
          <rect x="96" y="0" width="244" height="230" fill="#f6f2e9" />
          {/* Security pattern overlay */}
          <rect x="96" y="0" width="244" height="230" fill="url(#guilloche)" />
          {/* Page edge line */}
          <line x1="96" y1="0" x2="96" y2="230" stroke="#1a2744" strokeWidth="0.5" opacity="0.12" />

          {/* ── Photo box ── */}
          <rect x="110" y="20" width="60" height="78" rx="2" fill="#e8e2d5" stroke="#1a2744" strokeWidth="0.8" opacity="0.4" />
          {/* Person silhouette */}
          <g transform="translate(140,58)" opacity="0.25" fill="#1a2744">
            <circle cx="0" cy="-16" r="12" />
            <path d="M-20 18 Q-20 2 0 2 Q20 2 20 18 Z" />
          </g>
          {/* Passport photo border lines */}
          <rect x="110" y="20" width="60" height="78" rx="2" fill="none" stroke="#1a2744" strokeWidth="0.5" opacity="0.2" strokeDasharray="2 2" />

          {/* ── Data fields ── */}
          <text x="182" y="31" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">SURNAME / NOM</text>
          <rect x="182" y="35" width="110" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="52" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">GIVEN NAMES</text>
          <rect x="182" y="56" width="90" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="73" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">NATIONALITY</text>
          <rect x="182" y="77" width="70" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />
          <text x="182" y="94" fontFamily="monospace" fontSize="5" fill="#1a2744" opacity="0.3" letterSpacing="1">DATE OF BIRTH</text>
          <rect x="182" y="98" width="80" height="6" rx="1.5" fill="#1a2744" opacity="0.1" />

          {/* ── Passport number chip area ── */}
          <rect x="182" y="110" width="48" height="14" rx="3" fill="#1a2744" opacity="0.06" stroke="#1a2744" strokeWidth="0.5" />
          <text x="206" y="120" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#1a2744" opacity="0.25" letterSpacing="0.5">EVH 2026</text>

          {/* ── MRZ zone ── */}
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
          <text x="0" y="14" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#2a7a4a" opacity="0.7" letterSpacing="1">25 JAN 2025</text>
          <text x="0" y="24" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#2a7a4a" opacity="0.5">PORT: INTL-A</text>
        </g>

        {/* ── VISA STAMP 2 - Departure (stamp red), mid right ── */}
        <g transform="translate(250, 148) rotate(-9)">
          <rect x="-32" y="-22" width="64" height="44" rx="4" fill="#fff8f7" fillOpacity="0.9" stroke="#b23528" strokeWidth="1.5" />
          <line x1="-28" y1="-12" x2="28" y2="-12" stroke="#b23528" strokeWidth="0.5" opacity="0.4" />
          <line x1="-28" y1="12" x2="28" y2="12" stroke="#b23528" strokeWidth="0.5" opacity="0.4" />
          <text x="0" y="-4" textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill="#b23528" fontWeight="bold" letterSpacing="1.5">DEPARTURE</text>
          <text x="0" y="8" textAnchor="middle" fontFamily="monospace" fontSize="5.5" fill="#b23528" opacity="0.75" letterSpacing="0.5">14 MAR 2025</text>
        </g>

        {/* ── VISA STAMP 3 - Transit (blue), lower left of bio page ── */}
        <g transform="translate(138, 152) rotate(-12)">
          <circle cx="0" cy="0" r="28" fill="#f0f4ff" fillOpacity="0.8" stroke="#3b5bdb" strokeWidth="1.4" />
          <circle cx="0" cy="0" r="22" fill="none" stroke="#3b5bdb" strokeWidth="0.5" opacity="0.45" />
          <text x="0" y="-5" textAnchor="middle" fontFamily="monospace" fontSize="6" fill="#3b5bdb" fontWeight="bold" letterSpacing="1">TRANSIT</text>
          <text x="0" y="7" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="#3b5bdb" opacity="0.7">48 HRS</text>
          <text x="0" y="17" textAnchor="middle" fontFamily="monospace" fontSize="4.5" fill="#3b5bdb" opacity="0.5">08 FEB 2025</text>
        </g>
      </svg>
    </div>
  );
}
