import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { REGION_ORDER } from "@/lib/programs";
import ProgramsNav from "@/components/ProgramsNav";
import type { VisaType } from "@/lib/types";

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

const routesWithProcessingTime = entries.reduce(
  (n, e) => n + e.visaTypes.filter((v) => v.processing_days_min != null || v.processing_days_max != null).length,
  0,
);

const byRegion = new Map<string, StudentEntry[]>(REGION_ORDER.map((r) => [r, entries.filter((e) => e.region === r)]));
const europeCountries = (byRegion.get("Europe") ?? []).map((e) => e.name);

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
  keywords: [
    "student visa",
    "student visa countries",
    "study abroad visa",
    "student visa 2026",
    "study permit",
    "international student visa",
    "student visa requirements",
    "part time work student visa",
    "post study work visa",
    "student visa processing time",
    "student visa proof of funds",
  ],
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
    a: `A student visa (sometimes called a study permit or study visa) is a permit that lets you enter and remain in a country to pursue a course of study at an accredited institution. Almost every route requires proof of admission - a confirmed offer or enrolment letter - plus evidence you can fund tuition and living costs for the length of the course. Our dataset tracks ${totalRoutes} student visa routes across ${countryCount} countries, compiled from official government publications.`,
  },
  {
    q: "Do I need proof of funds for a student visa?",
    a: `Yes - essentially every student visa route requires evidence that you can cover tuition and living costs, usually bank statements, a scholarship letter, an education loan sanction letter, or a sponsor's financial documents alongside a sponsorship letter. The exact amount and documents required vary by destination and are rarely a single fixed figure. See our proof of funds guide for how much banks statements and other evidence are typically expected across major destinations.`,
  },
  {
    q: "Can I work while on a student visa?",
    a: `It depends on the destination, and where work rights exist they are almost always capped at a limited number of hours per week (or fortnight) during term, with fewer restrictions during scheduled breaks. Our dataset records an explicit part-time work-hour limit in official sources for ${partTimeCountries} countries - for example Canada (up to 20 hours a week off-campus), Australia (up to 48 hours a fortnight), and Japan (up to 28 hours a week with a permit). Always confirm the current limit with the issuing authority, since these caps change.`,
  },
  {
    q: "Is there a path to work after graduation?",
    a: `In some destinations, yes. Our data flags ${postStudyCountries} destinations whose official student-visa category text mentions a post-study or graduate work route - for example Australia's Temporary Graduate visa (subclass 485) for recent graduates, and Belgium's one-year, non-renewable orientation permit for graduates of Belgian institutions. Where no such route is flagged in our data, that does not necessarily mean none exists - check the destination's own immigration authority for the current rules.`,
  },
  {
    q: "Can I apply for a student visa online?",
    a: `${onlineCountries} of the ${countryCount} countries in our dataset offer at least one student visa route with an online application option. Many others still require an in-person appointment at an embassy, consulate or visa application centre for at least part of the process - check the route's own entry below and its official source link.`,
  },
  {
    q: `What's the difference between a "student visa" and a "study permit"?`,
    a: `They're generally the same thing under different local names. ${canada ? `${canada.name} calls its route a "${canada.visaTypes[0]?.name}"` : "Some countries call it a study permit"}, ${usa ? `the ${usa.name} instead issues separate visa categories by program type (${usa.visaTypes.map((v) => v.name).join(", ")})` : "others separate categories by program type"}, and many others use a general long-stay or "Type D" national visa endorsed for study. The underlying requirement - proof of enrolment plus sufficient funds - is consistent even when the name isn't.`,
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

function entryLabel(entryType: VisaType["entries"]): string | null {
  if (!entryType) return null;
  return `${entryType.charAt(0).toUpperCase()}${entryType.slice(1)} entry`;
}

function processingLabel(v: VisaType): string | null {
  const { processing_days_min: min, processing_days_max: max } = v;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max}d processing`;
  return `${min ?? max}d processing`;
}

function RouteRow({ v }: { v: VisaType }) {
  const stay = v.max_stay_days != null ? `stay up to ${v.max_stay_days}d` : null;
  const validity =
    v.validity_days != null && v.validity_days !== v.max_stay_days ? `valid ${v.validity_days}d` : null;
  const entryTag = entryLabel(v.entries);
  const processing = processingLabel(v);
  return (
    <li className="py-2.5">
      <p className="font-display text-sm font-medium text-ink">{v.name}</p>
      {v.purpose && <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{v.purpose}</p>}
      <p className="mono mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
        {stay && <span>{stay}</span>}
        {validity && <span>{validity}</span>}
        {entryTag && <span>{entryTag}</span>}
        {processing && <span>{processing}</span>}
        {v.fee_usd != null && <span>~${v.fee_usd}</span>}
        {v.online && <span className="text-vfree">online application</span>}
      </p>
      {v.notes && (
        <details className="group mt-1.5">
          <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-stamp transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Details from official source</span>
            <span className="hidden group-open:inline">Hide details</span>
            <Chevron />
          </summary>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{v.notes}</p>
        </details>
      )}
      {v.official_url && (
        <a
          href={v.official_url}
          target="_blank"
          rel="noreferrer"
          className="mono mt-1.5 inline-flex min-h-[44px] items-center gap-1 text-[11px] font-medium text-stamp underline-offset-2 hover:underline"
        >
          Official source ↗
        </a>
      )}
    </li>
  );
}

function CountryCard({ e }: { e: StudentEntry }) {
  const slug = nameToSlug(e.name);
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
        {e.visaTypes.length > 1 && (
          <span className="mono ml-auto text-[11px] text-ink-soft">{e.visaTypes.length} visa types</span>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {visible.map((v, i) => (
          <RouteRow key={`${v.name}-${i}`} v={v} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <details className="group mt-1">
          <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stamp transition hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              Show {hidden.length} more {e.name} student visa {hidden.length === 1 ? "route" : "routes"}
            </span>
            <span className="hidden group-open:inline">Hide extra {e.name} student visa routes</span>
            <Chevron />
          </summary>
          <ul className="divide-y divide-line">
            {hidden.map((v, i) => (
              <RouteRow key={`${v.name}-${i}`} v={v} />
            ))}
          </ul>
        </details>
      )}
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
            <nav aria-label="Breadcrumb" className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/programs" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Programs</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Student Visa</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Student Visa Countries 2026
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Study Abroad Visa Requirements in {countryCount} Countries, by Region
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {countryCount} countries · {totalRoutes} student visa routes · data refreshed {lastUpdated}
            </p>

            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-5">
              {[
                { k: "Countries", v: countryCount },
                { k: "Visa routes tracked", v: totalRoutes },
                { k: "Online application", v: onlineCountries },
                { k: "Publish part-time work rights", v: partTimeCountries },
                { k: "Routes with processing times", v: routesWithProcessingTime },
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
              A <strong className="text-ink">student visa</strong> lets you enter and remain in a country to study at
              an accredited institution. Nearly every route shares the same skeleton: a{" "}
              <strong className="text-ink">confirmed offer or enrolment letter</strong> from the institution, proof
              you can fund tuition and living costs for the course, and - depending on the destination -{" "}
              <strong className="text-ink">limits on how many hours you may work part-time</strong> during term, plus
              in some places a route to convert into a <strong className="text-ink">post-study work permit</strong>{" "}
              once you graduate. Beyond that shared shape, the details - permit length, entries, processing time,
              fees - vary a great deal by destination, which is why we list them individually below.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Some destinations publish a single general student visa, others run several categories for different
              levels or lengths of study. Grouped by region below, with a link to the official source for every route.
            </p>
            <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              Every route on this page requires proof you can pay for tuition and living costs - see our{" "}
              <Link href="/guide/proof-of-funds" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:text-ink">
                proof of funds guide
              </Link>{" "}
              for how much to show and which documents to use. Data compiled directly from official government
              publications, last refreshed {lastUpdated}.
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
                  Student Visas {region === "Europe" ? "in Europe" : `in ${region}`} ({total} Routes, {countries.length}{" "}
                  Countries)
                </h2>
                {region === "Europe" ? (
                  <>
                    <p className="mt-2 text-sm text-ink-soft">
                      {europeCountries.length} European countries carry a student visa route in our dataset, from
                      short-stay language courses to multi-year Type D national study visas.
                    </p>
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {countries.map((e) => (
                        <CountryCard key={e.iso3} e={e} />
                      ))}
                    </div>
                  </>
                ) : (
                  <details className="group mt-3">
                    <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Show {total} routes in {countries.length} {region} countries
                      </span>
                      <span className="hidden group-open:inline">Hide {region} routes</span>
                      <Chevron />
                    </summary>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {countries.map((e) => (
                        <CountryCard key={e.iso3} e={e} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
            );
          })}

          {/* FAQ */}
          <section id="faq" className="mt-14 scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">Student Visa FAQ</h2>
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

          <ProgramsNav current="/programs/student-visa" />

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              Check if you even need a visa to scout the campus first
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Many applicants visit a university or city visa-free before committing to a course and a student visa
              application. Check your passport&apos;s visa-free reach on Earth Visa.
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
