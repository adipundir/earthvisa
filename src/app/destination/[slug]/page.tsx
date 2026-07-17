import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { corridorsForDestination, DEMONYM } from "@/lib/corridors";
import { aliasBySlug, SHORT_NAME, type ColloquialAlias } from "@/lib/colloquial";
import { feesFor, fmtFee } from "@/lib/fees";
import { buildReverseIndex } from "../reverse-index";
import type { AccessLevel } from "@/lib/types";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// "United Arab Emirates's" reads wrong; names ending in s take a bare apostrophe.
function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

// "1 nationality" / "67 nationalities" - counts never render a mismatched plural.
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
const PREVIEW_CORRIDORS = 24;

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
      <span className={`mono ml-auto whitespace-nowrap rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ring-1 ${levelClass}`}>
        {label}
      </span>
    </Link>
  );
}

// A single corridor-guide link row - same markup as components/CorridorLinks,
// rendered locally so the destination page can cap the list behind the same
// preview + <details> "Show all" pattern the nationality lists use.
function CorridorLinkRow({ href, label, iso3 }: { href: string; label: string; iso3: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
      >
        <span className="text-xl">{flagFor(iso3)}</span>
        <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
          {label}
        </span>
        <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">
          →
        </span>
      </Link>
    </li>
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
    // absolute opts out of the root layout's "%s | Earth Visa" template -
    // this template is already tight against the SERP length budget for
    // longer country names, and the auto-appended suffix pushed most of
    // them over 60 chars despite looking "fine" when measured without it.
    title: { absolute: title },
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

  // Destinations whose official visa policy isn't published as an enumerated
  // list (North Korea, Palestine, Turkmenistan, Yemen) have an EMPTY reverse
  // index - rendering "0 admitted visa-free / restrictive / 198 visa required"
  // would fabricate a policy nobody verified. visaPolicyCounts distinguishes
  // "tracked, admits nobody via streamlined routes" from "not tracked at all".
  const record = dataset.countries.find((c) => c.iso3 === destIso3);
  const policyTracked = Object.values(record?.visaPolicyCounts ?? {}).some((n) => n > 0);
  // Transit visa products the destination itself publishes (category "transit"
  // in its official visa-type catalogue).
  const transitTypes = (dataset.destinationVisaTypes?.[destIso3] ?? []).filter((v) => v.category === "transit");

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
  // FAQ #1 deliberately carries no counts - the stat strip and the section
  // headings above own those numbers; the answer just routes the reader.
  const faq1Routes: string[] = [];
  if (vfCount > 0) faq1Routes.push("visa-free");
  if (voaCount > 0) faq1Routes.push("with a visa on arrival");
  if (etaCount > 0) faq1Routes.push("with an eTA or e-Visa");
  const faq1Answer =
    faq1Routes.length > 0
      ? `It depends on your nationality - the lists above show every nationality that can enter ${country.name} ${
          faq1Routes.length > 1
            ? `${faq1Routes.slice(0, -1).join(", ")} or ${faq1Routes[faq1Routes.length - 1]}`
            : faq1Routes[0]
        }. ${
          visaRequiredCount > 0
            ? `If your country is not listed, you will likely need to apply for ${withArticle(country.name)} tourist visa in advance at an embassy or consulate.`
            : "Every nationality we track qualifies for one of these streamlined routes."
        }`
      : `All visitors must arrange ${withArticle(country.name)} visa in advance through an embassy or consulate - no nationality qualifies for visa-free, on-arrival, or online-authorisation entry in 2026.`;

  // FAQ #3: the lead, document list, and closing line are shared between the
  // visible bullet rendering and the prose JSON-LD answer so they never drift.
  const faq3Online = visaRequiredCount === 0 && etaCount > 0;
  const faq3Lead = faq3Online
    ? `If your nationality is not eligible for visa-free entry${voaCount > 0 ? " or visa on arrival" : ""} to ${country.name}, you can apply online for an eTA or e-Visa - no embassy visit required. You will generally need:`
    : `If your nationality is not eligible for visa-free entry${voaCount > 0 ? " or visa on arrival" : ""} to ${country.name}, you typically need to apply at ${withArticle(country.name)} embassy or consulate in your home country. Requirements generally include:`;
  const faq3Docs = faq3Online
    ? ["Valid passport", "Completed online application", "Digital photo", "Proof of accommodation", "Proof of onward travel"]
    : ["Valid passport", "Completed application form", "Passport-sized photos", "Proof of accommodation", "Proof of onward travel", "Travel insurance", "Proof of sufficient funds"];
  const faq3Close = "Processing times and fees vary by nationality and visa category - see the visa types and fees on this page for the exact figures.";

  const faqs: { q: string; a: string; render?: ReactNode }[] = !policyTracked ? [
    {
      q: `Do I need a visa to visit ${display}?`,
      a: `${country.name} does not publish its visa policy as an enumerated per-nationality list on an official source Earth Visa can verify, so we do not yet track entry rules for ${country.name}. Consult ${possessive(country.name)} official government or embassy channels before planning travel.`,
    },
    {
      q: `Which countries can visit ${country.name} without a visa?`,
      a: `We do not yet have verified per-nationality data for ${country.name}. Rather than estimate, Earth Visa only publishes entry rules confirmed against official government sources.`,
    },
  ] : [
    { q: `Do I need a visa to visit ${display}?`, a: faq1Answer },
    {
      q: `Which countries can visit ${country.name} without a visa?`,
      a:
        vfCount > 0
          ? `${plural(vfCount, "country", "countries")} can visit ${country.name} without a visa in 2026${topVfNames ? `, including: ${topVfNames}` : ""}. Use Earth Visa to check whether your specific passport grants visa-free access to ${country.name}.`
          : `No country's citizens can visit ${country.name} entirely visa-free in 2026 - every nationality needs a visa or travel authorisation. Use Earth Visa to check what your specific passport needs to enter ${country.name}.`,
    },
    {
      q: `How do I apply for ${withArticle(country.name)} tourist visa?`,
      // Prose form for JSON-LD; the visible accordion renders the same list
      // as bullets via `render` below.
      a: `${faq3Lead} ${faq3Docs.map((d) => d.toLowerCase()).join(", ")}. ${faq3Close}`,
      render: (
        <div className="mt-1 max-w-3xl pb-4 text-sm leading-relaxed text-ink-soft">
          <p>{faq3Lead}</p>
          <ul className="mt-2 space-y-1.5">
            {faq3Docs.map((d) => (
              <li key={d} className="flex gap-3">
                <span aria-hidden className="mono text-stamp">■</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">{faq3Close}</p>
        </div>
      ),
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
      ...(policyTracked ? [{
        "@type": "Dataset",
        name: `${country.name} Visa Requirements by Nationality 2026`,
        description: `Official-source visa policy data for ${country.name} showing which nationalities can visit visa-free, on arrival, or require a visa`,
        url: `https://earthvisa.in/destination/${slug}`,
        creator: { "@type": "Organization", name: "Earth Visa" },
        temporalCoverage: "2026",
        variableMeasured: "Visa-free nationalities admitted",
        measurementTechnique: "Official government visa policy publications",
      }] : []),
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
            <nav className="mono mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span>/</span>
              <Link href="/destination" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Destinations</Link>
              <span>/</span>
              <span className="text-ink">{country.name}</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">{flag}</span>
                {display} Visa Requirements 2026
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  {alias ? <>Entry Rules Under {country.name} Visa Policy</> : <>Entry Rules &amp; Visa-Free Access by Passport</>}
                </span>
              </h1>
              {/* The openness judgment lives in the intro paragraph below;
                  stating it here too would say the same thing twice. */}
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                {policyTracked
                  ? <>{plural(vfCount, "nationality", "nationalities")} admitted visa-free</>
                  : <>visa policy not published as an enumerated list · not yet tracked</>}
              </p>
            </div>
            {alias && (
              <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
                {alias.note}
              </p>
            )}

            {/* Stats - only when the destination's policy is actually tracked */}
            {policyTracked && (
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
                  <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            )}
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* Intro paragraph - keyword-rich */}
          <section className="mt-10 max-w-3xl">
            {!policyTracked && (
              <p className="rounded-lg border border-eta/30 bg-eta/[0.06] px-5 py-4 text-base leading-relaxed text-ink-soft">
                <strong className="text-ink">{country.name} does not publish its visa policy as an enumerated per-nationality list</strong>{" "}
                on an official source Earth Visa can verify, so we do not yet track which nationalities can enter and how.
                Rather than estimate, we only publish entry rules confirmed against official government publications  - 
                consult {possessive(country.name)} official government or embassy channels before planning travel.
              </p>
            )}
            {/* No count recap here - the stat strip above and the section
                headings below own the numbers. One openness judgment, one
                actionable routing sentence. */}
            {policyTracked && (
            <p className="text-base leading-relaxed text-ink-soft">
              {possessive(country.name)} visa policy is{" "}
              <strong className="text-ink">{openness}</strong> relative to other destinations worldwide.{" "}
              {visaRequiredCount === 0 && totalWithAccess > 0 ? (
                etaCount > 0 ? (
                  <>
                    Every nationality not covered by visa-free{voaCount > 0 ? " or visa-on-arrival" : ""} entry can
                    apply online for an <strong className="text-ink">eTA or e-Visa</strong> - no embassy visit
                    required.
                  </>
                ) : (
                  <>
                    Every nationality we track can enter {country.name} without arranging a visa in advance.
                  </>
                )
              ) : etaCount > 0 ? (
                <>
                  If your nationality is not listed as visa-free, visa on arrival, or eTA/e-Visa eligible, you will
                  need to apply for <strong className="text-ink">{withArticle(`${country.name} tourist visa`)}</strong>{" "}
                  in advance at an embassy or consulate.
                </>
              ) : (
                <>
                  If your nationality is not listed as visa-free{voaCount > 0 ? " or visa on arrival" : ""}, you will
                  need to apply for <strong className="text-ink">{withArticle(`${country.name} tourist visa`)}</strong>{" "}
                  in advance at an embassy or consulate.
                </>
              )}
            </p>
            )}
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
                {/* No lead paragraph: each card carries its own "official
                    source" chip and source-domain link. */}
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

          {/* Transit visa - the destination's own published transit products.
              Absence of a product here means none is recorded, NOT that transit
              is visa-free - so nothing is asserted when the list is empty. */}
          {transitTypes.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                {display} Transit Visa
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-ink-soft">
                {country.name} publishes {transitTypes.length === 1 ? "a transit visa product" : `${transitTypes.length} transit visa products`} for
                travellers passing through to another destination. Whether you need one depends on your nationality and
                whether you stay airside  - {" "}
                <Link href="/guide/transit-visa" className="font-medium text-stamp underline-offset-2 hover:underline">
                  see how transit visas work
                </Link>.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {transitTypes.map((v, i) => (
                  <div key={i} className="rounded-lg border border-line-strong bg-paper-2 px-4 py-3">
                    <p className="font-display text-[14px] font-semibold text-ink">{v.name}</p>
                    {v.purpose && <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{v.purpose}</p>}
                    <div className="mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
                      {v.max_stay_days != null && <span>up to {v.max_stay_days} day{v.max_stay_days === 1 ? "" : "s"}</span>}
                      {v.fee_usd != null && (v.fee_usd === 0 ? <span className="text-vfree">free</span> : <span>~${v.fee_usd}</span>)}
                      {v.online && <span className="text-vfree">apply online</span>}
                      {v.on_arrival && <span className="text-voa">on arrival</span>}
                    </div>
                    {v.notes && <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{v.notes}</p>}
                    {v.official_url && (
                      <a href={v.official_url} target="_blank" rel="noreferrer" className="mono mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-stamp underline-offset-2 hover:underline">
                        Apply here ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {country.name} Visa Requirements FAQ
            </h2>
            <div className="mt-5 divide-y divide-line">
              {faqs.map(({ q, a, render }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  {render ?? <p className="mt-1 max-w-3xl pb-4 text-sm leading-relaxed text-ink-soft">{a}</p>}
                </details>
              ))}
            </div>
          </section>

          {/* Corridor guides (internal link mesh to detailed per-nationality
              pages). Capped behind the same preview + <details> "Show all"
              pattern as the nationality lists - big destinations have ~200
              corridors, and every link stays in the HTML for crawlers. */}
          {corridorLinks.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-ink">
                {country.name} Visa Guides by Nationality
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Step-by-step {country.name} visa requirements, fees and document checklists for travellers from these countries.
              </p>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {corridorLinks.slice(0, PREVIEW_CORRIDORS).map((l) => (
                  <CorridorLinkRow key={l.href} href={l.href} label={l.label} iso3={l.iso3} />
                ))}
              </ul>
              {corridorLinks.length > PREVIEW_CORRIDORS && (
                <details className="group mt-2.5">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {corridorLinks.length}</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                    <Chevron />
                  </summary>
                  <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {corridorLinks.slice(PREVIEW_CORRIDORS).map((l) => (
                      <CorridorLinkRow key={l.href} href={l.href} label={l.label} iso3={l.iso3} />
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

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
