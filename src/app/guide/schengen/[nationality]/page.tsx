import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { corridorsForNationality, DEMONYM, TOP_NATIONALITIES } from "@/lib/corridors";
import {
  pluralDemonym,
  SCHENGEN_MEMBERS,
  SCHENGEN_REPRESENTATIVE,
  schengenCounts,
  schengenSet,
  schengenStatus,
  type SchengenStatus,
} from "@/lib/schengen";

// Only the curated top nationalities get a Schengen guide; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return TOP_NATIONALITIES.map((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    return c ? { nationality: nameToSlug(c.name) } : null;
  }).filter((x): x is { nationality: string } => x !== null);
}

const topNatSet = new Set(TOP_NATIONALITIES);

function slugToCountry(slug: string) {
  const c = dataset.allCountries.find((x) => nameToSlug(x.name) === slug) ?? null;
  return c && topNatSet.has(c.iso3) ? c : null;
}

const memberCount = SCHENGEN_MEMBERS.length;
const counts = schengenCounts();

/** Visa-free stay allowance to the representative Schengen member, if any. */
function exemptStayDays(iso3: string): number | null {
  const edge = (dataset.passportAccess[iso3] ?? []).find(
    (e) => e.dest === SCHENGEN_REPRESENTATIVE && e.level === "visa_free",
  );
  return edge?.maxStayDays ?? null;
}

function verdictLine(status: SchengenStatus, plural: string, stayDays: number | null): string {
  switch (status) {
    case "member":
      return `No. ${plural} do not need a Schengen visa - their country is a Schengen member, so they have freedom of movement across the whole area with no visa and no stay limit.`;
    case "exempt":
      return `No. ${plural} do not need a Schengen visa for short stays. They are on the EU's visa-exempt list (verified against France's published visa policy) and can visit all ${memberCount} Schengen countries visa-free for up to ${stayDays ?? 90} days in any 180-day period.`;
    default:
      return `Yes. ${plural} need a Schengen short-stay visa (Type C) before travelling to any of the ${memberCount} Schengen countries, even for tourism. One visa covers the whole area for up to 90 days in any 180-day period.`;
  }
}

