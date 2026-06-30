import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { compute } from "@/lib/compute";
import type { AccessLevel } from "@/lib/types";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugToCountry(slug: string) {
  return dataset.allCountries.find((c) => nameToSlug(c.name) === slug) ?? null;
}

export async function generateStaticParams() {
  return dataset.allCountries.map((c) => ({ slug: nameToSlug(c.name) }));
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

  const title = `${country.name} Passport Ranking 2026 - ${vfCount} Visa-Free Countries`;
  const description = `Visa-free countries for the ${country.name} passport 2026: ${vfCount} destinations without a visa, ${voaCount} visa on arrival, and ${etaCount} e-visa. See the full list from official government sources.`;

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

export default async function PassportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = slugToCountry(slug);
  if (!country) notFound();

  const result = compute([country.iso3], [], {});
  const flag = flagFor(country.iso3);
  const vfCount = result.reachByLevel.visa_free.length;
  const voaCount = result.reachByLevel.visa_on_arrival.length;
  // eTA + e-Visa share one stat tile and one section (sorted by destination name)
  const etaEdges = [...result.reachByLevel.eta, ...result.reachByLevel.e_visa].sort(
    (a, b) => nameFor(a.dest).localeCompare(nameFor(b.dest)),
  );
  const etaCount = etaEdges.length;
  const total = result.reach.length;
  const fomCount = result.freedomOfMovement.length;
  const cbiCount = result.cbi.length;
  const rbiCount = result.rbi.length;

  // Rank: count how many passports have >= reach
  const allReachCounts = Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => ({ iso3, count: edges.length }))
    .sort((a, b) => b.count - a.count);
  const rankIdx = allReachCounts.findIndex((r) => r.iso3 === country.iso3);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

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
            "name": `How many countries can ${country.name} passport holders visit without a visa in 2026?`,
            "acceptedAnswer": { "@type": "Answer", "text": `${country.name} passport holders can visit ${vfCount} countries completely visa-free in 2026. Additionally, ${voaCount} countries offer visa on arrival and ${etaCount} countries offer eTA or e-Visa - bringing the total to ${total} destinations accessible without a pre-arranged embassy visa.` }
          },
          {
            "@type": "Question",
            "name": `What is the ${country.name} passport ranking in 2026?`,
            "acceptedAnswer": { "@type": "Answer", "text": rank ? `The ${country.name} passport ranks approximately ${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} out of 199 passports in 2026, based on the number of visa-free destinations (${total} total accessible countries).` : `The ${country.name} passport provides access to ${total} destinations in 2026.` }
          },
          {
            "@type": "Question",
            "name": `Which countries offer visa on arrival to ${country.name} passport holders?`,
            "acceptedAnswer": { "@type": "Answer", "text": `${voaCount} countries offer visa on arrival to ${country.name} passport holders. Top destinations include: ${result.reachByLevel.visa_on_arrival.slice(0, 5).map(e => nameFor(e.dest)).join(", ")}${voaCount > 5 ? `, and ${voaCount - 5} more` : ""}.` }
          },
          ...(cbiCount > 0 ? [{
            "@type": "Question",
            "name": `Can ${country.name} citizens obtain a second citizenship through investment?`,
            "acceptedAnswer": { "@type": "Answer", "text": `Yes. ${country.name} citizens can apply for ${cbiCount} citizenship by investment (CBI) programs worldwide. These programs grant citizenship in exchange for qualifying investments including real estate, government donations, or bond purchases.` }
          }] : []),
        ],
      },
      {
        "@type": "Dataset",
        "name": `${country.name} Passport Visa-Free Access Data 2026`,
        "description": `Official-source visa-free access data for ${country.name} passport holders covering ${total} destinations`,
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
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
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
                  <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
                    Ranked #{rank} of 199 passports worldwide
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
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro paragraph - keyword-rich */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              The <strong className="text-ink">{country.name} passport</strong> provides visa-free or visa-on-arrival access to{" "}
              <strong className="text-ink">{total} countries</strong> as of 2026, making it{" "}
              {rank && rank <= 20 ? "one of the most powerful passports in the world" : rank && rank <= 50 ? "a strong mid-tier passport" : rank && rank <= 100 ? "a passport with moderate global reach" : "a passport with growing international access"}.
              {" "}{country.name} passport holders can enter <strong className="text-ink">{vfCount} destinations completely visa-free</strong>,{" "}
              {voaCount > 0 && <>{voaCount} countries offer <strong className="text-ink">visa on arrival</strong>, and </>}
              {etaCount > 0 && <>{etaCount} destinations are accessible via <strong className="text-ink">electronic travel authorisation (eTA or e-Visa)</strong>.</>}
              {fomCount > 0 && <> Additionally, {country.name} passport holders benefit from <strong className="text-ink">freedom of movement rights</strong> across {fomCount} countries through regional bloc membership.</>}
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              All data is sourced directly from official government publications - foreign ministry visa policy pages, border authority portals, and published bilateral agreements.
              {cbiCount > 0 && <> {country.name} citizens can also explore <strong className="text-ink">{cbiCount} citizenship by investment programs</strong> and <strong className="text-ink">{rbiCount} golden visa / residency by investment programs</strong> to obtain a second passport or residence permit.</>}
            </p>
          </section>

          {/* Visa-free destinations */}
          {result.reachByLevel.visa_free.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Visa-Free Destinations for {country.name} Passport Holders ({vfCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Enter with just your {country.name} passport - no visa application, no fee, no advance paperwork required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {result.reachByLevel.visa_free.slice(0, 30).map((e) => (
                  <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.dest)}</span>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                      {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_free}`}>Visa-free</span>
                  </div>
                ))}
              </div>
              {result.reachByLevel.visa_free.length > 30 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {result.reachByLevel.visa_free.length} visa-free destinations</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {result.reachByLevel.visa_free.slice(30).map((e) => (
                      <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                        <span className="text-xl">{flagFor(e.dest)}</span>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                          {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                        </div>
                        <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_free}`}>Visa-free</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Visa on arrival */}
          {result.reachByLevel.visa_on_arrival.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Visa on Arrival Countries for {country.name} Passport ({voaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Receive your visa stamp at the airport on arrival - no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {result.reachByLevel.visa_on_arrival.slice(0, 18).map((e) => (
                  <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.dest)}</span>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                      {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_on_arrival}`}>On arrival</span>
                  </div>
                ))}
              </div>
              {result.reachByLevel.visa_on_arrival.length > 18 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {result.reachByLevel.visa_on_arrival.length} visa-on-arrival countries</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {result.reachByLevel.visa_on_arrival.slice(18).map((e) => (
                      <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                        <span className="text-xl">{flagFor(e.dest)}</span>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                          {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                        </div>
                        <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_on_arrival}`}>On arrival</span>
                      </div>
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
                eTA &amp; e-Visa Destinations for {country.name} Passport Holders ({etaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Apply online before you travel - an electronic travel authorisation (eTA) or e-Visa is granted digitally, with no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {etaEdges.slice(0, 30).map((e) => (
                  <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.dest)}</span>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                      {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[e.level]}`}>
                      {e.level === "eta" ? "eTA" : "e-Visa"}
                    </span>
                  </div>
                ))}
              </div>
              {etaEdges.length > 30 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {etaEdges.length} eTA / e-Visa destinations</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {etaEdges.slice(30).map((e) => (
                      <div key={e.dest} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                        <span className="text-xl">{flagFor(e.dest)}</span>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-medium text-ink">{nameFor(e.dest)}</div>
                          {e.maxStayDays != null && <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>}
                        </div>
                        <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS[e.level]}`}>
                          {e.level === "eta" ? "eTA" : "e-Visa"}
                        </span>
                      </div>
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
                As a {country.name} citizen you have the right to live and work in these countries through regional bloc membership - no visa required.
              </p>
            </section>
          )}

          {/* CBI programs */}
          {cbiCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Citizenship by Investment Programs Available to {country.name} Citizens ({cbiCount})
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                As a {country.name} passport holder you can apply for citizenship by investment in {cbiCount} countries - gaining a second passport that may significantly increase your global travel access and provide additional rights to live, work, and do business abroad.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.cbi.slice(0, 6).map((p) => (
                  <div key={p.iso3} className="rounded-sm border border-line bg-paper-2/70 p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{flagFor(p.iso3)}</span>
                      <div>
                        <div className="font-display font-semibold text-ink">{p.name}</div>
                        <div className="text-sm italic text-ink-soft">{p.program_name}</div>
                      </div>
                    </div>
                    {p.options[0] && (
                      <p className="mono mt-3 text-[11px] text-ink-mute">
                        From {p.options[0].currency} {p.options[0].min_amount?.toLocaleString() ?? "-"} · {p.processing_time || "varies"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {result.cbi.length > 6 && (
                <details className="group mt-3">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
                    <span className="group-open:hidden">Show all {result.cbi.length} citizenship by investment programs</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {result.cbi.slice(6).map((p) => (
                      <div key={p.iso3} className="rounded-sm border border-line bg-paper-2/70 p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{flagFor(p.iso3)}</span>
                          <div>
                            <div className="font-display font-semibold text-ink">{p.name}</div>
                            <div className="text-sm italic text-ink-soft">{p.program_name}</div>
                          </div>
                        </div>
                        {p.options[0] && (
                          <p className="mono mt-3 text-[11px] text-ink-mute">
                            From {p.options[0].currency} {p.options[0].min_amount?.toLocaleString() ?? "-"} · {p.processing_time || "varies"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {country.name} Passport FAQ
            </h2>
            <div className="mt-5 divide-y divide-line">
              {[
                {
                  q: `How many countries can ${country.name} passport holders visit without a visa in 2026?`,
                  a: `${country.name} passport holders can visit ${vfCount} countries completely visa-free in 2026. An additional ${voaCount} countries offer visa on arrival and ${etaCount} destinations are accessible with an eTA or e-Visa - bringing the total to ${total} destinations accessible without a pre-arranged embassy visa.`,
                },
                {
                  q: `What is the ${country.name} passport ranking in 2026?`,
                  a: rank ? `The ${country.name} passport ranks #${rank} out of 199 passports globally in 2026, based on the number of accessible destinations (${total} countries).` : `The ${country.name} passport provides access to ${total} countries in 2026.`,
                },
                {
                  q: `Do ${country.name} passport holders need a visa to travel to Europe?`,
                  a: result.reachByLevel.visa_free.some(e => ["DEU","FRA","ESP","ITA","GRC","PRT"].includes(e.dest))
                    ? `${country.name} passport holders can travel to many EU/Schengen countries visa-free. Check the full list above for specific destinations and maximum stay durations.`
                    : `${country.name} passport holders typically require a Schengen visa to enter EU countries. However, holding a valid US visa, UK visa, or Schengen visa may unlock additional travel options. Use Earth Visa to explore your full options.`,
                },
                ...(cbiCount > 0 ? [{
                  q: `Can ${country.name} citizens get a second citizenship through investment?`,
                  a: `Yes. ${country.name} citizens can apply for ${cbiCount} citizenship by investment (CBI) programs including those in the Caribbean (St Kitts, Dominica, Grenada), Malta, Turkey, and others. These programs grant a second passport in exchange for a qualifying investment, typically starting from $100,000–$200,000.`,
                }] : []),
                {
                  q: `Which countries can ${country.name} passport holders visit on arrival?`,
                  a: voaCount > 0 ? `${voaCount} countries offer visa on arrival to ${country.name} passport holders. Top destinations include: ${result.reachByLevel.visa_on_arrival.slice(0, 5).map(e => nameFor(e.dest)).join(", ")}${voaCount > 5 ? `, and ${voaCount - 5} more` : ""}.` : `${country.name} passport holders have limited visa on arrival access. Consider using the full Earth Visa tool to explore credential-based access unlocked by holding a US visa, Schengen visa, or other documents.`,
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
