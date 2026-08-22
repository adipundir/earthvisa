import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import ReportLine from "@/components/ReportLine";

// ---------------------------------------------------------------------------
// /guide/mexico-citizenship - "mexico citizenship", "how to get mexican
// citizenship", "mexico naturalization", "mexico dual citizenship", "mexico
// citizenship by investment", "mexico rentista visa", "ley de nacionalidad".
//
// The differentiated angle: most coverage flattens Mexico's naturalisation
// law to a single "5 years" headline. It is actually four different tracks
// (5 years standard, 2 years for a spouse or a Latin American/Iberian
// national, 1 year for an adoptee or minor, and a discretionary waiver for
// notable contributions) plus a mandatory exam nobody mentions. This page
// also corrects a real, live error this site had: the Rentista residency
// visa's income thresholds were stale by a year (a July 2025 regulatory
// reform was never reflected), caught and fixed while researching this page.
//
// Every claim traces to Mexico's Ley de Nacionalidad, its Reglamento, or an
// official SRE (Secretaria de Relaciones Exteriores) publication. Facts that
// could not be confirmed against a primary source (the exact revocation
// article numbers, the exact Ley Federal de Derechos citation for the fee)
// are stated as unconfirmed rather than asserted.
// ---------------------------------------------------------------------------

const LEY_URL = "https://sre.gob.mx/ley-de-nacionalidad?start=2";
const RESIDENCIA_URL = "https://portales.sre.gob.mx/tramites-dgaj/naturalizacion/carta-de-naturalizacion-por-residencia";
const LATAM_URL = "https://portales.sre.gob.mx/tramites-dgaj/naturalizacion/carta-de-naturalizacion-por-ser-originario-de-un-pais-latinoamericano-o-de-la-peninsula-iberica";
const INSTRUCTIVO_URL = "https://portales.sre.gob.mx/tramites-dgaj/naturalizacion/instructivo-para-obtener-la-nacionalidad-mexicana-por-naturalizacion";
const COSTOS_URL = "https://portales.sre.gob.mx/tramites-dgaj/nacionalidad/costos-de-servicios-de-nacionalidad-y-naturalizacion";
const RENTISTA_URL = "https://consulmex.sre.gob.mx/reinounido/index.php/es/contenido/96-rentista-visitor-carnet-visa";
const NATURALIZACION_URL = "https://www.gob.mx/sre/acciones-y-programas/naturalizacion-de-extranjeros";

const title = "Mexico Citizenship 2026: The Real Naturalization Timeline";
const description =
  "How to get Mexican citizenship in 2026: the 5-year standard path, the 2-year and 1-year fast tracks, the mandatory exam, the real fee, and how to actually start the residency clock. Sourced from Mexico's Ley de Nacionalidad and official SRE publications, including a corrected residency-visa income threshold this site had wrong.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/guide/mexico-citizenship" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/mexico-citizenship",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

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

