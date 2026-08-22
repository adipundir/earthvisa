import type { Metadata } from "next";
import DestinationExplorer from "@/components/DestinationExplorer";

export const metadata: Metadata = {
  title: "Entry Check - Do I Need a Visa?",
  description: "Find out instantly if you need a visa for your destination. Enter where you want to go and your passport - get the exact visa requirement, stay duration, and conditions from official sources.",
  alternates: { canonical: "https://earthvisa.in/visit" },
  openGraph: {
    title: "Entry Check - Do I Need a Visa? | Earth Visa",
    description: "Find out instantly if you need a visa for your destination. Official sources only.",
    url: "https://earthvisa.in/visit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Entry Check - Do I Need a Visa? | Earth Visa",
    description: "Find out instantly if you need a visa for your destination. Official sources only.",
  },
};

export default function VisitPage() {
  return (
    <main className="min-h-screen">
      {/* Tool-first hero (spec §10): the destination input is the hero element,
          rendered by DestinationExplorer right under this server-rendered copy. */}
      <DestinationExplorer
        hero={
          <div>
            <h1 className="text-display max-w-3xl text-ink">
              Do I need a visa for{" "}
              <span className="italic text-stamp">my destination?</span>
            </h1>
            <p className="text-body measure mt-3 text-ink-soft">
              Select where you want to go, then add your passport. We&apos;ll tell you exactly what access you have - visa-free, on arrival, eTA, or visa required - with conditions and official source links.
            </p>
          </div>
        }
      />
    </main>
  );
}
