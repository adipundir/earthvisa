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

// Inbound openness per destination - how many nationalities it admits
// visa-free. Reverse-indexed from the same passportAccess data the destination
// pages count (folding in bloc grants), so index and detail figures agree.
// Genuine zero-count destinations show "0 visa-free" rather than no stat.
const admitsVisaFree = visaFreeAdmitCounts();

export default function DestinationIndex() {
  const regions = buildRegions((iso3) => `${admitsVisaFree.get(iso3) ?? 0} visa-free`);

  return (
    <main className="min-h-screen">
      <header className="bg-grid-paper border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-10 sm:px-8">
          <nav aria-label="Breadcrumb" className="mono-chrome mb-4">
            <Link href="/" className="transition hover:text-ink">Earth Visa</Link>
            <span aria-hidden> / </span>
            Destinations
          </nav>
          <h1 className="text-display text-ink">
            Visa Requirements by Destination
            <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
              Entry Rules for Every Country
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Choose a destination to see which nationalities can enter visa-free, on arrival or with an eTA,
            its visa types, fees and document requirements.
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

      {/* CountryIndex owns the search + flat list; this heading gives the
          link wall a semantic outline (the page otherwise has no h2). */}
      <div className="mx-auto w-full max-w-6xl px-5 pt-10 -mb-6 sm:px-8">
        <h2 className="text-section text-ink">All Destinations A–Z</h2>
        <p className="text-body mt-2 max-w-3xl text-ink-soft">
          Each destination links to its entry rules, visa-free nationality lists and official visa fees.
        </p>
      </div>
      <Suspense fallback={null}>
        <CountryIndex regions={regions} kind="destination" />
      </Suspense>
    </main>
  );
}
