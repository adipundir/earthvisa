import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { compute } from "@/lib/compute";
import { corridorsForNationality, isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";
import PassportDestinationSearch from "@/components/PassportDestinationSearch";
import type { AccessLevel, CbiProgram } from "@/lib/types";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugToCountry(slug: string) {
  return dataset.allCountries.find((c) => nameToSlug(c.name) === slug) ?? null;
}

// "1st" / "2nd" / "21st" / "112th" - handles the 11-13 exception.
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  return `${n}${mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th"}`;
}

// Grammar-safe nationality phrasings. DEMONYM covers the big passports
// ("Indian", "German"); for the rest we use phrasings that read correctly with
// the bare country name ("Palau passport holders", "citizens of Palau").
function nationalityPhrases(iso3: string, name: string) {
  const adj = DEMONYM[iso3];
  return {
    /** attributive form: "Indian passport holders" / "Palau passport holders" */
    adj: adj ?? name,
    /** subject phrase mid-sentence: "Indian citizens" / "citizens of Palau" */
    citizens: adj ? `${adj} citizens` : `citizens of ${name}`,
    /** subject phrase at sentence start: "Indian citizens" / "Citizens of Palau" */
    citizensCap: adj ? `${adj} citizens` : `Citizens of ${name}`,
    /** title case for headings: "Indian Citizens" / "Citizens of Palau" */
    citizensTitle: adj ? `${adj} Citizens` : `Citizens of ${name}`,
  };
}

export async function generateStaticParams() {
  return dataset.allCountries.map((c) => ({ slug: nameToSlug(c.name) }));
}

// Global rank by total reach - shared by metadata and the page body.
const rankOf = new Map(
  Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => ({ iso3, count: edges.length }))
    .sort((a, b) => b.count - a.count)
    .map((r, i) => [r.iso3, i + 1]),
);

// Head-term titles: "{country} passport ranking 2026" is the dominant query
// shape, and rank-in-title answers it in the SERP. India gets the exact
// highest-volume phrasing for its cluster.
function passportTitle(iso3: string, name: string, rank: number | undefined, vfCount: number): string {
  if (iso3 === "IND") return `Visa-Free Countries for Indians 2026 - Full List (${vfCount}) & Passport Rank`;
  return rank
    ? `${name} Passport Ranking 2026: #${rank} of 199 - ${vfCount} Visa-Free Countries`
    : `${name} Passport Ranking 2026 - ${vfCount} Visa-Free Countries`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = slugToCountry(slug);
  if (!country) return { title: "Not Found" };

  const result = compute([country.iso3], [], {});
  const vfCount = result.reachByLevel.visa_free.length;
  const voaCount = result.reachByLevel.visa_on_arrival.length;
  const etaCount = result.reachByLevel.eta.length + result.reachByLevel.e_visa.length;
  const total = result.reach.length;
  const flag = flagFor(country.iso3);

  const rank = rankOf.get(country.iso3);
  const title = passportTitle(country.iso3, country.name, rank, vfCount);
  const { adj } = nationalityPhrases(country.iso3, country.name);
  const description = `Visa-free countries for the ${adj} passport 2026: ${vfCount} destinations without a visa, ${voaCount} visa on arrival, and ${etaCount} e-visa${rank ? `. Ranked #${rank} of 199 passports` : ""}. Full list from official government sources.`;

  return {
    title,
    description,
    keywords: [
      `visa free countries for ${country.name.toLowerCase()} passport`,
      `${country.name.toLowerCase()} passport visa free countries`,
      `${country.name.toLowerCase()} passport ranking 2026`,
      `${country.name.toLowerCase()} passport ranking`,
      `how many countries can ${country.name.toLowerCase()} visit without visa`,
      `${country.name.toLowerCase()} passport strength`,
      `${country.name.toLowerCase()} visa on arrival countries`,
      `visa on arrival countries for ${country.name.toLowerCase()} passport`,
      `countries ${country.name.toLowerCase()} can visit without visa`,
      `${country.name.toLowerCase()} passport strength`,
      `most powerful passport ${country.name.toLowerCase()}`,
    ],
    openGraph: {
      title,
      description,
      url: `https://earthvisa.in/passport/${slug}`,
      type: "article",
    },
    alternates: { canonical: `https://earthvisa.in/passport/${slug}` },
  };
}

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

