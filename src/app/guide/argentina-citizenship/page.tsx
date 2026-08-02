import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import ReportLine from "@/components/ReportLine";

// ---------------------------------------------------------------------------
// /guide/argentina-citizenship - "argentina citizenship", "how to get argentine
// citizenship", "argentina citizenship by residency", "argentina 2 year
// citizenship", "argentina dual citizenship", "argentina citizenship by
// investment", "carta de ciudadania".
//
// The differentiated angle: almost every article on this topic either (a)
// repeats the "2 years, no investment" headline without the actual legal
// requirements and process, or (b) breathlessly covers the 2025 "citizenship
// by investment" announcement without mentioning that its legal basis was
// struck down by the Camara Nacional Electoral in June 2026 and the program
// has never taken a single applicant. This page does both properly: the real
// constitutional path in full, and the investment shortcut's actual, current,
// contested status, not the press-release version.
//
// Every claim traces to Argentina's Constitution, Ley 346, its regulatory
// Decreto 3213/84, the 2025-2026 DNU/Decreto record, or official government
// pages - the same sourcing already verified in data/countries/ARG.json's
// cbi/rbi blocks, cross-checked again while writing this page. Facts that
// could not be confirmed against an official source (real-world processing
// time, the exact wording of the June 2026 court ruling, whether the
// government has since filed its Supreme Court appeal) are stated as
// unconfirmed rather than asserted.
// ---------------------------------------------------------------------------

const CONSTITUTION_URL = "https://www.congreso.gob.ar/constitucionParte1Cap1.php";
const LEY_346_URL = "https://www.argentina.gob.ar/normativa/nacional/ley-346-48854/texto";
const DECRETO_3213_URL = "https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25471/texact.htm";
const RENTISTA_URL = "https://www.argentina.gob.ar/servicio/obtener-una-residencia-temporaria-como-rentista";
const DNU_366_URL = "https://www.argentina.gob.ar/normativa/nacional/decreto-366-2025-413297/texto";
const DECRETO_524_URL = "https://www.argentina.gob.ar/normativa/nacional/decreto-524-2025-415710";
const CANCILLERIA_DNI_URL = "https://www.cancilleria.gob.ar/es/servicios/dni/primer-ejemplar-por-naturalizacion-carta-de-ciudadania";

const title = "Argentina Citizenship 2026: The Real 2-Year Residency Path";
const description =
  "How to get Argentine citizenship in 2026: the constitutional 2-year residency path, what Ley 346 actually requires, how to start the clock as a resident, and why the 'buy your way in' investment shortcut was struck down by the courts. Sourced from Argentina's Constitution, Ley 346 and official government publications.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "argentina citizenship",
    "argentina citizenship by residency",
    "how to get argentine citizenship",
    "argentina 2 year citizenship",
    "argentina naturalization",
    "carta de ciudadania",
    "argentina dual citizenship",
    "argentina citizenship by investment",
    "argentina residency visa",
    "ley 346 argentina",
    "argentina rentista visa",
    "argentina passport",
    "move to argentina citizenship",
    "argentina citizenship requirements",
    "argentina second passport",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/argentina-citizenship" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/argentina-citizenship",
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

