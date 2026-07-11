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
  keywords: [
    "etias",
    "etias 2026",
    "etias for us citizens",
    "what is etias",
    "etias application",
    "etias requirements",
    "is etias a visa",
    "etias for uk citizens",
    "etias for canadian citizens",
    "etias for australian citizens",
    "etias countries list",
    "do i need etias",
    "eu travel authorisation",
  ],
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
      a: "No. ETIAS (European Travel Information and Authorisation System) is a travel authorisation, not a visa. It applies only to travellers who can already enter the Schengen area without a visa. It does not change visa-free status - it adds a quick online pre-screening step before travel, similar in concept to the US ESTA. Travellers who need a Schengen visa will continue to apply for a visa and will not use ETIAS.",
    },
    {
      q: "Do US citizens need ETIAS in 2026?",
      a: `US passport holders currently enter Schengen countries visa-free${usStay ? ` for up to ${usStay} days in any 180-day period` : ""}, per official visa policy data. Once ETIAS becomes mandatory, US citizens will need to obtain the authorisation online before travelling - but they will still not need a visa. The start date has been revised more than once and is not yet fixed; Earth Visa will update this page the moment it is.`,
    },
    {
      q: "When does ETIAS start?",
      a: "The EU has announced ETIAS and its phased rollout follows the EU Entry/Exit System (EES), but the start date has been postponed several times and is not yet fixed - so this page deliberately does not state a launch date as fact. Earth Visa tracks the EU's own timeline and will update this page as soon as a firm date is confirmed.",
    },
    {
      q: "How much does ETIAS cost?",
      a: "The application fee is set by the EU and has been revised during the rollout process, with exemptions planned for some age groups. We do not state a figure here because it is not yet finalised for launch - Earth Visa will publish the confirmed fee and exemptions as soon as the EU sets them.",
    },
    {
      q: `Which countries will require ETIAS?`,
      a: `ETIAS will cover the Schengen area - ${schengen.length} countries in our dataset's Schengen group, including France, Germany, Spain, Italy and the Netherlands. Cyprus, an EU member that is not yet part of Schengen, is also on the EU's list.`,
    },
    {
      q: "Do I need ETIAS if I already need a Schengen visa?",
      a: "No. ETIAS is only for visa-exempt travellers. If your passport requires a Schengen visa (for example, most applicants from India, Pakistan, Nigeria or the Philippines), you follow the Schengen visa process instead - ETIAS never applies to you. Check your passport's Schengen access on Earth Visa to see which process applies.",
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
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center">Guides</span>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">ETIAS</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
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
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Schengen states", v: String(schengen.length) },
                { k: "EU members", v: String(euCount) },
                { k: "Passports in the ETIAS group", v: String(vfToFranceCount) },
                { k: "Typical visa-free stay", v: usStay ? `${usStay} days` : "varies" },
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

          {/* ETIAS is not a visa */}
          <section className="mt-10 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">ETIAS Is Not a Visa</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              <strong className="text-ink">ETIAS</strong>{" "}
              (European Travel Information and Authorisation System) is the
              EU&apos;s upcoming <strong className="text-ink">travel authorisation for visa-exempt travellers</strong> -
              and it is <strong className="text-ink">not a visa</strong>. That distinction is the single most common
              point of confusion. A visa is an entry permission you apply for because your passport does not qualify for
              visa-free entry. ETIAS is the opposite: it applies <em>only</em> to travellers whose passports already
              enter the <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen area</Link>{" "}
              without a visa, adding a short online security pre-screening before the trip.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              If you have used the US <strong className="text-ink">ESTA</strong> or the Canadian and UK{" "}
              <strong className="text-ink">eTA</strong> systems, ETIAS follows the same concept: apply online, get an
              electronic authorisation linked to your passport, and travel visa-free as before. Nothing about your
              visa-free status changes - the stay limits stay the same, and there is still no embassy appointment.
            </p>
            <p className="mono mt-5 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Launch timing and the application fee have been revised during the rollout and are not yet finalised,
              so this page does not state a start date or price as fact. Earth Visa tracks the EU&apos;s own rollout
              page,{" "}
              <a href={OFFICIAL_URL} rel="noopener noreferrer" className="text-stamp underline underline-offset-2">travel-europe.europa.eu</a>,
              and will update this the moment either is confirmed.
            </p>
          </section>

          {/* Who will need it */}
          <section className="mt-12 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">Who Will Need ETIAS</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              ETIAS will apply to <strong className="text-ink">visa-exempt, non-EU nationals</strong> making short
              visits to the Schengen area - the same travellers who today simply board a plane with their passport.
              Per our dataset, <strong className="text-ink">{vfToFranceCount} passports</strong> from outside the EU
              and the Schengen area currently enter France (used here as the Schengen reference destination)
              visa-free, including travellers from the{" "}
              <Link href={`/passport/${nameToSlug(nameFor("USA"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United States</Link>,{" "}
              <Link href={`/passport/${nameToSlug(nameFor("GBR"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United Kingdom</Link>,{" "}
              <Link href={`/passport/${nameToSlug(nameFor("CAN"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Canada</Link> and{" "}
              <Link href={`/passport/${nameToSlug(nameFor("AUS"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Australia</Link>.
            </p>
            <ul className="mt-4 space-y-2 text-base leading-relaxed text-ink-soft">
              <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><strong className="text-ink">Visa-exempt travellers</strong> (US, UK, Canadian, Australian and other visa-free passports): will need ETIAS once it becomes mandatory.</span></li>
              <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><strong className="text-ink">EU / Schengen citizens and residents</strong>: do not need ETIAS.</span></li>
              <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><strong className="text-ink">Travellers who need a Schengen visa</strong> (for example most applicants from India, Pakistan or Nigeria): never use ETIAS - the Schengen visa process applies instead. See our <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen visa guide</Link>.</span></li>
            </ul>

            {/* Data-driven visa-exempt examples */}
            {visaExemptSamples.length > 0 && (
              <>
                <h3 className="mt-8 font-display text-lg font-semibold text-ink">
                  Example Passports in the ETIAS Group (Visa-Free to Schengen Today)
                </h3>
                <p className="mt-2 text-sm text-ink-soft">
                  Confirmed visa-free to France in our dataset - these are the travellers ETIAS is built for.
                </p>
              </>
            )}
            {visaExemptSamples.length > 0 && (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {visaExemptSamples.map(({ iso3, edge }) => (
                  <Link
                    key={iso3}
                    href={`/passport/${nameToSlug(nameFor(iso3))}`}
                    className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                  >
                    <span className="text-xl">{flagFor(iso3)}</span>
                    <div className="min-w-0">
                      <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{nameFor(iso3)}</span>
                      {edge?.maxStayDays != null && (
                        <div className="mono text-[10px] text-ink-mute">≤ {edge.maxStayDays} days visa-free</div>
                      )}
                    </div>
                    <span className="mono ml-auto rounded-[3px] bg-vfree/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-vfree ring-1 ring-vfree/30">
                      Visa-free
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* How it works */}
          <section className="mt-12 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">How ETIAS Works</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: "Apply online before your trip",
                  d: "The application is a web form: passport details, background and security questions. Per the official EU description, most applications are expected to be processed quickly, but some can take longer if follow-up checks are needed - so apply well before booking-critical dates.",
                },
                {
                  t: "The authorisation links to your passport electronically",
                  d: "There is no sticker or stamp. Border systems and airlines read the authorisation from your passport number, which also means a new passport requires a new ETIAS.",
                },
                {
                  t: "Travel visa-free as before",
                  d: "ETIAS covers multiple short visits over its validity period. Your stay limits do not change - the standard Schengen short-stay rule (90 days in any 180-day period) continues to apply to visa-exempt visitors.",
                },
                {
                  t: "Carriers and border guards check it",
                  d: "Once mandatory, airlines are expected to verify ETIAS before boarding, and having an ETIAS does not guarantee entry - the final decision stays with border officers, as with any travel authorisation.",
                },
              ].map(({ t, d }, i) => (
                <li key={t} className="flex gap-4">
                  <span className="mono mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-stamp">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">{t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mono mt-6 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Validity period, fee, age exemptions and the exact start date are set by the EU and have shifted during
              rollout planning - check{" "}
              <a href={OFFICIAL_URL} rel="noopener noreferrer" className="text-stamp underline underline-offset-2">travel-europe.europa.eu</a>{" "}
              for the current rules before you travel.
            </p>
          </section>

          {/* Where ETIAS applies - dataset Schengen list */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Where ETIAS Will Apply: The Schengen Countries ({schengen.length})
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              The {schengen.length} Schengen members recorded in our dataset are listed below - each links to its
              entry-requirements page. The EU&apos;s own list also includes Cyprus, an EU member not yet in Schengen.
              For how the Schengen short-stay rules work, see the{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen visa guide</Link>.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {schengen.map((iso3) => (
                <Link
                  key={iso3}
                  href={`/destination/${nameToSlug(nameFor(iso3))}`}
                  className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                >
                  <span className="text-xl">{flagFor(iso3)}</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                    {nameFor(iso3)}
                  </span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">ETIAS FAQ</h2>
            <div className="mt-5 divide-y divide-line">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  <p className="mt-1 max-w-3xl pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>
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
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Does your passport enter Schengen visa-free?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Check your passport&apos;s Europe access - if you are visa-exempt, ETIAS will apply to you; if not, the
              Schengen visa process does. See the full picture, or compare passports on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport rankings</Link>.
            </p>
            <Link
              href="/visit"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Check your visa requirements →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
