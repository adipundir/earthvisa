import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { corridorsForDestination, DEMONYM } from "@/lib/corridors";
import { aliasBySlug, SHORT_NAME, type ColloquialAlias } from "@/lib/colloquial";
import { feesFor, fmtFee } from "@/lib/fees";
import CorridorLinks from "@/components/CorridorLinks";
import { buildReverseIndex } from "../reverse-index";
import type { AccessLevel } from "@/lib/types";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// "United Arab Emirates's" reads wrong; names ending in s take a bare apostrophe.
function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

// "1 nationality" / "67 nationalities" — counts never render a mismatched plural.
function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

// "a Japan visa" but "an Israel visa". U-names split by sound: "a United…" /
// "a Ukraine…" (yoo) vs "an Uganda…" / "an Uzbekistan…".
function withArticle(name: string): string {
  return /^([AEIO]|U[gz])/.test(name) ? `an ${name}` : `a ${name}`;
}

// "2026-07-02" → "2 Jul 2026", matching the site header's date style.
function fmtUpdated(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// A slug resolves to either a country or a colloquial alias (dubai → ARE).
// Alias pages carry the query token people actually search while rendering the
// official jurisdiction's rules, clearly labelled.
function resolveSlug(slug: string): { country: (typeof dataset.allCountries)[number]; alias: ColloquialAlias | null } | null {
  const alias = aliasBySlug.get(slug);
  if (alias) {
    const country = dataset.allCountries.find((c) => c.iso3 === alias.iso3);
    return country ? { country, alias } : null;
  }
  const country = dataset.allCountries.find((c) => nameToSlug(c.name) === slug) ?? null;
  return country ? { country, alias: null } : null;
}

export async function generateStaticParams() {
  return [
    ...dataset.allCountries.map((c) => ({ slug: nameToSlug(c.name) })),
    ...[...aliasBySlug.keys()].map((slug) => ({ slug })),
  ];
}

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

// How many entries to show before the in-place "Show all" disclosure.
const PREVIEW_VF = 30;
const PREVIEW_VOA = 20;
const PREVIEW_ETA = 15;

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

// A single nationality entry. The whole ≥44px row is one tappable next/link.
function NationalityRow({
  iso3,
  maxStayDays,
  levelClass,
  label,
}: {
  iso3: string;
  maxStayDays: number | null;
  levelClass: string;
  label: string;
}) {
  return (
    <Link
      href={`/passport/${nameToSlug(nameFor(iso3))}`}
      className="group/row flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
    >
      <span className="text-xl">{flagFor(iso3)}</span>
      <div className="min-w-0">
        <span className="font-display text-sm font-medium text-ink transition group-hover/row:text-stamp">
          {nameFor(iso3)}
        </span>
        {maxStayDays != null && (
          <div className="mono text-[11px] text-ink-mute">≤ {maxStayDays} days</div>
        )}
      </div>
      <span className={`mono ml-auto whitespace-nowrap rounded-[3px] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ring-1 ${levelClass}`}>
        {label}
      </span>
    </Link>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolveSlug(slug);
  if (!resolved) return { title: "Not Found" };
  const { country, alias } = resolved;

  const accessByLevel = buildReverseIndex(country.iso3);
  const vfCount = accessByLevel.visa_free.length;
  const voaCount = accessByLevel.visa_on_arrival.length;
  const etaCount = accessByLevel.eta.length + accessByLevel.e_visa.length;
  const flag = flagFor(country.iso3);

  // Zero-count clauses are omitted rather than rendered as "0 nationalities …".
  const accessBits: string[] = [];
  if (vfCount > 0) accessBits.push(`${plural(vfCount, "nationality enters", "nationalities enter")} visa-free`);
  if (voaCount > 0) {
    accessBits.push(
      vfCount > 0 ? `${voaCount} get visa on arrival` : `${plural(voaCount, "nationality gets", "nationalities get")} visa on arrival`,
    );
  }
  if (accessBits.length === 0) {
    accessBits.push(
      etaCount > 0
        ? `${plural(etaCount, "nationality is", "nationalities are")} eligible for an eTA or e-Visa`
        : "every nationality needs a visa arranged in advance",
    );
  }
  const accessSummary = accessBits.join(", ");

  // Alias pages target the colloquial query ("do i need a visa for dubai")
  // while making the governing jurisdiction explicit in the same title.
  const display = alias?.alias ?? country.name;
  const short = SHORT_NAME[country.iso3] ?? country.name;
  const title = alias
    ? `Do I Need a Visa for ${display}? ${short} Entry Requirements 2026`
    : `Do I Need a Visa for ${country.name}? Entry Requirements 2026`;
  const description = alias
    ? `${display} visa requirements 2026: ${display} follows ${possessive(country.name)} visa policy. ${accessSummary[0].toUpperCase()}${accessSummary.slice(1)}. Check if your passport needs a visa, from official sources.`
    : `${country.name} visa requirements 2026: ${accessSummary}. Check if your passport needs a visa, tourist visa rules, and entry conditions from official sources.`;

  return {
    title,
    description,
    keywords: [
      `do I need a visa for ${display.toLowerCase()}`,
      `${display.toLowerCase()} visa requirements`,
      `${display.toLowerCase()} visa requirements 2026`,
      `${display.toLowerCase()} entry requirements`,
      `${display.toLowerCase()} tourist visa`,
      `${display.toLowerCase()} visa on arrival`,
      `${country.name.toLowerCase()} visa free countries`,
      `countries that can visit ${country.name.toLowerCase()} without visa`,
      `how many countries can visit ${country.name.toLowerCase()} without visa`,
      `${country.name.toLowerCase()} visa policy 2026`,
      `${country.name.toLowerCase()} entry requirements 2026`,
    ],
    openGraph: {
      title,
      description,
      url: `https://earthvisa.in/destination/${slug}`,
      type: "article",
    },
    alternates: { canonical: `https://earthvisa.in/destination/${slug}` },
  };
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = resolveSlug(slug);
  if (!resolved) notFound();
  const { country, alias } = resolved;
  const display = alias?.alias ?? country.name;

  const flag = flagFor(country.iso3);
  const destIso3 = country.iso3;

  const accessByLevel = buildReverseIndex(destIso3);
  const vfCount = accessByLevel.visa_free.length;
  const voaCount = accessByLevel.visa_on_arrival.length;
  const etaCount = accessByLevel.eta.length + accessByLevel.e_visa.length;
  const totalWithAccess = vfCount + voaCount + etaCount;
  // Everyone else needs a visa in advance. This is a complement of the same
  // official per-destination data behind every other stat on this page (each
  // destination's own visa_free/VoA/eTA/e-Visa lists already fold in bloc and
  // freedom-of-movement grants), not a separate inferred figure.
  const visaRequiredCount = Math.max(0, dataset.allCountries.length - 1 - totalWithAccess);

  const openness =
    vfCount >= 100
      ? "very open"
      : vfCount >= 60
      ? "moderately open"
      : vfCount >= 30
      ? "selectively open"
      : "restrictive";

  // Combine eta + e_visa for display, keeping each entry's real level so an
  // e-Visa (a full online visa application) is never badged as the lighter
  // "eTA" travel authorisation.
  const etaAndEvisa = [
    ...accessByLevel.eta.map((e) => ({ ...e, lvl: "eta" as const })),
    ...accessByLevel.e_visa.map((e) => ({ ...e, lvl: "e_visa" as const })),
  ];

  // Top examples for FAQ answers
  const topVfNames = accessByLevel.visa_free
    .slice(0, 5)
    .map((e) => nameFor(e.iso3))
    .join(", ");

  // FAQ copy is data-aware: zero-count clauses are dropped instead of reading
  // "0 nationalities can obtain a visa on arrival". One array feeds both the
  // visible FAQ and the JSON-LD FAQPage so the two can never drift apart.
  const faq1Sentences = ["It depends on your nationality."];
  faq1Sentences.push(
    vfCount > 0
      ? `Citizens of ${plural(vfCount, "country", "countries")} can visit ${country.name} without a visa in 2026.`
      : `No nationality qualifies for fully visa-free entry to ${country.name} in 2026.`,
  );
  if (voaCount > 0) {
    faq1Sentences.push(`An additional ${plural(voaCount, "nationality", "nationalities")} can obtain a visa on arrival.`);
  }
  if (etaCount > 0) {
    faq1Sentences.push(`${plural(etaCount, "nationality", "nationalities")} can apply online for an eTA or e-Visa.`);
  }
  faq1Sentences.push(
    visaRequiredCount > 0
      ? `If your country is not among these, you will likely need to apply for ${withArticle(country.name)} tourist visa in advance at an embassy or consulate.`
      : totalWithAccess > 0
      ? "Every nationality we track qualifies for one of these streamlined routes."
      : `All visitors must arrange ${withArticle(country.name)} visa in advance through an embassy or consulate.`,
  );

  const streamlinedBits: string[] = [];
  if (voaCount > 0) {
    streamlinedBits.push(`${plural(voaCount, "country", "countries")} can obtain a visa on arrival`);
  }
  if (etaCount > 0) {
    streamlinedBits.push(`${voaCount > 0 ? etaCount : plural(etaCount, "country", "countries")} can enter via eTA or e-Visa`);
  }
  const faq3Sentences = [
    vfCount > 0
      ? `${plural(vfCount, "nationality", "nationalities")} can visit ${country.name} completely visa-free in 2026.`
      : `No nationality can visit ${country.name} completely visa-free in 2026.`,
  ];
  if (streamlinedBits.length > 0) {
    faq3Sentences.push(
      `${vfCount > 0 ? "Additionally" : "However"}, ${streamlinedBits.join(", and ")} - bringing the total to ${plural(totalWithAccess, "nationality", "nationalities")} with streamlined entry to ${country.name}.`,
    );
  }
  if (visaRequiredCount > 0) {
    faq3Sentences.push(
      `The remaining ${plural(visaRequiredCount, "nationality", "nationalities")} must apply for a visa in advance at an embassy, consulate, or official visa application centre before travelling.`,
    );
  }

  const faqs = [
    { q: `Do I need a visa to visit ${display}?`, a: faq1Sentences.join(" ") },
    {
      q: `Which countries can visit ${country.name} without a visa?`,
      a:
        vfCount > 0
          ? `${plural(vfCount, "country", "countries")} can visit ${country.name} without a visa in 2026${topVfNames ? `, including: ${topVfNames}` : ""}. Use Earth Visa to check whether your specific passport grants visa-free access to ${country.name}.`
          : `No country's citizens can visit ${country.name} entirely visa-free in 2026 - every nationality needs a visa or travel authorisation. Use Earth Visa to check what your specific passport needs to enter ${country.name}.`,
    },
    { q: `How many countries can visit ${country.name} without a visa?`, a: faq3Sentences.join(" ") },
    {
      q: `How do I apply for ${withArticle(country.name)} tourist visa?`,
      a:
        visaRequiredCount === 0 && etaCount > 0
          ? `If your nationality is not eligible for visa-free entry${voaCount > 0 ? " or visa on arrival" : ""} to ${country.name}, you can apply online for an eTA or e-Visa - no embassy visit required. You will generally need a valid passport, a completed online application, a digital photo, and proof of accommodation and onward travel. Processing times and fees vary by nationality and visa category - see the visa types and fees on this page for the exact figures.`
          : `If your nationality is not eligible for visa-free entry${voaCount > 0 ? " or visa on arrival" : ""} to ${country.name}, you typically need to apply at ${withArticle(country.name)} embassy or consulate in your home country. Requirements generally include a valid passport, completed application form, passport-sized photos, proof of accommodation and onward travel, travel insurance, and proof of sufficient funds. Processing times and fees vary by nationality and visa category - see the visa types and fees on this page for the exact figures.`,
    },
    {
      q: `How long can I stay in ${country.name} without a visa?`,
      a:
        vfCount > 0
          ? `The maximum visa-free stay duration in ${country.name} varies by nationality. Common allowances are 30, 60, or 90 days. See the visa-free country list above for specific stay durations per nationality.`
          : `${country.name} does not offer visa-free entry to any nationality in 2026, so your permitted stay is set by the visa or travel authorisation you obtain.`,
    },
  ];

  // Corridor guides where this country is the destination (internal link mesh).
  const corridorLinks = corridorsForDestination(destIso3).map((c) => ({
    href: `/passport/${c.natSlug}/${c.destSlug}`,
    label: `${DEMONYM[c.nat] ?? nameFor(c.nat)} citizens`,
    iso3: c.nat,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Destinations", item: "https://earthvisa.in/destination" },
          {
            "@type": "ListItem",
            position: 3,
            name: `${country.name} Visa Requirements`,
            item: `https://earthvisa.in/destination/${slug}`,
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
      {
        "@type": "Dataset",
        name: `${country.name} Visa Requirements by Nationality 2026`,
        description: `Official-source visa policy data for ${country.name} showing which nationalities can visit visa-free, on arrival, or require a visa`,
        url: `https://earthvisa.in/destination/${slug}`,
        creator: { "@type": "Organization", name: "Earth Visa" },
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
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span>/</span>
              <Link href="/destination" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Destinations</Link>
              <span>/</span>
              <span className="text-ink">{country.name}</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6 flex items-start gap-5">
              <span className="text-6xl leading-none">{flag}</span>
              <div>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                  {display} Visa Requirements 2026
                  <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                    {alias ? <>Entry Rules Under {country.name} Visa Policy</> : <>Entry Rules &amp; Visa-Free Access by Passport</>}
                  </span>
                </h1>
                <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-stamp">
                  {plural(vfCount, "nationality", "nationalities")} admitted visa-free · {openness} visa policy
                </p>
              </div>
            </div>
            {alias && (
              <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
                {alias.note}
              </p>
            )}

            {/* Stats */}
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-5">
              {[
                { k: "Visa-free nationalities", v: vfCount },
                { k: "Visa on arrival", v: voaCount },
                { k: "eTA / e-Visa", v: etaCount },
                { k: "Total streamlined", v: totalWithAccess },
                { k: "Visa required in advance", v: visaRequiredCount },
              ].map(({ k, v }, i, arr) => (
                // The odd fifth stat spans the full width on the 2-col mobile
                // grid instead of dangling beside an empty cell.
                <div key={k} className={i === arr.length - 1 ? "col-span-2 sm:col-span-1" : undefined}>
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
              {vfCount > 0 ? (
                <>
                  Citizens of <strong className="text-ink">{plural(vfCount, "country", "countries")}</strong> can visit{" "}
                  <strong className="text-ink">{country.name}</strong> without a visa in 2026.{" "}
                </>
              ) : (
                <>
                  No nationality qualifies for fully visa-free entry to{" "}
                  <strong className="text-ink">{country.name}</strong> in 2026.{" "}
                </>
              )}
              {voaCount > 0 && (
                <>
                  <strong className="text-ink">{plural(voaCount, "nationality", "nationalities")}</strong> can obtain a visa on arrival.{" "}
                </>
              )}
              {etaCount > 0 && (
                <>
                  An additional <strong className="text-ink">{plural(etaCount, "country", "countries")}</strong>{" "}
                  {etaCount === 1 ? "is" : "are"} eligible for an eTA or e-Visa.{" "}
                </>
              )}
              {possessive(country.name)} visa policy is{" "}
              <strong className="text-ink">{openness}</strong> relative to other destinations worldwide.{" "}
              {visaRequiredCount > 0 && (
                <>
                  Citizens of the remaining <strong className="text-ink">{plural(visaRequiredCount, "country", "countries")}</strong> need to apply for a visa in advance before visiting {country.name}.
                </>
              )}
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              {visaRequiredCount === 0 && totalWithAccess > 0 ? (
                etaCount > 0 ? (
                  <>
                    Every nationality not covered by visa-free{voaCount > 0 ? " or visa-on-arrival" : ""} entry can
                    apply online for an <strong className="text-ink">eTA or e-Visa</strong> - no embassy visit
                    required.{" "}
                  </>
                ) : (
                  <>
                    Every nationality we track can enter {country.name} without arranging a visa in advance.{" "}
                  </>
                )
              ) : etaCount > 0 ? (
                <>
                  If your nationality is not listed as visa-free, visa on arrival, or eTA/e-Visa eligible, you will
                  need to apply for <strong className="text-ink">{withArticle(`${country.name} tourist visa`)}</strong>{" "}
                  in advance at an embassy or consulate.{" "}
                </>
              ) : (
                <>
                  If your nationality is not listed as visa-free or visa on arrival, you will need to apply for{" "}
                  <strong className="text-ink">{withArticle(`${country.name} tourist visa`)}</strong> in advance at an
                  embassy or consulate.{" "}
                </>
              )}
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
                Passport holders from these countries can enter {country.name} without a visa - no embassy appointment, no advance fee.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {accessByLevel.visa_free.slice(0, PREVIEW_VF).map((e) => (
                  <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS.visa_free} label="Visa-free" />
                ))}
              </div>
              {vfCount > PREVIEW_VF && (
                <details className="group mt-2.5">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {vfCount}</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <Chevron />
                  </summary>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {accessByLevel.visa_free.slice(PREVIEW_VF).map((e) => (
                      <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS.visa_free} label="Visa-free" />
                    ))}
                  </div>
                </details>
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
                Citizens of these countries can obtain a visa stamp at the {country.name} border on arrival - no advance embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {accessByLevel.visa_on_arrival.slice(0, PREVIEW_VOA).map((e) => (
                  <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS.visa_on_arrival} label="On arrival" />
                ))}
              </div>
              {voaCount > PREVIEW_VOA && (
                <details className="group mt-2.5">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {voaCount}</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <Chevron />
                  </summary>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {accessByLevel.visa_on_arrival.slice(PREVIEW_VOA).map((e) => (
                      <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS.visa_on_arrival} label="On arrival" />
                    ))}
                  </div>
                </details>
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
                These nationalities can apply for an electronic travel authorisation or e-Visa online before travel - no embassy visit required.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {etaAndEvisa.slice(0, PREVIEW_ETA).map((e) => (
                  <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS[e.lvl]} label={e.lvl === "eta" ? "eTA" : "e-Visa"} />
                ))}
              </div>
              {etaCount > PREVIEW_ETA && (
                <details className="group mt-2.5">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {etaCount}</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <Chevron />
                  </summary>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {etaAndEvisa.slice(PREVIEW_ETA).map((e) => (
                      <NationalityRow key={e.iso3} iso3={e.iso3} maxStayDays={e.maxStayDays} levelClass={LEVEL_COLORS[e.lvl]} label={e.lvl === "eta" ? "eTA" : "e-Visa"} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Official visa fees */}
          {(() => {
            const df = feesFor(destIso3);
            const paid = df?.fees.filter((f) => f.amount != null) ?? [];
            if (!df || paid.length === 0) return null;
            return (
              <section className="mt-12">
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {display} Visa Fees ({df.updated ? `updated ${fmtUpdated(df.updated)}` : "2026"})
                </h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Official visa costs for {display}, sourced directly from government fee schedules and kept current.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {paid.slice(0, 6).map((f, i) => (
                    <div key={i} className="rounded-lg border border-line-strong bg-paper-2 px-4 py-3">
                      <p className="font-display text-[14px] font-semibold text-ink">{f.name}</p>
                      <p className="mono mt-1 text-lg font-semibold tabular-nums text-ink">{fmtFee(f)}</p>
                      <div className="mono mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
                        {f.validity && <span>{f.validity}</span>}
                        {f.official && <span className="text-vfree">official source</span>}
                      </div>
                      {f.source_url && (
                        <a href={f.source_url} target="_blank" rel="noreferrer" className="mono mt-2 inline-block text-[10px] text-ink-mute underline-offset-2 transition hover:text-ink hover:underline">
                          {(() => { try { return new URL(f.source_url).hostname.replace(/^www\./, ""); } catch { return "source"; } })()} ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {df.vfs.used && (
                  <p className="mono mt-3 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
                    {/* No amount here: crawled service fees are per-country (often
                        India-centre figures) and this page is nationality-agnostic.
                        Exact amounts belong on corridor pages. */}
                    Applications are handled via {df.vfs.operator} - a service fee applies on top of the visa fee and
                    varies by country and centre.
                  </p>
                )}
              </section>
            );
          })()}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {country.name} Visa Requirements FAQ
            </h2>
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

          {/* Corridor guides (internal link mesh to detailed per-nationality pages) */}
          <CorridorLinks
            title={`${country.name} Visa Guides by Nationality`}
            description={`Step-by-step ${country.name} visa requirements, fees and document checklists for travellers from these countries.`}
            links={corridorLinks}
          />

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check your specific visa requirements for {country.name}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Enter your passport to instantly see whether you need a visa for {country.name}, how long you can stay, and what documents you need.
            </p>
            <Link
              href={`/visit?dest=${destIso3}`}
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