const LEVEL_LABEL_SHORT: Record<AccessLevel, string> = {
  visa_free: "Visa-free",
  visa_on_arrival: "On arrival",
  eta: "eTA",
  e_visa: "e-Visa",
};

// A tappable destination card. Links to the nationality-specific corridor page
// when one exists (e.g. India -> Thailand), otherwise the destination's page -
// so every destination in the reach lists leads somewhere with more detail.
// `fom` marks destinations covered by freedom of movement, where a tourist-stay
// cap would contradict the right to live and work there.
function DestCard({ natName, natIso3, edge, fom = false }: {
  natName: string;
  natIso3: string;
  edge: { dest: string; maxStayDays: number | null; level: AccessLevel };
  fom?: boolean;
}) {
  const destSlug = nameToSlug(nameFor(edge.dest));
  const href = isUsefulCorridor(natIso3, edge.dest)
    ? `/passport/${nameToSlug(natName)}/${destSlug}`
    : `/destination/${destSlug}`;
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong hover:bg-paper-2">
      <span className="text-xl">{flagFor(edge.dest)}</span>
      <div className="min-w-0">
        <div className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{nameFor(edge.dest)}</div>
        {fom ? (
          <div className="mono text-[11px] text-ink-mute">Freedom of movement</div>
        ) : (
          edge.maxStayDays != null && <div className="mono text-[11px] text-ink-mute">≤ {edge.maxStayDays} days</div>
        )}
      </div>
      <span className={`mono ml-auto shrink-0 whitespace-nowrap rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[edge.level]}`}>{LEVEL_LABEL_SHORT[edge.level]}</span>
    </Link>
  );
}

// processing_time in the CBI dataset occasionally carries crawler annotations
// ("Not stated verbatim on cip.gov.ag fetched pages") or long multi-clause
// caveats. Keep only short, human-readable durations so internal notes never
// reach the UI.
function cleanProcessingTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/not (stated|specified|published)|fetched page|verbatim|official (page|source)/i.test(raw)) return null;
  const s = raw.replace(/\s*\([^)]*\)/g, "").split(";")[0].trim().replace(/[.,:]+$/, "");
  if (!s || s.length > 80) return null;
  return s;
}

// Citizenship-by-investment program card. The fee / processing meta line only
// renders when the dataset has a real amount and a clean duration.
function CbiCard({ p }: { p: CbiProgram }) {
  const opt = p.options[0];
  const fee = opt && opt.currency && opt.min_amount != null
    ? `From ${opt.currency} ${opt.min_amount.toLocaleString()}`
    : null;
  const meta = [fee, cleanProcessingTime(p.processing_time)].filter(Boolean).join(" · ");
  return (
    <div className="rounded-sm border border-line bg-paper-2/70 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flagFor(p.iso3)}</span>
        <div>
          <div className="font-display font-semibold text-ink">{p.name}</div>
          <div className="text-sm italic text-ink-soft">{p.program_name}</div>
        </div>
      </div>
      {meta && <p className="mono mt-3 text-[11px] text-ink-mute">{meta}</p>}
    </div>
  );
}

