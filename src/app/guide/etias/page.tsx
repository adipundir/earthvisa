import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/etias - "etias", "etias 2026", "etias for us citizens"
//
// Definitional explainer. The single most important message (and the top
// search confusion) is that ETIAS is NOT a visa - it is a pre-travel
// authorisation for nationals who are already visa-exempt. Launch timing and
// fee have shifted repeatedly, so this page deliberately never states a start
// date or price as fact - Earth Visa tracks the EU's own rollout and updates
// this page the moment either is confirmed, rather than sending readers away
// to check for themselves.
//
// Every factual visa claim (who enters Schengen visa-free today, member
// lists, stay lengths) is computed from the dataset at build time.
// ---------------------------------------------------------------------------

const OFFICIAL_URL = "https://travel-europe.europa.eu/etias_en";

// Sample nationalities people actually search "etias for X citizens" about.
// Only rendered when the dataset confirms visa-free access to France (used as
// the Schengen reference destination) - never asserted from world knowledge.
const SAMPLE_NATIONALITIES = [
  "USA", "GBR", "CAN", "AUS", "NZL", "JPN", "KOR", "SGP",
  "ARE", "BRA", "MEX", "ARG", "CHL", "MYS", "ISR", "UKR",
];

// Corridor mesh: top English-market nationalities x flagship Schengen states.
const CORRIDOR_NATS = ["USA", "GBR", "CAN", "AUS"];
const CORRIDOR_DESTS = ["FRA", "DEU", "ESP", "ITA"];

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

const title = "ETIAS 2026: What It Is, Who Needs It & How It Works (Not a Visa)";
const description =
  "ETIAS explained for 2026: the EU travel authorisation for visa-exempt travellers - including US, UK, Canadian and Australian citizens. What ETIAS is (not a visa), who will need it, how it works, and where to check official launch status.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/guide/etias" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/etias",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// aria-hidden chevron that rotates when its parent <details> is open.
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

