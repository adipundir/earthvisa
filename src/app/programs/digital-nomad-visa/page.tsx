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
  source: string;
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
    source: f.official_url,
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
    source: r.official_url,
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
// Countries whose own source text says it publishes no income floor - computed,
// so the FAQ can never drift from the table above it.
const noIncomeCountries = [
  ...new Set(
    entries
      .filter((e) => /\bno (?:mandatory )?minimum income\b/i.test(e.detail))
      .map((e) => e.name),
  ),
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
    a: `Most do, and the figures move often - so the income column quotes each official source's own threshold rather than a rounded summary.${
      noIncomeCountries.length ? ` ${noIncomeCountries.join(", ")} publish none.` : ""
    }`,
  },
  {
    q: "Do digital nomad visas lead to permanent residency?",
    a: `It varies. Some are residence permits whose years can count toward long-term residence; many are non-immigrant visas that do not. Each region table quotes its source's own wording.`,
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

// 54 of the 58 entries carry some spelling of exactly "digital nomad" as their
// category, which is what the whole page is about - the label only earns a line
// when it says something the page title does not. Anchored at both ends, so
// categories that name more than nomads (Mauritius' "digital nomad remote
// worker", Thailand's "digital nomad / remote worker / freelancer") still show.
const GENERIC_CATEGORY = /^digital[\s_-]?nomad$/i;
// "Not specified on official page/source", "Not applicable - programme
// discontinued" and friends repeat on 11 entries and tell the reader nothing
// the row does not already say. Stripped as a clause rather than dropped as a
// whole string, because Portugal's tacks a real instruction onto the end of it
// ("...; consular appointment required"). "Not yet ..." is deliberately NOT
// matched - those strings carry rollout dates the announced badge does not.
const EMPTY_PROCESSING = /^not\s+(?:specified|applicable|officially)\b[^;]*(?:;\s*)?/i;

/** drops the "not specified" boilerplate, keeps anything the source put after it */
function cleanProcessing(processing: string): string | null {
  const rest = processing.replace(EMPTY_PROCESSING, "").trim();
  if (!rest) return null;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

// Every eligibility blob is one prose paragraph that mixes the money threshold
// (the one fact people open this page for) with the rest of the conditions.
// Splitting on sentence boundaries lets the threshold move into its own column
// without rewriting a word of the source text - the sentences that carry it are
// removed from the conditions cell, so nothing is shown twice and nothing is lost.
const SENTENCE_BREAK = /(?<=[.;])\s+/;
const MONEY_CONTEXT =
  /\b(income|salary|salaries|savings|earns?|earning|funds|financial|wage|remuneration|balance|threshold)\b/i;

/**
 * Sentence split that survives the abbreviations these sources are full of:
 * "B/. 36,000" and "(approx. USD 37,000)" would otherwise be torn in half and
 * lose their currency. A fragment is glued back on when the previous one has an
 * unclosed bracket, or ended in a period and this one resumes in lower case.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(SENTENCE_BREAK).map((s) => s.trim()).filter(Boolean)) {
    const prev = out[out.length - 1];
    if (prev) {
      const unclosed = (prev.match(/\(/g) ?? []).length > (prev.match(/\)/g) ?? []).length;
      if (unclosed || (prev.endsWith(".") && /^[a-z0-9]/.test(part))) {
        out[out.length - 1] = `${prev} ${part}`;
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

function splitEligibility(detail: string): { money: string; conditions: string } {
  const sentences = splitSentences(detail);
  const money: string[] = [];
  const conditions: string[] = [];
  for (const s of sentences) {
    if (/\d/.test(s) && MONEY_CONTEXT.test(s)) money.push(s);
    else conditions.push(s);
  }
  return { money: money.join(" "), conditions: conditions.join(" ") };
}

/** one programme = one table row: who it is for, then its numbers in their own columns */
function NomadRow({ e }: { e: NomadEntry }) {
  const slug = nameToSlug(e.name);
  const w = passportWorth(e.iso3);
  const { money, conditions } = splitEligibility(e.detail);
  const category = e.category && !GENERIC_CATEGORY.test(e.category) ? typeLabel(e.category) : null;
  const processing = e.processing ? cleanProcessing(e.processing) : null;
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2.5 pr-3">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span aria-hidden>{flagFor(e.iso3)}</span>
          <Link
            href={`/destination/${slug}`}
            className="font-display text-[14px] font-semibold text-ink transition hover:text-stamp"
          >
            {e.name}
          </Link>
          {e.status === "closed" && (
            <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
              closed
            </span>
          )}
          {e.status === "announced" && (
            <span className="mono rounded-[3px] bg-eta/10 px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">
              announced
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug italic text-ink-soft">{e.program}</span>
        {conditions && (
          <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">{conditions}</span>
        )}
        <span className="mt-1 block text-[12px] text-ink-mute">
          {category && <span>{category} · </span>}
          {w && (
            <Link href={`/passport/${slug}`} className="text-stamp transition hover:text-ink">
              passport ({w.visaFree} visa-free)
            </Link>
          )}
          {e.source && (
            <>
              {w && " · "}
              <a
                href={e.source}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-stamp transition hover:text-ink"
              >
                official source ↗
              </a>
            </>
          )}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-[13px] leading-relaxed text-ink-soft">{money || "—"}</td>
      <td className="py-2.5 text-[13px] leading-relaxed text-ink-soft">{processing || "—"}</td>
    </tr>
  );
}

/** every programme in a region as a single table, instead of a block each */
function RegionTable({ list }: { list: NomadEntry[] }) {
  return (
    <div className="mt-4 overflow-x-auto pb-4">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line-strong text-[12px] font-medium text-ink-mute">
            <th scope="col" className="w-1/2 py-2 pr-3 font-medium">
              Country &amp; programme
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Income requirement
            </th>
            <th scope="col" className="py-2 font-medium">
              Processing
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <NomadRow key={`${e.iso3}-${e.program}`} e={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DigitalNomadVisaPage() {
  const regions = REGION_ORDER.filter((r) => (byRegion.get(r) ?? []).length > 0);
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

            <nav
              aria-label="Jump to a region"
              className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-mute"
            >
              {regions.map((r) => (
                <a key={r} href={`#${r.toLowerCase()}`} className="text-stamp transition hover:text-ink">
                  {r}
                </a>
              ))}
              <a href="#faq" className="text-stamp transition hover:text-ink">
                FAQ
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro - said once; every other line on this page is data. */}
          <section className="mt-8 max-w-3xl">
            <p className="text-body text-ink-soft">
              A <strong className="text-ink">digital nomad visa</strong> lets you live in a country while working
              remotely for employers or clients based abroad - legally, without pretending to be a tourist.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
              Open a region for every programme it publishes, with the income threshold, processing time and eligibility
              text quoted from the official source. Thresholds change often; the official link is always the last word.
            </p>
          </section>

          {/* Regions - one table each, nothing repeated per country */}
          <div className="mt-8 space-y-3">
            {regions.map((region) => {
              const list = byRegion.get(region) ?? [];
              return (
                <section key={region} id={region.toLowerCase()} className="scroll-mt-24">
                  <details className="group card-doc px-4 py-1 sm:px-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                      <h2 className="text-section text-ink">
                        Digital Nomad Visas in {region} ({list.length})
                      </h2>
                      <Chevron />
                    </summary>
                    <RegionTable list={list} />
                    <div className="h-3" />
                  </details>
                </section>
              );
            })}
          </div>

          {/* FAQ */}
          <section id="faq" className="mt-12 scroll-mt-24">
            <h2 className="text-section text-ink">Digital Nomad Visa FAQ</h2>
            <dl className="mt-4 max-w-3xl space-y-4">
              {faqs.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-display text-[15px] font-semibold text-ink">{q}</dt>
                  <dd className="mt-1 text-[14px] leading-relaxed text-ink-soft">{a}</dd>
                </div>
              ))}
            </dl>
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
