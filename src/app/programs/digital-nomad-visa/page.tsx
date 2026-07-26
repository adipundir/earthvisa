import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import {
  nomadFastTrack,
  nomadRbiExtras,
  passportWorth,
  programStatus,
  REGION_ORDER,
  TOTAL_RANKED_PASSPORTS,
  typeLabel,
} from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import ReportLine from "@/components/ReportLine";

// ---------------------------------------------------------------------------
// Data (all derived from dataset.fastTrack + dataset.rbi - nothing invented)
// ---------------------------------------------------------------------------

interface NomadEntry {
  iso3: string;
  name: string;
  region: string;
  program: string;
  category: string;
  processing: string;
  /** verbatim eligibility / program notes from the official source at crawl time */
  detail: string;
  status: "open" | "closed" | "announced";
}

const entries: NomadEntry[] = [
  ...nomadFastTrack().map((f) => ({
    iso3: f.iso3,
    name: f.name,
    region: f.region,
    program: f.program_name,
    category: f.category || "digital_nomad",
    processing: f.processing_time,
    detail: f.eligibility,
    status: programStatus([f.program_name, f.eligibility, f.processing_time, f.notes].join(" ")),
  })),
  // Remote-work residence permits from the residency dataset, for countries that
  // have no dedicated fast-track nomad entry (e.g. Malta, Uruguay, Guatemala).
  ...nomadRbiExtras().map((r) => ({
    iso3: r.iso3,
    name: r.name,
    region: r.region,
    program: r.program_name,
    category: r.type,
    processing: "",
    detail: r.notes,
    status: programStatus([r.program_name, r.notes].join(" ")),
  })),
].sort((a, b) => a.name.localeCompare(b.name));

const lastUpdated = dataset.meta.lastUpdated;
const countryCount = new Set(entries.map((e) => e.iso3)).size;
const openCount = entries.filter((e) => e.status === "open").length;
const notOpenCount = entries.length - openCount;
const byRegion = new Map<string, NomadEntry[]>(
  REGION_ORDER.map((r) => [r, entries.filter((e) => e.region === r)]),
);
const europeCountries = [
  ...new Set((byRegion.get("Europe") ?? []).filter((e) => e.status === "open").map((e) => e.name)),
].sort();

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Digital Nomad Visa Countries 2026: ${countryCount} Countries with Remote Work Visas`;
const description = `Digital nomad visa countries in 2026: ${countryCount} countries with a remote-work visa or residence route, grouped by region with official-source eligibility text and processing times. Includes announced and discontinued programs, clearly flagged.`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "digital nomad visa",
    "digital nomad visa countries",
    "digital nomad visa 2026",
    "remote work visa",
    "countries with digital nomad visas",
    "digital nomad visa europe",
    "digital nomad visa asia",
    "work remotely abroad visa",
    "freelancer visa",
    "digital nomad residence permit",
  ],
  alternates: { canonical: "https://earthvisa.in/programs/digital-nomad-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/digital-nomad-visa",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is a digital nomad visa?",
    a: `A digital nomad visa is a visa or residence permit that lets you live in a country while working remotely for employers or clients based outside it. It is distinct from a work visa (which authorises local employment) and from tourist entry (which generally does not permit working). Our dataset tracks ${entries.length} such routes across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "How many countries offer digital nomad visas in 2026?",
    a: `Our dataset (last refreshed ${lastUpdated}) tracks ${countryCount} countries with a digital nomad or remote-work residence route - ${entries.length} programs in total, of which ${openCount} are open and ${notOpenCount} are recorded as announced-but-not-yet-open or discontinued per their official sources.`,
  },
  {
    q: "Which European countries offer digital nomad visas?",
    a: `${europeCountries.length} European countries carry an open digital nomad or remote-work route in our dataset: ${europeCountries.join(", ")}. Cyprus also runs a digital nomad visa scheme (listed under Asia in our regional grouping).`,
  },
  {
    q: "Can I work for a local company on a digital nomad visa?",
    a: `Generally no. These routes are designed for income earned from employers or clients outside the host country - the eligibility text from each official source, quoted in the entries above, governs. Taking up local employment usually requires a separate work permit.`,
  },
  {
    q: "Do digital nomad visas require a minimum income?",
    a: `Most programs publish a minimum income or savings threshold, and these figures change frequently. We deliberately do not summarise thresholds in one table - instead, each entry above quotes the eligibility text directly from the official source at crawl time, so the exact current figure is right there in the entry.`,
  },
  {
    q: "Do digital nomad visas lead to permanent residency?",
    a: `It varies. Some routes are structured as residence permits whose years can count toward long-term residence, while many are non-immigrant visas that do not. See the entry for your destination above - it quotes the official source's own eligibility text, including whether the route counts toward residence.`,
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Programs" },
        {
          "@type": "ListItem",
          position: 3,
          name: "Digital Nomad Visa Countries",
          item: "https://earthvisa.in/programs/digital-nomad-visa",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "ItemList",
      name: "Digital Nomad Visa Countries 2026",
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${e.name} - ${e.program}`,
        url: `https://earthvisa.in/destination/${nameToSlug(e.name)}`,
      })),
    },
  ],
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

