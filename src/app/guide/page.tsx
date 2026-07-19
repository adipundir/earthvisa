import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameToSlug } from "@/lib/dataset";
import { DEMONYM, TOP_NATIONALITIES } from "@/lib/corridors";

// Index for every /guide/* route, so the bare /guide prefix resolves (it used
// to 404 while nine child routes lived beneath it) and each guide has one more
// crawlable inbound link. Must list every static guide route (mirrors
// GUIDE_PAGES in src/app/sitemap.ts).
const GUIDES: { href: string; title: string; desc: string }[] = [
  {
    href: "/guide/schengen",
    title: "Schengen Visa",
    desc: "Requirements, the countries list, fees and the 90/180-day rule - plus per-nationality application guides.",
  },
  {
    href: "/guide/etias",
    title: "ETIAS",
    desc: "The EU's upcoming travel authorisation: what it is, who needs it, and why it is not a visa.",
  },
  {
    href: "/guide/visa-types",
    title: "Visa Types Explained",
    desc: "Visa-free vs visa on arrival vs eTA vs e-Visa - one plain-language definition for every access level.",
  },
  {
    href: "/guide/transit-visa",
    title: "Transit Visas",
    desc: "Do you need one for a layover? Airside vs landside, and each destination's published transit products.",
  },
  {
    href: "/guide/proof-of-funds",
    title: "Proof of Funds",
    desc: "How much bank balance visa officers expect to see, and how to document it.",
  },
  {
    href: "/guide/umrah-visa",
    title: "Umrah Visa",
    desc: "Nusuk, tourist-visa routes and Umrah entry requirements by nationality.",
  },
  {
    href: "/guide/gcc-visa",
    title: "GCC Unified Visa",
    desc: "The Grand Tours visa's status and the Gulf entry rules that apply today.",
  },
  {
    href: "/guide/japan-visa-fee-increase-2026",
    title: "Japan Visa Fee Increase 2026",
    desc: "Japan's first fee revision since 1978, effective 1 July 2026: old vs new fees and who is exempt.",
  },
  {
    href: "/guide/thailand-visa-changes-2026",
    title: "Thailand Visa Changes 2026",
    desc: "The 60-day visa-free stay is being replaced by 30- and 15-day tiers - approved but not yet in force. Who lands where.",
  },
];

// Highest-demand per-nationality Schengen guides surfaced directly; the full
// set stays reachable from the Schengen hub.
const SCHENGEN_NATS = ["IND", "PAK", "PHL", "NGA", "BGD", "IDN", "VNM", "EGY", "ZAF", "CHN"].filter((iso3) =>
  TOP_NATIONALITIES.includes(iso3),
);

const TITLE = "Visa Guides: Schengen, ETIAS, Visa Types, Transit & More | Earth Visa";
const DESCRIPTION =
  "Every Earth Visa guide in one place: Schengen visas by nationality, ETIAS, visa types explained, transit visas, proof of funds, Umrah and Gulf entry rules - all from official sources.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/guide" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://earthvisa.in/guide" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Guides", item: "https://earthvisa.in/guide" },
      ],
    },
  ],
};

export default function GuideIndexPage() {
  const schengenLinks = SCHENGEN_NATS.flatMap((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    return c ? [{ iso3, name: c.name, adj: DEMONYM[iso3] ?? c.name, slug: nameToSlug(c.name) }] : [];
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        <header className="bg-grid-paper border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Guides</span>
            </nav>


            <h1 className="text-display mt-6 text-ink">
              Visa Guides
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Schengen, ETIAS, Visa Types, Transit &amp; More
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {GUIDES.length} guides · official sources only
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <section className="mt-10">
            <h2 className="text-section text-ink">All Guides</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              The concepts and processes behind the per-country data: how each visa system works, what officers ask
              for, and what recent rule changes mean.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {GUIDES.map((g) => (
                <li key={g.href}>
                  <Link
                    href={g.href}
                    className="card-doc group flex h-full min-h-[44px] flex-col justify-center px-4 py-3.5"
                  >
                    <span className="font-display text-[15px] font-semibold text-ink transition group-hover:text-stamp">
                      {g.title} →
                    </span>
                    <span className="mt-1 text-[13px] leading-relaxed text-ink-soft">{g.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-section text-ink">Schengen Visa Guides by Nationality</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Fees, documents and appointment steps for the most-searched applicant nationalities - the{" "}
              <Link href="/guide/schengen" className="font-medium text-stamp underline-offset-2 hover:underline">
                Schengen hub
              </Link>{" "}
              covers every other passport.
            </p>
            <ul className="card-doc mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
              {schengenLinks.map((l) => (
                <li key={l.iso3} className="border-t border-line first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0">
                  <Link
                    href={`/guide/schengen/${l.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5 py-1.5 transition hover:bg-paper-2/50"
                  >
                    <span className="text-lg leading-none">{flagFor(l.iso3)}</span>
                    <span className="min-w-0 flex-1 font-display text-[15px] font-medium text-ink transition group-hover:text-stamp">
                      Schengen visa for {l.adj} citizens
                    </span>
                    <span aria-hidden className="mono shrink-0 text-ink-mute transition group-hover:text-stamp">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Looking for a specific passport or destination?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Guides explain the system - the exact rule for your trip depends on your passport and destination.
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
