import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import CountryIndex from "@/components/CountryIndex";
import { buildRegions } from "@/lib/regions";
import { visaFreeAdmitCounts } from "./reverse-index";

export const metadata: Metadata = {
  title: "Destination Index - Visa Requirements by Country",
  description: "Browse every destination. See which nationalities can enter visa-free, visa-on-arrival, or with an eTA, plus visa types and document requirements, from official sources.",
  alternates: { canonical: "https://earthvisa.in/destination" },
  openGraph: {
    title: "Destination Index - Visa Requirements by Country | Earth Visa",
    description: "Browse every destination and see which nationalities enter visa-free, on arrival or with an eTA, plus visa types and document requirements - from official sources.",
    url: "https://earthvisa.in/destination",
  },
  twitter: {
    card: "summary_large_image",
    title: "Destination Index - Visa Requirements by Country | Earth Visa",
    description: "Browse every destination and see which nationalities enter visa-free, on arrival or with an eTA, plus visa types and document requirements - from official sources.",
  },
};

// Inbound openness per destination — how many nationalities it admits
// visa-free. Reverse-indexed from the same passportAccess data the destination
// pages count (folding in bloc grants), so index and detail figures agree.
// Genuine zero-count destinations show "0 visa-free" rather than no stat.
const admitsVisaFree = visaFreeAdmitCounts();

export default function DestinationIndex() {
  const regions = buildRegions((iso3) => `${admitsVisaFree.get(iso3) ?? 0} visa-free`);

  return (
    <main className="min-h-screen">
      <header className="border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-10 sm:px-8">
          <nav className="mono mb-4 text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">
            <Link href="/" className="transition hover:text-ink">Earth Visa</Link> / Destinations
          </nav>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Browse by Destination
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Choose a destination to see which nationalities can enter visa-free, on arrival or with an eTA,
            its visa types, fees and document requirements - all from official sources.
          </p>
          <p className="mt-4 text-[15px] text-ink-mute">
            Want to know where your passport can take you?{" "}
            <Link
              href="/passport"
              className="font-display text-ink-soft underline decoration-line underline-offset-4 transition hover:text-ink hover:decoration-ink-soft"
            >
              Browse by Passport →
            </Link>
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <CountryIndex regions={regions} kind="destination" />
      </Suspense>
    </main>
  );
}
