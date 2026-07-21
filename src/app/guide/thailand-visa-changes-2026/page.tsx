import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/thailand-visa-changes-2026 - "thailand visa changes 2026", "thailand
// 60 day visa free ending", "thailand 30 day visa exemption"
//
// Breaking-news explainer for Thailand's replacement of the blanket 60-day
// visa exemption (93 countries, active since 15 July 2024) with a tiered
// scheme approved by Cabinet on 19 May 2026 and REVISED on 14 July 2026:
// 30 days for 59 countries/territories, 15 days for 2, visa on arrival cut
// from 31 countries to 3. None of it is in force yet - it takes effect 15
// days after Royal Gazette publication, which has not happened as of 19 July
// 2026 - so every "current status" figure on this page is computed live from
// dataset.passportAccess (which still carries the legally active 60-day
// edges). Only the announced tier structure, dates and confirmed placements
// are researched constants, cross-referenced against the advisory notes in
// data/countries/THA.json. Confirmed-tier claims are limited to nationalities
// individually sourced (all 27 EU states, India, Maldives, Mauritius,
// Seychelles, the 3 VoA countries); the full 59-country list is NOT public,
// and this page says so rather than guessing.
// ---------------------------------------------------------------------------

const TAT_MAY_URL =
  "https://www.tatnews.org/2026/05/thai-cabinet-approves-revision-of-60-day-visa-exemption-scheme-pending-royal-gazette-publication/";
const TAT_JUL_URL =
  "https://www.tatnews.org/2026/07/thai-cabinet-approves-updated-visa-measures-pending-royal-gazette-publication/";
const NATION_JUL_URL = "https://www.nationthailand.com/news/policy/40068630";

const THA = "THA";