export default function EtiasGuidePage() {
  const schengen = dataset.groups.SCHENGEN ?? [];
  const euCount = (dataset.groups.EU ?? []).length;

  // Nationalities the dataset confirms enter France (Schengen) visa-free -
  // exactly the group ETIAS is designed for.
  const visaExemptSamples = SAMPLE_NATIONALITIES
    .map((iso3) => ({ iso3, edge: accessTo(iso3, "FRA") }))
    .filter((x) => x.edge?.level === "visa_free");

  // Passports our dataset records as visa-free to France, excluding EU and
  // Schengen member passports - their citizens are outside the ETIAS scope.
  const memberSet = new Set([...schengen, ...(dataset.groups.EU ?? [])]);
  const vfToFranceCount = Object.entries(dataset.passportAccess).filter(([nat, edges]) =>
    !memberSet.has(nat) && edges.some((e) => e.dest === "FRA" && e.level === "visa_free"),
  ).length;

  const usEdge = accessTo("USA", "FRA");
  const usStay = usEdge?.maxStayDays ?? null;

  const corridorLinks = CORRIDOR_NATS.flatMap((nat) =>
    CORRIDOR_DESTS.filter((dest) => isUsefulCorridor(nat, dest)).map((dest) => ({
      href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`,
      label: `${nameFor(dest)} for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
      iso3: dest,
    })),
  );

  const faqs = [
    {
      q: "Is ETIAS a visa?",
      a: "No. ETIAS is an online pre-screening for travellers who can already enter the Schengen area without a visa, similar in concept to the US ESTA. It does not change visa-free status.",
    },
    {
      q: "Do US citizens need ETIAS in 2026?",
      a: `US passport holders enter Schengen visa-free${usStay ? ` for up to ${usStay} days in any 180` : ""}. Once ETIAS is mandatory they will complete the online authorisation first - still no visa. The start date is not yet fixed.`,
    },
    {
      q: "When does ETIAS start?",
      a: "Not yet fixed - see the status note above for the EU's current rollout timeline.",
    },
    {
      q: "How much does ETIAS cost?",
      a: "Not yet finalised - see the status note above for where the confirmed fee will be published first.",
    },
    {
      q: `Which countries will require ETIAS?`,
      a: `The Schengen area - see "Where ETIAS Will Apply" above for the full country list and the Cyprus caveat.`,
    },
    {
      q: "Do I need ETIAS if I already need a Schengen visa?",
      a: "No - ETIAS is only for visa-exempt travellers. If your passport requires a Schengen visa (most applicants from India, Pakistan, Nigeria or the Philippines), you follow the visa process instead.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "ETIAS Guide", item: "https://earthvisa.in/guide/etias" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
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
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/guide" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Guides</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">ETIAS</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                ETIAS Explained 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  The EU Travel Authorisation - and Why It Is Not a Visa
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Pre-travel authorisation for visa-exempt passports
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Schengen states", v: String(schengen.length) },
                { k: "EU members", v: String(euCount) },
                { k: "Passports in the ETIAS group", v: String(vfToFranceCount) },
                { k: "Typical visa-free stay", v: usStay ? `${usStay} days` : "varies" },
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

          {/* ETIAS is not a visa */}
          <section className="mt-10 max-w-3xl">
            <h2 className="text-section text-ink">ETIAS Is Not a Visa</h2>
            <p className="text-body mt-3 text-ink-soft">
              <strong className="text-ink">ETIAS</strong>{" "}
              (European Travel Information and Authorisation System) is the EU&apos;s upcoming{" "}
              <strong className="text-ink">travel authorisation for visa-exempt travellers</strong> - the opposite of
              a visa, which exists because a passport does not qualify for visa-free entry.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <div className="card-doc p-4">
                <h3 className="mono-chrome">ETIAS is</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A short online security pre-screening before travel</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Only for passports that already enter the <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen area</Link> without a visa</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>The same concept as the US ESTA and the Canadian and UK eTA</span></li>
                </ul>
              </div>
              <div className="card-doc p-4">
                <h3 className="mono-chrome">ETIAS is not</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A visa, or a change to your visa-free status</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A change to stay limits - the 90/180 rule still applies</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>An embassy process - there is no appointment</span></li>
                </ul>
              </div>
            </div>
            <p className="card-doc mt-5 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">Status:</strong> launch date &amp; fee not yet fixed. We
              update this page the moment either is confirmed on{" "}
              <a href={OFFICIAL_URL} rel="noopener noreferrer" className="text-stamp underline underline-offset-2">travel-europe.europa.eu</a>.
            </p>
          </section>

          {/* Who will need it */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Who Will Need ETIAS</h2>
            <p className="text-body mt-3 text-ink-soft">
              <strong className="text-ink">Visa-exempt, non-EU nationals</strong> on short visits to the Schengen
              area - the travellers who today just board with their passport, including those from the{" "}
              <Link href={`/passport/${nameToSlug(nameFor("USA"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United States</Link>,{" "}
              <Link href={`/passport/${nameToSlug(nameFor("GBR"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United Kingdom</Link>,{" "}
              <Link href={`/passport/${nameToSlug(nameFor("CAN"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Canada</Link> and{" "}
              <Link href={`/passport/${nameToSlug(nameFor("AUS"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Australia</Link>.
            </p>
            <ul className="mt-4 space-y-2 text-base leading-relaxed text-ink-soft">
              <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><strong className="text-ink">EU / Schengen citizens and residents</strong>: never need ETIAS.</span></li>
              <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><strong className="text-ink">Travellers who need a Schengen visa</strong> (most applicants from India, Pakistan or Nigeria): the <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen visa process</Link> applies instead.</span></li>
            </ul>

            {/* Single-category section (all visa-free): the heading carries the
                status once, so rows drop the per-card badge (spec §11). */}
            {visaExemptSamples.length > 0 && (
              <h3 className="mt-8 font-display text-lg font-semibold text-ink">
                Example Passports, Visa-Free to Schengen Today
              </h3>
            )}
            {visaExemptSamples.length > 0 && (
              <div className="card-doc mt-4 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5">
                {visaExemptSamples.map(({ iso3, edge }) => (
                  <Link
                    key={iso3}
                    href={`/passport/${nameToSlug(nameFor(iso3))}`}
                    className="group flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 transition first:border-t-0 hover:bg-paper-2/50 sm:[&:nth-child(-n+2)]:border-t-0"
                  >
                    <span className="text-lg leading-none">{flagFor(iso3)}</span>
                    <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{nameFor(iso3)}</span>
                    {edge?.maxStayDays != null && (
                      <span className="mono shrink-0 text-[11px] tabular-nums text-ink-mute">≤ {edge.maxStayDays} days</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* How it works */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">How ETIAS Works</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: "Apply online before your trip",
                  d: "A web form: passport details, background and security questions. Most decisions are expected to be quick, but follow-up checks take longer - apply well before booking-critical dates.",
                },
                {
                  t: "The authorisation links to your passport electronically",
                  d: "No sticker, no stamp - it is read from your passport number, so a new passport means a new ETIAS.",
                },
                {
                  t: "Travel visa-free as before",
                  d: "One ETIAS covers multiple short visits over its validity, and stay limits do not change: 90 days in any 180.",
                },
                {
                  t: "Carriers and border guards check it",
                  d: "Airlines are expected to verify it before boarding. It does not guarantee entry - border officers decide.",
                },
              ].map(({ t, d }, i) => (
                <li key={t} className="flex gap-4">
                  <span className="mono mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-stamp">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">{t}</h3>
                    <p className="text-body mt-1 text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Where ETIAS applies - dataset Schengen list */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Where ETIAS Will Apply: The Schengen Countries ({schengen.length})
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Tap a country for its entry requirements. The EU&apos;s own list adds Cyprus, an EU member not yet in
              Schengen; short-stay rules are in the{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen visa guide</Link>.
            </p>
            <div className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
              {schengen.map((iso3) => (
                <Link
                  key={iso3}
                  href={`/destination/${nameToSlug(nameFor(iso3))}`}
                  className="group flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 transition first:border-t-0 hover:bg-paper-2/50 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0"
                >
                  <span className="text-lg leading-none">{flagFor(iso3)}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                    {nameFor(iso3)}
                  </span>
                  <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">ETIAS FAQ</h2>
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

          {/* Corridor mesh */}
          <CorridorLinks
            title="Schengen Entry Rules by Passport"
            description="Detailed entry rules, stay limits and document notes for popular Schengen trips."
            links={corridorLinks}
          />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Does your passport enter Schengen visa-free?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Visa-exempt means ETIAS will apply to you; otherwise the Schengen visa process does. Or compare
              passports on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport rankings</Link>.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check your visa requirements →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
