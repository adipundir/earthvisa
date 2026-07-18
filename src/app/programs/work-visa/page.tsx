import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import type { VisaType } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import { passportWorth, REGION_ORDER } from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";

// ---------------------------------------------------------------------------
// Data (derived entirely from dataset.destinationVisaTypes - nothing invented)
// ---------------------------------------------------------------------------

interface WorkEntry {
  iso3: string;
  name: string;
  region: string;
  visaTypes: VisaType[];
}

const entries: WorkEntry[] = dataset.allCountries
  .map((c) => ({
    iso3: c.iso3,
    name: c.name,
    region: c.region,
    visaTypes: (dataset.destinationVisaTypes[c.iso3] ?? []).filter((v) => v.category === "work"),
  }))
  .filter((e) => e.visaTypes.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

const lastUpdated = dataset.meta.lastUpdated;
const countryCount = entries.length;
const allWork = entries.flatMap((e) => e.visaTypes);
const totalPrograms = allWork.length;
const onlineCount = allWork.filter((v) => v.online).length;

const byRegion = new Map<string, WorkEntry[]>(REGION_ORDER.map((r) => [r, entries.filter((e) => e.region === r)]));
const europeEntries = byRegion.get("Europe") ?? [];
const europeProgramCount = europeEntries.reduce((n, e) => n + e.visaTypes.length, 0);

// Countries with the most distinct work-visa categories in our data (for the FAQ - computed, not hardcoded).
const byCountryCount = [...entries].sort((a, b) => b.visaTypes.length - a.visaTypes.length);
const topCount = byCountryCount[0]?.visaTypes.length ?? 0;
const topCountries = byCountryCount.filter((e) => e.visaTypes.length === topCount).map((e) => e.name);

// How many entries' own text names an employer/sponsor/job offer requirement, vs. explicitly say they don't need one.
const textOf = (v: VisaType) => `${v.name} ${v.purpose} ${v.notes ?? ""}`;
const sponsorMentionCount = allWork.filter((v) => /employer|sponsor|job offer/i.test(textOf(v))).length;
const noOfferCount = allWork.filter((v) =>
  /without.*(job offer|employer|sponsor)|not tied to (an|any) employer|no job offer/i.test(textOf(v)),
).length;

// Published processing-time spread across the dataset (min of mins, max of maxes) - for an honest range, not an average.
const procMins = allWork.map((v) => v.processing_days_min).filter((n): n is number => n != null);
const procMaxs = allWork.map((v) => v.processing_days_max).filter((n): n is number => n != null);
const minProcessing = procMins.length ? Math.min(...procMins) : null;
const maxProcessing = procMaxs.length ? Math.max(...procMaxs) : null;

// A real example of a work permit that grants permanent residence outright, if one exists in the data.
const ausEntry = entries.find((e) => e.iso3 === "AUS");
const prExample = ausEntry?.visaTypes.find((v) => /permanent residence/i.test(v.purpose));

// Working holiday visas are a separate category in our dataset - cited here only as a real count for contrast.
const workingHolidayCount = Object.values(dataset.destinationVisaTypes).reduce(
  (n, types) => n + types.filter((v) => v.category === "working_holiday").length,
  0,
);

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Work Visa Countries 2026: ${countryCount} Countries with Work Permits & Employment Visas`;
const description = `Work visa and employment permit routes in 2026 across ${countryCount} countries: ${totalPrograms} programs with entry type, stay length, processing time and fees, sourced directly from official government pages and grouped by region.`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "work visa",
    "work visa countries",
    "work permit",
    "employment visa",
    "skilled worker visa",
    "intra-company transfer visa",
    "work visa 2026",
    "work visa requirements",
    "employer sponsored visa",
    "self employed visa",
  ],
  alternates: { canonical: "https://earthvisa.in/programs/work-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/work-visa",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is a work visa?",
    a: `A work visa (or work permit) is a visa category that authorises paid employment or self-employment in the issuing country - distinct from a tourist or business visa, which generally does not permit working. Our dataset tracks ${totalPrograms} work visa programs across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "Do I need a job offer before applying for a work visa?",
    a: `Usually, yes. Most work visas are employer-sponsored: a company in the destination country extends a job offer (and often a formal sponsorship or nomination) before you can apply. In our dataset, ${sponsorMentionCount} of the ${totalPrograms} work visa entries explicitly reference an employer, sponsor or job offer in their official description. A smaller set - at least ${noOfferCount} entries, typically points-based talent or job-seeker routes - are explicitly designed to let you enter without one, so you can search for work locally.`,
  },
  {
    q: "What is a labor market test?",
    a: `A labor market test (sometimes called a labor market impact assessment or resident labor market test) is a requirement, used by some countries, that an employer first advertise the role and demonstrate that no qualified local or resident candidate is available before a foreign worker's visa can be approved. Not every work visa route requires one - some skilled-worker and intra-company transfer categories are exempt by design - so check the specific program's own eligibility text.`,
  },
  {
    q: "What's the difference between a work visa and a working holiday visa?",
    a: `A standard work visa is usually tied to a specific employer and job offer from the outset, with status conditional on that employment. A working holiday visa is a separate, typically reciprocal route for young people (commonly ages 18-30 or 18-35) that permits incidental work to fund travel, without requiring a job offer or employer sponsorship in advance, and is usually valid for a fixed period such as a year. Our dataset tracks these as a distinct category - ${workingHolidayCount} working holiday programs - separately from the work visa entries listed on this page.`,
  },
  {
    q: "What types of work permits exist?",
    a: `Common categories include skilled worker visas (for roles matching a shortage list or salary/qualification threshold), intra-company transfer visas (for staff relocated within the same multinational employer), seasonal or temporary work visas (fixed-term, often agricultural or hospitality), and self-employed/freelance permits (for those setting up a business or working independently rather than for a local employer). A working holiday visa is a related but separate youth-exchange category. Exact eligibility and naming vary by country - see each destination's entries below for the categories that country actually publishes.`,
  },
  ...(minProcessing != null && maxProcessing != null
    ? [
        {
          q: "How long does a work visa take to process?",
          a: `It varies widely by country and permit type. Across the officially published processing windows in our dataset, figures range from ${minProcessing} to ${maxProcessing} days - some routes are same-day or same-week, while others (typically those requiring a labor market test or multi-agency sign-off) publish windows of several months. Each entry below shows the specific range published by that country's official source.`,
        },
      ]
    : []),
  ...(prExample
    ? [
        {
          q: "Can a work visa lead to permanent residency?",
          a: `Sometimes directly, sometimes only after years of renewal. A few programs in our dataset grant permanent residence outright to the sponsored worker - for example, ${ausEntry!.name}'s ${prExample.name} is recorded as granting permanent residence to skilled workers nominated by an employer. Most other work visas are temporary and would need a separate residence or settlement application later; check each program's own text for its stated outcome.`,
        },
      ]
    : []),
  {
    q: "Which countries publish the most work visa categories?",
    a: `${topCountries.join(" and ")} currently publish the most - ${topCount} distinct work visa categories each in our dataset - reflecting occupation- and sector-specific visa systems rather than a single generic work permit.`,
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
          name: "Work Visa Countries",
          item: "https://earthvisa.in/programs/work-visa",
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
      name: "Work Visa Countries 2026",
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${e.name} - ${e.visaTypes.length} work visa ${e.visaTypes.length === 1 ? "type" : "types"}`,
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

/** convert a stored day-count into a friendlier unit, without changing the underlying figure */
function stayLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days % 365 === 0) {
    const yrs = days / 365;
    return `${yrs} year${yrs === 1 ? "" : "s"}`;
  }
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

function entriesLabel(e: VisaType["entries"]): string {
  return e === "multiple" ? "Multiple entry" : e === "double" ? "Double entry" : "Single entry";
}

function VisaTypeRow({ v }: { v: VisaType }) {
  const stay = stayLabel(v.max_stay_days);
  return (
    <li className="py-2.5">
      <span className="font-display text-sm font-medium text-ink">{v.name}</span>
      {v.purpose && <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{v.purpose}</p>}
      <p className="mono mt-1.5 text-[11px] text-ink-mute">
        {entriesLabel(v.entries)}
        {stay && <> · stay up to {stay}</>}
        {v.processing_days_min != null && v.processing_days_max != null && (
          <>
            {" "}
            · processing {v.processing_days_min}-{v.processing_days_max} days
          </>
        )}
        {v.fee_usd != null && (
          <>
            {" "}
            · fee from <span className="text-ink">{fmtMoney(v.fee_usd, "USD")}</span>
          </>
        )}
        {v.online && <> · apply online</>}
        {v.on_arrival && <> · on arrival</>}
      </p>
      {v.official_url && (
        <a
          href={v.official_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mono mt-1 inline-flex min-h-[44px] items-center text-[11px] uppercase tracking-[0.1em] text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
        >
          Official source →
        </a>
      )}
    </li>
  );
}

function CountryBlock({ e }: { e: WorkEntry }) {
  const slug = nameToSlug(e.name);
  const w = passportWorth(e.iso3);
  const VISIBLE = 1;
  const visible = e.visaTypes.slice(0, VISIBLE);
  const hidden = e.visaTypes.slice(VISIBLE);
  return (
    <div className="rounded-sm border border-line bg-paper-2/70 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xl">{flagFor(e.iso3)}</span>
        <Link
          href={`/destination/${slug}`}
          className="inline-flex min-h-[44px] items-center font-display text-base font-semibold text-ink transition hover:text-stamp"
        >
          {e.name}
        </Link>
        <span className="mono ml-auto text-[11px] text-ink-soft">
          {e.visaTypes.length} work visa {e.visaTypes.length === 1 ? "type" : "types"}
        </span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {visible.map((v, i) => (
          <VisaTypeRow key={`${v.name}-${i}`} v={v} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <details className="group mt-1">
          <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stamp transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              Show {hidden.length} more {e.name} work visa {hidden.length === 1 ? "type" : "types"}
            </span>
            <span className="hidden group-open:inline">Hide extra {e.name} work visa types</span>
            <Chevron />
          </summary>
          <ul className="divide-y divide-line">
            {hidden.map((v, i) => (
              <VisaTypeRow key={`${v.name}-${i}`} v={v} />
            ))}
          </ul>
        </details>
      )}
      <div className="mt-3 border-t border-line pt-3">
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
    </div>
  );
}

export default function WorkVisaPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Programs</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Work Visa</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Work Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Work Permits &amp; Employment Visas in {countryCount} Countries, by Region
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {totalPrograms} programs tracked · data refreshed {lastUpdated}
            </p>

            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Countries", v: countryCount },
                { k: "Work visa types tracked", v: totalPrograms },
                { k: "Europe programs", v: europeProgramCount },
                { k: "Apply online", v: onlineCount },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <nav aria-label="Jump to a region" className="mono mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.15em]">
              <span className="text-[10px] text-ink-mute">Jump to</span>
              {REGION_ORDER.filter((r) => (byRegion.get(r) ?? []).length > 0).map((r) => (
                <a
                  key={r}
                  href={`#${r.toLowerCase()}`}
                  className="inline-flex min-h-[44px] items-center text-stamp transition hover:text-ink"
                >
                  {r}
                </a>
              ))}
              <a href="#faq" className="inline-flex min-h-[44px] items-center text-stamp transition hover:text-ink">
                FAQ
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              A <strong className="text-ink">work visa</strong> authorises paid employment in the issuing country -
              distinct from a tourist or business visa, which generally does not. Most work visas require an{" "}
              <strong className="text-ink">employer sponsor and a job offer</strong> before you can apply, and some
              countries also run a <strong className="text-ink">labor market test</strong> before approving a foreign
              hire. Every program is grouped by region below.
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">
                Common permit types
              </span>
              {["Skilled worker", "Intra-company transfer", "Seasonal", "Working holiday", "Self-employed"].map(
                (t) => (
                  <span
                    key={t}
                    className="mono rounded-sm border border-line bg-paper-2/70 px-2 py-1 text-[11px] text-ink-soft"
                  >
                    {t}
                  </span>
                ),
              )}
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              For every country we also show <strong className="text-ink">what its passport is worth</strong>: the
              visa-free destination count and global rank from our{" "}
              <Link
                href="/rankings"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                passport rankings
              </Link>
              , since a work visa is often the first step toward a country you might one day hold a passport from.
            </p>
            <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Eligibility, fees and processing times change frequently. Figures compiled directly from official
              government publications, last refreshed {lastUpdated}.
            </p>
          </section>

          {/* Regions */}
          {REGION_ORDER.map((region) => {
            const countries = byRegion.get(region) ?? [];
            if (countries.length === 0) return null;
            const total = countries.reduce((n, e) => n + e.visaTypes.length, 0);
            return (
              <section key={region} id={region.toLowerCase()} className="mt-12 scroll-mt-24">
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Work Visas in {region} ({total} Programs, {countries.length} Countries)
                </h2>
                {region === "Europe" ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {countries.map((e) => (
                      <CountryBlock key={e.iso3} e={e} />
                    ))}
                  </div>
                ) : (
                  <details className="group mt-3">
                    <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Show {total} programs in {countries.length} {region} countries
                      </span>
                      <span className="hidden group-open:inline">Hide {region} work visas</span>
                      <Chevron />
                    </summary>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {countries.map((e) => (
                        <CountryBlock key={e.iso3} e={e} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
            );
          })}

          {/* FAQ */}
          <section id="faq" className="mt-14 scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">Work Visa FAQ</h2>
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

          <ProgramsNav current="/programs/work-visa" />

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check if you need a visa before you even apply for the job
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Many work-visa applicants first need a valid tourist or business entry to interview or sign paperwork in
              person. Check your passport&apos;s visa-free access on Earth Visa.
            </p>
            <Link
              href="/visit"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Explore passports on Earth Visa →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
