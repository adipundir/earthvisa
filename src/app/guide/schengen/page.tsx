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
  keywords: [
    "schengen visa",
    "schengen visa requirements",
    "schengen visa 2026",
    "schengen countries list",
    "schengen countries list 2026",
    "schengen visa fee",
    "schengen visa cost",
    "how to apply for schengen visa",
    "schengen visa documents",
    "90/180 rule schengen",
    "what is the schengen area",
    "which countries need schengen visa",
    "schengen visa free countries",
    "schengen short stay visa type c",
  ],
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

// One tappable country tile linking to a destination or passport page.
function CountryTile({ iso3, href, sub }: { iso3: string; href: string; sub?: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
    >
      <span className="text-xl">{flagFor(iso3)}</span>
      <div className="min-w-0">
        <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
          {nameFor(iso3)}
        </span>
        {sub && <div className="mono text-[10px] text-ink-mute">{sub}</div>}
      </div>
      <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
    </Link>
  );
}

const FAQS = [
  {
    q: "What is a Schengen visa?",
    a: `A Schengen visa is a short-stay visa (Type C) that lets you travel across all ${memberCount} Schengen Area countries on one document. It allows stays of up to 90 days in any 180-day period for tourism, family visits or business. You apply once, at the consulate of your main destination, and can then cross internal Schengen borders without further checks.`,
  },
  {
    q: "Which countries are in the Schengen Area in 2026?",
    a: `The Schengen Area has ${memberCount} member countries in 2026: ${SCHENGEN_MEMBERS.map((m) => nameFor(m)).sort().join(", ")}. One short-stay visa covers all of them. Note that Ireland is in the EU but not in Schengen, and the United Kingdom runs its own visa policy.`,
  },
  {
    q: "Do I need a Schengen visa?",
    a: `It depends on your nationality. Citizens of ${counts.exempt} of the ${TOTAL_PASSPORTS} nationalities Earth Visa tracks do not need a Schengen visa for short stays - either because their country is a Schengen member or because they are on the EU's visa-exempt list (verified against France's published visa policy). The remaining ${counts.required} nationalities must apply for a Schengen short-stay visa before travelling.`,
  },
  {
    q: "How much does a Schengen visa cost?",
    a: "The standard Schengen short-stay visa fee in the official fee schedules we track is EUR 90 for adults and EUR 45 for children aged 6 to 12; children under 6 are free. A reduced EUR 35 fee applies to nationals of countries with an EU visa-facilitation agreement (for example several Eastern European and Caucasus states). Service-centre handling fees (VFS, TLScontact) are charged on top where consulates outsource intake.",
  },
  {
    q: "What is the 90/180 rule?",
    a: "Visa-free visitors and Schengen visa holders may stay at most 90 days within any rolling 180-day window, counted across the whole Schengen Area, not per country. Every day spent in any member state counts toward the same allowance. On each day of your stay, look back 180 days: the total days spent in Schengen in that window must not exceed 90.",
  },
  {
    q: "How long does a Schengen visa take to process?",
    a: "In the official data we track for France, consulates decide within 15 days in most cases, extendable to up to 45 days when extra scrutiny or documents are needed. You can lodge the application up to 6 months before travel; applying at least several weeks ahead is strongly advised in high season.",
  },
  {
    q: "Can I visit all Schengen countries with one visa?",
    a: `Yes. A standard (non-territorially-limited) Schengen short-stay visa is valid for the whole area - all ${memberCount} member countries - within its validity dates and the 90/180 limit. You must apply at the consulate of your main destination (longest stay), or of first entry if stays are equal.`,
  },
  {
    q: "Is the United Kingdom in the Schengen Area?",
    a: "No. The United Kingdom is not a Schengen member and runs its own visa policy, as does Ireland (which is in the EU but stayed outside Schengen). A Schengen visa does not grant entry to the UK or Ireland, and UK/Irish visas do not grant entry to the Schengen Area.",
  },
  {
    q: "What documents do I need for a Schengen visa?",
    a: "The standard file is: the harmonised application form, a passport valid at least three months beyond your planned departure from Schengen, recent photos, travel medical insurance with at least EUR 30,000 coverage valid across Schengen, proof of accommodation and itinerary, proof of sufficient funds, and evidence of ties to your home country. Consulates and their VFS/TLScontact centres publish per-nationality checklists - see our per-country corridor guides for specifics.",
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
            <nav aria-label="Breadcrumb" className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/guide" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Guides</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Schengen Visa</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
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
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Member countries", v: String(memberCount) },
                { k: "Nationalities exempt", v: String(counts.exempt) },
                { k: "Need a visa", v: String(counts.required) },
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
              The <strong className="text-ink">Schengen visa</strong> is Europe&apos;s common short-stay visa
              (Type C): one application, one sticker, and free movement across the whole area. Whether you need
              one depends on your passport - see{" "}
              <Link href="#who-needs" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">who needs a Schengen visa</Link>.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              This guide covers the <Link href="#countries" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen countries list</Link>,{" "}
              <Link href="#who-needs" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">who needs a visa</Link>,{" "}
              <Link href="#apply" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">how to apply</Link>, the{" "}
              <Link href="#fee" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen visa fee</Link> and the{" "}
              <Link href="#rule" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">90/180 rule</Link>.
            </p>
          </section>

          {/* What is the Schengen Area */}
          <section className="mt-12 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">What Is the Schengen Area?</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              The Schengen Area is a group of {memberCount} European countries that abolished passport checks at
              their shared internal borders. Once you enter one member state legally, you can travel to the others
              without further border control. Most Schengen members are EU countries, joined by Iceland,
              Liechtenstein, Norway and Switzerland. Two important exceptions trip up travellers:{" "}
              <Link href="/destination/ireland" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Ireland</Link>{" "}
              is in the EU but not in Schengen, and the{" "}
              <Link href="/destination/united-kingdom" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">United Kingdom</Link>{" "}
              is in neither - both run their own visa policies, so a Schengen visa is not valid there.
            </p>
          </section>

          {/* Schengen countries list */}
          <section id="countries" className="mt-12 scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Schengen Countries List 2026 ({memberCount})
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              One Schengen short-stay visa is valid in all of these countries. Tap any country for its full entry
              requirements by passport.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {memberList.map((iso3) => (
                <CountryTile key={iso3} iso3={iso3} href={`/destination/${nameToSlug(nameFor(iso3))}`} sub="Schengen member" />
              ))}
            </div>
          </section>

          {/* 90/180 rule */}
          <section id="rule" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">The 90/180 Rule, Explained</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Whether you enter visa-free or on a Schengen visa, short stays are capped at{" "}
              <strong className="text-ink">90 days within any rolling 180-day period</strong> - counted across the
              whole Schengen Area, not per country. Three days in{" "}
              <Link href="/destination/france" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">France</Link>,
              four in{" "}
              <Link href="/destination/italy" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Italy</Link>{" "}
              and a week in{" "}
              <Link href="/destination/spain" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Spain</Link>{" "}
              all draw from the same allowance. The window rolls: on each day of your stay, look back 180 days and
              count every day spent in any Schengen country - the total must not exceed 90. Overstaying can mean
              fines, an entry ban, and refusals on future visa applications.
            </p>
          </section>

          {/* Who needs one - data-derived */}
          <section id="who-needs" className="mt-12 scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Who Needs a Schengen Visa in 2026?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
              The EU keeps one harmonised exemption list, so a single member&apos;s published policy answers the
              question for the whole area - verified here against France&apos;s official visa policy.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-ink">
              Nationalities That Do Not Need a Schengen Visa ({vfToFrance.length} visa-exempt)
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              These passports are admitted visa-free for up to 90 days in any 180. Citizens of the {memberCount}{" "}
              Schengen member states are not listed here - they have freedom of movement, with no visa and no stay
              limit. Tap a passport for its full visa-free list.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {vfToFrance.slice(0, 15).map((e) => (
                <CountryTile
                  key={e.iso3}
                  iso3={e.iso3}
                  href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                  sub={e.maxStayDays != null ? `visa-free ≤ ${e.maxStayDays} days` : "visa-free"}
                />
              ))}
            </div>
            <details className="group/toggle mt-2.5">
              <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open/toggle:hidden">Show all {vfToFrance.length}</span>
                <span className="hidden group-open/toggle:inline">Show fewer</span>
                <Chevron toggle />
              </summary>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {vfToFrance.slice(15).map((e) => (
                  <CountryTile
                    key={e.iso3}
                    iso3={e.iso3}
                    href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                    sub={e.maxStayDays != null ? `visa-free ≤ ${e.maxStayDays} days` : "visa-free"}
                  />
                ))}
              </div>
            </details>

            <h3 className="mt-8 font-display text-lg font-semibold text-ink">
              Nationalities That Need a Schengen Visa ({counts.required})
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              These passports must obtain a Schengen short-stay visa before travelling, even for tourism.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {counts.requiredIso3.slice(0, 15).map((iso3) => (
                <CountryTile key={iso3} iso3={iso3} href={`/passport/${nameToSlug(nameFor(iso3))}`} sub="Schengen visa required" />
              ))}
            </div>
            <details className="group/toggle mt-2.5">
              <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open/toggle:hidden">Show all {counts.required}</span>
                <span className="hidden group-open/toggle:inline">Show fewer</span>
                <Chevron toggle />
              </summary>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {counts.requiredIso3.slice(15).map((iso3) => (
                  <CountryTile key={iso3} iso3={iso3} href={`/passport/${nameToSlug(nameFor(iso3))}`} sub="Schengen visa required" />
                ))}
              </div>
            </details>
          </section>

          {/* Per-nationality guides */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Schengen Visa Guides by Nationality
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Dedicated Schengen guides for the most-searched nationalities: whether you need a visa, where to apply,
              documents and fees.
            </p>
            <h3 className="mt-5 font-display text-base font-semibold text-ink">Visa required</h3>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {guidesRequired.map((g) => (
                <li key={g.iso3}>
                  <Link
                    href={`/guide/schengen/${g.slug}`}
                    className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                  >
                    <span className="text-xl">{flagFor(g.iso3)}</span>
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                      Schengen visa for {DEMONYM[g.iso3] ?? g.name} citizens
                    </span>
                    <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 font-display text-base font-semibold text-ink">No visa needed (short stays)</h3>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {guidesNotRequired.map((g) => (
                <li key={g.iso3}>
                  <Link
                    href={`/guide/schengen/${g.slug}`}
                    className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
                  >
                    <span className="text-xl">{flagFor(g.iso3)}</span>
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                      Schengen rules for {DEMONYM[g.iso3] ?? g.name} citizens
                    </span>
                    <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* How to apply */}
          <section id="apply" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">How to Apply for a Schengen Visa</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              The application process is harmonised across members - the same form, fee and core documents everywhere.
            </p>
            <ol className="mt-5 space-y-4">
              {[
                {
                  t: "Pick the right consulate",
                  d: "Apply to the country of your main destination - where you will spend the longest. If stays are equal, apply to the country of first entry. Applying to the \"easiest\" consulate while mainly visiting another country is a common ground for refusal.",
                },
                {
                  t: "Fill the harmonised application form",
                  d: "Every member uses the same Schengen short-stay form. Most consulates take applications through outsourced centres (VFS Global, TLScontact or BLS) in your country of residence.",
                },
                {
                  t: "Gather the standard file",
                  d: "Passport valid at least three months beyond departure from Schengen, photos, travel medical insurance with at least EUR 30,000 coverage, proof of accommodation, itinerary, proof of funds, and evidence of ties to your home country. Exact per-nationality checklists are published by each consulate - see our corridor guides below.",
                },
                {
                  t: "Book biometrics and pay the fee",
                  d: "First-time applicants give fingerprints; these stay valid in the VIS system for later applications. The standard fee is EUR 90 for adults (see the fee section below).",
                },
                {
                  t: "Wait for the decision",
                  d: "In the official data we track for France, consulates decide within 15 days in most cases, extendable to up to 45 days. You can apply up to 6 months before travel.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-4 rounded-sm border border-line bg-paper-2/70 p-4">
                  <span className="mono text-lg font-semibold tabular-nums text-stamp">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">{s.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Fee */}
          <section id="fee" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">Schengen Visa Fee 2026</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              The short-stay visa fee is set EU-wide, so it is the same whichever member state you apply to:
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="mono border-b border-line-strong text-left text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
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
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">■</span>
                <span>A separate VFS Global or TLScontact service fee is charged on top where the consulate outsources intake.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">■</span>
                <span>The visa fee is not refunded if the application is refused.</span>
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Wondering how much money to show in your bank statement? See our{" "}
              <Link href="/guide/proof-of-funds#schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen proof-of-funds guide
              </Link>{" "}
              for the official daily-subsistence amount required by each member state.
            </p>
          </section>

          {/* Corridor guides per top destination */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Schengen Visa Requirements by Destination &amp; Nationality
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Detailed corridor guides - stay length, conditions, documents and official sources - for the
              most-visited Schengen destinations.
            </p>
            <div className="mt-5 space-y-2.5">
              {CORRIDOR_DESTS.map((dest) => {
                const links = corridorsForDestination(dest);
                if (links.length === 0) return null;
                return (
                  <details key={dest} className="group rounded-sm border border-line bg-paper-2/70">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="text-xl">{flagFor(dest)}</span>
                      <span className="font-display text-[15px] font-medium text-ink">
                        {nameFor(dest)} visa guides by nationality ({links.length})
                      </span>
                      <span className="ml-auto"><Chevron /></span>
                    </summary>
                    <ul className="grid gap-2.5 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {links.map((c) => (
                        <li key={`${c.nat}-${c.dest}`}>
                          <Link
                            href={`/passport/${c.natSlug}/${c.destSlug}`}
                            className="group/link flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper px-3.5 py-2.5 transition hover:border-line-strong"
                          >
                            <span className="text-xl">{flagFor(c.nat)}</span>
                            <span className="font-display text-sm font-medium text-ink transition group-hover/link:text-stamp">
                              {DEMONYM[c.nat] ?? nameFor(c.nat)} citizens
                            </span>
                            <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover/link:text-stamp">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Schengen Visa FAQ</h2>
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
              Check your Schengen visa requirements
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to instantly see whether you need a Schengen visa, how long you can stay, and which
              European countries you can enter visa-free. Or compare all passports on the{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport rankings</Link>.
            </p>
            <Link
              href="/visit?dest=FRA"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Check visa requirements on Earth Visa →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
