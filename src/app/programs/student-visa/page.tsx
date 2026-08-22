import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { REGION_ORDER } from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { VisaType } from "@/lib/types";
import ReportLine from "@/components/ReportLine";

// ---------------------------------------------------------------------------
// Data (all derived from dataset.destinationVisaTypes - nothing invented)
// ---------------------------------------------------------------------------

interface StudentEntry {
  iso3: string;
  name: string;
  region: string;
  visaTypes: VisaType[];
}

const countryByIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c]));

const entries: StudentEntry[] = Object.entries(dataset.destinationVisaTypes)
  .map(([iso3, types]) => {
    const students = types.filter((v) => v.category === "student");
    const c = countryByIso3.get(iso3);
    if (students.length === 0 || !c) return null;
    return { iso3, name: c.name, region: c.region, visaTypes: students };
  })
  .filter((e): e is StudentEntry => e !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

const lastUpdated = dataset.meta.lastUpdated;
const countryCount = entries.length;
const totalRoutes = entries.reduce((n, e) => n + e.visaTypes.length, 0);
const onlineCountries = entries.filter((e) => e.visaTypes.some((v) => v.online)).length;

const PART_TIME_RE = /part-?time|work.{0,25}hours?|hours? per (week|fortnight|month)/i;
const partTimeCountries = entries.filter((e) => e.visaTypes.some((v) => v.notes && PART_TIME_RE.test(v.notes))).length;

const POST_STUDY_RE = /post-?study|graduat|after (completion|graduation)|stay-back|orientation year/i;
const postStudyCountries = entries.filter((e) => e.visaTypes.some((v) => v.notes && POST_STUDY_RE.test(v.notes))).length;

const byRegion = new Map<string, StudentEntry[]>(REGION_ORDER.map((r) => [r, entries.filter((e) => e.region === r)]));

// A couple of destination examples used verbatim below, so the FAQ stays grounded in the data.
const canada = entries.find((e) => e.iso3 === "CAN");
const usa = entries.find((e) => e.iso3 === "USA");

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const title = `Student Visa Countries 2026: ${countryCount} Countries with Study Abroad Visas`;
const description = `Student visa requirements for ${countryCount} countries in 2026: visa/permit name, stay length, entries, processing time, fees, part-time work rights and post-study options - compiled from official government sources.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/programs/student-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/programs/student-visa",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const faqs = [
  {
    q: "What is a student visa?",
    a: `A student visa (or study permit) lets you enter and remain in a country to study at an accredited institution. Nearly every route needs a confirmed offer or enrolment letter plus evidence you can fund tuition and living costs for the whole course. This page tracks ${totalRoutes} student visa routes across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "Do I need proof of funds for a student visa?",
    a: `Yes - essentially every student visa route requires evidence you can cover tuition and living costs: bank statements, a scholarship letter, an education loan sanction letter, or a sponsor's financial documents with a sponsorship letter. The amount varies by destination and is rarely a single fixed figure; our proof of funds guide has the published numbers.`,
  },
  {
    q: "Can I work while on a student visa?",
    a: `Where work rights exist they are almost always capped per week or fortnight during term, with fewer restrictions in scheduled breaks. Official sources publish an explicit limit for ${partTimeCountries} countries - Canada 20 hours a week off-campus, Australia 48 hours a fortnight, Japan 28 hours a week with a permit. Confirm the current cap with the issuing authority, since these change.`,
  },
  {
    q: "Is there a path to work after graduation?",
    a: `In ${postStudyCountries} destinations the official student-visa text names a post-study or graduate work route - for example Australia's Temporary Graduate visa (subclass 485) and Belgium's one-year, non-renewable orientation permit. Where our data flags none, that does not prove none exists; check the destination's own immigration authority.`,
  },
  {
    q: "Can I apply for a student visa online?",
    a: `${onlineCountries} of the ${countryCount} countries here offer at least one student visa route with an online application. Many others still require an in-person appointment at an embassy, consulate or visa application centre for part of the process - each route's official source link says which.`,
  },
  {
    q: `What's the difference between a "student visa" and a "study permit"?`,
    a: `They are generally the same thing under different local names. ${canada ? `${canada.name} calls its route a "${canada.visaTypes[0]?.name}"` : "Some countries call it a study permit"}, ${usa ? `the ${usa.name} issues separate categories by program type (${usa.visaTypes.map((v) => v.name).join(", ")})` : "others separate categories by program type"}, and many use a general long-stay or "Type D" national visa endorsed for study. The underlying requirement - proof of enrolment plus sufficient funds - is consistent even when the name isn't.`,
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
          name: "Student Visa Countries",
          item: "https://earthvisa.in/programs/student-visa",
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
      name: "Student Visa Countries 2026",
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${e.name} student visa`,
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

function entryLabel(entryType: VisaType["entries"]): string | null {
  if (!entryType) return null;
  return `${entryType.charAt(0).toUpperCase()}${entryType.slice(1)} entry`;
}

function processingLabel(v: VisaType): string | null {
  const { processing_days_min: min, processing_days_max: max } = v;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max} days`;
  return `${min ?? max} days`;
}

