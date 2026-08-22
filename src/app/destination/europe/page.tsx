import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { DEMONYM, TOP_NATIONALITIES } from "@/lib/corridors";
import { SCHENGEN_MEMBERS, schengenCounts, schengenStatus, type SchengenStatus } from "@/lib/schengen";
import SearchableLedger from "@/components/SearchableLedger";

const memberCount = SCHENGEN_MEMBERS.length;
const counts = schengenCounts();

// High-volume nationalities for the quick-answer grid; every status below is
// derived from the dataset (membership group or France's published policy).
const FEATURED_NATIONALITIES = [
  "USA", "GBR", "CAN", "AUS", "IND", "PAK", "CHN", "NGA", "ZAF", "PHL",
  "BRA", "MEX", "UKR", "TUR", "RUS", "ARE", "IDN", "VNM", "EGY", "KEN",
];

const TITLE = "Do I Need a Visa for Europe? Schengen & Europe Entry Rules 2026";
const DESCRIPTION = `Europe is not one visa zone: ${memberCount} countries share the Schengen short-stay policy, while the UK and Ireland run their own. Citizens of ${counts.exempt} of ${TOTAL_PASSPORTS} nationalities enter Schengen visa-free; ${counts.required} need a visa. Check your passport, from official sources.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/destination/europe" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/destination/europe",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const STATUS_LABEL: Record<SchengenStatus, string> = {
  member: "No visa - Schengen citizen",
  exempt: "Visa-free short stays",
  visa_required: "Schengen visa required",
};

const STATUS_CLASS: Record<SchengenStatus, string> = {
  member: "text-vfree bg-vfree/10 ring-vfree/30",
  exempt: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_required: "text-stamp bg-stamp/10 ring-stamp/30",
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

const FAQS = [
  {
    q: "Do I need a visa for Europe?",
    a: `It depends on your nationality and which part of Europe you are visiting. For the Schengen zone, citizens of ${counts.exempt} of the ${TOTAL_PASSPORTS} nationalities Earth Visa tracks enter visa-free for up to 90 days in any 180-day period, while ${counts.required} need a Schengen visa first.`,
  },
  {
    q: "Is Europe one visa zone?",
    a: `No. Europe is a continent, not a visa zone. The largest common zone is the Schengen Area (${memberCount} countries, one short-stay visa policy). Ireland is in the EU but outside Schengen, the United Kingdom is outside both, and several other European states run their own visa policies. Always check the specific country, not "Europe".`,
  },
  {
    q: "Do US citizens need a visa for Europe?",
    a: "US citizens do not need a visa for short stays in the Schengen Area - visa-free entry for up to 90 days in any 180-day period. The EU's planned ETIAS travel authorisation will eventually apply to visa-exempt visitors like US citizens; it is not a visa and was not yet mandatory at the time of writing.",
  },
  {
    q: "Do UK citizens need a visa for Europe after Brexit?",
    a: "For short stays, no. British citizens can visit the Schengen Area visa-free for up to 90 days in any 180-day period. The 90/180 limit is counted across all Schengen countries combined. Longer stays (work, study, residence) need a national visa from the specific country.",
  },
  {
    q: "Do Indian citizens need a visa for Europe?",
    a: "Yes, for the Schengen Area. Indian citizens are not on the EU's visa-exemption list in the data we track, so a Schengen short-stay visa is required before travelling - one visa covers all Schengen countries. The UK and Ireland require separate visas under their own policies.",
  },
  {
    q: "What is ETIAS and do I need it?",
    a: "ETIAS is the EU's planned online travel authorisation for visa-exempt visitors to the Schengen Area - similar in spirit to the US ESTA. It is not a visa: it applies only to nationalities that already travel visa-free. It was not yet mandatory at the time of writing; Earth Visa tracks the EU's rollout and will update this page once it is.",
  },
  {
    q: "Can I visit the UK with a Schengen visa?",
    a: "No. The United Kingdom is not in the Schengen Area, so a Schengen visa is not valid there, and a UK visa is not valid in Schengen. Ireland likewise runs its own visa policy. If your itinerary includes Schengen countries plus the UK or Ireland, check each policy separately.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Destinations", item: "https://earthvisa.in/destination" },
        { "@type": "ListItem", position: 3, name: "Europe Visa Requirements", item: "https://earthvisa.in/destination/europe" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function EuropePage() {
  const memberList = [...SCHENGEN_MEMBERS].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));
  const topNatSet = new Set(TOP_NATIONALITIES);

  const featured = FEATURED_NATIONALITIES.map((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    if (!c) return null;
    return {
      iso3,
      name: c.name,
      slug: nameToSlug(c.name),
      status: schengenStatus(iso3),
      hasGuide: topNatSet.has(iso3),
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

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
              <Link href="/destination" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Destinations</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Europe</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">🇪🇺</span>
                Do I Need a Visa for Europe?
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  Entry Rules by Nationality 2026
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Europe is not one visa zone - most of it is Schengen
              </p>
            </div>

            {/* Stats */}
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Schengen countries", v: String(memberCount) },
                { k: "Nationalities exempt", v: String(counts.exempt) },
                { k: "Need a Schengen visa", v: String(counts.required) },
                { k: "Max short stay", v: "90/180" },
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

          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              There is no single &quot;Europe visa&quot;. Most of the continent shares the{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen short-stay policy
              </Link>
              : one visa (or one visa exemption) covers the whole area for up to{" "}
              <strong className="text-ink">90 days in any 180-day period</strong>. Outside that zone, the{" "}
              <Link href="/destination/united-kingdom" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                United Kingdom
              </Link>{" "}
              and{" "}
              <Link href="/destination/ireland" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Ireland
              </Link>{" "}
              run their own visa policies (and share a Common Travel Area with each other), and several other European
              states set their own rules too.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              For the Schengen zone the answer is data-driven: the exempt and visa-required counts above are verified
              against France&apos;s official published visa policy, since the EU exemption list is harmonised across
              all members.
            </p>
          </section>

          {/* Quick answer by nationality */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Quick Answer by Nationality
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Schengen-zone status for the most-searched passports. Tap a nationality for its full Schengen guide.
            </p>
            <SearchableLedger count={featured.length} noun="nationalities">
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((n) => (
                  <li key={n.iso3} data-search={`${n.name} ${DEMONYM[n.iso3] ?? ""}`.toLowerCase()}>
                    <Link
                      href={n.hasGuide ? `/guide/schengen/${n.slug}` : `/passport/${n.slug}`}
                      className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                    >
                      <span className="text-xl">{flagFor(n.iso3)}</span>
                      <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                        {DEMONYM[n.iso3] ?? n.name} citizens
                      </span>
                      <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${STATUS_CLASS[n.status]}`}>
                        {STATUS_LABEL[n.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SearchableLedger>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-soft">
              Visa-exempt travellers (for example American, British, Canadian and Australian citizens) should note the
              EU&apos;s planned <strong className="text-ink">ETIAS</strong> travel authorisation - an online pre-travel
              check for visa-free visitors, similar in spirit to the US ESTA. It is not a visa and was not yet
              mandatory at the time of writing; Earth Visa tracks the EU&apos;s rollout and will update this page once it is.
            </p>
          </section>

          {/* The zones of Europe */}
          <section className="mt-12 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Europe&apos;s Visa Zones, in One Minute
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-sm border border-line bg-paper-2/70 p-5">
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  The Schengen Area ({memberCount} countries)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  One short-stay policy for almost all of continental Europe. Enter once, then cross internal borders
                  freely; stays are capped at 90 days in any 180 across the whole area. If you need a visa, one
                  Schengen visa covers every member. Full details - countries list, application steps, fees, the
                  90/180 rule - in our{" "}
                  <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    Schengen visa guide
                  </Link>.
                </p>
              </div>
              <div className="rounded-sm border border-line bg-paper-2/70 p-5">
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  The UK &amp; Ireland (separate policies)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Neither is in Schengen; each decides its own visa rules, and they share a Common Travel Area with
                  each other. A Schengen visa is not valid in either. Check{" "}
                  <Link href="/destination/united-kingdom" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    United Kingdom entry requirements
                  </Link>{" "}
                  and{" "}
                  <Link href="/destination/ireland" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    Ireland entry requirements
                  </Link>{" "}
                  separately.
                </p>
              </div>
              <div className="rounded-sm border border-line bg-paper-2/70 p-5">
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  The rest of Europe
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Countries outside Schengen and the EU - in the Balkans, the Caucasus and beyond - each set their own
                  entry rules, and several are notably more open than Schengen for some passports. Look up any country
                  on our{" "}
                  <Link href="/destination" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    destinations index
                  </Link>{" "}
                  or check your passport&apos;s full reach on the{" "}
                  <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                    passport rankings
                  </Link>.
                </p>
              </div>
            </div>
          </section>

          {/* Schengen members */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Schengen Countries Covered by One Visa ({memberCount})
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Tap any country for its full visa requirements by passport.
            </p>
            <SearchableLedger count={memberList.length} noun="Schengen countries">
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {memberList.map((iso3) => (
                  <Link
                    key={iso3}
                    href={`/destination/${nameToSlug(nameFor(iso3))}`}
                    data-search={nameFor(iso3).toLowerCase()}
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
            </SearchableLedger>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Europe Visa FAQ</h2>
            <div className="mt-5 divide-y divide-line">
              {FAQS.map(({ q, a }) => (
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

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check your exact requirements for any European country
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to see whether you need a visa for each European destination, how long you can stay,
              and what documents you need.
            </p>
            <Link
              href="/visit?dest=FRA"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