export default function MexicoCitizenshipGuidePage() {
  // The two residency routes with a published path to the naturalisation
  // clock, straight from the same official-source data behind every ranking
  // on this site - so this page and the data can never quietly drift apart.
  const residencyRoutes = dataset.rbi.filter((r) => r.iso3 === "MEX" && r.path_to_citizenship_years != null);

  const mexAccess = dataset.passportAccess["MEX"] ?? [];
  const reachCount = mexAccess.filter(
    (e) => e.level === "visa_free" || e.level === "visa_on_arrival" || e.level === "eta",
  ).length;

  const faqs = [
    {
      q: "How long do I have to live in Mexico before I can apply for citizenship?",
      a: "It depends which track you qualify for. The standard path is 5 continuous years of legal residence (Ley de Nacionalidad, Art. 20). It drops to 2 years if you marry a Mexican national or already hold a Latin American or Iberian Peninsula passport, and to just 1 year for adoptees and minors under a Mexican national's legal guardianship. In rare cases the President can waive the residency requirement entirely for notable scientific, artistic, sporting or business contributions.",
    },
    {
      q: "Is there an exam?",
      a: "Yes, a Spanish-language exam plus a Mexican history and culture exam (Ley Art. 19-III, Reglamento Art. 14). Refugees, minors, and applicants 60 or older are exempt from the history and culture portion, but everyone still has to pass the Spanish-language exam.",
    },
    {
      q: "Do I apply at a government office or a court?",
      a: "An office, not a court. Naturalization is handled entirely by SRE (the Secretaria de Relaciones Exteriores, through its Direccion de Nacionalidad) as an administrative process. This is a genuine point of contrast with Argentina, whose equivalent process is constitutionally a judicial one decided by a federal judge.",
    },
    {
      q: "Does Mexico have a citizenship by investment program?",
      a: "No. There is no direct path to citizenship through investment alone. Investment can accelerate qualifying for a residency visa, which then still requires the same years of physical residence as anyone else before you can apply to naturalize.",
    },
    {
      q: "Do I have to give up my current citizenship?",
      a: "No. Since a 1998 reform to Article 32 of the Constitution, acquiring Mexican citizenship does not require renouncing your prior nationality, and Mexican citizens who acquire another nationality do not lose their Mexican one either.",
    },
    {
      q: "How much does the application cost?",
      a: "MXN $9,500 for 2026, per Anexo 4 of the Resolucion Miscelanea Fiscal, confirmed on two official SRE fee pages. That covers the naturalization procedure itself, not apostilles, translations or any legal assistance you use.",
    },
    {
      q: "How do I actually start the residency clock if I don't live in Mexico yet?",
      a: "You need a legal temporary or permanent resident status first. The two routes with a published path to the citizenship clock are an investor visa (currently around " +
        (residencyRoutes[0] ? fmtMoney(residencyRoutes[0].min_amount, residencyRoutes[0].currency) : "MXN 5,378,663") +
        ") and the Rentista route for people with passive income from abroad. The Rentista thresholds were revised in a July 2025 regulatory reform - the current official minimum is 680 UMA-days a month in income, or 11,460 UMA-days in savings; the older real-estate-ownership option no longer appears on the official page.",
    },
    {
      q: "Can naturalized Mexican citizenship be taken away later?",
      a: "Yes, through an SRE administrative process, not a court: SRE must first obtain an opinion from SEGOB, then give the affected person a hearing, before revoking the naturalization letter for cause. Reported causes include voluntarily acquiring a foreign nationality, holding yourself out as a foreigner, or living abroad for 5 or more continuous years. The exact article numbers behind this process could not be independently confirmed against a primary source at time of writing, so treat the substance as reliable and the precise citation as unconfirmed.",
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
          { "@type": "ListItem", position: 3, name: "Mexico Citizenship", item: "https://earthvisa.in/guide/mexico-citizenship" },
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Mexico Citizenship</span>
            </nav>

            <div className="mt-6">
              <h1 className="text-display text-ink">
                Mexico&apos;s Citizenship Clock Has Four Speeds
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  5 years, 2 years, or 1, depending who you are, plus the exam nobody mentions
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Ley de Nacionalidad Art. 20, verified against official SRE sources
              </p>
            </div>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Standard residency", v: "5 yrs" },
                { k: "Fastest track", v: "1 yr" },
                { k: "Dual citizenship", v: "Yes" },
                { k: "Passport reach", v: `${reachCount} places` },
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

          {/* The tiered right */}
          <section className="mt-10">
            <h2 className="text-section text-ink">A Tiered Right, Not a Single Number</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              Most coverage flattens Mexican naturalization to &quot;5 years.&quot; Article 20 of the{" "}
              <strong className="text-ink">Ley de Nacionalidad</strong> actually sets out four different tracks, and
              which one applies to you can cut years off the standard timeline:
            </p>
            <ol className="mt-5 space-y-3">
              {[
                { t: "5 years - the standard path", d: "Continuous legal residence in Mexico, for anyone who doesn't qualify for a faster track (Art. 20, chapeau)." },
                { t: "2 years - spouse of a Mexican national", d: "2 years of cohabitation at a shared domicile in Mexico with your Mexican-national spouse (Art. 20-II)." },
                { t: "2 years - Latin American or Iberian Peninsula nationals", d: "Argentine, Spanish, Brazilian, Colombian and other Ibero-American passport holders qualify for the same 2-year track (Art. 20-I(c))." },
                { t: "1 year - adoptees and minors", d: "Foreign minors under the legal guardianship (patria potestad) of a Mexican national (Art. 20-III)." },
                { t: "Discretionary waiver - notable contributions", d: "The President may waive the residency requirement entirely for applicants with recognized scientific, artistic, sporting or business contributions to the nation (Art. 20-I(d))." },
              ].map((s, i) => (
                <li key={s.t} className="card-doc flex gap-4 p-4">
                  <span className="mono text-lg font-semibold tabular-nums text-stamp">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">{s.t}</h3>
                    <p className="text-body mt-1 text-ink-soft">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-body mt-4 max-w-3xl text-ink-soft">
              Read the law itself at{" "}
              <a href={LEY_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                sre.gob.mx
              </a>
              , and see SRE&apos;s own modality pages for the{" "}
              <a href={RESIDENCIA_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                standard residency track
              </a>{" "}
              and the{" "}
              <a href={LATAM_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Latin American / Iberian track
              </a>
              .
            </p>
          </section>

          {/* The exam */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The Exam Nobody Mentions</h2>
            <p className="text-body mt-3 text-ink-soft">
              Every track above shares the same requirement most articles skip: a{" "}
              <strong className="text-ink">Spanish-language exam</strong>, plus a{" "}
              <strong className="text-ink">Mexican history and culture exam</strong> (Ley Art. 19-III, Reglamento Art.
              14). Refugees, minors, and applicants 60 or older are exempt from the history and culture half, but
              everyone still has to pass the Spanish-language portion. Alongside the exam you need federal and local
              criminal-record clearances, and proof you meet the residency track you&apos;re applying under. This is a
              real point of difference from Argentina&apos;s equivalent process, which has no formal language or
              history exam at all.
            </p>
          </section>

          {/* The process */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The Process: an Office, Not a Court</h2>
            <p className="text-body mt-3 text-ink-soft">
              Naturalization is handled entirely by <strong className="text-ink">SRE</strong> (the Secretaria de
              Relaciones Exteriores, through its Direccion de Nacionalidad) as an administrative procedure, never a
              court. See SRE&apos;s own{" "}
              <a href={INSTRUCTIVO_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                instructivo
              </a>{" "}
              for the current document checklist. A 2026 procedural reform reportedly cut SRE&apos;s internal target
              from 90 calendar days to 40 business days and consolidated several separate application forms into one,
              though the underlying official publication behind that specific figure could not be independently
              located, so treat it as reported rather than primary-confirmed. Mexico&apos;s Reglamento separately sets
              a 3-month ceiling for SRE&apos;s own resolution once the immigration authority&apos;s favorable opinion
              is in hand.
            </p>
            <div className="card-doc card-doc-rule mt-5 p-4">
              <h3 className="mono-chrome">How long does it really take?</h3>
              <p className="text-body mt-2.5 text-ink-soft">
                No official SRE statistics page publishes an average end-to-end duration. Immigration-law
                practitioners commonly cite roughly 6 months in Mexico City and longer elsewhere, with an overall
                range of 8 to 18 months from filing to receiving the naturalization letter once document
                prevenciones and background-check turnaround are factored in. Treat that range as practitioner-
                reported, not official.
              </p>
            </div>
          </section>

          {/* The fee */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The Fee</h2>
            <p className="text-body mt-3 text-ink-soft">
              The naturalization procedure costs <strong className="text-ink">MXN $9,500</strong> for 2026, per Anexo
              4 of the Resolucion Miscelanea Fiscal, confirmed on two separate{" "}
              <a href={COSTOS_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                official SRE fee pages
              </a>
              . That figure covers the naturalization service itself; apostilles, sworn translations and any legal
              help you use are separate.
            </p>
          </section>

          {/* Starting the clock */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Starting the Clock: How to Become a Resident First</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              The residency count only runs once you hold a legal resident status. These are the routes with a
              published path from temporary residence through to the citizenship clock, straight from the same
              official-source data behind every ranking on this site:
            </p>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {residencyRoutes.map((r) => (
                <div key={r.program_name} className="py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <dt className="font-display text-[15px] font-semibold text-ink">{r.program_name}</dt>
                    <dd className="mono shrink-0 text-[13px] tabular-nums text-stamp">
                      {r.min_amount != null ? fmtMoney(r.min_amount, r.currency) : "no fixed minimum"}
                    </dd>
                  </div>
                  <p className="text-body mt-1.5 text-ink-soft">{r.notes}</p>
                </div>
              ))}
            </div>
            <div className="card-doc card-doc-rule mt-5 p-4">
              <h3 className="mono-chrome">A correction we made while researching this page</h3>
              <p className="text-body mt-2.5 text-ink-soft">
                The Rentista visa&apos;s income thresholds were revised by a Mexican government reform in July 2025 -
                the current official minimum is 680 UMA-days a month in income (roughly $4,570 at recent exchange
                rates), or 11,460 UMA-days in savings (roughly $77,015). An older real-estate-ownership alternative no
                longer appears on the official page. We found our own data on this was a year out of date while
                fact-checking this article and corrected it - see the{" "}
                <a href={RENTISTA_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                  official Rentista visa page
                </a>{" "}
                for the current figures.
              </p>
            </div>
          </section>

          {/* Dual citizenship */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">You Keep Your Passport</h2>
            <p className="text-body mt-3 text-ink-soft">
              Since a 1998 reform to Article 32 of the Constitution, becoming Mexican does not require renouncing your
              existing nationality, and Mexican citizens who acquire another nationality do not lose their Mexican
              one either. The only carve-out is that certain reserved public offices (the presidency, cabinet
              secretaries, the military officer corps) are limited to citizens who are Mexican by birth and hold no
              other nationality - a restriction that doesn&apos;t affect naturalized citizens generally, since they
              are already excluded from those specific offices by birth status regardless.
            </p>
          </section>

          {/* Revocation */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Can It Be Taken Away Later?</h2>
            <p className="text-body mt-3 text-ink-soft">
              Yes, but only through an SRE administrative process, not automatically and not at a single
              official&apos;s discretion. SRE must first obtain an opinion from SEGOB (the Interior Ministry), then
              grant the affected person a hearing, before revoking a naturalization letter by reasoned resolution.
              Reported grounds include voluntarily acquiring a foreign nationality through your own request, holding
              yourself out as a foreigner in an official document, or residing abroad for 5 or more continuous years.
              The exact Ley de Nacionalidad article numbers behind this chapter could not be independently confirmed
              against a primary source at time of writing - the substance is corroborated across multiple sources,
              but treat the precise citation as unconfirmed until independently re-verified.
            </p>
          </section>

          {/* No investment shortcut */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">No Investment Shortcut Exists</h2>
            <p className="text-body mt-3 text-ink-soft">
              Unlike some countries, Mexico has no citizenship-by-investment program, and a fresh check found no
              proposed or enacted scheme as of August 2026. Investment can get you into a residency visa faster, but
              it does not shorten the years of physical residence the naturalization law itself requires.
            </p>
          </section>

          {/* What you get */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">What Mexican Citizenship Actually Gets You</h2>
            <p className="text-body mt-3 text-ink-soft">
              Our data records the Mexican passport reaching <strong className="text-ink">{reachCount} destinations</strong>{" "}
              without a pre-arranged visa: visa-free entry, visa on arrival or an eTA. E-visas are never folded into
              that count on this site, since an e-visa is an application you can be refused, not a door that is
              already open. See the full breakdown on the{" "}
              <Link href="/passport/mexico" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Mexican passport page
              </Link>
              .
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Mexico Citizenship FAQ</h2>
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
              Every rule on this page traces to Mexico&apos;s Ley de Nacionalidad, its Reglamento, or an official SRE
              publication. Where a fact could not be confirmed against a primary source, this page says so rather
              than repeating what other sites assume.
            </p>
            <ul className="card-doc mt-5 divide-y divide-line px-5">
              {[
                { label: "Ley de Nacionalidad, texto (SRE)", href: LEY_URL },
                { label: "Carta de naturalizacion por residencia (SRE)", href: RESIDENCIA_URL },
                { label: "Carta de naturalizacion, Latinoamerica / Peninsula Iberica (SRE)", href: LATAM_URL },
                { label: "Instructivo para obtener la nacionalidad mexicana (SRE)", href: INSTRUCTIVO_URL },
                { label: "Costos de servicios de nacionalidad y naturalizacion (SRE)", href: COSTOS_URL },
                { label: "Residencia Temporaria - Rentista (Consulado de Mexico)", href: RENTISTA_URL },
                { label: "Naturalizacion de extranjeros, overview (SRE)", href: NATURALIZACION_URL },
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

          {/* Related */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Related</h2>
            <div className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5">
              {[
                { href: "/passport/mexico", label: "What the Mexican passport can do", flag: true },
                { href: "/destination/mexico", label: "Visa requirements for visiting Mexico", flag: true },
                { href: "/guide/argentina-citizenship", label: "Compare: Argentina's 2-year citizenship path", flag: false },
                { href: "/programs/easiest-citizenship", label: "Every country's fastest citizenship path", flag: false },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 transition first:border-t-0 hover:bg-paper-2/50 sm:first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                >
                  {l.flag && <span className="text-lg leading-none">{flagFor("MEX")}</span>}
                  <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                    {l.label}
                  </span>
                  <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              ))}
            </div>
          </section>

          <ReportLine />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Comparing Mexico against another country?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              See every country&apos;s real path to citizenship, residency programs and passport reach, sourced from
              official governments only.
            </p>
            <Link href="/programs/easiest-citizenship" className="btn-stamp mt-5">
              Compare citizenship paths →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
