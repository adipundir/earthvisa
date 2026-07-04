import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";
import type { AccessLevel } from "@/lib/types";

// ---------------------------------------------------------------------------
// /guide/gcc-visa - "gcc unified visa", "gcc grand tours visa"
//
// The six GCC states have approved a Schengen-style joint tourist visa
// (announced as the "GCC Grand Tours" visa). It is treated here strictly as
// ANNOUNCED / UPCOMING - our dataset records only per-state visa policies,
// so this page never claims the unified visa is live, never states a launch
// date or fee, and points readers at official channels for rollout status.
//
// Everything below the announcement explainer is data-driven: per-state
// openness stats, and a nationality x state access matrix computed from
// dataset.passportAccess at build time.
// ---------------------------------------------------------------------------

// Popularity order for display (all six derived from dataset.groups.GCC).
const GCC_ORDER = ["ARE", "SAU", "QAT", "OMN", "BHR", "KWT"];

// Nationalities with the highest "gcc visa" search demand.
const MATRIX_NATIONALITIES = ["IND", "PAK", "PHL", "EGY", "USA", "GBR"];

const LEVEL_LABEL: Record<AccessLevel, string> = {
  visa_free: "Visa-free",
  visa_on_arrival: "On arrival",
  eta: "eTA",
  e_visa: "e-Visa",
};

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

const title = "GCC Unified Visa 2026: Grand Tours Visa Status & Current Gulf Entry Rules";
const description =
  "GCC unified tourist visa (Grand Tours visa) explained for 2026: the six Gulf states approved a Schengen-style joint visa covering UAE, Saudi Arabia, Qatar, Oman, Bahrain and Kuwait. Rollout status, and the individual visa rules that apply per state until it launches.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "gcc unified visa",
    "gcc grand tours visa",
    "gcc visa",
    "unified gulf visa",
    "gcc tourist visa",
    "one visa for gulf countries",
    "gcc unified visa 2026",
    "gcc unified visa launch",
    "gulf schengen visa",
    "uae saudi qatar oman bahrain kuwait visa",
    "gcc visa for indian",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/gcc-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/gcc-visa",
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