function NomadCard({ e }: { e: NomadEntry }) {
  const slug = nameToSlug(e.name);
  const w = passportWorth(e.iso3);
  return (
    <article className="card-doc flex flex-col p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xl">{flagFor(e.iso3)}</span>
        <Link
          href={`/destination/${slug}`}
          className="inline-flex min-h-[44px] items-center font-display font-semibold text-ink transition hover:text-stamp"
        >
          {e.name}
        </Link>
        {e.status === "closed" && (
          <span className="mono rounded-[3px] bg-stamp/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
            closed per official source
          </span>
        )}
        {e.status === "announced" && (
          <span className="mono rounded-[3px] bg-eta/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">
            announced - not yet open
          </span>
        )}
      </div>
      <p className="mt-1 text-sm italic leading-snug text-ink-soft">{e.program}</p>
      <p className="mono-chrome mt-2">{typeLabel(e.category)}</p>
      {e.processing && <p className="mono mt-1.5 text-[11px] text-ink-mute">Processing: {e.processing}</p>}
      {e.detail && (
        <details className="group mt-2">
          <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stamp transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Eligibility per official source</span>
            <span className="hidden group-open:inline">Hide eligibility</span>
            <Chevron />
          </summary>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{e.detail}</p>
        </details>
      )}
      <div className="mt-auto border-t border-line pt-3">
        <div className="mono flex flex-wrap gap-x-4 text-[11px]">
          <Link
            href={`/destination/${slug}`}
            className="inline-flex min-h-[44px] items-center uppercase tracking-[0.12em] text-stamp transition hover:text-ink"
          >
            {e.name} entry rules →
          </Link>
          {w && (
            <Link
              href={`/passport/${slug}`}
              className="inline-flex min-h-[44px] items-center uppercase tracking-[0.12em] text-ink-soft transition hover:text-ink"
            >
              Passport ({w.visaFree} visa-free) →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function DigitalNomadVisaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Programs</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Digital Nomad Visa</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Digital Nomad Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                {countryCount} Countries with Remote Work Visas &amp; Residence Routes
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {entries.length} programs · data refreshed {lastUpdated}
            </p>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Countries", v: countryCount },
                { k: "Programs tracked", v: entries.length },
                { k: "Open routes", v: openCount },
                { k: "Announced / closed", v: notOpenCount },
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
              A <strong className="text-ink">digital nomad visa</strong> lets you live in a country while working
              remotely for employers or clients based abroad - legally, without pretending to be a tourist. Our
              dataset tracks <strong className="text-ink">{entries.length} remote-work routes</strong> across{" "}
              <strong className="text-ink">{countryCount} countries</strong>, grouped by region below.
            </p>
            <p className="text-body mt-4 text-ink-soft">
              Two honest caveats. First, income thresholds change so often that summarising them in one table would age
              badly - so each entry instead quotes the{" "}
              <strong className="text-ink">program&apos;s eligibility text verbatim</strong> as of crawl time. Second,
              not every announced program is open: entries recorded as announced or discontinued are labelled, not
              hidden.
            </p>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Data compiled directly from official government publications, last refreshed {lastUpdated}.
            </p>
          </section>

          {/* Regions */}
          {REGION_ORDER.map((region) => {
            const list = byRegion.get(region) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={region} className="mt-12">
                <h2 className="text-section text-ink">
                  Digital Nomad Visas in {region} ({list.length})
                </h2>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {list.map((e) => (
                    <NomadCard key={`${e.iso3}-${e.program}`} e={e} />
                  ))}
                </div>
              </section>
            );
          })}

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Digital Nomad Visa FAQ</h2>
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

          <ProgramsNav current="/programs/digital-nomad-visa" />

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              First, check if you even need a visa to arrive
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Many nomads scout a country visa-free before committing to a permit. Check your passport&apos;s access to
              any destination on Earth Visa.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check visa-free access →
            </Link>
          </section>
        </div>
        <ReportLine />
      </main>
    </>
  );
}
