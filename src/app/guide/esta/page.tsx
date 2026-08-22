import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/esta - "esta", "esta application", "esta requirements", "visa waiver
// program", "esta denied", "esta cuba", "vwp ineligible".
//
// The differentiated angle - and the reason this page exists rather than being
// one more "how to apply for ESTA" restatement - is the 2015 Act. A traveller
// who has been present in one of nine countries, or who holds a second
// nationality from one of six, is barred from the Visa Waiver Program entirely,
// and CBP will REVOKE an ESTA already granted. Nobody covers this properly, and
// getting it wrong strands a real person at a boarding gate.
//
// Every claim here was researched from CBP / DHS / Federal Register / statute
// and then adversarially re-verified against the cited source. Two things that
// survived that pass and are easy to get wrong:
//   - The list is NINE countries, not the seven of the original June 2016 ESTA
//     question. North Korea was added to the March 1 2011 list, and Cuba was
//     added on its own threshold of January 12 2021 (its SST designation date).
//   - The dual-nationality bar is a DIFFERENT, shorter list than the
//     prior-presence bar, and the military/official-duty exceptions do not
//     apply to it at all.
//
// The VWP membership count is computed from the dataset (passports recorded at
// "eta" level to the USA) rather than asserted, per the sitewide rule that no
// factual claim comes from world knowledge.
// ---------------------------------------------------------------------------

const OFFICIAL_ESTA_URL = "https://esta.cbp.dhs.gov/";
const CBP_VWP_ACT_FAQ =
  "https://www.cbp.gov/travel/international-visitors/visa-waiver-program/visa-waiver-program-improvement-and-terrorist-travel-prevention-act-faq";
const CBP_ESTA_FAQ =
  "https://www.cbp.gov/travel/international-visitors/esta/frequently-asked-questions-about-visa-waiver-program-vwp-and-electronic-system-travel";

// Corridor mesh: VWP nationalities who actually search "esta" x the USA.
const CORRIDOR_NATS = ["GBR", "DEU", "FRA", "AUS", "JPN", "KOR", "ESP", "ITA", "NLD", "SGP", "QAT", "ISR"];

// The prior-presence bar. Eight countries share the statutory March 1 2011
// threshold; Cuba runs on its own date. Kept as data so the two thresholds can
// never drift apart in prose.
const PRESENCE_BAR = [
  { iso3: "IRQ", since: "1 March 2011" },
  { iso3: "SYR", since: "1 March 2011" },
  { iso3: "IRN", since: "1 March 2011" },
  { iso3: "SDN", since: "1 March 2011" },
  { iso3: "LBY", since: "1 March 2011" },
  { iso3: "SOM", since: "1 March 2011" },
  { iso3: "YEM", since: "1 March 2011" },
  { iso3: "PRK", since: "1 March 2011" },
  { iso3: "CUB", since: "12 January 2021" },
];

// The dual-nationality bar - deliberately a separate, shorter list.
const NATIONALITY_BAR = ["IRQ", "SYR", "IRN", "PRK", "SDN", "CUB"];

const title = "ESTA 2026: US Travel Authorisation, Fees & What Disqualifies You";
const description =
  "ESTA explained for 2026: what it is, the current fee, and the nine countries where past travel can disqualify you from the Visa Waiver Program entirely - including one where CBP revokes an ESTA you already hold. Sourced from CBP, DHS and the statute.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/guide/esta" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/esta",
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

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

