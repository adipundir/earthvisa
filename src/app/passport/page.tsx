import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { dataset } from "@/lib/dataset";
import CountryIndex from "@/components/CountryIndex";
import { buildRegions } from "@/lib/regions";

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
    card: "summary_large_image",
    title: "Passport Index - Visa-Free Travel by Passport | Earth Visa",
    description: "Browse every passport and see its visa-free destinations, visa on arrival access, golden visas and citizenship by investment - from official sources.",
  },
};

// Outbound visa-free reach per passport — the "passport power" figure.
const visaFreeReach = new Map(
  Object.entries(dataset.passportAccess).map(([iso3, edges]) => [
    iso3,
    edges.filter((e) => e.level === "visa_free").length,
  ]),
);

export default function PassportIndex() {
  const regions = buildRegions((iso3) => {
    const n = visaFreeReach.get(iso3) ?? 0;
    return n ? `${n} visa-free` : undefined;
  });

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
