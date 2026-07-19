import Link from "next/link";
import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { fmtDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";

// Sitewide footer. Its main job beyond branding is reachability: it links every
// hub, guide, program and popular list page from every route, so nothing is
// orphaned (reachable only via the sitemap) and internal PageRank flows.
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/", label: "Check your passport" },
      { href: "/visit", label: "Do I need a visa?" },
      { href: "/passport", label: "All passports" },
      { href: "/destination", label: "All destinations" },
      { href: "/rankings", label: "Passport ranking 2026" },
      { href: "/rankings/visa-fees", label: "Visa fee ranking 2026" },
      { href: "/earthling", label: "Claim your Earthling ID" },
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/guide", label: "All guides" },
      { href: "/guide/schengen", label: "Schengen visa" },
      { href: "/guide/proof-of-funds", label: "Proof of funds" },
      { href: "/guide/etias", label: "ETIAS" },
      { href: "/guide/umrah-visa", label: "Umrah visa" },
      { href: "/guide/gcc-visa", label: "GCC unified visa" },
      { href: "/guide/japan-visa-fee-increase-2026", label: "Japan visa fee increase" },
      { href: "/guide/thailand-visa-changes-2026", label: "Thailand visa changes" },
      { href: "/destination/europe", label: "Visa for Europe" },
    ],
  },
  {
    title: "Programs",
    links: [
      { href: "/programs", label: "All programs" },
      { href: "/programs/citizenship-by-investment", label: "Citizenship by investment" },
      { href: "/programs/golden-visa", label: "Golden visas" },
      { href: "/programs/digital-nomad-visa", label: "Digital nomad visas" },
      { href: "/programs/easiest-citizenship", label: "Easiest citizenship" },
      { href: "/programs/work-visa", label: "Work visas" },
      { href: "/programs/student-visa", label: "Student visas" },
    ],
  },
  {
    title: "Popular",
    links: [
      { href: "/list/visa-free-countries-for-indians", label: "Visa-free for Indians" },
      { href: "/list/countries-with-us-visa-for-indians", label: "Countries with a US visa" },
      { href: "/destination/dubai", label: "Dubai visa" },
      { href: "/guide/schengen/india", label: "Schengen for Indians" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hair">
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pb-12 sm:pt-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          {/* Brand + methodology */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-ink">
              <BrandMark size={26} className="shrink-0" />
              <span className="text-[18px] font-bold tracking-tight">Earth Visa</span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
              Visa rules, fees and entry requirements for {TOTAL_PASSPORTS} passports - sourced only from official
              government publications, never third-party aggregators.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[13.5px] font-semibold text-ink">{col.title}</p>
              <ul className="mt-3.5 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13.5px] text-ink-2 transition hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Meta line: sitewide chrome lives here (the nav carries none). */}
        <div className="mt-12 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-hair pt-5 text-[13px] text-ink-2">
          <span>Official sources only</span>
          <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
          <span title={`Data last updated ${dataset.meta.lastUpdated}`}>
            Updated {fmtDate(dataset.meta.lastUpdated)}
          </span>
          <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
          <span>{TOTAL_PASSPORTS} passports tracked</span>
        </div>
      </div>
    </footer>
  );
}