export default function EstaGuidePage() {
  // The VWP group as our dataset records it: passports that reach the USA at
  // "eta" level, i.e. no visa but a mandatory pre-travel authorisation.
  const vwpPassports = Object.entries(dataset.passportAccess)
    .filter(([, edges]) => edges.some((e) => e.dest === "USA" && e.level === "eta"))
    .map(([iso3]) => iso3)
    .sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

  // Passports that reach the USA with no authorisation at all - Canada and the
  // COFA states. A frequent source of "do Canadians need an ESTA" confusion.
  const noEstaNeeded = Object.entries(dataset.passportAccess)
    .filter(([, edges]) => edges.some((e) => e.dest === "USA" && e.level === "visa_free"))
    .map(([iso3]) => iso3)
    .sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

  const usaStay = accessTo("GBR", "USA")?.maxStayDays ?? null;

  const corridorLinks = CORRIDOR_NATS.filter((nat) => isUsefulCorridor(nat, "USA")).map((nat) => ({
    href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor("USA"))}`,
    label: `United States for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
    iso3: nat,
  }));

  const faqs = [
    {
      q: "Is ESTA a visa?",
      a: "No - it is an automated eligibility check, and cannot stand in for a visa where US law requires one.",
    },
    {
      q: "Can travelling to another country stop me from getting an ESTA?",
      a: "Yes - presence in any of the nine countries listed above disqualifies you from the Visa Waiver Program, whatever the purpose of the trip.",
    },
    {
      q: "Can an ESTA I already hold be revoked?",
      a: "Yes - CBP can revoke an approved ESTA at any time, including over a disqualifying trip taken after approval.",
    },
    {
      q: "Does dual nationality affect my ESTA?",
      a: "Yes, against a shorter, separate list (Iraq, Syria, Iran, North Korea, Sudan, Cuba), and the military and official-duty exceptions do not apply to it.",
    },
    {
      q: "How long is an ESTA valid?",
      a: "Typically two years, or until your passport expires, whichever comes first.",
    },
    {
      q: "My ESTA was denied. What now?",
      a: "A denial closes only the Visa Waiver Program route - you can still apply for a US visa, normally a B-1/B-2.",
    },
    {
      q: "Do I need an ESTA if I already hold a US visa?",
      a: "No. CBP states that travellers on a valid visa need no ESTA and may travel on that visa for the purpose it was issued for.",
    },
    {
      q: "Do children need their own ESTA?",
      a: "Yes - accompanied and unaccompanied children of any age need their own approval. There is no family application.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://earthvisa.in/guide" },
          { "@type": "ListItem", position: 3, name: "ESTA Guide", item: "https://earthvisa.in/guide/esta" },
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
              <span className="inline-flex min-h-[44px] items-center text-ink">ESTA</span>
            </nav>

            <div className="mt-6">
              <h1 className="text-display text-ink">
                ESTA Explained 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  The US travel authorisation, and the travel history that quietly disqualifies you
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Pre-travel authorisation for Visa Waiver Program passports
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "VWP passports", v: String(vwpPassports.length) },
                { k: "Max stay", v: usaStay ? `${usaStay} days` : "90 days" },
                { k: "Countries that disqualify", v: String(PRESENCE_BAR.length) },
                { k: "Typical validity", v: "2 years" },
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

          {/* ESTA is not a visa */}
          <section className="mt-10 max-w-3xl">
            <h2 className="text-section text-ink">ESTA Is Not a Visa</h2>
            <p className="text-body mt-3 text-ink-soft">
              <strong className="text-ink">ESTA</strong>{" "}
              (Electronic System for Travel Authorization) decides whether a traveller may board for the United States
              under the <strong className="text-ink">Visa Waiver Program</strong>. CBP is blunt about the limit: it is
              not a visa, and cannot stand in for one where US law requires a visa.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <div className="card-doc p-4">
                <h3 className="mono-chrome">ESTA is</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>An eligibility screening completed online before you travel</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Only for the {vwpPassports.length} passports already in the Visa Waiver Program</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>The same concept as the EU&apos;s <Link href="/guide/etias" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">ETIAS</Link> and the UK and Canadian eTA</span></li>
                </ul>
              </div>
              <div className="card-doc p-4">
                <h3 className="mono-chrome">ESTA is not</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A visa, or a substitute for one where a visa is required</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A guarantee of entry - a CBP officer decides admission at the port of entry</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Permission to work or study in the United States</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Appealable: travelling under the programme waives any appeal of a CBP admissibility decision, except an asylum claim</span></li>
                </ul>
              </div>
            </div>
          </section>

          {/* THE core section: what disqualifies you */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              The Travel History That Disqualifies You
            </h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              The{" "}
              <strong className="text-ink">Visa Waiver Program Improvement and Terrorist Travel Prevention Act of 2015</strong>{" "}
              (Division O, Title II of Public Law 114-113) added section 217(a)(12) to the Immigration and Nationality
              Act: it removes people from the programme for where they have been, whatever their nationality, record
              or reason for going. <strong className="text-ink">Presence</strong> is the trigger - tourism, family,
              journalism, aid work and business count identically. The statute names Iraq and Syria and extends to
              state sponsors of terrorism plus any country of concern designated by the Secretary of Homeland
              Security, which is how the list grew past two.
            </p>

            <div className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
              {PRESENCE_BAR.map(({ iso3, since }) => (
                <div
                  key={iso3}
                  className="flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0"
                >
                  <span className="text-lg leading-none">{flagFor(iso3)}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink">
                    {nameFor(iso3)}
                  </span>
                  <span className="mono shrink-0 text-[11px] text-ink-mute">{since}</span>
                </div>
              ))}
            </div>

            <div className="card-doc card-doc-rule mt-5 max-w-3xl p-4">
              <h3 className="font-display text-[15px] font-semibold text-ink">Two different dates, and CBP is not consistent about them</h3>
              <p className="text-body mt-2 text-ink-soft">
                Eight countries share the statutory 1 March 2011 threshold; Cuba runs on its own 12 January 2021
                designation date, which CBP&apos;s Cuba guidance states while the live ESTA form asks all nine as one
                1 March 2011 question. If either date could apply to you, assume you are affected and plan for a visa.
              </p>
            </div>
          </section>

          {/* Revocation */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">An Approved ESTA Can Be Revoked</h2>
            <p className="text-body mt-3 text-ink-soft">
              An authorisation granted before a disqualifying trip is not protection: CBP may revoke an approved ESTA
              at any time, and its Cuba guidance is explicit that for a traveller present in Cuba on or after 12
              January 2021, or holding both a VWP and Cuban nationality,{" "}
              <strong className="text-ink">the ESTA will be revoked</strong>. It can be valid when you book and
              invalid when you fly, so CBP advises applying for a new ESTA or a visa rather than finding out at the
              airport.
            </p>
          </section>

          {/* Dual nationality - a different list */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Dual Nationality: A Separate, Shorter List</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              A second restriction, frequently conflated with the travel one: VWP nationals who are <em>also</em>{" "}
              nationals of the countries below cannot use the Visa Waiver Program at all.
            </p>
            <div className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
              {NATIONALITY_BAR.map((iso3) => (
                <div
                  key={iso3}
                  className="flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0"
                >
                  <span className="text-lg leading-none">{flagFor(iso3)}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-medium text-ink">
                    {nameFor(iso3)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-body mt-4 max-w-3xl text-ink-soft">
              Libya, Somalia and Yemen are deliberately <strong className="text-ink">not</strong> here: going there
              restricts you, holding their nationality does not. The exceptions below do not apply to this rule.
            </p>
          </section>

          {/* Exceptions and waivers */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The Exceptions Are Narrow</h2>
            <p className="text-body mt-3 text-ink-soft">
              Two carve-outs, both about <em>why</em> you were there, both requiring a determination by the Secretary
              of Homeland Security:
            </p>
            <ol className="text-body mt-4 space-y-3 text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mono shrink-0 text-stamp">1</span>
                <span>Presence to perform <strong className="text-ink">military service</strong> in the armed forces of a Visa Waiver Program country.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono shrink-0 text-stamp">2</span>
                <span>Presence to carry out <strong className="text-ink">official duties as a full-time employee</strong> of a Visa Waiver Program country&apos;s government.</span>
              </li>
            </ol>
            <p className="text-body mt-4 text-ink-soft">
              Beyond those, DHS may waive the bar in US law enforcement or national security interests. There is no
              waiver form - eligibility is considered when you apply for an ESTA. Waivers are rare, case-by-case,
              never decided at the border, and not something to plan a trip around.
            </p>
          </section>

          {/* Fee and validity */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Fee, Validity and When You Need a New One</h2>
            <p className="text-body mt-3 text-ink-soft">
              Section 100014 of Public Law 119-21 (4 July 2025) raised the statutory minimum, and CBP began charging
              the inflation-adjusted FY2026 amount on 1 January 2026. It is adjusted annually, so confirm any figure -
              including this one - on{" "}
              <a
                href={OFFICIAL_ESTA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp"
              >
                esta.cbp.dhs.gov
              </a>{" "}
              before you pay.
            </p>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {[
                { k: "FY2026 fee, from 1 January 2026", v: "USD 40.27 per granted authorisation: 17.00 travel promotion, 10.27 operational, 13.00 Treasury General Fund" },
                { k: "If your application is denied", v: "USD 10.27 - the cost-recovery portion is charged to every applicant, the remaining 30.00 only on approval" },
                { k: "Typical validity", v: "Two years, or until your passport expires, whichever is sooner" },
                { k: "Trips covered", v: "Multiple entries within the validity window" },
              ].map(({ k, v }) => (
                <div key={k} className="py-3">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="text-body mt-1 text-ink-soft">{v}</dd>
                </div>
              ))}
            </div>
            <p className="text-body mt-4 text-ink-soft">
              A new passport, name change, change of citizenship or change to any yes/no eligibility answer cannot be
              amended on an existing authorisation: each needs a fresh application and fee.
            </p>
          </section>

          {/* Who needs one */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Who Needs an ESTA ({vwpPassports.length} passports)
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              No visa, but a mandatory pre-travel authorisation - one per traveller, children of any age included,
              for land crossings and transit as well as flights.
            </p>
            <div className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
              {vwpPassports.map((iso3) => (
                <Link
                  key={iso3}
                  href={`/passport/${nameToSlug(nameFor(iso3))}`}
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
            {noEstaNeeded.length > 0 && (
              <p className="text-body mt-4 max-w-3xl text-ink-soft">
                Entering without a visa does not always mean an ESTA:{" "}
                {noEstaNeeded.map((iso3, i) => (
                  <span key={iso3}>
                    {i > 0 && i === noEstaNeeded.length - 1 ? " and " : i > 0 ? ", " : ""}
                    <Link
                      href={`/passport/${nameToSlug(nameFor(iso3))}/${nameToSlug(nameFor("USA"))}`}
                      className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp"
                    >
                      {nameFor(iso3)}
                    </Link>
                  </span>
                ))}{" "}
                enter under separate arrangements, outside the programme entirely.
              </p>
            )}
          </section>

          {/* If you are affected */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">If You Are Affected, You Can Still Travel</h2>
            <p className="text-body mt-3 text-ink-soft">
              Losing VWP eligibility is not a ban - it moves you from the online route to the embassy one: a
              nonimmigrant visa, normally a B-1/B-2, with an application, fee, interview and wait. Keep the ESTA
              denial or revocation: travellers affected by the 2015 Act with imminent business, medical or
              humanitarian travel may request an expedited appointment, and the consulate may ask to see it.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              Entry suspensions by presidential proclamation are a separate regime with their own country lists,
              exceptions and revisions. If one may apply to you, check the current proclamation on the Federal
              Register alongside{" "}
              <a
                href={CBP_VWP_ACT_FAQ}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp"
              >
                CBP&apos;s VWP guidance
              </a>.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">ESTA FAQ</h2>
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

          {/* Sources */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Sources</h2>
            <p className="text-body mt-2 text-ink-soft">
              Every rule here comes from US government publications.
            </p>
            <ul className="card-doc mt-5 divide-y divide-line px-5">
              {[
                { label: "Apply for or check an ESTA (CBP)", href: OFFICIAL_ESTA_URL },
                { label: "VWP Improvement and Terrorist Travel Prevention Act FAQ (CBP)", href: CBP_VWP_ACT_FAQ },
                { label: "ESTA and Visa Waiver Program FAQ (CBP)", href: CBP_ESTA_FAQ },
                { label: "Public Law 114-113, Division O, Title II (the 2015 Act)", href: "https://www.congress.gov/114/plaws/publ113/PLAW-114publ113.pdf" },
              ].map(({ label, href }) => (
                <li key={href} className="py-1.5">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-h-[44px] items-center gap-2.5"
                  >
                    <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                      {label}
                    </span>
                    <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* Corridor mesh */}
          <CorridorLinks
            title="US Entry Rules by Passport"
            description="Entry requirements, stay limits and document notes for travel to the United States."
            links={corridorLinks}
          />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Does your passport need an ESTA or a visa?
            </h2>
            <Link href="/visit" className="btn-stamp mt-5">
              Check your visa requirements →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