// The single date this page was last human-verified against official Thai
// sources. UPDATE THIS ONE CONSTANT whenever you re-check the status (and the
// day the Royal Gazette finally publishes - that is the flip this page waits
// for). Everything date-stamped below derives from it, so the page can never
// show two different "as of" dates or a stamp that silently drifts out of sync
// with the ISO date in the article's structured data.
const LAST_REVIEWED = "2026-07-19"; // ISO 8601, machine-readable for JSON-LD
const CHECKED_STAMP = new Date(`${LAST_REVIEWED}T00:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}); // -> "19 July 2026"

// Confirmed 30-day-tier samples (all 27 EU member states were confirmed as a
// bloc by TAT; Croatia, Bulgaria, Cyprus, Malta were individually named as
// additions, as were India and Maldives). Shown with their LIVE current status
// from the dataset so "today vs after" never drifts from the data.
const CONFIRMED_30_SAMPLES = ["IND", "DEU", "FRA", "ITA", "ESP", "NLD", "POL", "HRV", "CYP", "MLT", "BGR", "MDV"];
const TIER_15 = ["MUS", "SYC"];
const VOA_3 = ["AZE", "BLR", "SRB"];

// High-traffic Thailand corridors for the link mesh - only rendered when the
// corridor page actually exists (isUsefulCorridor).
const CORRIDOR_CANDIDATES = ["IND", "GBR", "USA", "DEU", "FRA", "ITA", "ESP", "NLD", "POL", "RUS", "AUS", "CHN", "PHL"];

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

/** Human label for a nationality's CURRENT (legally active) Thailand access. */
function todayLabel(nat: string): string {
  const e = accessTo(nat, THA);
  if (!e) return "visa required";
  if (e.level === "visa_free") return e.maxStayDays ? `visa-free, ${e.maxStayDays} days` : "visa-free";
  if (e.level === "visa_on_arrival") return e.maxStayDays ? `visa on arrival, ${e.maxStayDays} days` : "visa on arrival";
  if (e.level === "e_visa") return "e-Visa";
  if (e.level === "eta") return "eTA";
  return "visa required";
}

const title = "Thailand Visa Changes 2026: 60-Day Visa-Free Ending, New 30-Day Rule & Who's Affected";
const description =
  "Thailand approved replacing its 60-day visa exemption with a tiered system: 30-day visa-free entry for 59 countries (India was upgraded on 14 July 2026), 15 days for Mauritius and Seychelles, and visa on arrival cut from 31 countries to 3. Not yet in force - the 60-day rule still applies until 15 days after Royal Gazette publication. Confirmed tier placements, effective-date mechanics, and the long-stay visas that are unaffected.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "thailand visa changes 2026",
    "thailand 60 day visa free ending",
    "thailand 30 day visa exemption",
    "thailand visa free 2026",
    "thailand visa exemption new rules",
    "thailand visa for indians 2026",
    "thailand india visa free 30 days",
    "thailand visa on arrival countries 2026",
    "when does thailand 30 day visa start",
    "thailand royal gazette visa exemption",
    "thailand 15 day visa exemption",
    "thailand visa rules july 2026",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/thailand-visa-changes-2026" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/thailand-visa-changes-2026",
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

export default function ThailandVisaChangesGuidePage() {
  const indEdge = accessTo("IND", THA);
  const indDaysToday = indEdge?.level === "visa_free" ? indEdge.maxStayDays : null;

  const thaSlug = nameToSlug(nameFor(THA));

  const corridorLinks = CORRIDOR_CANDIDATES.filter((nat) => isUsefulCorridor(nat, THA)).map((nat) => ({
    href: `/passport/${nameToSlug(nameFor(nat))}/${thaSlug}`,
    label: `Thailand entry rules for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
    iso3: nat,
  }));

  const faqs = [
    {
      q: "Is Thailand really ending the 60-day visa-free stay?",
      a: `Yes - but it has not happened yet. Thailand's Cabinet approved replacing the blanket 60-day visa exemption (93 countries, in place since 15 July 2024) on 19 May 2026, and approved a revised version of the framework on 14 July 2026: a 30-day visa exemption for 59 countries/territories, a 15-day exemption for 2, and visa on arrival for 3. The change only takes legal effect 15 days after the implementing announcements are published in the Royal Gazette, which has not happened as of ${CHECKED_STAMP} - so the 60-day rule still applies at Thai borders today.`,
    },
    {
      q: "When do Thailand's new visa rules start?",
      a: `No start date exists yet. The five implementing Ministry of Interior announcements take effect 15 days after they are published in the Royal Gazette, and as of ${CHECKED_STAMP} no publication date has been announced. Until then, the current 60-day exemption and 31-country visa-on-arrival scheme remain in force.`,
    },
    {
      q: "Do Indian citizens lose visa-free entry to Thailand?",
      a: `No. The original 19 May 2026 framework would have demoted India to a 15-day visa on arrival (THB 2,000 fee), but the Cabinet reversed that on 14 July 2026: India is confirmed on the new 30-day visa-free list. Today Indian passport holders still get the current ${indDaysToday ?? 60}-day visa-free stay; once the new rules take effect, that becomes 30 days visa-free - not visa on arrival.`,
    },
    {
      q: "Which countries keep visa-free entry to Thailand under the new rules?",
      a: "Confirmed so far: all 27 EU member states (with Croatia, Bulgaria, Cyprus and Malta individually named as additions), India, and the Maldives are on the 30-day visa-free list of 59 countries/territories; Mauritius and Seychelles get 15 days. Media reports also place the US, UK, Australia, Canada, Japan and South Korea on the 30-day list, but the full official 59-country list has not been published - it will only be definitive when the Royal Gazette annexes appear.",
    },
    {
      q: "What happens to Thailand's visa on arrival?",
      a: "It shrinks from 31 eligible countries to just 3: Azerbaijan, Belarus and Serbia. India, originally slated to join that list in the May framework, was instead upgraded to the 30-day visa-free tier on 14 July 2026. The other current visa-on-arrival countries are expected to lose eligibility when the change takes effect.",
    },
    {
      q: "I'll be in Thailand when the new rules start - is my stay cut short?",
      a: "No. The approved transition rule says travellers who enter Thailand before the new measures take effect keep the full duration of their originally permitted stay. A 60-day entry stamped before the effective date remains a 60-day stay.",
    },
    {
      q: "Are DTV, LTR, Thailand Privilege or retirement visa holders affected?",
      a: "No. The change replaces the visa-exemption scheme for short tourist stays only. Long-stay categories - the Destination Thailand Visa (DTV), Long-Term Resident (LTR) visa, Thailand Privilege, retirement (Non-O/O-A), work, student and marriage visas - are unaffected, and existing bilateral visa-exemption agreements (90-, 30- or 14-day depending on the treaty) continue unchanged.",
    },
    {
      q: "Why is Thailand making this change?",
      a: "The government's stated aims are tighter screening, reducing misuse of visa-exempt entry (including illegal work), eliminating overlapping entitlements (\"one country, one entitlement\"), and aligning stay lengths with actual travel behaviour - most tourists stay well under 30 days. The 14 July 2026 revision explicitly cited Indian visitors' roughly 7-day average trips in restoring India's visa-free status.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          {
            "@type": "ListItem",
            position: 2,
            name: "Thailand Visa Changes 2026",
            item: "https://earthvisa.in/guide/thailand-visa-changes-2026",
          },
        ],
      },
      {
        "@type": "Article",
        headline: title,
        description,
        mainEntityOfPage: "https://earthvisa.in/guide/thailand-visa-changes-2026",
        // Derived from the same LAST_REVIEWED constant as the visible stamp, so
        // the structured date and the on-page date can never disagree.
        dateModified: LAST_REVIEWED,
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Thailand Visa Changes</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                Thailand Visa Changes 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  The 60-Day Visa-Free Stay Is Ending - Here&apos;s Who Lands Where
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Approved 19 May 2026 &middot; revised 14 July 2026 &middot; NOT yet in force as of {CHECKED_STAMP}
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Visa-free stay today", v: "60 days" },
                { k: "New standard stay", v: "30 days" },
                { k: "Countries covered", v: "93 → 65" },
                { k: "Visa on arrival list", v: "31 → 3" },
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

          {/* Current-rule banner - the single most important fact on the page */}
          <section className="mt-10 max-w-3xl">
            <div className="card-doc card-doc-rule px-5 py-4">
              <p className="mono-chrome">
                Status checked {CHECKED_STAMP}
              </p>
              <p className="text-body mt-2 text-ink-soft">
                <strong className="text-ink">The old rules still apply.</strong> The new tiers take effect{" "}
                <strong className="text-ink">15 days after publication in the Royal Gazette</strong>, and no
                publication date has been announced. Until then, the 60-day visa exemption and the 31-country
                visa on arrival remain the law at every Thai border - and travellers who enter{" "}
                <em>before</em> the effective date keep their full originally permitted stay.
              </p>
            </div>
          </section>

          {/* What's changing */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">What&apos;s Changing</h2>
            <p className="text-body mt-3 text-ink-soft">
              Since <strong className="text-ink">15 July 2024</strong>, Thailand has given passport holders of 93
              countries a blanket <strong className="text-ink">60-day visa-free stay</strong>. On{" "}
              <strong className="text-ink">19 May 2026</strong> the Cabinet approved scrapping that scheme, and on{" "}
              <strong className="text-ink">14 July 2026</strong> it approved a revised, final framework: a
              tiered &quot;one country, one entitlement&quot; system covering 65 countries and territories.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col" className="mono-chrome py-3 pr-4">Entry route</th>
                    <th scope="col" className="mono-chrome py-3 pr-4">Today (in force)</th>
                    <th scope="col" className="mono-chrome py-3">Approved (pending Gazette)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">General visa exemption</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">93 countries &middot; 60 days</td>
                    <td className="py-3 text-sm font-semibold text-ink">59 countries/territories &middot; 30 days</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">15-day visa exemption</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">-</td>
                    <td className="py-3 text-sm font-semibold text-ink">2 countries (Mauritius, Seychelles)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">Visa on arrival (THB 2,000)</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">31 countries &middot; 15 days</td>
                    <td className="py-3 text-sm font-semibold text-ink">3 countries (Azerbaijan, Belarus, Serbia)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">Bilateral exemption treaties</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">90 / 30 / 14 days by treaty</td>
                    <td className="py-3 text-sm text-ink-soft">Unchanged</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">DTV, LTR, Privilege, retirement &amp; other visas</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">Per visa terms</td>
                    <td className="py-3 text-sm text-ink-soft">Unchanged</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="card-doc mt-5 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">The full 59-country list is not public yet.</strong>{" "}
              Officials have confirmed the tier sizes and named some members (below), but the definitive
              country-by-country annexes only appear with Royal Gazette publication. This page lists only
              placements that are individually sourced - not guesses.
            </p>
          </section>

          {/* The India story */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The India Reversal: VoA Demotion Undone</h2>
            <p className="text-body mt-3 text-ink-soft">
              The May framework&apos;s most controversial line moved <strong className="text-ink">India</strong> off
              the visa-free list entirely, down to a 15-day visa on arrival with a THB 2,000 fee. After reports of
              falling Indian arrivals, the Cabinet reversed course on <strong className="text-ink">14 July 2026</strong>:
              India is confirmed on the <strong className="text-ink">30-day visa-free list</strong>, with officials
              citing India&apos;s economic importance and Indian visitors&apos; roughly 7-day average stays.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              Nothing has changed at the border yet: Indian passport holders still enter visa-free for up to{" "}
              <strong className="text-ink">{indDaysToday ?? 60} days</strong> today, becoming 30 days once the new
              rules take effect. Full requirements on the{" "}
              <Link href={`/passport/india/${thaSlug}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Thailand entry rules for Indian citizens
              </Link>{" "}
              page.
            </p>
          </section>

          {/* Who lands where */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Who Lands Where - Confirmed Placements Only</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Individually sourced from the Tourism Authority of Thailand&apos;s official announcement and Thai press
              coverage of the 14 July 2026 Cabinet session: all 27 EU member states (Croatia, Bulgaria, Cyprus and
              Malta were named as additions), India and the Maldives are on the 30-day list. Each card shows the
              nationality&apos;s <em>current, still-active</em> status from our dataset.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {CONFIRMED_30_SAMPLES.map((iso3) => (
                <Link
                  key={iso3}
                  href={isUsefulCorridor(iso3, THA) ? `/passport/${nameToSlug(nameFor(iso3))}/${thaSlug}` : `/passport/${nameToSlug(nameFor(iso3))}`}
                  className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="text-xl">{flagFor(iso3)}</span>
                  <div className="min-w-0">
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{nameFor(iso3)}</span>
                    <div className="mono text-[11px] text-ink-mute">today: {todayLabel(iso3)}</div>
                  </div>
                  <span className="mono ml-auto shrink-0 rounded-[3px] bg-vfree/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-vfree ring-1 ring-vfree/30">
                    → 30 days
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-sub text-ink">The 15-Day Tier</h3>
                <p className="text-body mt-1.5 max-w-xl text-ink-soft">
                  Two countries drop from 60 days to 15 - the shortest visa-free tier, flagged for review against
                  tourism volumes.
                </p>
                <div className="mt-4 grid gap-2.5">
                  {TIER_15.map((iso3) => (
                    <div key={iso3} className="card-doc flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                      <span className="text-xl">{flagFor(iso3)}</span>
                      <div className="min-w-0">
                        <span className="font-display text-sm font-medium text-ink">{nameFor(iso3)}</span>
                        <div className="mono text-[11px] text-ink-mute">today: {todayLabel(iso3)}</div>
                      </div>
                      <span className="mono ml-auto shrink-0 rounded-[3px] bg-eta/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">
                        → 15 days
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sub text-ink">The 3-Country Visa on Arrival</h3>
                <p className="text-body mt-1.5 max-w-xl text-ink-soft">
                  Visa on arrival survives for just three nationalities (15 days, THB 2,000, designated checkpoints).
                  India was slated to be the fourth until the July revision moved it to visa-free.
                </p>
                <div className="mt-4 grid gap-2.5">
                  {VOA_3.map((iso3) => (
                    <div key={iso3} className="card-doc flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                      <span className="text-xl">{flagFor(iso3)}</span>
                      <div className="min-w-0">
                        <span className="font-display text-sm font-medium text-ink">{nameFor(iso3)}</span>
                        <div className="mono text-[11px] text-ink-mute">today: {todayLabel(iso3)}</div>
                      </div>
                      <span className="mono ml-auto shrink-0 rounded-[3px] bg-eta/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">
                        → VoA
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="card-doc mt-6 max-w-3xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">Widely reported but not yet officially itemised:</strong>{" "}
              coverage consistently places the United States, United Kingdom, Australia, Canada, Japan and South
              Korea on the 30-day list, and the scheme&apos;s shrink from 93 to 65 countries means roughly two dozen
              nationalities lose visa-free access altogether - but no official source has published those names.
              We&apos;ll update this page and the underlying dataset when the Gazette annexes appear.
            </p>
          </section>

          {/* Effective date mechanics */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">When It Takes Effect - and What Happens Mid-Trip</h2>
            <ul className="text-body mt-4 space-y-2 text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  <strong className="text-ink">Five Ministry of Interior announcements</strong> implement the change.
                  They take legal effect <strong className="text-ink">15 days after publication in the Royal
                  Gazette</strong> - and as of {CHECKED_STAMP} they have not been published, with no date announced.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  <strong className="text-ink">Until then, nothing changes:</strong> the 60-day exemption and the
                  31-country visa on arrival remain the enforced rules at every checkpoint.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  <strong className="text-ink">Enter before the switch, keep your stay:</strong> travellers admitted
                  before the effective date retain the full duration originally stamped - a 60-day entry is not
                  shortened retroactively.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  <strong className="text-ink">Extensions still exist:</strong> visa-exempt entrants can currently
                  apply for one 30-day extension at an immigration office - a separate mechanism this reform does
                  not abolish.
                </span>
              </li>
            </ul>
          </section>

          {/* Protected categories */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Long-Stay Visas Are Not Touched</h2>
            <p className="text-body mt-3 text-ink-soft">
              This reform rewrites <em>visa-exempt short-stay</em> entry only. If you hold - or are applying for -
              a <strong className="text-ink">Destination Thailand Visa (DTV)</strong>, a{" "}
              <strong className="text-ink">Long-Term Resident (LTR)</strong> visa,{" "}
              <strong className="text-ink">Thailand Privilege</strong>, a retirement (Non-O/O-A), work, student or
              marriage visa, your terms are unaffected. Existing bilateral visa-exemption treaties (90-, 30- or
              14-day, e.g. for South Korea, Brazil, China, Hong Kong, Laos, Cambodia and Myanmar) also continue
              unchanged. See every Thai visa category on the{" "}
              <Link href={`/destination/${thaSlug}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Thailand destination page
              </Link>.
            </p>
          </section>

          {/* Sources */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Sources</h2>
            <ul className="text-body mt-4 space-y-2 text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Tourism Authority of Thailand (official) - updated visa measures pending Royal Gazette publication,
                  16 July 2026:{" "}
                  <a href={TAT_JUL_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">tatnews.org</a>
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Tourism Authority of Thailand (official) - original Cabinet approval of the revision, May 2026:{" "}
                  <a href={TAT_MAY_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">tatnews.org</a>
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Nation Thailand - Thailand revamps visa rules for 65 countries and territories, 14 July 2026:{" "}
                  <a href={NATION_JUL_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">nationthailand.com</a>
                </span>
              </li>
            </ul>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Current-status figures on this page (60-day stays, visa-on-arrival entries) are rendered live from
              Earth Visa&apos;s dataset, which tracks the legally active policy from official Thai government
              sources - not the pending one. The dataset flips only when the Royal Gazette publishes.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Thailand Visa Changes FAQ</h2>
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
            title="Thailand Entry Rules by Nationality"
            description="Current, in-force requirements and stay limits for the most-travelled passports - each page carries the pending-change advisory."
            links={corridorLinks}
          />

          {/* Related */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Related Guides</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <li>
                <Link href="/guide/visa-types" className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">📄</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Visa types explained</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
              <li>
                <Link href="/guide/japan-visa-fee-increase-2026" className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">🇯🇵</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Japan visa fee increase 2026</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              What does your passport get in Thailand right now?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              The rules above are the approved future - your trip runs on today&apos;s. See the current, in-force
              entry rule for every nationality on the{" "}
              <Link href={`/destination/${thaSlug}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Thailand destination page
              </Link>.
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
