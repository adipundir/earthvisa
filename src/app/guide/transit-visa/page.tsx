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
  keywords: [
    "transit visa",
    "transit visa requirements",
    "do i need a transit visa",
    "airport transit visa",
    "direct transit vs indirect transit",
    "transit visa exempt countries",
    "layover visa",
    "connecting flight visa requirements",
    "landside transit visa",
    "airside transit",
    "transit visa 2026",
    "does a layover need a visa",
  ],
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
    a: "Very often no - this is called direct or airside transit, where you land and depart from the same airport on the same booking without crossing border control into the country. Many countries let travellers of most or all nationalities transit airside without any visa, provided the connection is on the same day (or within a set number of hours) and the traveller stays within the international transit area. But this is not universal: some countries still require even airside transit passengers of certain nationalities to hold a visa, so it must be checked for your specific passport and airport, not assumed.",
  },
  {
    q: "Does a layover under 24 hours need a visa?",
    a: "Not necessarily, but layover length alone doesn't decide it. A short layover through the same airport, on the same ticket, without leaving the international transit area, is the scenario countries are most likely to exempt from a visa. A short layover that still involves changing airports or terminals outside security, or collecting and re-checking your own baggage through border control, is often treated as a normal entry regardless of how many hours it lasts - and can require a visa the same as staying for tourism.",
  },
  {
    q: "What's the difference between direct and indirect transit?",
    a: "Direct (airside) transit means staying within the international transit area of the same airport, on a through-checked itinerary, usually same-day - you never legally enter the country. Indirect (landside) transit means passing through immigration and border control at all: an overnight layover, a change of airport or terminal that requires re-entry through security, or collecting your luggage and rechecking it yourself. Indirect transit is treated much more like a normal entry, and countries are far more likely to require a visa for it, even when the same nationality would transit airside visa-free.",
  },
  {
    q: "Can transit visa rules differ from that country's regular tourist visa rules for the same passport?",
    a: "Yes - transit and entry are governed by separate rules, and a country's transit-visa-exempt nationality list is often broader (or narrower) than its tourist-visa-exempt list. Never assume that being visa-exempt for tourism automatically means visa-exempt for transit, or vice versa.",
  },
  {
    q: "How do I check if I need a transit visa for a specific layover?",
    a: "Check three things before booking: the length of your layover, whether you change terminals or airports (and therefore pass through border control), and whether the transit country publishes a transit-visa-exempt nationality list that covers your passport. Airline check-in staff and the transit country's immigration or embassy website are the two most reliable places to confirm this for your specific nationality and routing.",
  },
  {
    q: "Is a transit visa the same as a visa on arrival?",
    a: "No. A visa on arrival is issued at the border for people who are actually entering and staying in the country. A transit visa is issued (sometimes also on arrival, sometimes only in advance) specifically for passengers continuing to another destination, and usually carries a shorter permitted stay and narrower conditions than a visa on arrival for tourism.",
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
      className="group flex min-h-[44px] items-center gap-3 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 transition hover:border-line-strong"
    >
      <span className="text-xl">{flagFor(e.iso3)}</span>
      <div className="min-w-0">
        <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
          {e.name}
        </span>
        <div className="mono text-[10px] text-ink-mute">{bits.join(" · ")}</div>
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
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center">Guide</span>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Transit Visa</span>
            </nav>

            <div className="rule-double" />

            <div className="mt-6">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
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
            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Destinations tracked", v: String(destinationCount) },
                { k: "Publish an official fee", v: String(withFee) },
                { k: "Offer online application", v: String(withOnline) },
                { k: "Issue on arrival", v: String(withOnArrival) },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-base leading-relaxed text-ink-soft">
              A <strong className="text-ink">transit visa</strong> is for travellers who are only passing through a
              country to reach a connecting flight or an onward destination - not for actually visiting it. It is a
              different product from a tourist visa: shorter permitted stay, a narrower purpose, and often (though
              not always) an easier or cheaper route than entering as a visitor.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              The most common source of confusion is that &quot;transit&quot; covers two very different situations -{" "}
              <Link href="#direct-vs-indirect" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                direct (airside) transit and indirect (landside) transit
              </Link>{" "}
              - and that whether you need a visa at all depends on{" "}
              <Link href="#nationality-and-country" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                both your passport and the specific transit country&apos;s rules
              </Link>
              , not a single global standard. This guide covers both, plus a{" "}
              <Link href="#checklist" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                practical checklist
              </Link>{" "}
              to run before you book a connecting itinerary.
            </p>
            <p className="mono mt-4 max-w-2xl rounded-sm border border-line bg-paper-2/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-mute">
              This page explains transit visas in general terms. Rules are set per destination and per nationality -
              use{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Earth Visa&apos;s passport checker
              </Link>{" "}
              to check a specific corridor. Data below last refreshed {lastUpdated}.
            </p>
          </section>

          {/* Direct vs indirect */}
          <section id="direct-vs-indirect" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Direct (Airside) Transit vs Indirect (Landside) Transit
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Whether a transit visa is required almost always turns on which of these two situations you are in:
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-sm border border-vfree/30 bg-vfree/[0.05] p-4">
                <p className="mono text-[10px] font-semibold uppercase tracking-[0.15em] text-vfree">
                  Direct / airside transit
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Same airport, same day, on a through-checked itinerary, staying entirely within the international
                  or &quot;airside&quot; transit area - you never cross immigration into the country. This is the
                  scenario most countries treat leniently: it very often needs nothing at all, regardless of
                  nationality, provided the connection time and routing qualify.
                </p>
              </div>
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.05] p-4">
                <p className="mono text-[10px] font-semibold uppercase tracking-[0.15em] text-stamp">
                  Indirect / landside transit
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Changing airports or terminals in a way that requires clearing immigration, an overnight layover,
                  or leaving the airport (going &quot;landside&quot;) for any reason - a hotel stay, a city visit, or
                  simply collecting and rechecking your own baggage. This is treated much more like a normal entry,
                  and can require a visa the same way a tourist visit would.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              The dividing line is border control, not the clock: a nine-hour airside layover can need nothing, while
              a two-hour landside stop can need a full visa - because one crosses into the country and the other
              doesn&apos;t.
            </p>
          </section>

          {/* Nationality + country */}
          <section id="nationality-and-country" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">
              It Depends on Your Passport AND the Transit Country
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              There is no universal transit-visa rule:
            </p>
            <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink-soft">
              <li>· Rules are set per destination and applied per nationality.</li>
              <li>
                · The transit-exempt list and the entry-exempt list are different lists - either one can be broader
                than the other.
              </li>
              <li>
                · So check your exact passport and transit country - never infer from tourist-visa status, or from
                what another country requires on the same route.
              </li>
            </ul>
          </section>

          {/* By destination - dataset derived */}
          <section id="destinations" className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Transit Visa Products by Destination ({destinationCount})
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
              This shows what each destination publishes for travellers who do need a transit visa - not who is
              exempt from one; tap a destination for its full passport-by-passport entry requirements.
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
            <h2 className="font-display text-2xl font-semibold text-ink">Before You Book: A Transit Checklist</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Run through this before booking a connecting itinerary, not after:
            </p>
            <ol className="mt-5 space-y-4">
              {[
                {
                  t: "Check your layover length",
                  d: "A short, same-day connection is far more likely to qualify as direct/airside transit than an overnight layover. Some countries also set a maximum transit time (for example a same-day cutoff) beyond which you're no longer treated as in transit at all.",
                },
                {
                  t: "Check whether you change terminals or airports",
                  d: "Connections that keep you within the same terminal's international area are treated differently from ones that require you to exit security, collect baggage, or transfer to a different airport across the city - the latter usually means clearing immigration.",
                },
                {
                  t: "Look for a published transit-visa-exempt nationality list",
                  d: "Many countries publish a list of nationalities exempt from a transit visa - separate from their tourist-visa-exempt list. Check the transit country's own immigration or embassy site for your specific passport, rather than assuming your tourist-visa status carries over.",
                },
                {
                  t: "Confirm the same for every leg of a multi-stop itinerary",
                  d: "If your route connects through more than one country, each transit country's rules apply independently - clearing one leg visa-free doesn't tell you anything about the next.",
                },
                {
                  t: "Check well before booking, not at check-in",
                  d: "Transit visa rules and exemption lists change, and airlines can deny boarding at check-in if you lack a required transit visa. Confirm requirements while your itinerary is still flexible enough to add a visa application or change routing.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-4 rounded-sm border border-line bg-paper-2/70 p-4">
                  <span className="mono text-lg font-semibold tabular-nums text-stamp">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">{s.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Tool pointer */}
          <section id="tool" className="mt-12 max-w-3xl scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold text-ink">Check Transit Access for Your Passport</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Earth Visa&apos;s interactive passport checker includes a dedicated transit-access view alongside its
              regular visa-free, visa-on-arrival, eTA and e-visa results, showing destinations a given passport can
              transit without a visa. Enter a passport on{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                the Earth Visa checker
              </Link>{" "}
              and open its transit view to see that specific corridor, rather than relying on a general rule.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Transit Visa FAQ</h2>
            <div className="mt-5 divide-y divide-line">
              {FAQS.map(({ q, a }) => (
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

          {/* CTA */}
          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">Check transit visa access for your passport</h2>
            <p className="mt-2 text-sm text-ink-soft">
              See whether your passport can transit a specific country visa-free, on arrival, or needs a visa in
              advance - and its full visa-free destination list while you&apos;re there.
            </p>
            <Link
              href="/visit"
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