export default async function PassportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = slugToCountry(slug);
  if (!country) notFound();

  const result = compute([country.iso3], [], {});
  const flag = flagFor(country.iso3);
  const vfCount = result.reachByLevel.visa_free.length;
  const voaCount = result.reachByLevel.visa_on_arrival.length;
  // Reach lists render alphabetically by display name (compute returns ISO3 order).
  const byDestName = (a: { dest: string }, b: { dest: string }) =>
    nameFor(a.dest).localeCompare(nameFor(b.dest));
  const vfEdges = [...result.reachByLevel.visa_free].sort(byDestName);
  const voaEdges = [...result.reachByLevel.visa_on_arrival].sort(byDestName);
  const fomEdges = [...result.freedomOfMovement].sort(byDestName);
  // eTA + e-Visa share one stat tile and one section
  const etaEdges = [...result.reachByLevel.eta, ...result.reachByLevel.e_visa].sort(byDestName);
  const etaCount = etaEdges.length;
  const total = result.reach.length;
  const fomCount = result.freedomOfMovement.length;
  // Destinations with freedom of movement: their visa-free cards must not show
  // a tourist-stay cap that contradicts the right to live and work there.
  const fomSet = new Set(result.freedomOfMovement.map((e) => e.dest));
  const cbiCount = result.cbi.length;
  // RBI rows are option-level (a country can contribute several); the honest
  // headline number is how many countries offer a program.
  const rbiCountries = new Set(result.rbi.map((p) => p.iso3)).size;

  const rank = rankOf.get(country.iso3) ?? null;

  // Corridor guides where this passport is the traveller (internal link mesh).
  const { adj: demonym, citizens, citizensCap, citizensTitle } = nationalityPhrases(country.iso3, country.name);
  const natCorridors = corridorsForNationality(country.iso3);
  const corridorLinks = natCorridors.map((c) => ({
    href: `/passport/${c.natSlug}/${c.destSlug}`,
    label: nameFor(c.dest),
    iso3: c.dest,
  }));
  // Header search: jump to a destination's visa guide for this nationality.
  const searchOptions = dataset.allCountries
    .filter((c) => c.iso3 !== country.iso3)
    .map((c) => ({ slug: nameToSlug(c.name), name: c.name, iso2: c.iso2 }));
  const corridorDestSlugs = natCorridors.map((c) => c.destSlug);

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Earth Visa", "item": "https://earthvisa.in" },
          { "@type": "ListItem", "position": 2, "name": "Passports", "item": "https://earthvisa.in/passport" },
          { "@type": "ListItem", "position": 3, "name": `${country.name} Passport`, "item": `https://earthvisa.in/passport/${slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": `How many countries can ${demonym} passport holders visit without a visa in 2026?`,
            "acceptedAnswer": { "@type": "Answer", "text": `${demonym} passport holders can visit ${vfCount} countries completely visa-free in 2026. Additionally, ${voaCount} countries offer visa on arrival and ${etaCount} countries offer eTA or e-Visa - bringing the total to ${total} destinations accessible without a pre-arranged embassy visa.` }
          },
          {
            "@type": "Question",
            "name": `What is the ${demonym} passport ranking in 2026?`,
            "acceptedAnswer": { "@type": "Answer", "text": rank ? `The ${demonym} passport ranks approximately ${ordinal(rank)} out of 199 passports in 2026, based on the number of visa-free destinations (${total} total accessible countries).` : `The ${demonym} passport provides access to ${total} destinations in 2026.` }
          },
          {
            "@type": "Question",
            "name": `Which countries offer visa on arrival to ${demonym} passport holders?`,
            "acceptedAnswer": { "@type": "Answer", "text": `${voaCount} countries offer visa on arrival to ${demonym} passport holders. These include: ${voaEdges.slice(0, 5).map(e => nameFor(e.dest)).join(", ")}${voaCount > 5 ? `, and ${voaCount - 5} more` : ""}.` }
          },
          ...(cbiCount > 0 ? [{
            "@type": "Question",
            "name": `Can ${citizens} obtain a second citizenship through investment?`,
            "acceptedAnswer": { "@type": "Answer", "text": `Yes. ${citizensCap} can apply for ${cbiCount} citizenship by investment (CBI) programs worldwide. These programs grant citizenship in exchange for qualifying investments including real estate, government donations, or bond purchases.` }
          }] : []),
        ],
      },
      {
        "@type": "Dataset",
        "name": `${country.name} Passport Visa-Free Access Data 2026`,
        "description": `Official-source visa-free access data for ${demonym} passport holders covering ${total} destinations`,
        "url": `https://earthvisa.in/passport/${slug}`,
        "creator": { "@type": "Organization", "name": "Earth Visa" },
        "temporalCoverage": "2026",
        "variableMeasured": "Visa-free destination count",
        "measurementTechnique": "Official government visa policy publications",
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
            {/* Breadcrumb */}
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/passport" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Passports</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">{country.name}</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6 flex items-start gap-5">
              <span className="text-6xl leading-none">{flag}</span>
              <div>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                  {country.name} Passport
                  <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                    Visa-Free Countries &amp; Travel Power 2026
                  </span>
                </h1>
                {rank && (
                  <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                    Ranked #{rank} of 199 passports worldwide ·{" "}
                    <Link href="/rankings" className="underline decoration-line underline-offset-4 transition hover:text-ink">
                      Full 2026 passport index
                    </Link>
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Visa-free", v: vfCount },
                { k: "Visa on arrival", v: voaCount },
                { k: "eTA / e-Visa", v: etaCount },
                { k: "Total reach", v: total },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <PassportDestinationSearch
              natSlug={slug}
              citizens={citizens}
              options={searchOptions}
              corridorSlugs={corridorDestSlugs}
            />
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro paragraph - keyword-rich */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              The <strong className="text-ink">{demonym} passport</strong> provides visa-free or visa-on-arrival access to{" "}
              <strong className="text-ink">{total} countries</strong> as of 2026, making it{" "}
              {rank && rank <= 20 ? "one of the most powerful passports in the world" : rank && rank <= 50 ? "a strong mid-tier passport" : rank && rank <= 100 ? "a passport with moderate global reach" : "a passport with growing international access"}.
              {" "}{demonym} passport holders can enter <strong className="text-ink">{vfCount} destinations completely visa-free</strong>,{" "}
              {voaCount > 0 && <>{voaCount} countries offer <strong className="text-ink">visa on arrival</strong>, and </>}
              {etaCount > 0 && <>{etaCount} destinations are accessible via <strong className="text-ink">electronic travel authorisation (eTA or e-Visa)</strong>.</>}
              {fomCount > 0 && <> Additionally, {demonym} passport holders benefit from <strong className="text-ink">freedom of movement rights</strong> across {fomCount} countries through regional bloc membership.</>}
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              All data is sourced directly from official government publications - foreign ministry visa policy pages, border authority portals, and published bilateral agreements.
              {cbiCount > 0 && <> {citizensCap} can also explore <strong className="text-ink">{cbiCount} citizenship by investment programs</strong> and <strong className="text-ink">golden visa / residency by investment programs in {rbiCountries} countries</strong> to obtain a second passport or residence permit.</>}
            </p>
          </section>

          {/* Visa-free destinations */}
          {vfEdges.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Visa-Free Destinations for {demonym} Passport Holders ({vfCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Enter with just your {demonym} passport - no visa application, no fee, no advance paperwork required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {vfEdges.slice(0, 30).map((e) => (
                  <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} fom={fomSet.has(e.dest)} />
                ))}
              </div>
              {vfEdges.length > 30 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {vfEdges.length} visa-free destinations</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {vfEdges.slice(30).map((e) => (
                      <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} fom={fomSet.has(e.dest)} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Visa on arrival */}
          {voaEdges.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Visa on Arrival Countries for {demonym} Passport Holders ({voaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Receive your visa stamp at the airport on arrival - no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {voaEdges.slice(0, 18).map((e) => (
                  <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} />
                ))}
              </div>
              {voaEdges.length > 18 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {voaEdges.length} visa-on-arrival countries</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {voaEdges.slice(18).map((e) => (
                      <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* eTA / e-Visa destinations */}
          {etaEdges.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                eTA &amp; e-Visa Destinations for {demonym} Passport Holders ({etaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Apply online before you travel - an electronic travel authorisation (eTA) or e-Visa is granted digitally, with no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {etaEdges.slice(0, 30).map((e) => (
                  <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} />
                ))}
              </div>
              {etaEdges.length > 30 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {etaEdges.length} eTA / e-Visa destinations</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {etaEdges.slice(30).map((e) => (
                      <DestCard key={e.dest} natName={country.name} natIso3={country.iso3} edge={e} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Freedom of movement */}
          {fomCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Freedom of Movement Countries ({fomCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                {citizensCap} have the right to live and work in these countries through regional bloc membership - no visa required.
              </p>
              <div className="mt-5 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {fomEdges.map((e) => {
                  const destSlug = nameToSlug(nameFor(e.dest));
                  const href = isUsefulCorridor(country.iso3, e.dest)
                    ? `/passport/${slug}/${destSlug}`
                    : `/destination/${destSlug}`;
                  return (
                    <Link key={e.dest} href={href} className="group flex min-h-[40px] items-center gap-2.5 text-[15px] text-ink-soft transition hover:text-stamp">
                      <span className="text-lg">{flagFor(e.dest)}</span>
                      <span className="font-display underline decoration-line underline-offset-4 transition group-hover:decoration-stamp">{nameFor(e.dest)}</span>
                      <span aria-hidden className="mono text-ink-mute transition group-hover:text-stamp">→</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* CBI programs */}
          {cbiCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Citizenship by Investment Programs Available to {citizensTitle} ({cbiCount})
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {demonym} passport holders can apply for citizenship by investment in {cbiCount} countries - gaining a second passport that can significantly increase global travel access and add rights to live, work, and do business abroad.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.cbi.slice(0, 6).map((p) => (
                  <CbiCard key={p.iso3} p={p} />
                ))}
              </div>
              {result.cbi.length > 6 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {result.cbi.length} citizenship by investment programs</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {result.cbi.slice(6).map((p) => (
                      <CbiCard key={p.iso3} p={p} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Corridor guides (internal link mesh to detailed per-destination pages) */}
          <CorridorLinks
            title={`${country.name} Visa Requirements by Destination`}
            description={`Step-by-step visa guides, fees and document checklists for ${demonym} passport holders visiting popular destinations.`}
            links={corridorLinks}
          />

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {country.name} Passport FAQ
            </h2>
            <div className="mt-5 divide-y divide-line">
              {[
                {
                  q: `How many countries can ${demonym} passport holders visit without a visa in 2026?`,
                  a: `${demonym} passport holders can visit ${vfCount} countries completely visa-free in 2026. An additional ${voaCount} countries offer visa on arrival and ${etaCount} destinations are accessible with an eTA or e-Visa - bringing the total to ${total} destinations accessible without a pre-arranged embassy visa.`,
                },
                {
                  q: `What is the ${demonym} passport ranking in 2026?`,
                  a: rank ? `The ${demonym} passport ranks #${rank} out of 199 passports globally in 2026, based on the number of accessible destinations (${total} countries).` : `The ${demonym} passport provides access to ${total} countries in 2026.`,
                },
                {
                  q: `Do ${demonym} passport holders need a visa to travel to Europe?`,
                  a: vfEdges.some(e => ["DEU","FRA","ESP","ITA","GRC","PRT"].includes(e.dest))
                    ? `${demonym} passport holders can travel to many EU/Schengen countries visa-free. Check the full list above for specific destinations and maximum stay durations.`
                    : `${demonym} passport holders typically require a Schengen visa to enter EU countries. However, holding a valid US visa, UK visa, or Schengen visa may unlock additional travel options. Use Earth Visa to explore your full options.`,
                },
                ...(cbiCount > 0 ? [{
                  q: `Can ${citizens} get a second citizenship through investment?`,
                  a: `Yes. ${citizensCap} can apply for ${cbiCount} citizenship by investment (CBI) programs including those in the Caribbean (St Kitts, Dominica, Grenada), Malta, Turkey, and others. These programs grant a second passport in exchange for a qualifying investment, typically starting from $100,000–$200,000.`,
                }] : []),
                {
                  q: `Which countries can ${demonym} passport holders visit on arrival?`,
                  a: voaCount > 0 ? `${voaCount} countries offer visa on arrival to ${demonym} passport holders. These include: ${voaEdges.slice(0, 5).map(e => nameFor(e.dest)).join(", ")}${voaCount > 5 ? `, and ${voaCount - 5} more` : ""}.` : `${demonym} passport holders have limited visa on arrival access. Consider using the full Earth Visa tool to explore credential-based access unlocked by holding a US visa, Schengen visa, or other documents.`,
                },
              ].map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                    {q}
                    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <p className="mt-1 mb-3 max-w-3xl text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
