import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/dataset";

// ---------------------------------------------------------------------------
// Data (a handful of grounded counts used sparingly - this page is fundamentally
// a plain-language glossary, not a data-driven listing)
// ---------------------------------------------------------------------------

const lastUpdated = dataset.meta.lastUpdated;
const passportCount = dataset.allCountries.length;
const destinationCount = dataset.meta.destinationsWithVisaPolicy;
const euMemberCount = dataset.groups.EU?.length ?? 0;

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

const TITLE = "Visa Types Explained 2026: Visa-Free vs Visa on Arrival vs eTA vs e-Visa";
const DESCRIPTION =
  "What visa-free, visa on arrival, eTA, e-visa, visa required, freedom of movement and transit visa actually mean, and how they differ from each other. The plain-language reference behind every access-level badge on Earth Visa.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "visa types explained",
    "types of visa",
    "eta vs evisa",
    "difference between eta and e visa",
    "what is an eta",
    "what is an evisa",
    "what is an e visa",
    "visa on arrival vs visa free",
    "freedom of movement meaning",
    "what is a transit visa",
    "visa required meaning",
    "electronic travel authorization explained",
    "visa glossary",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/visa-types" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://earthvisa.in/guide/visa-types",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

type Tone = "vfree" | "voa" | "eta" | "evisa" | "neutral" | "bloc" | "stamp";

const TONE_CLASSES: Record<Tone, string> = {
  vfree: "text-vfree bg-vfree/10 ring-vfree/30",
  voa: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  evisa: "text-evisa bg-evisa/10 ring-evisa/30",
  neutral: "text-ink-soft bg-paper-3 ring-line-strong",
  bloc: "text-bloc bg-bloc/10 ring-bloc/30",
  stamp: "text-stamp bg-stamp/10 ring-stamp/30",
};
const TONE_DOT: Record<Tone, string> = {
  vfree: "bg-vfree",
  voa: "bg-voa",
  eta: "bg-eta",
  evisa: "bg-evisa",
  neutral: "bg-ink-mute",
  bloc: "bg-bloc",
  stamp: "bg-stamp",
};

const CONCEPTS: { id: string; label: string; tone: Tone; tag: string }[] = [
  { id: "visa-free", label: "Visa-Free", tone: "vfree", tag: "Access level" },
  { id: "visa-on-arrival", label: "Visa on Arrival", tone: "voa", tag: "Access level" },
  { id: "eta", label: "eTA", tone: "eta", tag: "Pre-screening, not a visa" },
  { id: "e-visa", label: "e-Visa", tone: "evisa", tag: "A real visa, issued online" },
  { id: "visa-required", label: "Visa Required", tone: "neutral", tag: "Traditional visa" },
  { id: "freedom-of-movement", label: "Freedom of Movement", tone: "bloc", tag: "Beyond visa-free" },
  { id: "transit", label: "Transit Visa", tone: "stamp", tag: "Depends on routing" },
];