function titleFor(status: SchengenStatus, plural: string): string {
  switch (status) {
    case "member":
      return `Schengen Visa for ${plural} 2026 - Not Needed (Schengen Member)`;
    case "exempt":
      return `Schengen Visa for ${plural} 2026 - Not Required for Short Stays`;
    default:
      return `Schengen Visa for ${plural} 2026: Requirements, Fee & Documents`;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ nationality: string }> }): Promise<Metadata> {
  const { nationality } = await params;
  const country = slugToCountry(nationality);
  if (!country) return { title: "Not Found" };

  const status = schengenStatus(country.iso3);
  const plural = pluralDemonym(country.iso3, country.name);
  const demonym = DEMONYM[country.iso3] ?? country.name;
  const stayDays = exemptStayDays(country.iso3);
  const title = titleFor(status, plural);
  const description = `${verdictLine(status, plural, stayDays)} ${
    status === "visa_required"
      ? "See the fee (EUR 90), documents, processing time and where to apply, from official sources."
      : "See the 90/180 rule, ETIAS, and per-country entry rules, from official sources."
  }`;

  return {
    title,
    description,
    keywords: [
      `schengen visa for ${plural.toLowerCase()}`,
      `schengen visa for ${demonym.toLowerCase()} citizens`,
      `do ${demonym.toLowerCase()} citizens need a schengen visa`,
      `schengen visa requirements for ${plural.toLowerCase()}`,
      `schengen visa requirements ${country.name.toLowerCase()}`,
      `${country.name.toLowerCase()} schengen visa 2026`,
      `europe visa for ${plural.toLowerCase()}`,
      `schengen visa fee for ${plural.toLowerCase()}`,
      `schengen visa documents for ${plural.toLowerCase()}`,
    ],
    alternates: { canonical: `https://earthvisa.in/guide/schengen/${nationality}` },
    openGraph: {
      title,
      description,
      url: `https://earthvisa.in/guide/schengen/${nationality}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

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

export default async function SchengenNationalityPage({ params }: { params: Promise<{ nationality: string }> }) {
  const { nationality } = await params;
  const country = slugToCountry(nationality);
  if (!country) notFound();

  const status = schengenStatus(country.iso3);
  const plural = pluralDemonym(country.iso3, country.name);
  const demonym = DEMONYM[country.iso3] ?? country.name;
  const stayDays = exemptStayDays(country.iso3);
  const flag = flagFor(country.iso3);
  const passportSlug = nameToSlug(country.name);

  // Corridor guides for Schengen destinations we cover for this passport.
  const schengenCorridors = corridorsForNationality(country.iso3).filter((c) => schengenSet.has(c.dest));

  const verdict = verdictLine(status, plural, stayDays);
  const stampText =
    status === "member" ? "No visa - Schengen member" : status === "exempt" ? "No visa for short stays" : "Schengen visa required";

  const faqs = [
    {
      q: `Do ${plural} need a Schengen visa in 2026?`,
      a: verdict,
    },
    ...(status === "visa_required"
      ? [
          {
            q: `How much is the Schengen visa fee for ${plural}?`,
            a: `The standard Schengen short-stay visa fee in the official fee schedules we track is EUR 90 for adults and EUR 45 for children aged 6 to 12; children under 6 are free. Where the consulate outsources intake to VFS Global or TLScontact, a service fee is charged on top. The fee is the same whichever Schengen country you apply to.`,
          },
          {
            q: `Where do ${plural} apply for a Schengen visa?`,
            a: `Apply at the consulate (or its VFS Global / TLScontact centre) of your main destination - the Schengen country where you will spend the longest. If your stays are equal, apply to the country of first entry. Applying to a different member because it seems easier is a common ground for refusal.`,
          },
          {
            q: `What documents do ${plural} need for a Schengen visa?`,
            a: `The standard file is: the harmonised application form, a passport valid at least three months beyond departure from Schengen, recent photos, travel medical insurance with at least EUR 30,000 coverage, proof of accommodation and itinerary, proof of funds, and evidence of ties to ${country.name}. Each consulate publishes an exact per-nationality checklist - see our per-country guides for specifics.`,
          },
          {
            q: `How long does a Schengen visa take for ${plural}?`,
            a: `In the official data we track for France, consulates decide within 15 days in most cases, extendable to up to 45 days when extra scrutiny or documents are needed. Applications can be lodged up to 6 months before travel; apply several weeks ahead in high season.`,
          },
        ]
      : [
          {
            q: `How long can ${plural} stay in the Schengen Area?`,
            a:
              status === "member"
                ? `As citizens of a Schengen member state, ${plural} have freedom of movement: they can live, work and travel across the area without a visa or a stay limit.`
                : `${plural} can stay up to ${stayDays ?? 90} days in any 180-day period, counted across all ${memberCount} Schengen countries combined - not per country. Longer stays (work, study, residence) require a national long-stay visa or permit from the specific country.`,
          },
          {
            q: `Do ${plural} need ETIAS for Europe?`,
            a:
              status === "member"
                ? `No. ETIAS is the EU's planned travel authorisation for visa-exempt non-EU visitors; citizens of Schengen and EU member states are not in its scope.`
                : `Not yet, but eventually. ETIAS is the EU's planned online travel authorisation for visa-exempt visitors - similar to the US ESTA. It is not a visa. It was not yet mandatory at the time of writing; Earth Visa tracks the EU's rollout and will update this page once it is.`,
          },
        ]),
    {
      q: `Which countries does a Schengen ${status === "visa_required" ? "visa" : "trip"} cover for ${plural}?`,
      a: `The Schengen Area has ${memberCount} member countries in 2026: ${SCHENGEN_MEMBERS.map((m) => nameFor(m)).sort().join(", ")}. ${
        status === "visa_required"
          ? "One short-stay visa is valid in all of them."
          : "The same visa-free rules apply in all of them."
      } Ireland and the United Kingdom are not in Schengen and run separate visa policies.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Schengen Visa Guide", item: "https://earthvisa.in/guide/schengen" },
          {
            "@type": "ListItem",
            position: 3,
            name: `Schengen Visa for ${plural}`,
            item: `https://earthvisa.in/guide/schengen/${nationality}`,
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
            <nav className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/guide/schengen" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Schengen Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">{country.name}</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">{flag}</span>
                Schengen Visa for {plural} 2026
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  {status === "visa_required"
                    ? "Requirements, Fee, Documents & Where to Apply"
                    : "Visa-Free Entry Rules & the 90/180 Limit"}
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">{stampText}</p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Countries covered", v: String(memberCount) },
                {
                  k: "Visa needed",
                  v: status === "visa_required" ? "Yes" : "No",
                },
                {
                  k: "Max short stay",
                  v: status === "member" ? "No limit" : `${stayDays ?? 90}/180`,
                },
                {
                  k: status === "visa_required" ? "Standard fee" : "Advance visa fee",
                  v: status === "visa_required" ? "EUR 90" : "None",
                },
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

          {/* Verdict */}
          <section className="mt-10 max-w-3xl">
            <div className="card-doc p-5">
              <h2 className="mono-chrome">
                Do {plural} need a Schengen visa?
              </h2>
              <p className="mt-2 text-base leading-relaxed text-ink">{verdict}</p>
            </div>
            <p className="text-body mt-4 text-ink-soft">
              {status === "member" && (
                <>
                  {country.name} is one of the {memberCount} Schengen members, so this page is short by design:
                  there is no visa, no form and no fee for travel anywhere in the area. See the{" "}
                  <Link href={`/passport/${passportSlug}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    {country.name} passport page
                  </Link>{" "}
                  for everything the passport unlocks beyond Europe.
                </>
              )}
              {status === "exempt" && (
                <>
                  {country.name}{" "}
                  is on the EU&apos;s harmonised visa-exemption list, which we verify against
                  France&apos;s published visa policy. That exemption applies identically in every Schengen country -
                  there is no member state where {plural} would suddenly need a short-stay visa. The trade-off is the
                  strict{" "}
                  <Link href="/guide/schengen#rule" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    90/180 rule
                  </Link>
                  : {stayDays ?? 90}{" "}
                  days in any rolling 180-day window across the whole area. Note that the EU&apos;s
                  planned ETIAS travel authorisation will eventually apply to visa-exempt visitors - it is not a visa,
                  and was not yet mandatory at the time of writing.
                </>
              )}
              {status === "visa_required" && (
                <>
                  {country.name}{" "}
                  is not on the EU&apos;s visa-exemption list (verified against France&apos;s published
                  visa policy), so a <strong className="text-ink">Schengen short-stay visa (Type C)</strong> is
                  required before travel. The good news: the process is harmonised. One application at the consulate
                  of your main destination gives you a visa valid across all {memberCount} member countries, and{" "}
                  {counts.required} nationalities are in the same position - the consulates process these files every
                  day.
                </>
              )}
            </p>
          </section>

          {/* Where to apply / corridor coverage */}
          {schengenCorridors.length > 0 && (
            <section className="mt-12">
              <h2 className="text-section text-ink">
                {status === "visa_required"
                  ? `Schengen Country Guides for ${demonym} Applicants (${schengenCorridors.length})`
                  : `Schengen Entry Guides for ${demonym} Travellers (${schengenCorridors.length})`}
              </h2>
              <p className="text-body mt-2 max-w-3xl text-ink-soft">
                {status === "visa_required"
                  ? `Per-country corridor guides for ${demonym} citizens - apply through the consulate of your main destination. Where available, these include the exact document checklist published for ${country.name}.`
                  : `Per-country entry guides for ${demonym} citizens - stay length, conditions and the official source for each destination.`}
              </p>
              <ul className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
                {schengenCorridors.map((c) => (
                  <li
                    key={`${c.nat}-${c.dest}`}
                    className="border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0"
                  >
                    <Link
                      href={`/passport/${c.natSlug}/${c.destSlug}`}
                      className="group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50"
                    >
                      <span className="text-lg leading-none">{flagFor(c.dest)}</span>
                      <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                        {nameFor(c.dest)} visa for {demonym} citizens
                      </span>
                      <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {status === "visa_required" && (
            <>
              {/* Documents */}
              <section className="mt-12 max-w-3xl">
                <h2 className="text-section text-ink">
                  Schengen Visa Documents for {plural}
                </h2>
                <p className="text-body mt-3 text-ink-soft">
                  The core file is the same at every Schengen consulate. Each consulate (and its VFS Global or
                  TLScontact centre) publishes the exact checklist for applicants from {country.name} - our
                  per-country guides above link the official checklists where we hold them.
                </p>
                <ul className="card-doc mt-5 px-4 sm:px-5">
                  {[
                    "Harmonised Schengen short-stay application form, signed",
                    "Passport valid at least three months beyond your planned departure from the Schengen Area",
                    "Recent passport-format photos",
                    "Travel medical insurance with at least EUR 30,000 coverage, valid across Schengen",
                    "Proof of accommodation and a travel itinerary or round-trip reservation",
                    "Proof of sufficient funds for the stay",
                    `Evidence of ties to ${country.name}: employment or study letter, property, family - anything showing you will return`,
                  ].map((doc) => (
                    <li key={doc} className="flex min-h-[44px] items-center gap-3 border-t border-line py-2 first:border-t-0">
                      <span aria-hidden className="mono text-stamp">■</span>
                      <span className="text-[15px] leading-snug text-ink-soft">{doc}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Fee */}
              <section className="mt-12 max-w-3xl">
                <h2 className="text-section text-ink">
                  Schengen Visa Fee for {plural}
                </h2>
                <p className="text-body mt-3 text-ink-soft">
                  The fee is set EU-wide, so it is identical whichever member state you apply to - there is no
                  special per-nationality surcharge for {demonym} applicants.
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="mono-chrome border-b border-line-strong text-left">
                        <th scope="col" className="py-2.5 pr-4 font-medium">Applicant</th>
                        <th scope="col" className="py-2.5 font-medium">Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink-soft">
                      <tr>
                        <td className="py-2.5 pr-4 font-display font-medium text-ink">Adults (12+)</td>
                        <td className="mono py-2.5 tabular-nums">EUR 90</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-display font-medium text-ink">Children 6 to 12</td>
                        <td className="mono py-2.5 tabular-nums">EUR 45</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-display font-medium text-ink">Children under 6</td>
                        <td className="mono py-2.5 tabular-nums">Free</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="text-body mt-3 space-y-2 text-ink-soft">
                  <li className="flex gap-3">
                    <span aria-hidden className="mono text-stamp">■</span>
                    <span>+ VFS Global / TLScontact service fee where the consulate outsources intake.</span>
                  </li>
                  <li className="flex gap-3">
                    <span aria-hidden className="mono text-stamp">■</span>
                    <span>Not refunded if the application is refused.</span>
                  </li>
                </ul>
                <p className="text-body mt-3 text-ink-soft">
                  Full details, including the reduced visa-facilitation rate, on the{" "}
                  <Link href="/guide/schengen#fee" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    Schengen visa fee page
                  </Link>.
                </p>
              </section>
            </>
          )}

          {/* Where else can this passport go */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">
              Beyond Schengen: What the {country.name} Passport Unlocks
            </h2>
            <p className="text-body mt-3 text-ink-soft">
              Europe is one region - see the full picture of where the {country.name} passport can travel visa-free,
              on arrival or with an e-visa on the{" "}
              <Link href={`/passport/${passportSlug}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                {country.name} passport page
              </Link>
              , compare it against every other passport on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                passport rankings
              </Link>
              , or read the full{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen visa guide
              </Link>{" "}
              for the countries list, application steps and the 90/180 rule.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">
              Schengen Visa for {plural}: FAQ
            </h2>
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

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Check every destination for the {country.name} passport
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              See the full visa-free list, visa on arrival destinations and e-visa options for {demonym} travellers.
            </p>
            <Link
              href={`/visit?passport=${country.iso3}`}
              className="btn-stamp mt-5"
            >
              Check visa requirements on Earth Visa →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