export default function ArgentinaCitizenshipGuidePage() {
  // The three residency programs that actually feed the 2-year naturalisation
  // clock, straight from the dataset that also powers /programs/easiest-citizenship
  // - so this page and that one can never quietly drift apart on the numbers.
  const residencyRoutes = dataset.rbi.filter((r) => r.iso3 === "ARG" && r.path_to_citizenship_years != null);

  // Passport reach: visa-free + visa on arrival + eTA only, e-visas never
  // counted, same methodology as every ranking on the site.
  const argAccess = dataset.passportAccess["ARG"] ?? [];
  const reachCount = argAccess.filter(
    (e) => e.level === "visa_free" || e.level === "visa_on_arrival" || e.level === "eta",
  ).length;

  const faqs = [
    {
      q: "How long do I actually have to live in Argentina before I can apply for citizenship?",
      a: "Two continuous years, for absolutely anyone, regardless of nationality. This comes straight from Article 20 of the Constitution and Ley 346 (the Ley de Ciudadania, 1869), not a policy that can be revised by decree. You also need to be 18 or older, show a lawful means of subsistence (a job, pension, business income or remote income), and have no disqualifying criminal record.",
    },
    {
      q: "Is Argentina's 'citizenship by investment' program real?",
      a: "Not today. Decreto 524/2025 regulates an investment-based naturalisation route that DNU 366/2025 tried to add to Ley 346, but on 30 June 2026 the Camara Nacional Electoral declared that DNU absolutely null, holding that a decree cannot regulate citizenship or electoral matters. The implementation tender was voided in April 2026, and the Ministry of Economy never set a minimum investment amount. The government disputes the ruling and has said it will appeal, but no applications are open and none have ever been processed.",
    },
    {
      q: "Do I have to give up my current citizenship to become Argentine?",
      a: "No. Neither Ley 346 nor its regulatory decree, Decreto 3213/84, requires a naturalising foreigner to renounce their existing nationality. Argentina permits dual citizenship as a matter of course.",
    },
    {
      q: "Is there a language test or history exam?",
      a: "No. Ley 346's core naturalisation path has no formal language exam and no civics or history test. The requirements are residency, age, lawful means of support and good conduct, established before a federal judge.",
    },
    {
      q: "Can naturalised Argentine citizenship be taken away later?",
      a: "Only for fraud, and only by a federal judge, never by an administrative agency. Decreto Reglamentario 3213/84, the regulation to Ley 346, allows a court to annul citizenship obtained through false facts; the defendant gets 15 business days to respond before a ruling. It is not a discretionary or arbitrary power.",
    },
    {
      q: "I don't live in Argentina yet. How do I actually start the 2-year clock?",
      a: "You need a legal temporary residence status first. The two routes with a published, official path to the 2-year citizenship clock are an investor residence (roughly " +
        (residencyRoutes[0] ? fmtMoney(residencyRoutes[0].min_amount, residencyRoutes[0].currency) : "ARS 1,500,000") +
        " in a productive, commercial or service activity) and the Rentista route for people with passive income from abroad, currently set at 5 times the SMVM (Salario Minimo, Vital y Movil), an indexed floor rather than a fixed peso figure.",
    },
    {
      q: "How long does the citizenship process actually take once I apply?",
      a: "No government page publishes an average end-to-end duration, so treat any figure, including ranges commonly cited by immigration lawyers of a few months to one or two years, as anecdotal rather than official. It depends on the caseload of the federal court handling your file. The 2-year residency requirement is a minimum eligibility threshold, not a promise about how fast the paperwork moves after that.",
    },
    {
      q: "Do I apply through a government office or a court?",
      a: "A federal court. The application (solicitud de carta de ciudadania) is filed with, and the Carta de Ciudadania is issued by, the federal judge with jurisdiction over your district - the system in place since 1869. A 2025 decree briefly tried to move this to the immigration agency (DNM), but the Camara Nacional Electoral struck that change down in June 2026 and restored the judicial route nationwide.",
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
          { "@type": "ListItem", position: 3, name: "Argentina Citizenship", item: "https://earthvisa.in/guide/argentina-citizenship" },
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Argentina Citizenship</span>
            </nav>

            <div className="mt-6">
              <h1 className="text-display text-ink">
                Argentina Gives Citizenship in 2 Years
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  No investment, no language test, and why the &quot;buy it&quot; shortcut is not real
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Constitution Art. 20 + Ley 346, verified against official sources
              </p>
            </div>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Years of residence", v: "2" },
                { k: "Investment required", v: "$0" },
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

          {/* The constitutional right */}
          <section className="mt-10 max-w-3xl">
            <h2 className="text-section text-ink">A Right Written Into the Constitution</h2>
            <p className="text-body mt-3 text-ink-soft">
              Most countries hand out citizenship through immigration policy, which a government can tighten at will.
              Argentina&apos;s core path runs through its <strong className="text-ink">Constitution</strong> itself,
              Article 20: foreigners obtain naturalisation by residing two continuous years in the nation, and even
              that term can be shortened for those who render services to the Republic. The implementing statute,{" "}
              <strong className="text-ink">Ley 346</strong> (the Ley de Ciudadania, on the books since 1869),
              specifies who qualifies: foreigners 18 or older who have resided in the Republic for two continuous
              years, who show a lawful occupation and good conduct, decided through summary judicial proceedings
              before a federal judge.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              The law also explicitly bars a judge from denying an application for political, ideological, union,
              religious or racial reasons. Read the text yourself at{" "}
              <a href={CONSTITUTION_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                congreso.gob.ar
              </a>{" "}
              (Constitution) and{" "}
              <a href={LEY_346_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                argentina.gob.ar
              </a>{" "}
              (Ley 346).
            </p>
          </section>

          {/* What it actually takes */}
          <section className="mt-12">
            <h2 className="text-section text-ink">What It Actually Takes</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              Strip away the marketing angle and the requirements are short. This is the entire list, no hidden
              extras:
            </p>
            <ol className="mt-5 space-y-3">
              {[
                { t: "Be 18 or older", d: "No exception by nationality, and no minimum age discount for length of residence." },
                { t: "Live in Argentina for 2 continuous years", d: "The statutory minimum. It can be reduced for people who render specific services to the Republic, but the standard route is 2 years for everyone." },
                { t: "Show a lawful means of subsistence", d: "A job, pension, business income or remote income - documented, not merely declared." },
                { t: "Have good conduct and no disqualifying criminal record", d: "Assessed as part of the judicial process, not a separate application." },
                { t: "File before a federal judge, not an administrative office", d: "The application is a judicial proceeding (juicio sumario), decided by the federal court with jurisdiction over your address." },
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
              No formal language exam. No history or civics test. No minimum investment. Compare that with most
              European naturalisation routes, which typically run 5 to 10 years and require a language certificate.
            </p>
          </section>

          {/* The process */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The Process: a Judicial Route, Not a Government Office</h2>
            <p className="text-body mt-3 text-ink-soft">
              The application, called a <strong className="text-ink">solicitud de carta de ciudadania</strong>, is
              filed with the federal court in your district, not an immigration counter. Typical supporting
              documents include your DNM certificate of permanent residence, a DNI with your current address, an
              apostilled birth certificate with sworn translation if needed, criminal-record certificates from
              Argentina and any country you previously resided in, and proof of lawful income for the preceding
              months. After the court&apos;s own investigation and a favourable ruling, you attend a swearing-in
              hearing before the judge and receive the Carta de Ciudadania, which you then use to process your
              naturalised DNI within one year.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              This judicial system has run since 1869. In 2025, DNU 366/2025 tried to shift the granting authority to
              the immigration agency (DNM) and tighten &quot;continuous residence&quot; to mean zero absences from
              the country during the 2 years. On 30 June 2026 the Camara Nacional Electoral declared that decree
              absolutely null (case &quot;Yang, Liping&quot;), holding that citizenship is bound up with political
              and electoral rights and therefore falls outside what a decree can touch. The court ordered every
              federal judge with electoral jurisdiction nationwide to be notified, restoring the judicial route as
              the operative system. The government disputes the ruling, maintains the decree is still in force in
              its own view, and has said it will appeal to the Corte Suprema, though no filing or ruling has been
              confirmed as of early August 2026. Treat this as a live legal dispute, not a settled question, and
              check{" "}
              <a href={CANCILLERIA_DNI_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Cancilleria&apos;s own page
              </a>{" "}
              on the post-naturalisation DNI step for the current procedure.
            </p>
            <div className="card-doc card-doc-rule mt-5 p-4">
              <h3 className="mono-chrome">How long does it really take?</h3>
              <p className="text-body mt-2.5 text-ink-soft">
                No official source publishes an average processing time. Immigration lawyers and relocation sites
                cite anywhere from a few months to one or two years depending on the individual court&apos;s
                caseload. Treat that range as practitioner-reported, not government-confirmed, and expect it to vary
                by district.
              </p>
            </div>
          </section>

          {/* Starting the clock */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Starting the Clock: How to Become a Resident First</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              The 2-year count only runs once you hold a legal residence status. These are the routes with a
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
            <p className="text-body mt-4 max-w-3xl text-ink-soft">
              The Rentista route&apos;s minimum is set at 5 times the SMVM (Salario Minimo, Vital y Movil), an
              indexed wage floor rather than a fixed peso amount, so it moves with the SMVM itself instead of eroding
              with inflation. See the{" "}
              <a href={RENTISTA_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                official Rentista visa page
              </a>{" "}
              for the current figure and required documents.
            </p>
          </section>

          {/* Dual citizenship */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">You Keep Your Passport</h2>
            <p className="text-body mt-3 text-ink-soft">
              Neither Ley 346 nor its regulatory decree, Decreto 3213/84, contains a renunciation requirement. That
              absence, not a single government FAQ stating it outright, is the basis for confirming dual citizenship
              is permitted: nothing in the primary legislation forces you to give up your original nationality to
              become Argentine.
            </p>
          </section>

          {/* Revocation */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Can It Be Taken Away Later?</h2>
            <p className="text-body mt-3 text-ink-soft">
              Only for fraud, and only through a court, never at an official&apos;s discretion.{" "}
              <a href={DECRETO_3213_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Decreto Reglamentario 3213/84
              </a>
              , the regulation to Ley 346, allows nullity proceedings where citizenship was obtained by naturalisation
              or option based on false facts. A prosecutor joins the case, the defendant gets 15 business days to
              respond, and if nullity is declared, the national registry, the electoral court and the immigration
              agency are all formally notified. This decree was restored to force, along with Ley 346 itself, by Ley
              23.059 in 1984, which repealed the military dictatorship&apos;s Ley 21.795 - it is the decree, not Ley
              23.059 directly, that creates the fraud-nullity mechanism.
            </p>
          </section>

          {/* The investment shortcut */}
          <section className="mt-12">
            <h2 className="text-section text-ink">The &quot;Buy Citizenship&quot; Shortcut Is Not Real</h2>
            <p className="text-body mt-3 max-w-3xl text-ink-soft">
              In 2025 Argentina announced an investment-based citizenship track with no residency requirement.
              As of today, it has never processed a single applicant, and its legal foundation is actively disputed.
              Here is the actual sequence, not the press-release version:
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <div className="card-doc p-4">
                <h3 className="mono-chrome">What was announced</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><a href={DNU_366_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 hover:decoration-stamp">DNU 366/2025</a> (May 2025) added an investment-based naturalisation ground to Ley 346, no residency required</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span><a href={DECRETO_524_URL} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 hover:decoration-stamp">Decreto 524/2025</a> (July 2025) set a 30-business-day decision window and security-clearance rules</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>A tender to build the program launched in December 2025</span></li>
                </ul>
              </div>
              <div className="card-doc p-4">
                <h3 className="mono-chrome">What is actually true today</h3>
                <ul className="text-body mt-2.5 space-y-2 text-ink-soft">
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>The Camara Nacional Electoral declared DNU 366/2025 absolutely null on 30 June 2026, nationwide in effect</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>The implementation tender was voided in April 2026 - no contract, no program, no bidder compensation</span></li>
                  <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>No minimum investment amount was ever fixed by regulation; a ~USD 500,000 figure was reported in the press but never enacted</span></li>
                </ul>
              </div>
            </div>
            <p className="text-body mt-4 max-w-3xl text-ink-soft">
              The government disagrees with the court and says the decree remains in force in its own view, and has
              signalled it will appeal to the Corte Suprema. No appeal filing or ruling has been confirmed as of
              early August 2026. Whatever happens next, there is no functioning application process today, and the
              real, working path to Argentine citizenship remains the 2-year residency route above.
            </p>
          </section>

          {/* What you get */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">What Argentine Citizenship Actually Gets You</h2>
            <p className="text-body mt-3 text-ink-soft">
              Our data records the Argentine passport reaching{" "}
              <strong className="text-ink">{reachCount} destinations</strong> without a pre-arranged visa: visa-free
              entry, visa on arrival or an eTA. E-visas are never folded into that count on this site, since an
              e-visa is an application you can be refused, not a door that is already open. See the full breakdown
              on the{" "}
              <Link href="/passport/argentina" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Argentine passport page
              </Link>
              .
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Argentina Citizenship FAQ</h2>
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
              Every rule on this page traces to Argentina&apos;s Constitution, its statutes, or an official
              government publication. Where a fact could not be confirmed against a primary source, this page says
              so rather than repeating what other sites assume.
            </p>
            <ul className="card-doc mt-5 divide-y divide-line px-5">
              {[
                { label: "Constitucion de la Nacion Argentina, Art. 20 (Congreso)", href: CONSTITUTION_URL },
                { label: "Ley 346, texto original (argentina.gob.ar)", href: LEY_346_URL },
                { label: "Decreto Reglamentario 3213/84 (InfoLeg)", href: DECRETO_3213_URL },
                { label: "Residencia Temporaria como Rentista (argentina.gob.ar)", href: RENTISTA_URL },
                { label: "DNU 366/2025, texto (argentina.gob.ar)", href: DNU_366_URL },
                { label: "Decreto 524/2025, texto (argentina.gob.ar)", href: DECRETO_524_URL },
                { label: "DNI por naturalizacion, tramite posterior (Cancilleria)", href: CANCILLERIA_DNI_URL },
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
                { href: "/passport/argentina", label: "What the Argentine passport can do", flag: "ar" },
                { href: "/destination/argentina", label: "Visa requirements for visiting Argentina", flag: "ar" },
                { href: "/guide/mexico-citizenship", label: "Compare: Mexico's tiered citizenship path", flag: null },
                { href: "/programs/easiest-citizenship", label: "Every country's fastest citizenship path", flag: null },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 transition first:border-t-0 hover:bg-paper-2/50 sm:first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                >
                  {l.flag && <span className="text-lg leading-none">{flagFor("ARG")}</span>}
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
              Comparing Argentina against another country?
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
