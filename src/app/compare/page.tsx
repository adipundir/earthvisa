import type { Metadata } from "next";
import Link from "next/link";
import CompareExplorer from "@/components/CompareExplorer";
import { dataset } from "@/lib/dataset";
import { nameToSlug } from "@/lib/format";

const BASE_TITLE = "Compare Two Passports - Visa-Free Reach Side by Side";
const BASE_DESC =
  "Compare any two passports side by side: visa-free countries, visa on arrival and eTA reach for each, plus exactly which destinations only one passport can reach - all from official government sources.";

// Resolve a query-param value (name slug, ISO3, or ISO2) to a dataset country.
function resolveCountry(raw: string | undefined) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  return (
    dataset.allCountries.find(
      (c) => nameToSlug(c.name) === s || c.iso3.toLowerCase() === s || c.iso2.toLowerCase() === s,
    ) ?? null
  );
}

// Shared links keep a pair-specific title/description for richer previews, but
// the canonical always points at the bare /compare so query variants don't
// fragment indexing.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}): Promise<Metadata> {
  const { a, b } = await searchParams;
  const ca = resolveCountry(a);
  const cb = resolveCountry(b);

  let title = BASE_TITLE;
  let description = BASE_DESC;
  if (ca && cb) {
    title = `${ca.name} vs ${cb.name} Passport - Visa-Free Comparison`;
    description = `${ca.name} vs ${cb.name}: compare visa-free countries, visa on arrival and eTA reach for each passport, and see exactly which destinations only one can reach - from official government sources.`;
  }

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "https://earthvisa.in/compare" },
    openGraph: { title, description, url: "https://earthvisa.in/compare", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Popular, high-intent matchups - also a crawlable entry into the tool's
// query-param permutations and the corridor corpus behind each tile.
const POPULAR_PAIRS: { a: string; b: string; sa: string; sb: string; fa: string; fb: string }[] = [
  { a: "India", b: "Germany", sa: "india", sb: "germany", fa: "🇮🇳", fb: "🇩🇪" },
  { a: "United States", b: "United Kingdom", sa: "united-states", sb: "united-kingdom", fa: "🇺🇸", fb: "🇬🇧" },
  { a: "United Arab Emirates", b: "India", sa: "united-arab-emirates", sb: "india", fa: "🇦🇪", fb: "🇮🇳" },
  { a: "China", b: "Japan", sa: "china", sb: "japan", fa: "🇨🇳", fb: "🇯🇵" },
  { a: "Pakistan", b: "India", sa: "pakistan", sb: "india", fa: "🇵🇰", fb: "🇮🇳" },
  { a: "Nigeria", b: "South Africa", sa: "nigeria", sb: "south-africa", fa: "🇳🇬", fb: "🇿🇦" },
  { a: "Canada", b: "Australia", sa: "canada", sb: "australia", fa: "🇨🇦", fb: "🇦🇺" },
  { a: "Turkey", b: "Russia", sa: "turkey", sb: "russia", fa: "🇹🇷", fb: "🇷🇺" },
  { a: "Brazil", b: "Argentina", sa: "brazil", sb: "argentina", fa: "🇧🇷", fb: "🇦🇷" },
  { a: "Philippines", b: "Thailand", sa: "philippines", sb: "thailand", fa: "🇵🇭", fb: "🇹🇭" },
];

export default function ComparePage() {
  const { meta } = dataset;
  const dataYear = meta.lastUpdated.slice(0, 4);

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Passport Comparison Tool",
            url: "https://earthvisa.in/compare",
            applicationCategory: "TravelApplication",
            operatingSystem: "Web",
            description: BASE_DESC,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />

      {/* The tool. Empty: title + two inputs, full viewport. Both picked: the
          same page becomes the side-by-side answer. */}
      <CompareExplorer />

      {/* ── Below the fold: popular matchups + deeper entry points ── */}
      <section>
        <div className="mx-auto w-full max-w-6xl border-t border-hair px-5 pb-16 pt-12 sm:px-8">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">Popular passport matchups</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_PAIRS.map((p) => (
              <Link key={`${p.sa}-${p.sb}`} href={`/compare?a=${p.sa}&b=${p.sb}`} className="chip">
                <span aria-hidden="true">{p.fa}</span>
                {p.a} <span aria-hidden="true" className="text-ink-3">vs</span> <span aria-hidden="true">{p.fb}</span> {p.b}
              </Link>
            ))}
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-6 sm:grid-cols-3">
            <Link href="/" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">Where can you go? <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">Check a single passport&apos;s full reach across {meta.countriesWithData} destinations.</p>
            </Link>
            <Link href="/rankings" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">Passport Ranking {dataYear} <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">All {meta.countriesWithData} passports ranked by real reach.</p>
            </Link>
            <Link href="/guide/visa-types" className="group">
              <p className="text-[16.5px] font-semibold text-ink transition group-hover:text-accent">Visa types, explained <span aria-hidden="true">→</span></p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">Visa-free vs on arrival vs eTA vs e-visa - one plain-language glossary.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
