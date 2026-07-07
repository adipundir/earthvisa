"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dataset } from "@/lib/dataset";
import { fmtDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";

const LINKS = [
  { href: "/visit", label: "Entry Check" },
  { href: "/passport", label: "Passports" },
  { href: "/destination", label: "Destinations" },
  { href: "/rankings", label: "Rankings" },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 sm:gap-6 sm:px-8">
        <Link
          href="/"
          aria-label="Earth Visa - home"
          aria-current={path === "/" ? "page" : undefined}
          className="flex items-center gap-2 text-stamp transition hover:opacity-75"
        >
          <BrandMark size={22} className="shrink-0" />
          <span className="font-display text-[16px] font-semibold tracking-tight">Earth Visa</span>
        </Link>

        {/* Mobile-only: shares the logo's row, pinned to the right. Hidden from
            sm upward, where the full meta cluster below covers it instead. */}
        <span
          className="mono ml-auto text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute sm:hidden"
          title={`Data last updated ${dataset.meta.lastUpdated}`}
        >
          Updated {fmtDate(dataset.meta.lastUpdated)}
        </span>

        {/* w-full forces this onto its own line on mobile (flex-wrap trick);
            sm:w-auto rejoins the logo's row once the meta cluster below fits. */}
        <div className="flex w-full items-center gap-0.5 sm:w-auto sm:gap-1">
          {LINKS.map(({ href, label }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-md px-2.5 font-display text-[13px] font-medium transition sm:px-3 sm:text-[14px] ${
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

        {/* Meta cluster is desktop-only chrome: on mobile it wrapped to a third
            row, pushing the sticky nav to ~120px and burying anchor targets. */}
        <div className="mono ml-auto hidden items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.18em] sm:flex">
          <span className="text-vfree">Official sources only</span>
          <span className="h-3 w-px bg-line-strong" aria-hidden="true" />
          <span className="text-ink-mute" title={`Data last updated ${dataset.meta.lastUpdated}`}>
            Updated {fmtDate(dataset.meta.lastUpdated)}
          </span>
        </div>
      </div>
    </nav>
  );
}
