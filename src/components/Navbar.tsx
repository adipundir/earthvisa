"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";

const LINKS = [
  { href: "/visit", label: "Entry Check" },
  { href: "/passport", label: "Passports" },
  { href: "/destination", label: "Destinations" },
  { href: "/rankings", label: "Rankings" },
  { href: "/earthling", label: "Earthling" },
];

// lastUpdated is passed from the (server) root layout instead of importing
// @/lib/dataset here - that module eagerly evaluates the full ~18MB
// dataset.json at module scope, and importing it from a "use client"
// component was forcing that entire dataset into a client JS chunk shipped
// on every route just to print one date string.
export default function Navbar({ lastUpdated }: { lastUpdated: string }) {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      {/* SINGLE ROW on every viewport (spec §13) - the bar never wraps.
          brand (fixed) | link rail (scrolls horizontally when tight) |
          meta chrome (lg+ only) | theme toggle. */}
      <div className="mx-auto flex w-full max-w-6xl flex-nowrap items-center gap-2 px-4 py-2 sm:gap-5 sm:px-8 sm:py-2.5">
        <Link
          href="/"
          aria-label="Earth Visa - home"
          aria-current={path === "/" ? "page" : undefined}
          className="flex shrink-0 items-center gap-2 text-stamp transition hover:opacity-75"
        >
          <BrandMark size={28} className="shrink-0" />
          <span className="font-display text-[19px] font-semibold tracking-tight">Earth Visa</span>
        </Link>

        {/* Horizontally scrollable link rail (.nav-scroll hides the scrollbar
            and fades the right edge below lg). min-w-0 + flex-1 lets it absorb
            the leftover width instead of forcing the bar to wrap; -my-1/py-1
            give focus rings vertical room inside the scroll clip. */}
        <div className="nav-scroll -my-1 flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 py-1 xl:flex-none">
          {LINKS.map(({ href, label }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-2.5 font-display text-[13px] font-medium transition sm:px-3 sm:text-[14px] ${
                  active
                    ? "bg-stamp/[0.07] text-stamp"
                    : "text-ink-soft hover:bg-paper-3 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Meta chrome is demoted to wide desktop only (below xl it overflows
            the single row); the footer's meta strip carries "official sources /
            updated" on smaller viewports. */}
        <div className="mono-chrome ml-auto hidden shrink-0 items-center gap-2.5 xl:flex">
          <span>Official sources only</span>
          <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
          <span title={`Data last updated ${lastUpdated}`}>Updated {fmtDate(lastUpdated)}</span>
        </div>

        <span className="ml-auto shrink-0 xl:ml-0">
          <ThemeToggle />
        </span>
      </div>
    </nav>
  );
}
