import type { Metadata } from "next";
import DestinationExplorer from "@/components/DestinationExplorer";

export const metadata: Metadata = {
  title: "Entry Check - Do I Need a Visa?",
  description: "Find out instantly if you need a visa for your destination. Enter where you want to go and your passport - get the exact visa requirement, stay duration, and conditions from official sources.",
  keywords: [
    "do I need a visa", "visa requirements by destination", "entry requirements checker",
    "passport visa checker", "need visa for country", "travel visa check",
    "can I travel without visa", "visa free travel checker"
  ],
  alternates: { canonical: "https://earthvisa.in/visit" },
  openGraph: {
    title: "Entry Check - Do I Need a Visa? | Earth Visa",
    description: "Find out instantly if you need a visa for your destination. Official sources only.",
    url: "https://earthvisa.in/visit",
  },
  twitter: {
    title: "Entry Check - Do I Need a Visa? | Earth Visa",
    description: "Find out instantly if you need a visa for your destination. Official sources only.",
  },
};

export default function VisitPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-10 sm:px-8">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Do I need a visa for{" "}
            <span className="italic text-stamp">my destination?</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Select where you want to go, then add your passport. We&apos;ll tell you exactly what access you have - visa-free, on arrival, eTA, or visa required - with conditions and official source links.
          </p>
        </div>
      </header>
      <DestinationExplorer />
    </main>
  );
}
