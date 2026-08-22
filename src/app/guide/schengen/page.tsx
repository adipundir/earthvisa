import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { corridorsForDestination, DEMONYM, TOP_NATIONALITIES } from "@/lib/corridors";
import { SCHENGEN_MEMBERS, SCHENGEN_REPRESENTATIVE, schengenCounts, schengenSet, schengenStatus } from "@/lib/schengen";

// The six highest-demand Schengen destinations we hold corridor guides for.
const CORRIDOR_DESTS = ["FRA", "DEU", "ITA", "ESP", "NLD", "GRC"];

// Non-Schengen nationalities visa-free to the representative Schengen member
// (France), straight from the reverse index over dataset.passportAccess.
// Schengen members are excluded: their citizens travel on freedom of movement,
// not the visa-exemption list, so exempt = this list + the members themselves.
function visaFreeToRepresentative(): { iso3: string; maxStayDays: number | null }[] {
  const out: { iso3: string; maxStayDays: number | null }[] = [];
  for (const [passportIso3, edges] of Object.entries(dataset.passportAccess)) {
    if (schengenSet.has(passportIso3)) continue;
    const edge = edges.find((e) => e.dest === SCHENGEN_REPRESENTATIVE);
    if (edge && edge.level === "visa_free") out.push({ iso3: passportIso3, maxStayDays: edge.maxStayDays });
  }
  return out.sort((a, b) => nameFor(a.iso3).localeCompare(nameFor(b.iso3)));
}

const counts = schengenCounts();
const vfToFrance = visaFreeToRepresentative();
const memberCount = SCHENGEN_MEMBERS.length;

const TITLE = `Schengen Visa 2026: Requirements, Countries List, Fee & 90/180 Rule`;
const DESCRIPTION = `Schengen visa guide 2026: one short-stay visa covers all ${memberCount} Schengen countries. Citizens of ${counts.exempt} of ${TOTAL_PASSPORTS} nationalities do not need one; ${counts.required} do. Fee, documents, 90/180 rule and the full Schengen countries list, from official sources.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/guide/schengen" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/guide/schengen",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// `toggle` targets the named group/toggle <details> wrappers: those are named
// so hovering them does not trigger the unnamed group-hover styles of every
// country tile inside at once.
function Chevron({ toggle = false }: { toggle?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-3.5 shrink-0 text-ink-mute transition-transform duration-200 ${
        toggle ? "group-open/toggle:rotate-180" : "group-open:rotate-180"
      }`}
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

// Ledger-row vocabulary (spec §12): compact rows inside a document card. The
// nth-child border resets clear the top hairline on the first visual row for
// each column count (1 col base / 2 cols sm / 3 cols lg). Applied directly to
// the grid children (Link rows here, li rows in the guide lists below).
// Two columns from the base breakpoint. With no base column count, 199 country
// tiles stacked into one column and made this page 12,960px tall on a phone.
const LEDGER_GRID = "card-doc grid grid-cols-2 gap-x-5 px-4 sm:gap-x-8 sm:px-5 lg:grid-cols-3";
const LEDGER_ROW =
  "border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0";

