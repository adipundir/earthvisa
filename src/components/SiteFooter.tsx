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
    // Same paper ground as the page (no gray band, no full-bleed hairline):
    // the footer opens with a contained double rule - document-ledger close,
    // not edge-to-edge chrome.
    <footer className="mt-auto">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="rule-double" aria-hidden="true" />
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pb-12 sm:pt-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          {/* Brand + methodology */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-stamp">
              <BrandMark size={28} className="shrink-0" />
              <span className="font-display text-[19px] font-semibold tracking-tight">Earth Visa</span>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              Visa rules, fees and entry requirements for {TOTAL_PASSPORTS} passports - sourced only from official
              government publications, never third-party aggregators.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[14px] text-ink-soft transition hover:text-stamp">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Meta strip: carries the sitewide chrome on every viewport - the
            nav shows it only from lg up, so this is its mobile home. */}
        <div className="mono-chrome mt-12 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-line pt-5">
          <span>Official sources only</span>
          <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
          <span title={`Data last updated ${dataset.meta.lastUpdated}`}>
            Updated {fmtDate(dataset.meta.lastUpdated)}
          </span>
          <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
          <span>{TOTAL_PASSPORTS} passports tracked</span>
        </div>
      </div>
    </footer>
  );
}