/** one route = one table row: name, what it covers, the official small print, then the numbers */
function RouteRow({ v }: { v: VisaType }) {
  const tags = [entryLabel(v.entries), v.online ? "Online application" : null].filter(Boolean);
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2.5 pr-3">
        <span className="font-display text-[14px] font-medium text-ink">{v.name}</span>
        {v.purpose && <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{v.purpose}</span>}
        {v.notes && <span className="mt-1 block text-[12.5px] leading-snug text-ink-3">{v.notes}</span>}
        <span className="mt-1 block text-[12px] text-ink-3">
          {tags.join(" · ")}
          {v.official_url && (
            <>
              {tags.length > 0 && " · "}
              <a
                href={v.official_url}
                target="_blank"
                rel="noreferrer"
                className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink"
              >
                official source ↗
              </a>
            </>
          )}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {v.max_stay_days != null ? `${v.max_stay_days} days` : "—"}
        {v.validity_days != null && v.validity_days !== v.max_stay_days && (
          <span className="block text-[12px] text-ink-3">valid {v.validity_days} days</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {processingLabel(v) ?? "—"}
      </td>
      <td className="py-2.5 text-[13px] whitespace-nowrap text-ink-soft tabular-nums">
        {v.fee_usd != null ? `~$${v.fee_usd}` : "—"}
      </td>
    </tr>
  );
}

/** every country in a region, and every one of its routes, as a single table */
function RegionTable({ countries }: { countries: StudentEntry[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line-strong text-[12px] font-medium text-ink-3">
            <th scope="col" className="py-2 pr-3 font-medium">
              Student visa route
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
        <tbody>
          {countries.map((e) => {
            const slug = nameToSlug(e.name);
            return (
              <Fragment key={e.iso3}>
                <tr className="border-t border-line-strong bg-paper-2/60">
                  <th scope="colgroup" colSpan={4} className="px-0 py-2 text-left font-normal">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span aria-hidden>{flagFor(e.iso3)}</span>
                      <Link
                        href={`/destination/${slug}`}
                        className="font-display text-[15px] font-semibold text-ink transition hover:text-stamp"
                      >
                        {e.name}
                      </Link>
                      <span className="text-[12px] text-ink-3">
                        {e.visaTypes.length} {e.visaTypes.length === 1 ? "route" : "routes"}
                      </span>
                    </span>
                  </th>
                </tr>
                {e.visaTypes.map((v, i) => (
                  <RouteRow key={`${v.name}-${i}`} v={v} />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentVisaPage() {
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Student Visa</span>
            </nav>

            <h1 className="text-display text-ink">
              Student Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Study Abroad Visa Requirements in {countryCount} Countries, by Region
              </span>
            </h1>

            <div className="card-doc card-doc-rule mt-6 overflow-hidden">
              <dl className="grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-5">
                {[
                  { k: "Countries", v: String(countryCount) },
                  { k: "Visa routes tracked", v: String(totalRoutes) },
                  { k: "Online application", v: String(onlineCountries) },
                  { k: "Publish work-hour limits", v: String(partTimeCountries) },
                  { k: "Updated", v: lastUpdated },
                ].map(({ k, v }) => (
                  <div key={k} className="bg-card px-4 py-2.5 last:col-span-2 sm:last:col-span-1">
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
              A <strong className="text-ink">student visa</strong> lets you enter and remain in a country to study at an
              accredited institution. Nearly every route shares one skeleton - a confirmed offer or enrolment letter,
              proof you can fund tuition and living costs, capped part-time work hours during term, and sometimes a
              post-study work permit on graduation - while permit length, entries, processing time and fees vary a great
              deal by destination.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
              Open a region for every route it publishes, with the official source for each. For how much money to show
              and which documents prove it, see the{" "}
              <Link
                href="/guide/proof-of-funds"
                className="text-stamp underline decoration-line-strong underline-offset-2"
              >
                proof of funds guide
              </Link>
              .
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
                        Student Visas in {region} ({total} Routes, {countries.length} Countries)
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
            <h2 className="text-section text-ink">Student Visa FAQ</h2>
            <dl className="mt-4 max-w-3xl space-y-4">
              {faqs.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-display text-[15px] font-semibold text-ink">{q}</dt>
                  <dd className="mt-1 text-[14px] leading-relaxed text-ink-soft">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <ProgramsNav current="/programs/student-visa" />

          {/* CTA */}
          <section className="card-doc mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">Check if you even need a visa to scout the campus first</h2>
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
