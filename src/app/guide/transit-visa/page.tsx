import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";

// ---------------------------------------------------------------------------
// /guide/transit-visa
//
// Definitional explainer - there was previously ZERO explanatory content
// about transit visas anywhere on the site. Two things people confuse:
//   1. Transit visa vs tourist visa (a transit visa is only for passing
//      through en route to somewhere else, not for visiting).
//   2. Direct/airside transit vs indirect/landside transit - airside almost
//      never needs anything regardless of nationality; landside is treated
//      much more like a normal entry.
// Everything specific in the "by destination" section is pulled straight
// from dataset.destinationVisaTypes (the "transit" category visa type each
// destination publishes) - nothing here is invented. That data describes the
// transit visa PRODUCT a destination publishes, not who is exempt from it -
// exemption is nationality x country specific and is deliberately not
// asserted in bulk here; readers are pointed at the per-passport checker.
// ---------------------------------------------------------------------------

type TransitEntry = {
  iso3: string;
  name: string;
  visaName: string;
  feeUsd: number | null;
  maxStayDays: number | null;
  online: boolean;
  onArrival: boolean;
};

const nameByIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c.name]));

const transitEntries: TransitEntry[] = Object.entries(dataset.destinationVisaTypes)
  .flatMap(([iso3, types]) => {
    const t = types.find((v) => v.category === "transit");
    const name = nameByIso3.get(iso3);
    if (!t || !name) return [];
    return [
      {
        iso3,
        name,
        visaName: t.name,
        feeUsd: t.fee_usd,
        maxStayDays: t.max_stay_days,
        online: t.online,
        onArrival: t.on_arrival,
      },
    ];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const destinationCount = transitEntries.length;
const withFee = transitEntries.filter((e) => e.feeUsd != null).length;
const withOnline = transitEntries.filter((e) => e.online).length;
const withOnArrival = transitEntries.filter((e) => e.onArrival).length;
const lastUpdated = dataset.meta.lastUpdated;

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const TITLE = "Transit Visa Guide 2026: Do You Need One for a Layover?";
const DESCRIPTION = `What a transit visa is, direct/airside vs indirect/landside transit, and why the answer depends on both your passport and the transit country. ${destinationCount} destinations in our dataset publish a dedicated transit visa product - fees, stay limits, online and on-arrival options - from official sources.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/guide/transit-visa" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/guide/transit-visa",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQS = [
  {
    q: "What is a transit visa?",
    a: "A transit visa is a travel document for passing through a country only to reach a connecting flight or an onward destination - not for visiting that country itself. It typically permits a short stay (often just hours to a few days) strictly for the purpose of making your connection, and is usually more limited and cheaper than a tourist visa where one is required at all.",
  },
  {
    q: "Do I need a transit visa if I don't leave the airport?",
    a: "Very often no. Direct or airside transit - same airport, same booking, never crossing border control - is exempt for most or all nationalities in many countries, provided the connection is same-day and you stay in the international transit area. It is not universal: some countries require a visa even for airside transit by certain nationalities, so check your specific passport and airport rather than assuming.",
  },
  {
    q: "Does a layover under 24 hours need a visa?",
    a: "Layover length alone doesn't decide it. A same-airport, same-ticket connection without leaving the international transit area is what countries are most likely to exempt. A layover that changes airports or terminals outside security, or has you collect and re-check baggage through border control, is treated as a normal entry however short it is.",
  },
  {
    q: "Can transit visa rules differ from that country's regular tourist visa rules for the same passport?",
    a: "Yes - a country's transit-visa-exempt nationality list is often broader or narrower than its tourist-visa-exempt list. Never assume visa-exempt for tourism means visa-exempt for transit, or the reverse.",
  },
  {
    q: "How do I check if I need a transit visa for a specific layover?",
    a: "Three things before booking: your layover length, whether you change terminals or airports (and so pass through border control), and whether the transit country's transit-visa-exempt list covers your passport. Airline check-in staff and the transit country's immigration or embassy site are the reliable sources for your routing.",
  },
  {
    q: "Is a transit visa the same as a visa on arrival?",
    a: "No. A visa on arrival is issued at the border to people entering and staying. A transit visa is issued specifically for passengers continuing onward, and usually carries a shorter permitted stay and narrower conditions.",
  },
];

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Transit Visa Guide", item: "https://earthvisa.in/guide/transit-visa" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

function Chevron({ toggle = false }: { toggle?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-3.5 shrink-0 text-ink-mute transition-transform duration-200 ${
        toggle ? "group-open/toggle:rotate-180" : "group-open:rotate-180"
      }`}
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

function feeLabel(feeUsd: number | null): string {
  if (feeUsd == null) return "fee not published";
  if (feeUsd === 0) return "free";
  return `~$${feeUsd}`;
}

function TransitTile({ e }: { e: TransitEntry }) {
  const slug = nameToSlug(e.name);
  const bits: string[] = [feeLabel(e.feeUsd)];
  if (e.maxStayDays != null) bits.push(`≤ ${e.maxStayDays}d stay`);
  if (e.online) bits.push("online");
  if (e.onArrival) bits.push("on arrival");
  return (
    <Link
      href={`/destination/${slug}`}
      className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
    >
      <span className="text-xl">{flagFor(e.iso3)}</span>
      <div className="min-w-0">
        <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
          {e.name}
        </span>
        <div className="mono text-[11px] text-ink-mute">{bits.join(" · ")}</div>
      </div>
      <span aria-hidden className="mono ml-auto shrink-0 text-ink-mute transition group-hover:text-stamp">
        →
      </span>
    </Link>
  );
}

export default function TransitVisaGuidePage() {
  const shown = transitEntries.slice(0, 15);
  const rest = transitEntries.slice(15);

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
              <Link href="/guide" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Guides</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Transit Visa</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">✈️</span>
                Transit Visa Guide 2026
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  Do You Need One Just to Change Planes?
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Airside transit vs landside transit · nationality + country specific
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Destinations tracked", v: String(destinationCount) },
                { k: "Publish an official fee", v: String(withFee) },
                { k: "Offer online application", v: String(withOnline) },
                { k: "Issue on arrival", v: String(withOnArrival) },
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
              A <strong className="text-ink">transit visa</strong> is for passing through a country to reach an onward
              destination - not for visiting it. Shorter permitted stay, narrower purpose, and often an easier route
              than entering as a visitor.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              Jump to{" "}
              <Link href="#direct-vs-indirect" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                airside vs landside transit
              </Link>
              , why it depends on{" "}
              <Link href="#nationality-and-country" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                your passport and the transit country
              </Link>
              , or the{" "}
              <Link href="#checklist" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                pre-booking checklist
              </Link>
              .
            </p>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Rules are set per destination and per nationality - check a specific corridor with{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Earth Visa&apos;s passport checker
              </Link>
              . Data below last refreshed {lastUpdated}.
            </p>
          </section>

          {/* Direct vs indirect */}
          <section id="direct-vs-indirect" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">
              Direct (Airside) Transit vs Indirect (Landside) Transit
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-sm border border-vfree/30 bg-vfree/[0.05] p-4">
                <p className="mono text-[11px] font-semibold uppercase tracking-[0.15em] text-vfree">
                  Direct / airside transit
                </p>
                <p className="text-body mt-2 max-w-3xl text-ink-soft">
                  Same airport, same day, through-checked, entirely inside the international transit area - you never
                  cross immigration. Most countries treat this leniently: it very often needs nothing at all,
                  whatever your nationality, if the connection time and routing qualify.
                </p>
              </div>
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.05] p-4">
                <p className="mono text-[11px] font-semibold uppercase tracking-[0.15em] text-stamp">
                  Indirect / landside transit
                </p>
                <p className="text-body mt-2 max-w-3xl text-ink-soft">
                  An overnight layover, an airport or terminal change that requires clearing immigration, or leaving
                  the airport at all - even just to collect and recheck your own baggage. Treated much like a normal
                  entry, and can require a visa exactly as a tourist visit would.
                </p>
              </div>
            </div>
            <p className="text-body mt-4 text-ink-soft">
              The dividing line is border control, not the clock: a nine-hour airside layover can need nothing while a
              two-hour landside stop needs a full visa.
            </p>
          </section>

          {/* Nationality + country */}
          <section id="nationality-and-country" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">
              It Depends on Your Passport AND the Transit Country
            </h2>
            <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink-soft">
              <li>· Rules are set per destination and applied per nationality - there is no global standard.</li>
              <li>· The transit-exempt list and the entry-exempt list are different lists; either can be broader.</li>
              <li>· So never infer from tourist-visa status, or from what another country requires on the same route.</li>
            </ul>
          </section>

          {/* By destination - dataset derived */}
          <section id="destinations" className="mt-12">
            <h2 className="text-section text-ink">
              Transit Visa Products by Destination ({destinationCount})
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              What each destination publishes for travellers who do need a transit visa - not who is exempt. Tap one
              for its passport-by-passport requirements.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => (
                <TransitTile key={e.iso3} e={e} />
              ))}
            </div>
            {rest.length > 0 && (
              <details className="group/toggle mt-2.5">
                <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span className="group-open/toggle:hidden">Show all {transitEntries.length}</span>
                  <span className="hidden group-open/toggle:inline">Show fewer</span>
                  <Chevron toggle />
                </summary>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((e) => (
                    <TransitTile key={e.iso3} e={e} />
                  ))}
                </div>
              </details>
            )}
          </section>

          {/* Checklist */}
          <section id="checklist" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="text-section text-ink">Before You Book: A Transit Checklist</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: "Check your layover length",
                  d: "A short same-day connection is far more likely to qualify as airside transit than an overnight one. Some countries set a maximum transit time beyond which you are no longer in transit at all.",
                },
                {
                  t: "Check whether you change terminals or airports",
                  d: "Staying inside one terminal's international area is treated differently from exiting security, collecting baggage, or crossing the city to another airport - the latter usually means clearing immigration.",
                },
                {
                  t: "Look for a published transit-visa-exempt nationality list",
                  d: "Separate from the tourist-visa-exempt list. Check the transit country's own immigration or embassy site for your passport.",
                },
                {
                  t: "Confirm it for every leg of a multi-stop itinerary",
                  d: "Each transit country's rules apply independently - clearing one leg visa-free tells you nothing about the next.",
                },
                {
                  t: "Check before booking, not at check-in",
                  d: "Exemption lists change, and airlines deny boarding when a required transit visa is missing. Confirm while the itinerary is still flexible.",
                },
              ].map((s, i) => (
                <li key={s.t} className="card-doc flex gap-4 p-4">
                  <span className="mono text-lg font-semibold tabular-nums text-stamp">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">{s.t}</h3>
                    <p className="text-body mt-1 text-ink-soft">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-body mt-4 text-ink-soft">
              The{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Earth Visa passport checker
              </Link>{" "}
              has a transit-access view showing which destinations a given passport can transit without a visa.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Transit Visa FAQ</h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {FAQS.map(({ q, a }) => (
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

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">Check transit visa access for your passport</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Visa-free, on arrival, or a visa in advance - for any transit country.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check for your passport →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