// One tappable country ledger row linking to a destination or passport page.
function CountryTile({ iso3, href, sub }: { iso3: string; href: string; sub?: string }) {
  return (
    <Link
      href={href}
      className={`${LEDGER_ROW} group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50`}
    >
      <span className="text-lg leading-none">{flagFor(iso3)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
          {nameFor(iso3)}
        </span>
        {sub && <span className="mono block text-[11px] text-ink-mute">{sub}</span>}
      </span>
      <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
    </Link>
  );
}

const FAQS = [
  {
    q: "What is a Schengen visa?",
    a: `One short-stay visa (Type C) valid across all ${memberCount} Schengen countries for up to 90 days in any 180, for tourism, family visits or business. It is not valid in Ireland or the United Kingdom, which run their own visa policies.`,
  },
  {
    q: "Do I need a Schengen visa?",
    a: `It depends on your nationality: ${counts.exempt} of the ${TOTAL_PASSPORTS} nationalities we track are exempt for short stays (Schengen members, or on the EU's visa-exempt list), and the remaining ${counts.required} must apply before travelling.`,
  },
  {
    q: "How much does a Schengen visa cost?",
    a: "EUR 90 for adults, EUR 45 for children aged 6 to 12, free under 6, and EUR 35 under an EU visa-facilitation agreement. VFS or TLScontact handling fees are charged on top.",
  },
  {
    q: "What is the 90/180 rule?",
    a: "At most 90 days in any rolling 180-day window, counted across the whole Schengen Area rather than per country. On each day of your stay, look back 180 days: the days spent in Schengen must not exceed 90.",
  },
  {
    q: "How long does a Schengen visa take to process?",
    a: "For France, 15 days in most cases, extendable to 45 where extra scrutiny is needed. You can apply up to 6 months before travel, and several weeks ahead is advisable in high season.",
  },
  {
    q: "What documents do I need for a Schengen visa?",
    a: "The harmonised form, a passport valid three months beyond departure, photos, travel medical insurance with EUR 30,000 coverage, accommodation and itinerary, proof of funds, and evidence of ties to home. Consulates publish per-nationality checklists.",
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

export default function SchengenGuidePage() {
  const memberList = [...SCHENGEN_MEMBERS].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

  // Nationality guides, split by data-derived status for scannability.
  const natGuides = TOP_NATIONALITIES.map((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    return c ? { iso3, name: c.name, slug: nameToSlug(c.name), status: schengenStatus(iso3) } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  const guidesRequired = natGuides.filter((g) => g.status === "visa_required");
  const guidesNotRequired = natGuides.filter((g) => g.status !== "visa_required");

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
              <span className="inline-flex min-h-[44px] items-center text-ink">Schengen Visa</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">🇪🇺</span>
                Schengen Visa 2026
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  Requirements, Countries List, Fees &amp; the 90/180 Rule
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                One short-stay visa · {memberCount} countries · 90 days in any 180
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Member countries", v: String(memberCount) },
                // Non-member nationalities on the visa-exemption list only - the memberCount
                // tile above already covers the 29 members, so this must not double-count them
                // (and now matches the itemized "Nationalities That Do Not Need a Schengen Visa"
                // list below, which is member-countries-excluded by the same logic).
                { k: "Also visa-exempt", v: String(counts.exempt - memberCount) },
                { k: "Need a visa", v: String(counts.required) },
                { k: "Max short stay", v: "90/180" },
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

          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              Europe&apos;s common short-stay visa (Type C): one application, one sticker, free movement across all{" "}
              {memberCount} countries. Whether you need one{" "}
              <Link href="#who-needs" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">depends on your passport</Link>.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              Jump to:{" "}
              <Link href="#countries" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">countries list</Link>,{" "}
              <Link href="#who-needs" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">who needs a visa</Link>,{" "}
              <Link href="#apply" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">how to apply</Link>,{" "}
              <Link href="#fee" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">fee</Link>,{" "}
              <Link href="#rule" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">90/180 rule</Link>.
            </p>
          </section>

          {/* What is the Schengen Area */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">What Is the Schengen Area?</h2>
            <p className="text-body mt-3 text-ink-soft">
              {memberCount} European countries with no passport checks at their shared internal borders - mostly EU
              members, joined by Iceland, Liechtenstein, Norway and Switzerland.{" "}
              <Link href="/destination/ireland" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Ireland</Link>{" "}
              is in the EU but not in Schengen, and the{" "}
              <Link href="/destination/united-kingdom" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United Kingdom</Link>{" "}
              is in neither: a Schengen visa is not valid in either.
            </p>
          </section>

          {/* Schengen countries list */}
          <section id="countries" className="mt-12 scroll-mt-24">
            <h2 className="text-section text-ink">
              Schengen Countries List 2026 ({memberCount})
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              One short-stay visa is valid in all of them. Tap a country for its entry requirements by passport.
            </p>
            <div className={`${LEDGER_GRID} mt-5`}>
              {memberList.map((iso3) => (
                <CountryTile key={iso3} iso3={iso3} href={`/destination/${nameToSlug(nameFor(iso3))}`} />
              ))}
            </div>
          </section>

          {/* 90/180 rule */}
          <section id="rule" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">The 90/180 Rule, Explained</h2>
            <p className="text-body mt-3 text-ink-soft">
              Visa-free or on a visa, short stays are capped at{" "}
              <strong className="text-ink">90 days within any rolling 180-day period</strong>, counted across the
              whole area: three days in{" "}
              <Link href="/destination/france" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">France</Link>,
              four in{" "}
              <Link href="/destination/italy" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Italy</Link>{" "}
              and a week in{" "}
              <Link href="/destination/spain" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Spain</Link>{" "}
              all draw from one allowance. On each day of the stay, look back 180 days: the total must not exceed 90.
              Overstaying means fines, an entry ban and later refusals.
            </p>
          </section>

          {/* Who needs one - data-derived */}
          <section id="who-needs" className="mt-12 scroll-mt-24">
            <h2 className="text-section text-ink">
              Who Needs a Schengen Visa in 2026?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              The EU keeps one harmonised exemption list, so a single member&apos;s policy answers the question for
              the whole area - verified here against France&apos;s.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-ink">
              Nationalities That Do Not Need a Schengen Visa ({vfToFrance.length} visa-exempt)
            </h3>
            <p className="text-body mt-1 text-ink-soft">
              Admitted visa-free for up to 90 days in any 180. Citizens of the {memberCount} member states are not
              listed - they have freedom of movement, with no visa and no stay limit.
            </p>
            <div className={`${LEDGER_GRID} mt-4`}>
              {vfToFrance.slice(0, 15).map((e) => (
                <CountryTile
                  key={e.iso3}
                  iso3={e.iso3}
                  href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                  sub={e.maxStayDays != null && e.maxStayDays !== 90 ? `≤ ${e.maxStayDays} days` : undefined}
                />
              ))}
            </div>
            <details className="group/toggle mt-2.5">
              <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open/toggle:hidden">Show all {vfToFrance.length}</span>
                <span className="hidden group-open/toggle:inline">Show fewer</span>
                <Chevron toggle />
              </summary>
              <div className={`${LEDGER_GRID} mt-2.5`}>
                {vfToFrance.slice(15).map((e) => (
                  <CountryTile
                    key={e.iso3}
                    iso3={e.iso3}
                    href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                    sub={e.maxStayDays != null && e.maxStayDays !== 90 ? `≤ ${e.maxStayDays} days` : undefined}
                  />
                ))}
              </div>
            </details>

            <h3 className="mt-8 font-display text-lg font-semibold text-ink">
              Nationalities That Need a Schengen Visa ({counts.required})
            </h3>
            <p className="text-body mt-1 text-ink-soft">
              Must obtain a short-stay visa before travelling, even for tourism.
            </p>
            <div className={`${LEDGER_GRID} mt-4`}>
              {counts.requiredIso3.slice(0, 15).map((iso3) => (
                <CountryTile key={iso3} iso3={iso3} href={`/passport/${nameToSlug(nameFor(iso3))}`} />
              ))}
            </div>
            <details className="group/toggle mt-2.5">
              <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open/toggle:hidden">Show all {counts.required}</span>
                <span className="hidden group-open/toggle:inline">Show fewer</span>
                <Chevron toggle />
              </summary>
              <div className={`${LEDGER_GRID} mt-2.5`}>
                {counts.requiredIso3.slice(15).map((iso3) => (
                  <CountryTile key={iso3} iso3={iso3} href={`/passport/${nameToSlug(nameFor(iso3))}`} />
                ))}
              </div>
            </details>
          </section>

          {/* Per-nationality guides */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Schengen Visa Guides by Nationality
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Where to apply, documents and fees for your passport.
            </p>
            <h3 className="mt-5 font-display text-base font-semibold text-ink">Visa required</h3>
            <ul className={`${LEDGER_GRID} mt-3`}>
              {guidesRequired.map((g) => (
                <li key={g.iso3} className={LEDGER_ROW}>
                  <Link
                    href={`/guide/schengen/${g.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50"
                  >
                    <span className="text-lg leading-none">{flagFor(g.iso3)}</span>
                    <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                      {DEMONYM[g.iso3] ?? g.name} citizens
                    </span>
                    <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 font-display text-base font-semibold text-ink">No visa needed (short stays)</h3>
            <ul className={`${LEDGER_GRID} mt-3`}>
              {guidesNotRequired.map((g) => (
                <li key={g.iso3} className={LEDGER_ROW}>
                  <Link
                    href={`/guide/schengen/${g.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50"
                  >
                    <span className="text-lg leading-none">{flagFor(g.iso3)}</span>
                    <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                      {DEMONYM[g.iso3] ?? g.name} citizens
                    </span>
                    <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* How to apply */}
          <section id="apply" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">How to Apply for a Schengen Visa</h2>
            <p className="text-body mt-3 text-ink-soft">
              Harmonised across members - the same form, fee and core documents everywhere.
            </p>
            <ol className="mt-5 space-y-4">
              {[
                {
                  t: "Pick the right consulate",
                  d: "Your main destination - where you spend longest, or first entry if stays are equal. Applying to an \"easier\" consulate while mainly visiting elsewhere is a common ground for refusal.",
                },
                {
                  t: "Fill the harmonised application form",
                  d: "Usually lodged at an outsourced centre (VFS Global, TLScontact or BLS) in your country of residence.",
                },
                {
                  t: "Gather the standard file",
                  d: "Passport valid three months beyond departure, photos, travel medical insurance with EUR 30,000 coverage, accommodation, itinerary, proof of funds, evidence of ties to home. Each consulate publishes its own per-nationality checklist.",
                },
                {
                  t: "Book biometrics and pay the fee",
                  d: "Fingerprints on the first application, then reused from the VIS system.",
                },
                {
                  t: "Wait for the decision",
                  d: "France decides within 15 days in most cases, extendable to 45. Apply up to 6 months before travel.",
                },
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
          </section>

          {/* Fee */}
          <section id="fee" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">Schengen Visa Fee 2026</h2>
            <p className="text-body mt-3 text-ink-soft">
              Set EU-wide - the same whichever member state you apply to.
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
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Visa-facilitation nationals (e.g. Armenia, Azerbaijan)</td>
                    <td className="mono py-2.5 tabular-nums">EUR 35</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-body mt-3 text-ink-soft">
              A VFS Global or TLScontact service fee is charged on top, and the fee is not refunded if you are
              refused. For the bank balance to show, see the{" "}
              <Link href="/guide/proof-of-funds#schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen proof-of-funds guide
              </Link>.
            </p>
          </section>

          {/* Corridor guides per top destination.
              This used to render every nationality corridor for all six
              destinations inline: 1,188 links and ~4,900 words, 61% of the
              page. Those exact corridor URLs are already linked from each
              /destination/[slug] page - the two link sets were verified as an
              identical match, so nothing here was the only path to anything.
              Six hub links replace them. */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Schengen Visa Requirements by Destination &amp; Nationality
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Stay length, conditions and documents for the most-visited Schengen destinations.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {CORRIDOR_DESTS.map((dest) => {
                const links = corridorsForDestination(dest);
                if (links.length === 0) return null;
                return (
                  <li key={dest}>
                    <Link
                      href={`/destination/${nameToSlug(nameFor(dest))}`}
                      className="card-doc group/link flex min-h-[44px] items-center gap-3 px-4 py-3 transition hover:bg-paper-2/50"
                    >
                      <span className="text-xl">{flagFor(dest)}</span>
                      <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover/link:text-stamp">
                        {nameFor(dest)} by nationality ({links.length})
                      </span>
                      <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover/link:text-stamp">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Schengen Visa FAQ</h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {FAQS.map(({ q, a }) => (
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
              Check your Schengen visa requirements
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Or compare all passports on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport rankings</Link>.
            </p>
            <Link
              href="/visit?dest=FRA"
              className="btn-stamp mt-5"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
