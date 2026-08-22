import Link from "next/link";
import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import { fmtDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import FooterReportLink from "@/components/FooterReportLink";

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
      { href: "/guide/argentina-citizenship", label: "Argentina citizenship" },
      { href: "/guide/mexico-citizenship", label: "Mexico citizenship" },
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
        {/* Two columns from the base breakpoint up. Without one the four nav
            columns stacked into a single 1,608px run on a phone - 1.9 screens,
            and 64% of the whole /visit page.
            `items-start` matters: a grid row is otherwise as tall as its
            tallest cell, so "Explore" (7 links) was being stretched to match
            "Guides" (11) and ~134px of the footer was empty stretched cell.
            Every one of the 29 anchors stays - this footer is what keeps every
            hub, guide and programme page reachable from every route. */}
        <div className="grid grid-cols-2 items-start gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          {/* Brand + methodology */}
          <div className="col-span-2 max-w-xs lg:col-span-1">
            <div className="flex items-center gap-2 text-ink">
              <BrandMark size={26} className="shrink-0" />
              <span className="text-[18px] font-bold tracking-tight">Earth Visa</span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
              Visa rules, fees and entry requirements for {TOTAL_PASSPORTS} passports.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[13.5px] font-semibold text-ink">{col.title}</p>
              <ul className="mt-2.5 sm:mt-3.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {/* py-1.5 is the floor, not a style choice. Measured: the
                        after: box does NOT widen the tap target the way the old
                        comment here claimed - stacked links have no gap, so each
                        link's expanded box is covered by its neighbour's and
                        elementFromPoint still resolves to the natural row. The
                        real tap height is this padding plus the line box, and at
                        py-1 that measured 26.6px. Height savings have to come
                        from the layout, not from here. */}
                    <Link
                      href={l.href}
                      className="relative inline-block py-1.5 text-[13.5px] text-ink-2 transition hover:text-accent"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar: copyright + report entry left, studio credit right
            (SpinalFluid wordmark colors ported from the SpinalFluid brand).
            "Official sources only" lives in the brand blurb above - once. */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-t border-hair pt-5 text-[13px] text-ink-2">
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span title={`Data last updated ${fmtDate(dataset.meta.lastUpdated)}`}>© 2026 Earth Visa</span>
            <FooterReportLink className="relative text-[13px] text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-ink hover:underline" />
            <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
            {/* Reachable from every page. App Store Guideline 5.1.1(i) needs a
                privacy policy link, and GDPR/DPDP need it discoverable rather
                than merely existing at a URL. */}
            <Link
              href="/privacy"
              className="relative text-[13px] text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-ink hover:underline"
            >
              Privacy
            </Link>
            <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
            <Link
              href="/terms"
              className="relative text-[13px] text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-ink hover:underline"
            >
              Terms
            </Link>
            <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
            <a
              href="https://instagram.com/earthvisa.in"
              target="_blank"
              rel="noreferrer"
              className="relative text-[13px] text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-ink hover:underline"
            >
              Instagram
            </a>
          </span>
          <span className="inline-flex items-center gap-1.5 py-1">
            Product of <span className="font-semibold tracking-tight text-ink">Spinal<span className="sf-gold">fluid</span></span>
          </span>
        </div>
      </div>
    </footer>
  );
}
