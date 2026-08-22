import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import {
  nomadFastTrack,
  nomadRbiExtras,
  passportWorth,
  programStatus,
  REGION_ORDER,
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
    a: `A visa or residence permit that lets you live in a country while working remotely for employers or clients based outside it. Unlike a work visa it does not authorise local employment, and unlike tourist entry it lets you work legally.`,
  },
  {
    q: "How many countries offer digital nomad visas in 2026?",
    a: `${countryCount} countries, across ${entries.length} programs - ${openCount} open and ${notOpenCount} announced-but-not-yet-open or discontinued per their official sources (data refreshed ${lastUpdated}).`,
  },
  {
    q: "Which European countries offer digital nomad visas?",
    a: `${europeCountries.length} European countries carry an open digital nomad or remote-work route in our dataset: ${europeCountries.join(", ")}. Cyprus also runs a digital nomad visa scheme (listed under Asia in our regional grouping).`,
  },
  {
    q: "Can I work for a local company on a digital nomad visa?",
    a: `Generally no. These routes cover income from employers or clients outside the host country; local employment usually needs a separate work permit.`,
  },
  {
    q: "Do digital nomad visas require a minimum income?",
    a: `Most publish an income or savings threshold and the figures change often, so each entry above quotes its official source's eligibility text rather than a summarised number.`,
  },
  {
    q: "Do digital nomad visas lead to permanent residency?",
    a: `It varies. Some are residence permits whose years can count toward long-term residence; many are non-immigrant visas that do not. The entry above quotes each source's own wording.`,
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

// 53 of the 58 entries carry some spelling of "digital nomad" as their
// category, which is what the whole page is about - the label only earns a line
// when it says something the page title does not.
const GENERIC_CATEGORY = /^digital[\s_-]?nomad/i;
// "Not specified on official page/source", "Not applicable - programme
// discontinued" and friends repeat on ~17 entries and tell the reader nothing
// the row does not already say.
const EMPTY_PROCESSING = /^not\s+(specified|applicable|officially)/i;

function NomadRow({ e }: { e: NomadEntry }) {
  const slug = nameToSlug(e.name);
  const w = passportWorth(e.iso3);
  const category = e.category && !GENERIC_CATEGORY.test(e.category) ? typeLabel(e.category) : null;
  const processing = e.processing && !EMPTY_PROCESSING.test(e.processing) ? e.processing : null;
  const meta = category || processing || w;
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span aria-hidden className="text-lg leading-none">{flagFor(e.iso3)}</span>
        <Link href={`/destination/${slug}`} className="py-1 font-display font-semibold text-ink transition hover:text-stamp">
          {e.name}
        </Link>
        <span className="text-[13px] italic leading-snug text-ink-soft">{e.program}</span>
        {e.status === "closed" && (
          <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">closed</span>
        )}
        {e.status === "announced" && (
          <span className="mono rounded-[3px] bg-eta/10 px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">announced</span>
        )}
      </p>
      {/* Shown rather than folded - 40 of the eligibility blocks carry the
          income threshold, which is what people open this page for. Clamped to
          three lines; the full text stays in the markup. */}
      {e.detail && <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{e.detail}</p>}
      {meta && (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px] text-ink-mute">
          {category && <span>{category}</span>}
          {category && processing && <span aria-hidden>·</span>}
          {processing && <span>{processing}</span>}
          {(category || processing) && w && <span aria-hidden>·</span>}
          {w && (
            <Link href={`/passport/${slug}`} className="underline-offset-2 transition hover:text-ink hover:underline">
              passport · {w.visaFree} visa-free →
            </Link>
          )}
        </p>
      )}
    </li>
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
                {countryCount}{" "}Countries with Remote Work Visas &amp; Residence Routes
              </span>
            </h1>
            {/* One line instead of a four-cell stat card that repeated the
                counts already in the H1 and this line. */}
            <p className="mono mt-3 text-[12px] font-medium tabular-nums text-ink-soft">
              {entries.length} programs · {openCount} open · {notOpenCount} announced or closed · refreshed {lastUpdated}
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro - one sentence; the counts are in the header line above. */}
          <section className="mt-8 max-w-3xl">
            <p className="text-body text-ink-soft">
              A <strong className="text-ink">digital nomad visa</strong> lets you live in a country while working
              remotely for employers or clients based abroad - legally, without pretending to be a tourist.
            </p>
          </section>

          {/* Regions - one dense row per program rather than a card each */}
          {REGION_ORDER.map((region) => {
            const list = byRegion.get(region) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={region} className="mt-10">
                <h2 className="text-section text-ink">
                  Digital Nomad Visas in {region} ({list.length})
                </h2>
                <ul className="mt-3 divide-y divide-line border-t border-line lg:columns-2 lg:gap-10 lg:[&>li]:break-inside-avoid">
                  {list.map((e) => (
                    <NomadRow key={`${e.iso3}-${e.program}`} e={e} />
                  ))}
                </ul>
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
            <Link
              href="/visit"
              className="btn-stamp mt-4"
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
