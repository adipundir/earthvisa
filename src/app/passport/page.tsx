import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { dataset } from "@/lib/dataset";
import CountryIndex, { type RegionGroup } from "@/components/CountryIndex";

export const metadata: Metadata = {
  title: "Passport Index - Visa-Free Travel by Passport",
  description: "Browse every passport. See visa-free destinations, visa-on-arrival access, golden visas and citizenship-by-investment options for any nationality, from official sources.",
  alternates: { canonical: "https://earthvisa.in/passport" },
  openGraph: {
    title: "Passport Index - Visa-Free Travel by Passport | Earth Visa",
    description: "Browse every passport and see its visa-free destinations, visa on arrival access, golden visas and citizenship by investment - from official sources.",
    url: "https://earthvisa.in/passport",
  },
  twitter: {
    title: "Passport Index - Visa-Free Travel by Passport | Earth Visa",
    description: "Browse every passport and see its visa-free destinations, visa on arrival access, golden visas and citizenship by investment - from official sources.",
  },
};

const REGION_ORDER = ["Europe", "Asia", "Americas", "Africa", "Oceania", "Pacific"];

function buildRegions(): RegionGroup[] {
  const byRegion = new Map<string, typeof dataset.allCountries>();
  for (const c of dataset.allCountries) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, []);
    byRegion.get(c.region)!.push(c);
  }
  return [...byRegion.keys()]
    .sort((a, b) => (REGION_ORDER.indexOf(a) + 1 || 99) - (REGION_ORDER.indexOf(b) + 1 || 99))
    .map((region) => ({
      region,
      countries: byRegion
        .get(region)!
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name })),
    }));
}

export default function PassportIndex() {
  const regions = buildRegions();

  return (
    <main className="min-h-screen">
      <header className="border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-10 sm:px-8">
          <nav className="mono mb-4 text-[11px] uppercase tracking-[0.15em] text-ink-mute">
            <Link href="/" className="transition hover:text-ink">Earth Visa</Link> / Passports
          </nav>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Browse by Passport
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Choose a passport to see its visa-free destinations, visa-on-arrival access, freedom-of-movement
            rights, golden visas and citizenship-by-investment options - all from official sources.
          </p>
          <p className="mt-4 text-[15px] text-ink-mute">
            Looking for entry rules into a country?{" "}
            <Link
              href="/destination"
              className="font-display text-ink-soft underline decoration-line underline-offset-4 transition hover:text-ink hover:decoration-ink-soft"
            >
              Browse by Destination →
            </Link>
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <CountryIndex regions={regions} kind="passport" />
      </Suspense>
    </main>
  );
}