export default function GccVisaGuidePage() {
  // Member list comes from the dataset group; GCC_ORDER only sorts it.
  const gccSet = new Set(dataset.groups.GCC ?? []);
  const members = GCC_ORDER.filter((iso3) => gccSet.has(iso3));

  // Per-state reverse index: how many nationalities each state admits, by level.
  const stateStats = members.map((dest) => {
    const counts: Record<AccessLevel, number> = { visa_free: 0, visa_on_arrival: 0, eta: 0, e_visa: 0 };
    for (const edges of Object.values(dataset.passportAccess)) {
      const e = edges.find((x) => x.dest === dest);
      if (e) counts[e.level]++;
    }
    return { iso3: dest, name: nameFor(dest), counts };
  });

  const totalVf = stateStats.reduce((s, x) => s + x.counts.visa_free, 0);
  const totalVoa = stateStats.reduce((s, x) => s + x.counts.visa_on_arrival, 0);
  const totalE = stateStats.reduce((s, x) => s + x.counts.eta + x.counts.e_visa, 0);

  // Nationality x state matrix, straight from the dataset.
  const matrix = MATRIX_NATIONALITIES.map((nat) => ({
    nat,
    name: nameFor(nat),
    demonym: DEMONYM[nat] ?? nameFor(nat),
    cells: members.map((dest) => ({ dest, edge: accessTo(nat, dest) })),
  }));

  // GCC residence-permit perks recorded in the dataset (credential access
  // into other member states - the closest live thing to a "GCC visa").
  const gccResidenceEdges = (dataset.credentialAccess.GCC_RESIDENCE ?? [])
    .filter((e) => gccSet.has(e.dest) && !e.transit)
    .sort((a, b) => nameFor(a.dest).localeCompare(nameFor(b.dest)));

  // Corridor mesh: only corridors that actually exist in the build.
  const corridorLinks = MATRIX_NATIONALITIES.flatMap((nat) =>
    members.filter((dest) => isUsefulCorridor(nat, dest)).map((dest) => ({
      href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`,
      label: `${nameFor(dest)} for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
      iso3: dest,
    })),
  );

  const memberNames = members.map((m) => nameFor(m)).join(", ");

  const faqs = [
    {
      q: "What is the GCC unified visa (Grand Tours visa)?",
      a: `It is a planned Schengen-style joint tourist visa approved by the six Gulf Cooperation Council states - ${memberNames} - announced under the "GCC Grand Tours" name. One application would allow travel across all six countries, instead of today's separate per-state visas. It has been approved at GCC level, but this page treats it strictly as announced/upcoming: confirm rollout status on official GCC or member-state channels before planning around it.`,
    },
    {
      q: "Is the GCC unified visa available now?",
      a: "Not per our dataset. Every Gulf entry rule we record is still issued by an individual state - a UAE visa does not admit you to Saudi Arabia, and so on. No launch date or fee is stated here because none has been confirmed in our official-source data; check official announcements for current status.",
    },
    {
      q: "Which countries will the GCC unified visa cover?",
      a: `The six GCC member states: ${memberNames}. The announced concept covers tourism travel across all six with a single authorisation, similar to how one Schengen visa covers the Schengen area.`,
    },
    {
      q: "Do I need separate visas for each Gulf country today?",
      a: `Yes - each state decides its own policy, and access differs sharply by passport. For example, per our dataset, ${stateStats.find((s) => s.iso3 === "BHR")?.counts.visa_on_arrival ?? 0} nationalities get visa on arrival in Bahrain while Saudi Arabia offers its tourist e-visa to ${(stateStats.find((s) => s.iso3 === "SAU")?.counts.e_visa ?? 0)} nationalities. Check each destination page, or the matrix on this page, for your passport.`,
    },
    {
      q: "Does a GCC residence permit already unlock travel between Gulf states?",
      a: gccResidenceEdges.length > 0
        ? `Partially, yes. Our dataset records credential-based access for GCC residence-permit holders to ${[...new Set(gccResidenceEdges.map((e) => nameFor(e.dest)))].join(", ")} - typically visa on arrival or e-visa, often limited to eligible professions and permits valid 3+ months. Conditions vary per state; verify on each state's official portal.`
        : "Some Gulf states offer easier entry to residents of fellow GCC countries. Conditions vary per state; verify on each state's official portal.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "GCC Unified Visa Guide", item: "https://earthvisa.in/guide/gcc-visa" },
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
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center">Guides</span>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">GCC Unified Visa</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                GCC Unified Visa 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  The &quot;Grand Tours&quot; Visa - Status &amp; Today&apos;s Gulf Entry Rules
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
                Approved &amp; announced · not yet live per our dataset
              </p>
            </div>

            {/* Stats */}
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Member states", v: members.length },
                { k: "Visa-free grants (sum of 6 states)", v: totalVf },
                { k: "Visa on arrival grants", v: totalVoa },
                { k: "eTA / e-Visa grants", v: totalE },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* What it is */}
          <section className="mt-10 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">What Is the GCC Unified Tourist Visa?</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              The six Gulf Cooperation Council states -{" "}
              {members.map((m, i) => (
                <span key={m}>
                  <Link href={`/destination/${nameToSlug(nameFor(m))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">{nameFor(m)}</Link>
                  {i < members.length - 2 ? ", " : i === members.length - 2 ? " and " : ""}
                </span>
              ))}{" "}
              - have approved a <strong className="text-ink">Schengen-style joint tourist visa</strong>, announced under
              the <strong className="text-ink">&quot;GCC Grand Tours&quot;</strong> name. The concept: one application,
              one authorisation, tourism travel across all six countries - the way a single Schengen visa covers the{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Schengen area</Link>.
            </p>
            <p className="mono mt-5 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Status: approved and announced, but <strong>not yet live per our dataset</strong> - every Gulf entry rule
              we record is still issued per state. No launch date or fee is stated here; confirm rollout status on
              official GCC or member-state channels before planning a multi-country trip around it.
            </p>
          </section>

          {/* The six states, data-driven openness */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">The Six GCC Member States</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              How open each member is today, from our dataset - counts are nationalities admitted at each level.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stateStats.map(({ iso3, name, counts }) => (
                <Link
                  key={iso3}
                  href={`/destination/${nameToSlug(name)}`}
                  className="group rounded-sm border border-line bg-paper-2/70 p-4 transition hover:border-line-strong"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{flagFor(iso3)}</span>
                    <span className="font-display font-semibold text-ink transition group-hover:text-stamp">{name}</span>
                    <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                  </div>
                  <p className="mono mt-3 text-[11px] leading-relaxed text-ink-mute">
                    {counts.visa_free} visa-free · {counts.visa_on_arrival} on arrival · {counts.eta + counts.e_visa} eTA/e-visa
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Until it launches: per-state rules matrix */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Until It Launches: Visa Rules per GCC State
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Today you still deal with six separate visa systems. The matrix below shows the entry level each state
              grants to popular passports, computed from our official-source dataset. &quot;Visa required&quot; means no
              visa-free, on-arrival, eTA or e-visa grant is recorded - apply in advance.
            </p>
            <p className="mono mt-4 text-[10px] uppercase tracking-[0.15em] text-ink-mute sm:hidden">
              Swipe sideways for all six states <span aria-hidden>→</span>
            </p>
            <div className="mt-2 overflow-x-auto sm:mt-5">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col" className="mono py-3 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">Passport</th>
                    {members.map((dest) => (
                      <th key={dest} scope="col" className="mono px-2 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
                        <span className="mr-1.5">{flagFor(dest)}</span>
                        {nameFor(dest) === "United Arab Emirates" ? "UAE" : nameFor(dest)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {matrix.map(({ nat, name, cells }) => (
                    <tr key={nat}>
                      <th scope="row" className="py-3 pr-4 font-normal">
                        <Link href={`/passport/${nameToSlug(name)}`} className="group inline-flex min-h-[44px] items-center gap-2.5">
                          <span className="text-lg">{flagFor(nat)}</span>
                          <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{name}</span>
                        </Link>
                      </th>
                      {cells.map(({ dest, edge }) => (
                        <td key={dest} className="px-2 py-3">
                          {edge ? (
                            <span className={`mono inline-block rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[edge.level]}`}>
                              {LEVEL_LABEL[edge.level]}
                              {edge.maxStayDays != null && ` ${edge.maxStayDays}d`}
                            </span>
                          ) : (
                            <span className="mono inline-block rounded-[3px] bg-stamp/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
                              Visa required
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mono mt-3 text-[11px] text-ink-mute">
              Dataset last updated {dataset.meta.lastUpdated}. Check each destination page for full nationality lists.
            </p>
          </section>

          {/* GCC residents */}
          {gccResidenceEdges.length > 0 && (
            <section className="mt-12 max-w-3xl">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Already a GCC Resident? Your Permit Unlocks Neighbours
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">
                The closest live thing to a unified Gulf visa: our dataset records{" "}
                <strong className="text-ink">credential-based access for GCC residence-permit holders</strong> into
                other member states, regardless of nationality - commonly limited to permits valid 3+ months and, in
                some states, to eligible professions.
              </p>
              <ul className="mt-4 space-y-2.5">
                {gccResidenceEdges.map((e) => (
                  <li key={`${e.dest}-${e.level}`} className="flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.dest)}</span>
                    <span className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</span>
                    <span className={`mono ml-auto shrink-0 rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[e.level]}`}>
                      {LEVEL_LABEL[e.level]}
                      {e.maxStayDays != null && ` · ${e.maxStayDays}d`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Conditions differ per state (profession lists, permit validity, family riders) - verify on each
                state&apos;s official portal before travelling.
              </p>
            </section>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">GCC Unified Visa FAQ</h2>
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
            title="Gulf Visa Guides by Nationality"
            description="Detailed entry rules, stay limits and document notes for popular Gulf trips."
            links={corridorLinks}
          />

          {/* Related */}
          <section className="mt-12 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink">Related Guides</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <li>
                <Link href="/guide/umrah-visa" className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong">
                  <span className="text-xl">{flagFor("SAU")}</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Umrah visa guide (Saudi Arabia)</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
              <li>
                <Link href="/rankings" className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong">
                  <span className="text-xl">🛂</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Passport rankings 2026</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check your visa options for every Gulf state
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to see your current entry level for the UAE, Saudi Arabia, Qatar, Oman, Bahrain and
              Kuwait - including credential-based routes.
            </p>
            <Link
              href="/visit"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-paper-2"
            >
              Check visa requirements on Earth Visa →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
