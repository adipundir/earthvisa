import Link from "next/link";
import { dataset } from "@/lib/dataset";
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
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/guide/schengen", label: "Schengen visa" },
      { href: "/guide/proof-of-funds", label: "Proof of funds" },
      { href: "/guide/etias", label: "ETIAS" },
      { href: "/guide/umrah-visa", label: "Umrah visa" },
      { href: "/guide/gcc-visa", label: "GCC unified visa" },
      { href: "/destination/europe", label: "Visa for Europe" },
    ],
  },
  {
    title: "Programs",
    links: [
      { href: "/programs/citizenship-by-investment", label: "Citizenship by investment" },
      { href: "/programs/golden-visa", label: "Golden visas" },
      { href: "/programs/digital-nomad-visa", label: "Digital nomad visas" },
      { href: "/programs/easiest-citizenship", label: "Easiest citizenship" },
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
    <footer className="mt-auto border-t border-line-strong bg-paper-2">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          {/* Brand + methodology */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-stamp">
              <BrandMark size={22} className="shrink-0" />
              <span className="font-display text-[16px] font-semibold tracking-tight">Earth Visa</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Visa rules, fees and entry requirements for 199 passports - sourced only from official
              government publications, never third-party aggregators.
            </p>
            <p
              className="mono mt-4 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute"
              title={`Data last updated ${dataset.meta.lastUpdated}`}
            >
              Updated {fmtDate(dataset.meta.lastUpdated)}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="mono text-[10px] font-medium uppercase tracking-[0.2em] text-ink-mute">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13.5px] text-ink-soft transition hover:text-stamp">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
