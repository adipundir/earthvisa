import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
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

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

function buildReverseIndex(destIso3: string) {
  const accessByLevel: Record<AccessLevel, { iso3: string; maxStayDays: number | null }[]> = {
    visa_free: [],
    visa_on_arrival: [],
    eta: [],
    e_visa: [],
  };
  for (const [passportIso3, edges] of Object.entries(dataset.passportAccess)) {
    const edge = edges.find((e) => e.dest === destIso3);
    if (edge) {
      accessByLevel[edge.level].push({ iso3: passportIso3, maxStayDays: edge.maxStayDays });
    }
  }
  return accessByLevel;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const country = slugToCountry(slug);
  if (!country) return { title: "Not Found" };

  const accessByLevel = buildReverseIndex(country.iso3);
  const vfCount = accessByLevel.visa_free.length;
  const voaCount = accessByLevel.visa_on_arrival.length;
  const etaCount = accessByLevel.eta.length + accessByLevel.e_visa.length;
  const flag = flagFor(country.iso3);

  const title = `Do I Need a Visa for ${country.name}? Entry Requirements 2026`;
  const description = `${country.name} visa requirements 2026: ${vfCount} nationalities enter visa-free, ${voaCount} get visa on arrival. Check if your passport needs a visa, tourist visa rules, and entry conditions from official sources.`;

  return {
    title,
    description,
    keywords: [
      `do I need a visa for ${country.name.toLowerCase()}`,
      `${country.name.toLowerCase()} visa requirements`,
      `${country.name.toLowerCase()} visa requirements 2026`,
      `${country.name.toLowerCase()} entry requirements`,
      `${country.name.toLowerCase()} tourist visa`,
      `${country.name.toLowerCase()} visa on arrival`,
      `${country.name.toLowerCase()} visa free countries`,
      `countries that can visit ${country.name.toLowerCase()} without visa`,
      `how many countries can visit ${country.name.toLowerCase()} without visa`,
      `${country.name.toLowerCase()} visa policy 2026`,
      `${country.name.toLowerCase()} entry requirements 2026`,
    ],
    openGraph: {
      title,
      description,
      url: `https://passportpower.co/destination/${slug}`,
      type: "article",
    },
    alternates: { canonical: `https://passportpower.co/destination/${slug}` },
  };
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = slugToCountry(slug);
  if (!country) notFound();

  const flag = flagFor(country.iso3);
  const destIso3 = country.iso3;

  const accessByLevel = buildReverseIndex(destIso3);
  const vfCount = accessByLevel.visa_free.length;
  const voaCount = accessByLevel.visa_on_arrival.length;
  const etaCount = accessByLevel.eta.length + accessByLevel.e_visa.length;
  const totalWithAccess = vfCount + voaCount + etaCount;

  const openness =
    vfCount >= 100
      ? "very open"
      : vfCount >= 60
      ? "moderately open"
      : vfCount >= 30
      ? "selectively open"
      : "restrictive";

  // Combine eta + e_visa for display
  const etaAndEvisa = [...accessByLevel.eta, ...accessByLevel.e_visa];

  // Top examples for FAQ answers
  const topVfNames = accessByLevel.visa_free
    .slice(0, 5)
    .map((e) => nameFor(e.iso3))
    .join(", ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Passport Power", item: "https://passportpower.co" },
          { "@type": "ListItem", position: 2, name: "Destinations", item: "https://passportpower.co/destination" },
          {
            "@type": "ListItem",
            position: 3,
            name: `${country.name} Visa Requirements`,
            item: `https://passportpower.co/destination/${slug}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Do I need a visa to visit ${country.name}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `It depends on your nationality. Citizens of ${vfCount} countries can visit ${country.name} without a visa in 2026. An additional ${voaCount} nationalities can obtain a visa on arrival. If your country is not among these, you will likely need to apply for a tourist visa in advance at a ${country.name} embassy or consulate.`,
            },
          },
          {
            "@type": "Question",
            name: `Which countries can visit ${country.name} without a visa?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${vfCount} countries can visit ${country.name} without a visa in 2026${topVfNames ? `, including: ${topVfNames}` : ""}. Use Passport Power to check whether your specific passport grants visa-free access to ${country.name}.`,
            },
          },
          {
            "@type": "Question",
            name: `How many countries can visit ${country.name} without a visa?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${vfCount} nationalities can visit ${country.name} completely visa-free in 2026. Additionally, ${voaCount} countries can obtain a visa on arrival${etaCount > 0 ? `, and ${etaCount} can enter via eTA or e-Visa` : ""} — bringing the total to ${totalWithAccess} nationalities with streamlined entry to ${country.name}.`,
            },
          },
          {
            "@type": "Question",
            name: `How do I apply for a ${country.name} tourist visa?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `If your nationality is not eligible for visa-free entry or visa on arrival to ${country.name}, you typically need to apply at a ${country.name} embassy or consulate in your home country. Requirements generally include a valid passport, completed application form, passport-sized photos, proof of accommodation and onward travel, travel insurance, and proof of sufficient funds. Processing times and fees vary — check the official ${country.name} immigration authority website for current requirements.`,
            },
          },
          {
            "@type": "Question",
            name: `How long can I stay in ${country.name} without a visa?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `The maximum visa-free stay duration in ${country.name} varies by nationality. Common allowances are 30, 60, or 90 days. See the visa-free country list above for specific stay durations per nationality. Always verify with the official ${country.name} border authority before traveling.`,
            },
          },
        ],
      },
      {
        "@type": "Dataset",
        name: `${country.name} Visa Requirements by Nationality 2026`,
        description: `Official-source visa policy data for ${country.name} showing which nationalities can visit visa-free, on arrival, or require a visa`,
        url: `https://passportpower.co/destination/${slug}`,
        creator: { "@type": "Organization", name: "Passport Power" },
        temporalCoverage: "2026",
        variableMeasured: "Visa-free nationalities admitted",
        measurementTechnique: "Official government visa policy publications",
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
            <nav className="mono mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              <a href="/" className="hover:text-ink transition">Passport Power</a>
              <span>/</span>
              <a href="/destination" className="hover:text-ink transition">Destinations</a>
              <span>/</span>
              <span className="text-ink">{country.name}</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6 flex items-start gap-5">
              <span className="text-6xl leading-none">{flag}</span>
              <div>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                  {country.name} Visa Requirements 2026
                  <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                    Entry Rules &amp; Visa-Free Access by Passport
                  </span>
                </h1>
                <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
                  {vfCount} nationalities admitted visa-free · {openness} visa policy
                </p>
              </div>
            </div>

            {/* Stats */}
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Visa-free nationalities", v: vfCount },
                { k: "Visa on arrival", v: voaCount },
                { k: "eTA / e-Visa", v: etaCount },
                { k: "Total streamlined", v: totalWithAccess },
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

          {/* Intro paragraph — keyword-rich */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              Citizens of <strong className="text-ink">{vfCount} countries</strong> can visit{" "}
              <strong className="text-ink">{country.name}</strong> without a visa in 2026.{" "}
              {voaCount > 0 && (
                <>
                  <strong className="text-ink">{voaCount} nationalities</strong> can obtain a visa on arrival.{" "}
                </>
              )}
              {etaCount > 0 && (
                <>
                  An additional <strong className="text-ink">{etaCount} countries</strong> are eligible for an eTA or e-Visa.{" "}
                </>
              )}
              {country.name}&apos;s visa policy is{" "}
              <strong className="text-ink">{openness}</strong> relative to other destinations worldwide.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              If your nationality is not listed as visa-free or visa on arrival, you will need to apply for a{" "}
              <strong className="text-ink">{country.name} tourist visa</strong> in advance at an embassy or consulate.
              All data is sourced from official government publications and border authority portals.
            </p>
          </section>

          {/* Visa-free nationalities */}
          {vfCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Countries Whose Citizens Can Visit {country.name} Visa-Free ({vfCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Passport holders from these countries can enter {country.name} without a visa — no embassy appointment, no advance fee.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {accessByLevel.visa_free.slice(0, 30).map((e) => (
                  <div key={e.iso3} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.iso3)}</span>
                    <div className="min-w-0">
                      <a
                        href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                        className="font-display text-sm font-medium text-ink hover:text-stamp transition"
                      >
                        {nameFor(e.iso3)}
                      </a>
                      {e.maxStayDays != null && (
                        <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>
                      )}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_free}`}>
                      Visa-free
                    </span>
                  </div>
                ))}
              </div>
              {vfCount > 30 && (
                <p className="mono mt-3 text-[11px] text-ink-mute">
                  + {vfCount - 30} more nationalities admitted visa-free.{" "}
                  <a href={`/?dest=${destIso3}`} className="text-stamp hover:underline">
                    View all on Passport Power →
                  </a>
                </p>
              )}
            </section>
          )}

          {/* Visa on arrival */}
          {voaCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Nationalities That Get Visa on Arrival to {country.name} ({voaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Citizens of these countries can obtain a visa stamp at the {country.name} border on arrival — no advance embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {accessByLevel.visa_on_arrival.slice(0, 20).map((e) => (
                  <div key={e.iso3} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.iso3)}</span>
                    <div className="min-w-0">
                      <a
                        href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                        className="font-display text-sm font-medium text-ink hover:text-stamp transition"
                      >
                        {nameFor(e.iso3)}
                      </a>
                      {e.maxStayDays != null && (
                        <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>
                      )}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.visa_on_arrival}`}>
                      On arrival
                    </span>
                  </div>
                ))}
              </div>
              {voaCount > 20 && (
                <p className="mono mt-3 text-[11px] text-ink-mute">
                  + {voaCount - 20} more.{" "}
                  <a href={`/?dest=${destIso3}`} className="text-stamp hover:underline">
                    View all on Passport Power →
                  </a>
                </p>
              )}
            </section>
          )}

          {/* eTA / e-Visa */}
          {etaCount > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                eTA &amp; e-Visa Eligible Countries for {country.name} ({etaCount})
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                These nationalities can apply for an electronic travel authorisation or e-Visa online before travel — no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {etaAndEvisa.slice(0, 15).map((e) => (
                  <div key={e.iso3} className="flex items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5">
                    <span className="text-xl">{flagFor(e.iso3)}</span>
                    <div className="min-w-0">
                      <a
                        href={`/passport/${nameToSlug(nameFor(e.iso3))}`}
                        className="font-display text-sm font-medium text-ink hover:text-stamp transition"
                      >
                        {nameFor(e.iso3)}
                      </a>
                      {e.maxStayDays != null && (
                        <div className="mono text-[10px] text-ink-mute">≤ {e.maxStayDays} days</div>
                      )}
                    </div>
                    <span className={`mono ml-auto rounded-[3px] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ring-1 ${LEVEL_COLORS.eta}`}>
                      eTA
                    </span>
                  </div>
                ))}
              </div>
              {etaCount > 15 && (
                <p className="mono mt-3 text-[11px] text-ink-mute">+ {etaCount - 15} more.</p>
              )}
            </section>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {country.name} Visa Requirements FAQ
            </h2>
            <div className="mt-5 divide-y divide-line">
              {[
                {
                  q: `Do I need a visa to visit ${country.name}?`,
                  a: `It depends on your nationality. Citizens of ${vfCount} countries can visit ${country.name} without a visa in 2026. An additional ${voaCount} nationalities can obtain a visa on arrival. If your country is not among these, you will likely need to apply for a ${country.name} tourist visa in advance at an embassy or consulate.`,
                },
                {
                  q: `Which countries can visit ${country.name} without a visa?`,
                  a: `${vfCount} countries can visit ${country.name} without a visa in 2026${topVfNames ? `, including: ${topVfNames}` : ""}. Use Passport Power to check whether your specific passport grants visa-free access to ${country.name}.`,
                },
                {
                  q: `How many countries can visit ${country.name} without a visa?`,
                  a: `${vfCount} nationalities can visit ${country.name} completely visa-free in 2026. Additionally, ${voaCount} countries can obtain a visa on arrival${etaCount > 0 ? `, and ${etaCount} can enter via eTA or e-Visa` : ""} — bringing the total to ${totalWithAccess} nationalities with streamlined entry to ${country.name}.`,
                },
                {
                  q: `How do I apply for a ${country.name} tourist visa?`,
                  a: `If your nationality is not eligible for visa-free entry or visa on arrival to ${country.name}, you typically need to apply at a ${country.name} embassy or consulate in your home country. Requirements generally include a valid passport, completed application form, passport-sized photos, proof of accommodation and onward travel, travel insurance, and proof of sufficient funds. Processing times and fees vary — check the official ${country.name} immigration authority website for current requirements.`,
                },
                {
                  q: `How long can I stay in ${country.name} without a visa?`,
                  a: `The maximum visa-free stay duration in ${country.name} varies by nationality. Common allowances are 30, 60, or 90 days. See the visa-free country list above for specific stay durations per nationality. Always verify with the official ${country.name} border authority before traveling.`,
                },
              ].map(({ q, a }) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-[15px] font-medium text-ink">
                    {q}
                    <span className="mono shrink-0 text-ink-mute">▾</span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check your specific visa requirements for {country.name}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to instantly see whether you need a visa for {country.name}, how long you can stay, and what documents you need.
            </p>
            <a
              href={`/?dest=${destIso3}`}
              className="mono mt-5 inline-flex items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-paper-2"
            >
              Check visa requirements on Passport Power →
            </a>
          </section>

        </div>
      </main>
    </>
  );
}
