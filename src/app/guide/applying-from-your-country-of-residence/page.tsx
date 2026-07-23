import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM, nameToSlug } from "@/lib/corridors";
import { LEVEL_LABEL } from "@/lib/compute";
import type { AccessLevel } from "@/lib/types";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/applying-from-your-country-of-residence
//
// Fills a structural gap the nationality -> destination corridor model cannot
// express. Search Console shows a live cluster the site currently cannot serve:
// "<destination> visa from Qatar" (uk/switzerland/germany/new zealand, positions
// 39-67, zero clicks). These are RESIDENCE-based searches: expats in the Gulf
// applying from a country they live in but are not citizens of.
//
// The thesis, and the one thing every one of these searchers gets wrong:
//   - Your NATIONALITY decides WHETHER you need a visa (the site already knows
//     this per corridor - an Indian passport needs a UK visa whether you live
//     in Delhi or Doha).
//   - Your RESIDENCE decides WHERE and HOW you apply (which consulate has
//     jurisdiction, which visa application centre, what proof of residence).
//
// Sourcing note (official-source-first): the UK "apply from the country where
// you live" + biometrics-at-a-VAC facts are gov.uk-grounded. The Schengen
// consular-competence rule is the EU Visa Code (Regulation (EC) No 810/2009,
// Arts 5-6); EUR-Lex would not yield a verbatim quote through the fetchers at
// build time, so it is stated as the rule and linked, with the honest
// "confirm with the specific consulate" caveat rather than an unverified quote.
// The per-nationality visa requirements in the table are computed from the
// dataset, never asserted.
// ---------------------------------------------------------------------------

const GOVUK_STANDARD_VISITOR = "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa";
const GOVUK_FIND_VAC = "https://www.gov.uk/find-a-visa-application-centre";
const EU_VISA_CODE = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02009R0810-20200202";

// The audience: nationalities that make up the bulk of Gulf expat residents and
// that appear in the "visa from Qatar / from Dubai" query cluster.
const RESIDENT_NATS = ["IND", "PHL", "PAK", "BGD", "EGY", "NPL", "LKA"];
// The destinations those searches are about, plus the obvious neighbours.
const DESTS = ["GBR", "FRA", "USA", "CAN", "AUS", "NZL"];
// Short column headers so the table fits; France stands in for the Schengen area.
const DEST_HEADER: Record<string, string> = {
  GBR: "UK",
  FRA: "Schengen",
  USA: "USA",
  CAN: "Canada",
  AUS: "Australia",
  NZL: "New Zealand",
};

const title = "Applying for a Visa from Your Country of Residence (Gulf Residents) 2026";
const description =
  "Living in the UAE, Qatar or Saudi Arabia but not a citizen? Your nationality decides whether you need a visa; your residence decides where you apply. How to apply for a UK, Schengen or US visa from where you live - with your passport's actual requirements.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "visa from qatar",
    "visa from dubai",
    "uk visa from qatar",
    "schengen visa from uae",
    "applying for a visa as an expat",
    "visa from country of residence",
    "uk visit visa from qatar",
    "us visa from saudi arabia",
    "visa application for gulf residents",
    "can i apply for a visa where i live",
    "schengen visa from dubai",
    "visa for expats gcc",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/applying-from-your-country-of-residence" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/applying-from-your-country-of-residence",
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

function accessLevel(nat: string, dest: string): AccessLevel | null {
  const e = (dataset.passportAccess[nat] ?? []).find((x) => x.dest === dest);
  return (e?.level as AccessLevel | undefined) ?? null;
}

