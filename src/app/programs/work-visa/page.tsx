import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import type { VisaType } from "@/lib/dataset";
import { fmtMoney } from "@/lib/compute";
import { passportWorth, REGION_ORDER } from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import ReportLine from "@/components/ReportLine";

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
    a: `A work visa (or work permit) authorises paid employment or self-employment in the issuing country, which a tourist or business visa does not. This page tracks ${totalPrograms} work visa programs across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "Do I need a job offer before applying for a work visa?",
    a: `Usually yes - most work visas are employer-sponsored, so a company extends a job offer (often with a formal sponsorship or nomination) before you apply. ${sponsorMentionCount} of the ${totalPrograms} entries here name an employer, sponsor or job offer; at least ${noOfferCount} - typically points-based talent or job-seeker routes - let you enter without one and look for work locally.`,
  },
  {
    q: "What is a labor market test?",
    a: `A requirement, used by some countries, that the employer first advertise the role and show no qualified local or resident candidate was available before a foreign worker's visa is approved. Skilled-worker and intra-company transfer categories are often exempt by design, so check the program's own eligibility text.`,
  },
  {
    q: "What's the difference between a work visa and a working holiday visa?",
    a: `A work visa is normally tied to one employer and job offer, and your status depends on that employment. A working holiday visa is a separate reciprocal youth route (commonly ages 18-30 or 18-35) that permits incidental work to fund travel, needs no job offer, and usually runs for a fixed year. We track those separately: ${workingHolidayCount} working holiday programs.`,
  },
  {
    q: "What types of work permits exist?",
    a: `Skilled worker visas (shortage list or salary/qualification threshold), intra-company transfers, seasonal or temporary work visas, and self-employed or freelance permits - plus the separate working holiday category. Naming and eligibility vary by country; each region table lists the categories that country actually publishes.`,
  },
  ...(minProcessing != null && maxProcessing != null
    ? [
        {
          q: "How long does a work visa take to process?",
          a: `Officially published windows in this dataset run from ${minProcessing} to ${maxProcessing} days. Routes needing a labor market test or multi-agency sign-off sit at the long end; every program's own published range is in the region tables above.`,
        },
      ]
    : []),
  ...(prExample
    ? [
        {
          q: "Can a work visa lead to permanent residency?",
          a: `Sometimes directly, more often only after years of renewal. ${ausEntry!.name}'s ${prExample.name} is recorded as granting permanent residence outright to skilled workers nominated by an employer; most other work visas are temporary and need a separate residence or settlement application later.`,
        },
      ]
    : []),
  {
    q: "Which countries publish the most work visa categories?",
    a: `${topCountries.join(" and ")}, with ${topCount} distinct work visa categories each - occupation- and sector-specific systems rather than a single generic work permit.`,
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
      className="size-3.5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
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

function entriesLabel(e: VisaType["entries"]): string | null {
  return e === "multiple" ? "Multiple entry" : e === "double" ? "Double entry" : e === "single" ? "Single entry" : null;
}

/** one program = one table row: name + what it is, then the numbers in their own columns */
function ProgramRow({ v }: { v: VisaType }) {
  const stay = stayLabel(v.max_stay_days);
  const validity = v.validity_days != null && v.validity_days !== v.max_stay_days ? stayLabel(v.validity_days) : null;
  const tags = [entriesLabel(v.entries), v.online ? "Apply online" : null, v.on_arrival ? "On arrival" : null].filter(
    Boolean,
  );
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2.5 pr-3">
        <span className="font-display text-[14px] font-medium text-ink">{v.name}</span>
        {v.purpose && <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{v.purpose}</span>}
        <span className="mt-1 block text-[12px] text-ink-3">
          {tags.join(" · ")}
          {v.official_url && (
            <>
              {tags.length > 0 && " · "}
              <a
                href={v.official_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                official source ↗
              </a>
            </>
          )}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {stay ?? "—"}
        {validity && <span className="block text-[12px] text-ink-3">valid {validity}</span>}
      </td>
      <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {v.processing_days_min != null && v.processing_days_max != null
          ? `${v.processing_days_min}-${v.processing_days_max} days`
          : "—"}
      </td>
      <td className="py-2.5 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {v.fee_usd != null ? fmtMoney(v.fee_usd, "USD") : "—"}
      </td>
    </tr>
  );
}

/** every country in a region, and every one of its programs, as a single table */
function RegionTable({ countries }: { countries: WorkEntry[] }) {
  return (
    <div className="mt-4 overflow-x-auto pb-4">
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line-strong text-[12px] font-medium text-ink-3">
            <th scope="col" className="py-2 pr-3 font-medium">
              Work visa
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Stay
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Processing
            </th>
            <th scope="col" className="py-2 font-medium">
              Fee
            </th>
          </tr>
        </thead>
        {countries.map((e) => {
          const slug = nameToSlug(e.name);
          const w = passportWorth(e.iso3);
          return (
            <tbody key={e.iso3}>
              <tr className="border-t border-line-strong bg-paper-2/60">
                <th scope="rowgroup" colSpan={4} className="px-0 py-2 text-left font-normal">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span aria-hidden>{flagFor(e.iso3)}</span>
                      <Link
                        href={`/destination/${slug}`}
                        className="font-display text-[15px] font-semibold text-ink transition hover:text-stamp"
                      >
                        {e.name}
                      </Link>
                      <span className="text-[12px] text-ink-3">
                        {e.visaTypes.length} work visa {e.visaTypes.length === 1 ? "type" : "types"}
                      </span>
                      <span className="ml-auto text-[12px] text-ink-3">
                        <Link href={`/destination/${slug}`} className="text-stamp transition hover:text-ink">
                          entry rules
                        </Link>
                        {w && (
                          <>
                            {" · "}
                            <Link href={`/passport/${slug}`} className="text-stamp transition hover:text-ink">
                              passport ({w.visaFree} visa-free)
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                  </th>
                </tr>
              {e.visaTypes.map((v, i) => (
                <ProgramRow key={`${v.name}-${i}`} v={v} />
              ))}
            </tbody>
          );
        })}
      </table>
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
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Programs
              </Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Work Visa</span>
            </nav>

            <h1 className="text-display text-ink">
              Work Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Work Permits &amp; Employment Visas in {countryCount} Countries, by Region
              </span>
            </h1>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden">
              <dl className="grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
                {[
                  { k: "Countries", v: String(countryCount) },
                  { k: "Work visas tracked", v: String(totalPrograms) },
                  { k: "Apply online", v: String(onlineCount) },
                  { k: "Updated", v: lastUpdated },
                ].map(({ k, v }) => (
                  <div key={k} className="bg-card px-4 py-2.5">
                    <dt className="text-[12.5px] text-ink-3">{k}</dt>
                    <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <nav
              aria-label="Jump to a region"
              className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3"
            >
              {REGION_ORDER.filter((r) => (byRegion.get(r) ?? []).length > 0).map((r) => (
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
          {/* Intro - said once */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              A <strong className="text-ink">work visa</strong> authorises paid employment in the issuing country, which
              a tourist or business visa does not. Most need an employer sponsor and a job offer first - some countries
              also run a labor market test - and the usual families are skilled worker, intra-company transfer, seasonal,
              self-employed and working holiday routes.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
              Open a region for every program it publishes, with stay, processing time, fee and the official source.
              Each country also links to its{" "}
              <Link href="/rankings" className="text-stamp underline decoration-line-strong underline-offset-2">
                passport ranking
              </Link>
              . Rules change often; the official link is always the last word.
            </p>
          </section>

          {/* Regions - one table each, nothing repeated per country */}
          <div className="mt-8 space-y-3">
            {REGION_ORDER.map((region) => {
              const countries = byRegion.get(region) ?? [];
              if (countries.length === 0) return null;
              const total = countries.reduce((n, e) => n + e.visaTypes.length, 0);
              return (
                <section key={region} id={region.toLowerCase()} className="scroll-mt-24">
                  <details className="group card-doc px-4 py-1 sm:px-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                      <h2 className="text-section text-ink">
                        Work Visas in {region} ({total} Programs, {countries.length} Countries)
                      </h2>
                      <Chevron />
                    </summary>
                    <RegionTable countries={countries} />
                    <div className="h-3" />
                  </details>
                </section>
              );
            })}
          </div>

          {/* FAQ */}
          <section id="faq" className="mt-12 scroll-mt-24">
            <h2 className="text-section text-ink">Work Visa FAQ</h2>
            <dl className="mt-4 max-w-3xl space-y-4">
              {faqs.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-display text-[15px] font-semibold text-ink">{q}</dt>
                  <dd className="mt-1 text-[14px] leading-relaxed text-ink-soft">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <ProgramsNav current="/programs/work-visa" />

          {/* CTA */}
          <section className="card-doc mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">Check if you need a visa before you even apply for the job</h2>
            <Link href="/visit" className="btn-stamp mt-4">
              Explore passports on Earth Visa →
            </Link>
          </section>
        </div>
        <ReportLine />
      </main>
    </>
  );
}