function ConceptTag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`mono inline-flex items-center rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

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

const FAQS = [
  {
    q: "What's the difference between an eTA and an e-visa?",
    a: "An eTA is not a visa: it's an online pre-screening check layered on top of an entry you already qualify for visa-free or under a visa-waiver arrangement. An e-visa is an actual visa - the full entry permit a destination would otherwise require in person at an embassy - just applied for and issued online instead. If your passport is already visa-exempt for a country, an eTA (where one is required) is what you file. If your passport would need a visa anyway, an e-visa is that same visa, simply delivered digitally.",
  },
  {
    q: "Is a visa on arrival the same as visa-free?",
    a: "No. Visa-free means you walk through immigration with just your passport - no fee, no counter, no advance paperwork. Visa on arrival also requires no advance application, but you queue at a dedicated counter at the airport or land border, pay a fee in person, and get a stamp or sticker issued there and then. The two get confused because neither one requires applying before you fly, but only one of them is actually free and counter-free.",
  },
  {
    q: "Does freedom of movement mean I don't need any documents?",
    a: "No - you still need a valid passport or national ID, and depending on the bloc you may need to register your residence after arriving if you plan to stay long-term. What freedom of movement removes is the visa requirement and the short-stay time limit: it grants the right to live, work and reside, not just to visit, for as long as you remain a citizen of a member state.",
  },
  {
    q: "Do I need a transit visa if I'm just changing planes?",
    a: "It depends on the country, the specific airport, and whether you stay airside. If you remain inside the international transit zone without clearing immigration, many countries require no visa at all, regardless of nationality. If you have to go landside - to clear immigration, collect checked luggage, or change airports or terminals outside the secure zone - some countries then require a transit visa depending on your nationality and layover length, while others still allow it visa-free. Always check the rule for your exact routing rather than assuming transit is automatically visa-free.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Guide" },
        {
          "@type": "ListItem",
          position: 3,
          name: "Visa Types Glossary",
          item: "https://earthvisa.in/guide/visa-types",
        },
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

export default function VisaTypesGlossaryPage() {
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Visa Types</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Visa Types &amp; Access Levels, Explained
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                The Plain-Language Glossary Behind Every Badge on Earth Visa
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {CONCEPTS.length} concepts, defined once · data refreshed {lastUpdated}
            </p>

            <dl className="mono mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-4 text-ink sm:grid-cols-4">
              {[
                { k: "Concepts explained", v: String(CONCEPTS.length) },
                { k: "Passports tracked", v: String(passportCount) },
                { k: "Destinations tracked", v: String(destinationCount) },
                { k: "Last refreshed", v: lastUpdated },
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
              Every passport and destination page on Earth Visa shows one of a handful of status badges -{" "}
              <strong className="text-ink">Visa-Free</strong>, <strong className="text-ink">Visa on Arrival</strong>,{" "}
              <strong className="text-ink">eTA</strong>, <strong className="text-ink">e-Visa</strong>,{" "}
              <strong className="text-ink">Visa Required</strong>, <strong className="text-ink">Freedom of Movement</strong> - but
              a corridor page only ever tells you what applies to your specific passport and destination, never what
              the term itself means. This page is that missing reference: one plain-language definition for every
              access level and visa concept used across the site, so you know exactly what you&apos;re looking at
              wherever you land.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              This is a definitional guide, not a per-country listing - for what actually applies to you, check a
              specific <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport and destination pair</Link>{" "}
              or browse the <Link href="/passport" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport index</Link>.
            </p>

            {/* Jump nav */}
            <nav aria-label="Jump to a concept" className="mt-6 flex flex-wrap gap-2">
              {CONCEPTS.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="mono inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft transition hover:border-line-strong hover:text-ink"
                >
                  <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[c.tone]}`} />
                  {c.label}
                </a>
              ))}
            </nav>
          </section>

          {/* Visa-Free */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="visa-free" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Visa-Free
              </h2>
              <ConceptTag tone="vfree">Access level</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Visa-free access is the simplest entry there is: show up with a valid passport and cross the border.
              There is no application to file, no fee to pay, and nothing to prepare in advance beyond the passport
              itself (an officer may still ask, at their discretion, to see a return ticket or proof of funds).
              You&apos;ll typically get a stamp in your passport - or, inside a shared-border zone, nothing at all -
              authorising a permitted stay length set entirely by the destination.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Visa-free access is nationality-specific: the same destination can be visa-free for one passport and
              require a full visa for another. See any passport&apos;s full visa-free list on its own page, or check a
              specific pair on our{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                visa requirement tool
              </Link>
              .
            </p>
          </section>

          {/* Visa on Arrival */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="visa-on-arrival" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Visa on Arrival
              </h2>
              <ConceptTag tone="voa">Access level</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Visa on arrival looks similar to visa-free from the outside - you don&apos;t file anything before you
              fly - but it is a materially different process. Instead of walking straight through immigration, you
              queue at a dedicated visa-on-arrival counter, pay a fee in person (commonly cash, sometimes card), and
              receive a visa sticker or stamp issued right there at the airport or land border.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              It is <strong className="text-ink">not the same as visa-free</strong>: there is a fee, there is a
              counter process, and the officer issuing it can still ask for a return ticket, a hotel booking, or
              proof of funds first. Because it happens in person, the exact fee, accepted currency and required
              documents are set by that country&apos;s immigration authority and vary by destination - always check
              the specific requirement for your passport and destination rather than assuming a flat rule.
            </p>
          </section>

          {/* eTA */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="eta" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                eTA / Electronic Travel Authorisation
              </h2>
              <ConceptTag tone="eta">Pre-screening, not a visa</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              An eTA is <strong className="text-ink">not a visa</strong>. It&apos;s a security pre-screening step
              layered on top of an entry you already qualify for visa-free or under a visa-waiver arrangement. You
              apply online before you travel, usually get an automated approval within minutes to a few days, and the
              authorisation is linked electronically to your passport number - there is no physical document to
              print, no sticker, and no embassy visit required.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              In Earth Visa&apos;s data, Kenya&apos;s official tourist entry requirement is literally named the
              &quot;Electronic Travel Authorisation (eTA)&quot;, and destinations that run this kind of pre-screening
              for at least one nationality also include Australia&apos;s ETA, Canada&apos;s eTA, the United
              Kingdom&apos;s ETA and the United States&apos; ESTA - all pre-screening layers on top of an existing
              visa-exempt entry, not full visas. See our{" "}
              <Link href="/guide/etias" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                ETIAS guide
              </Link>{" "}
              for the EU&apos;s version of this same idea, applied across the Schengen Area.
            </p>
          </section>

          {/* e-Visa */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="e-visa" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                e-Visa
              </h2>
              <ConceptTag tone="evisa">A real visa, issued online</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              An e-visa <strong className="text-ink">is</strong> an actual visa - a genuine entry permit - just
              applied for and issued online instead of in person at an embassy or consulate. You fill out a form,
              upload scanned documents (photo, passport bio page, sometimes a hotel booking or return ticket), pay a
              fee online, and receive an approval letter or an electronic record tied to your passport instead of a
              stamp obtained face-to-face. It replaces the embassy visit and the physical sticker, but it does not
              replace the visa requirement itself: if you would otherwise need a visa to enter, an e-visa is still a
              visa - simply a digital one.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              This is the key distinction from an eTA: an eTA is a pre-screening step on top of entry you already had
              visa-free; an e-visa is the actual visa, for travellers who would need one anyway, delivered without a
              passport-stamp appointment. In Earth Visa&apos;s data, destinations issuing e-visas include
              India&apos;s e-Tourist Visa (eTV), Turkey&apos;s e-Visa and Vietnam&apos;s E-Visa. Australia is a useful
              illustration that the two tracks are genuinely different even within one country: some nationalities
              travelling there use its ETA (a pre-screening waiver), while others must obtain its eVisitor or general
              e-Visa (an actual visa) - same destination, two different mechanisms, depending on passport.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-ink">eTA vs e-Visa, at a Glance</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="mono border-b border-line-strong text-left text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      Question
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">
                      eTA
                    </th>
                    <th scope="col" className="py-2.5 font-medium">
                      e-Visa
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-soft">
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Is it a visa?</td>
                    <td className="py-2.5 pr-4">No - a pre-screening layer</td>
                    <td className="py-2.5">Yes - a full visa, just digital</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Who needs to file it</td>
                    <td className="py-2.5 pr-4">Travellers already visa-exempt</td>
                    <td className="py-2.5">Travellers who&apos;d otherwise need a visa</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Where you apply</td>
                    <td className="py-2.5 pr-4">Online, before travel</td>
                    <td className="py-2.5">Online, before travel</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">What you receive</td>
                    <td className="py-2.5 pr-4">An electronic record linked to your passport</td>
                    <td className="py-2.5">An approval letter / electronic visa record</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Visa Required */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="visa-required" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Visa Required
              </h2>
              <ConceptTag tone="neutral">Traditional visa</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              For most passport-and-destination combinations that don&apos;t fall under any of the above, you need a
              traditional visa: you must apply in advance, before you travel, at an embassy, a consulate, or an
              authorised visa application centre such as VFS Global, TLScontact or BLS International acting on the
              destination&apos;s behalf. The general shape of the process is consistent even though the specifics
              vary enormously - you complete an application form, assemble supporting documents (passport, photos,
              proof of funds, travel and accommodation details, sometimes an invitation letter), and in many cases
              attend an in-person appointment to submit biometrics (fingerprints and a photo).
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              A consulate then takes a published or typical processing time to reach a decision - it can be days or
              it can be months, depending entirely on the destination and, often, on your specific nationality. There
              is no single fee, document list or timeline that applies across every destination requiring a visa -
              see the specific corridor page for your passport and destination for what actually applies, or start
              from our{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                visa requirement tool
              </Link>
              .
            </p>
          </section>

          {/* Freedom of Movement */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="freedom-of-movement" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Freedom of Movement
              </h2>
              <ConceptTag tone="bloc">Beyond visa-free</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Freedom of movement is a broader right than visa-free entry: it is the right to live, work and reside
              in another country, not just visit it temporarily. It doesn&apos;t come from a bilateral visa-waiver
              arrangement between two governments - it comes from membership in a shared legal union or bloc that
              both countries belong to. The clearest real-world example is the{" "}
              <strong className="text-ink">European Union</strong>: citizens of its {euMemberCount} member states can
              move to, work in, and reside in any other member state, a right that goes well beyond the short tourist
              stays that ordinary visa-free travel allows.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Freedom of movement and Schengen are related but not the same thing: Schengen is about crossing internal
              European borders without passport checks for short stays, while EU freedom of movement is about the
              right to relocate and work long-term. The two overlap heavily but don&apos;t perfectly match - Ireland,
              for instance, is in the EU (so Irish citizens have freedom of movement) but outside Schengen. See our{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen guide
              </Link>{" "}
              for how the travel side works in practice.
            </p>
          </section>

          {/* Transit Visa */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="transit" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Transit Visa
              </h2>
              <ConceptTag tone="stamp">Depends on routing</ConceptTag>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              A transit visa is for passing through a country on the way to a final destination, not for a normal
              visit - and whether you need one depends heavily on the specific country, the airport, and how you are
              transiting.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              If you stay <strong className="text-ink">airside</strong> - inside the international transit zone of
              an airport, on the same trip, without going through immigration - many countries require no transit
              visa at all, regardless of nationality, because you never legally enter the country. The moment you go{" "}
              <strong className="text-ink">landside</strong> - clearing immigration to leave the airport, collect
              checked luggage, or change airports or terminals outside the secure zone - the rules change: some
              countries then require a transit visa depending on your nationality and how long your layover is, while
              others still let you through visa-free or issue one on arrival for the stopover.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Because this varies so much by destination - and even by which specific airport you are routed through -
              there is no single rule that covers every case. Always check the transit requirement for your exact
              routing and nationality before booking a connection that leaves the international zone. For the
              transit visa products published by each destination in our data, see our dedicated{" "}
              <Link href="/guide/transit-visa" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                transit visa guide
              </Link>
              .
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="font-display text-2xl font-semibold text-ink">Visa Types FAQ</h2>
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
            <h2 className="font-display text-xl font-semibold text-ink">
              Now check what actually applies to your passport
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Definitions are a start - the real answer depends on your passport and destination. Use Earth Visa to
              see the exact access level for any pair, in seconds.
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
