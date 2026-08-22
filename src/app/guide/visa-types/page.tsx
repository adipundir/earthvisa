import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/dataset";

// ---------------------------------------------------------------------------
// Data (a handful of grounded counts used sparingly - this page is fundamentally
// a plain-language glossary, not a data-driven listing)
// ---------------------------------------------------------------------------

const lastUpdated = dataset.meta.lastUpdated;
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
    a: "An eTA is a pre-screening step on an entry you already have visa-free; an e-visa is a full visa, delivered online, for travellers who'd need one anyway.",
  },
  {
    q: "Is a visa on arrival the same as visa-free?",
    a: "No - visa on arrival still means a fee and a counter at the border, while visa-free means neither.",
  },
  {
    q: "Does freedom of movement mean I don't need any documents?",
    a: "No - you still need a valid passport or national ID, and depending on the bloc you may need to register your residence if you stay long-term.",
  },
  {
    q: "Do I need a transit visa if I'm just changing planes?",
    a: "It depends on the country and the airport: staying airside often needs nothing, going landside can require one depending on your nationality and layover length.",
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
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">
                Earth Visa
              </Link>
              <span aria-hidden>/</span>
              <Link href="/guide" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Guides</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Visa Types</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Visa Types &amp; Access Levels, Explained
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                The Plain-Language Glossary Behind Every Badge on Earth Visa
              </span>
            </h1>
            <p className="mt-3 text-[13px] font-medium tabular-nums text-ink-soft">
              {CONCEPTS.length} concepts, defined once · refreshed {lastUpdated}
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              What every access-level badge on Earth Visa actually means - <strong className="text-ink">Visa-Free</strong>,{" "}
              <strong className="text-ink">Visa on Arrival</strong>, <strong className="text-ink">eTA</strong>,{" "}
              <strong className="text-ink">e-Visa</strong>, <strong className="text-ink">Visa Required</strong>,{" "}
              <strong className="text-ink">Freedom of Movement</strong>. For what applies to you, check a specific{" "}
              <Link href="/visit" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport and destination pair</Link>{" "}
              or browse the{" "}
              <Link href="/passport" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">passport index</Link>.
            </p>

            {/* Jump nav */}
            <nav aria-label="Jump to a concept" className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-medium">
              {CONCEPTS.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="inline-flex min-h-[36px] items-center gap-1.5 text-ink-soft transition hover:text-ink"
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[c.tone]}`} />
                  {c.label}
                </a>
              ))}
            </nav>
          </section>

          {/* The three-way comparison the title promises, answered up front;
              the per-concept sections below go deeper on each column. */}
          <section className="mt-12 max-w-3xl">
            <h2 id="comparison" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
              Visa-Free vs Visa on Arrival vs eTA vs e-Visa: The Difference
            </h2>
            <p className="text-body mt-3 text-ink-soft">
              All four mean you skip the embassy. What differs is whether a visa is issued, where, and whether you must
              apply before flying.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="mono-chrome border-b border-line-strong text-left">
                    <th scope="col" className="py-2.5 pr-4 font-medium">Question</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium text-vfree">Visa-Free</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">Visa on Arrival</th>
                    <th scope="col" className="py-2.5 pr-4 font-medium">eTA</th>
                    <th scope="col" className="py-2.5 font-medium">e-Visa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink-soft">
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Is a visa issued?</td>
                    <td className="py-2.5 pr-4">No</td>
                    <td className="py-2.5 pr-4">Yes - at the border</td>
                    <td className="py-2.5 pr-4">No - a pre-screening</td>
                    <td className="py-2.5">Yes - a full visa, digital</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Where it happens</td>
                    <td className="py-2.5 pr-4">Nowhere - just your passport</td>
                    <td className="py-2.5 pr-4">A counter at the airport or land border</td>
                    <td className="py-2.5 pr-4">Online, linked to your passport</td>
                    <td className="py-2.5">Online application portal</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Apply before flying?</td>
                    <td className="py-2.5 pr-4">No</td>
                    <td className="py-2.5 pr-4">No - but bring the fee and documents</td>
                    <td className="py-2.5 pr-4">Yes</td>
                    <td className="py-2.5">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-display font-medium text-ink">Typical cost</td>
                    <td className="py-2.5 pr-4">Free</td>
                    <td className="py-2.5 pr-4">A fee paid in person at the border</td>
                    <td className="py-2.5 pr-4">Free or a small online fee</td>
                    <td className="py-2.5">A visa fee paid online</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-body mt-3 text-ink-soft">
              Which column applies is nationality-specific: the same destination can sit in a different one for every
              passport.
            </p>
          </section>

          {/* Visa-Free */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="visa-free" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Visa-Free
              </h2>
              <ConceptTag tone="vfree">Access level</ConceptTag>
            </div>
            <p className="text-body mt-3 text-ink-soft">
              The simplest entry there is: show up with a valid passport and cross the border. No application, no fee,
              nothing to prepare in advance - though an officer may still ask to see a return ticket or proof of funds.
              You get a stamp (or, inside a shared-border zone, nothing at all) authorising a stay length the destination
              sets. It is nationality-specific: the same destination can be visa-free for one passport and require a full
              visa for another - check a pair on the{" "}
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
            <p className="text-body mt-3 text-ink-soft">
              You file nothing before you fly, but this is{" "}
              <strong className="text-ink">not the same as visa-free</strong>: you queue at a dedicated counter, pay a
              fee in person (commonly cash, sometimes card), and receive a visa sticker or stamp at the airport or land
              border. The officer can still ask for a return ticket, hotel booking or proof of funds first, and the fee,
              accepted currency and required documents are set per destination - so check the specific requirement
              rather than assuming a flat rule.
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
            <p className="text-body mt-3 text-ink-soft">
              An eTA is <strong className="text-ink">not a visa</strong>: it&apos;s a security pre-screening layered on
              top of an entry you already qualify for visa-free. You apply online before travelling, usually get an
              automated approval within minutes to a few days, and it is linked electronically to your passport number -
              no document to print, no sticker, no embassy visit. Kenya&apos;s eTA, Australia&apos;s ETA, Canada&apos;s
              eTA, the UK&apos;s ETA and the United States&apos; ESTA all work this way. The EU&apos;s version is{" "}
              <Link href="/guide/etias" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                ETIAS
              </Link>
              , applied across the Schengen Area.
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
            <p className="text-body mt-3 text-ink-soft">
              An e-visa <strong className="text-ink">is</strong> an actual visa, just applied for and issued online
              instead of at an embassy. You fill out a form, upload scanned documents (photo, passport bio page,
              sometimes a hotel booking or return ticket), pay online, and receive an approval letter or electronic
              record tied to your passport. It replaces the embassy visit, not the visa requirement.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              The distinction from an eTA: an eTA is pre-screening for travellers who are already visa-exempt; an
              e-visa is the visa itself, for travellers who would need one anyway. Australia runs both - its ETA for
              visa-exempt passports, its eVisitor / e-Visa for the rest.
            </p>
          </section>

          {/* Visa Required */}
          <section className="mt-12 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="visa-required" className="scroll-mt-24 font-display text-2xl font-semibold text-ink">
                Visa Required
              </h2>
              <ConceptTag tone="neutral">Traditional visa</ConceptTag>
            </div>
            <p className="text-body mt-3 text-ink-soft">
              Everything else: you apply in advance at an embassy, consulate, or an authorised application centre such
              as VFS Global, TLScontact or BLS International. You complete a form, assemble supporting documents
              (passport, photos, proof of funds, travel and accommodation details, sometimes an invitation letter), and
              often attend an appointment for biometrics. Processing runs from days to months depending on the
              destination and your nationality. No single fee, document list or timeline applies everywhere - check
              your own corridor on the{" "}
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
            <p className="text-body mt-3 text-ink-soft">
              A broader right than visa-free entry: the right to live, work and reside in another country, not just
              visit it. It comes from membership of a shared legal union rather than a bilateral visa waiver - most
              clearly the <strong className="text-ink">European Union</strong>, whose {euMemberCount} member states&apos;
              citizens can move to, work in and reside in any other member state.
            </p>
            <p className="text-body mt-3 text-ink-soft">
              Not the same as Schengen, which is about crossing internal borders without passport checks for short
              stays. They overlap but don&apos;t match: Ireland is in the EU but outside Schengen. See the{" "}
              <Link href="/guide/schengen" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Schengen guide
              </Link>{" "}
              for how the travel side works.
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
            <p className="text-body mt-3 text-ink-soft">
              For passing through a country on the way somewhere else. Stay{" "}
              <strong className="text-ink">airside</strong> - inside the international transit zone, never clearing
              immigration - and many countries require no transit visa at all, whatever your nationality, because you
              never legally enter. Go <strong className="text-ink">landside</strong> to leave the airport, collect
              checked luggage or change terminals outside the secure zone, and some countries require one depending on
              your nationality and layover length, while others still let you through visa-free. It varies by airport
              as well as by country, so check your exact routing before booking - and see the{" "}
              <Link href="/guide/transit-visa" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                transit visa guide
              </Link>{" "}
              for the products each destination publishes.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Visa Types FAQ</h2>
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
            <h2 className="text-section text-ink">
              Now check what actually applies to your passport
            </h2>
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