export default function ResidenceVisaGuidePage() {
  // For each nationality x destination, resolve the real access level from the
  // dataset and pick a link target that always exists: the corridor page when it
  // carries content, otherwise the nationality's passport page (never a 404).
  const rows = RESIDENT_NATS.map((nat) => ({
    nat,
    cells: DESTS.map((dest) => {
      const level = accessLevel(nat, dest);
      const label = level ? LEVEL_LABEL[level] : "Visa required";
      const href = isUsefulCorridor(nat, dest)
        ? `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`
        : `/passport/${nameToSlug(nameFor(nat))}`;
      return { dest, label, href, visaRequired: level === null };
    }),
  }));

  // Corridor mesh: the exact searched intents (resident-nationality -> the two
  // destinations with the most "from Qatar" volume), pruned to real pages.
  const corridorLinks = RESIDENT_NATS.flatMap((nat) =>
    ["GBR", "FRA"]
      .filter((dest) => isUsefulCorridor(nat, dest))
      .map((dest) => ({
        href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`,
        label: `${nameFor(dest)} for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
        iso3: dest,
      })),
  );

  const faqs = [
    {
      q: "Can I apply for a UK visit visa from Qatar if I am not Qatari?",
      a: "Yes. gov.uk states you can apply for a UK visit visa from any country whether you are resident there or not, though it may take longer if you are not resident. You apply online, then attend a visa application centre in your country of residence (run by VFS Global or TLScontact) to give your fingerprints and photo. Whether you need the visa at all is decided by your passport, not by living in Qatar - most Indian, Filipino, Pakistani and Egyptian passport holders do need one.",
    },
    {
      q: "Does living in Dubai or Saudi Arabia get me visa-free travel?",
      a: "No. Residence in a Gulf state does not change your nationality, and visa-free access is tied to nationality. An Indian citizen living in Dubai still travels on an Indian passport and still needs whatever that passport needs. What Gulf residence changes is where you apply - you can lodge the application in the Gulf rather than travelling home to do it.",
    },
    {
      q: "Which country's embassy do I apply to for a Schengen visa?",
      a: "Two rules combine. You apply to the consulate of the Schengen country that is your main destination (or, if you are visiting several equally, the country you enter first). And under the EU Visa Code you lodge it in the country where you are legally resident - so a resident of the UAE applies at that destination country's mission or visa centre in the UAE. Confirm the exact centre with that consulate, as arrangements vary.",
    },
    {
      q: "What do I need to prove residence?",
      a: "Consulates typically ask for a valid residence permit or ID for the country you are applying from, usually valid for a period beyond your intended return - three months beyond is a common Schengen requirement, but it varies by consulate. This is in addition to the normal documents your nationality's application requires. Always check the specific mission's published list.",
    },
    {
      q: "I am a citizen of X but live in Y. Which one matters?",
      a: "Both, for different things. Your citizenship (the passport you hold) decides whether a visa is required and which application applies to you. Your country of legal residence decides where you submit that application and the proof-of-residence documents you add. Use the table above to see what your specific passport needs, then apply from where you live.",
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
          {
            "@type": "ListItem",
            position: 3,
            name: "Applying from your country of residence",
            item: "https://earthvisa.in/guide/applying-from-your-country-of-residence",
          },
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Applying from where you live</span>
            </nav>

            <div className="mt-6">
              <h1 className="text-display text-ink">
                Applying from Where You Live
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  Your nationality decides if you need a visa. Your residence decides where you apply.
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                For expat residents of the UAE, Qatar, Saudi Arabia and the wider Gulf
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Decides if you need a visa", v: "Nationality" },
                { k: "Decides where you apply", v: "Residence" },
                { k: "Nationalities below", v: String(RESIDENT_NATS.length) },
                { k: "Destinations below", v: String(DESTS.length) },
              ].map(({ k, v }) => (
                <div key={k} className="bg-card px-4 py-2.5">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="mt-0.5 text-lg font-semibold sm:text-xl">{v}</dd>
                </div>
              ))}
            </dl></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Two questions */}
          <section className="mt-10 max-w-3xl">
            <h2 className="text-section text-ink">Two Questions People Merge Into One</h2>
            <p className="text-body mt-3 text-ink-soft">
              If you searched something like <em>&ldquo;UK visit visa from Qatar&rdquo;</em> or{" "}
              <em>&ldquo;Schengen visa from Dubai&rdquo;</em>, you are really asking two different questions, and
              almost every guide answers only one of them.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <div className="card-doc p-4">
                <h3 className="mono-chrome">Do I need a visa?</h3>
                <p className="text-body mt-2.5 text-ink-soft">
                  Decided by your <strong className="text-ink">nationality</strong> - the passport you hold. Living
                  in the Gulf does not change it. An Indian citizen needs a UK visa whether they live in Delhi or
                  Doha, because the passport is Indian either way.
                </p>
              </div>
              <div className="card-doc p-4">
                <h3 className="mono-chrome">Where do I apply?</h3>
                <p className="text-body mt-2.5 text-ink-soft">
                  Decided by your <strong className="text-ink">country of residence</strong> - which consulate has
                  jurisdiction, which visa application centre takes your biometrics, and what proof of residence you
                  attach. This is what living in Qatar actually changes.
                </p>
              </div>
            </div>
            <p className="text-body mt-4 text-ink-soft">
              So the honest answer to &ldquo;can I get a visa from where I live?&rdquo; is almost always{" "}
              <strong className="text-ink">yes, you apply from where you live</strong> - but you still need whatever
              your passport needs. The table below shows exactly what that is.
            </p>
          </section>

          {/* The data table */}
          <section className="mt-12">
            <h2 className="text-section text-ink">What Your Passport Actually Needs</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Computed from official government sources for the nationalities that make up most Gulf expat
              communities. Residence does not move any of these - it only changes where you lodge the application.
              Tap any cell for that passport&apos;s full entry rules, fees and document checklist.
            </p>
            <div className="card-doc mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="mono-chrome border-b border-line-strong">
                    <th scope="col" className="px-3 py-2.5 font-medium">Passport</th>
                    {DESTS.map((dest) => (
                      <th key={dest} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
                        {DEST_HEADER[dest] ?? nameFor(dest)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ nat, cells }) => (
                    <tr key={nat} className="border-b border-line last:border-b-0">
                      <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-display text-[15px] font-medium text-ink">
                        <span className="mr-2 text-lg leading-none">{flagFor(nat)}</span>
                        {DEMONYM[nat] ?? nameFor(nat)}
                      </th>
                      {cells.map(({ dest, label, href }) => (
                        <td key={dest} className="px-3 py-2.5 text-[13px]">
                          <Link
                            href={href}
                            className="inline-flex min-h-[44px] items-center text-ink-soft underline decoration-line-strong decoration-dotted underline-offset-4 transition hover:text-stamp hover:decoration-stamp"
                          >
                            {label}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-body mt-3 max-w-3xl text-ink-mute">
              Not your nationality? Look up any of the {dataset.allCountries.length} passports on the{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">visa checker</Link>.
            </p>
          </section>

          {/* Where you apply, by destination */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Where You Apply, by Destination</h2>

            <div className="mt-4 space-y-4">
              <div className="card-doc p-4">
                <h3 className="font-display text-base font-semibold text-ink">United Kingdom</h3>
                <p className="text-body mt-2 text-ink-soft">
                  gov.uk states you can apply for a UK visit visa from any country, whether you are resident there or
                  not - though it may take longer if you are not resident. You apply online first, then book a visa
                  application centre appointment (VFS Global or TLScontact) to give fingerprints and a photo. Choose
                  the centre in the country where you live; if you don&apos;t, gov.uk assigns the one most accessible
                  to you. See{" "}
                  <a href={GOVUK_STANDARD_VISITOR} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">the Standard Visitor visa</a>{" "}
                  and{" "}
                  <a href={GOVUK_FIND_VAC} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">find a visa application centre</a>.
                </p>
              </div>

              <div className="card-doc p-4">
                <h3 className="font-display text-base font-semibold text-ink">Schengen area</h3>
                <p className="text-body mt-2 text-ink-soft">
                  Two rules combine. You apply to the consulate of your <strong className="text-ink">main
                  destination</strong> Schengen country (or the country of first entry if you spread time evenly).
                  And under the EU Visa Code you lodge the application in the country where you are{" "}
                  <strong className="text-ink">legally resident</strong> - so a UAE resident applies at that
                  country&apos;s mission or visa centre in the UAE, not by flying home. Confirm the exact centre and
                  documents with that consulate; arrangements vary. Reference:{" "}
                  <a href={EU_VISA_CODE} target="_blank" rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">EU Visa Code, Regulation (EC) No 810/2009</a>.
                </p>
              </div>

              <div className="card-doc p-4">
                <h3 className="font-display text-base font-semibold text-ink">United States and others</h3>
                <p className="text-body mt-2 text-ink-soft">
                  Most nationalities apply for a US B-1/B-2 visitor visa at the US embassy or consulate in their
                  country of residence, and you can generally schedule an interview where you live. As a rule for any
                  destination: your nationality&apos;s application, submitted through the mission that serves where
                  you live. Applying outside your home country is normal - it is only occasionally slower or subject
                  to extra checks.
                </p>
              </div>
            </div>

            <div className="card-doc card-doc-rule mt-5 p-4">
              <h3 className="mono-chrome">One thing to get right</h3>
              <p className="text-body mt-2.5 text-ink-soft">
                Proof of legal residence is usually required on top of the normal documents - a residence permit or
                ID valid for the country you apply from, often valid some months beyond your return (three months
                beyond is a common Schengen ask). It varies by consulate, so treat the mission&apos;s own published
                checklist as the authority, not any third-party summary.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">FAQ</h2>
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
              Visa requirements in the table are computed from official government sources per passport. The process
              notes are grounded in the publications below; where a rule varies by consulate this page says so rather
              than overstating it.
            </p>
            <ul className="card-doc mt-5 divide-y divide-line px-5">
              {[
                { label: "UK Standard Visitor visa - how to apply (gov.uk)", href: GOVUK_STANDARD_VISITOR },
                { label: "Find a UK visa application centre (gov.uk)", href: GOVUK_FIND_VAC },
                { label: "EU Visa Code, Regulation (EC) No 810/2009 (EUR-Lex)", href: EU_VISA_CODE },
              ].map(({ label, href }) => (
                <li key={href} className="py-1.5">
                  <a href={href} target="_blank" rel="noopener noreferrer" className="group flex min-h-[44px] items-center gap-2.5">
                    <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">{label}</span>
                    <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* Corridor mesh */}
          {corridorLinks.length > 0 && (
            <CorridorLinks
              title="Entry Rules by Passport"
              description="The full requirements, fees and document notes for the passports covered above."
              links={corridorLinks}
            />
          )}

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">Check what your passport needs</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              See your exact visa requirement for any destination, from official government sources - then apply from
              where you live.
            </p>
            <Link href="/visit" className="btn-stamp mt-5">
              Check your visa requirements →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
