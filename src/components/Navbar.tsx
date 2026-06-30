"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dataset } from "@/lib/dataset";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso || "";
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function WhaleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 22c0-4.3-.5-7.4-2.1-9.7C8 9.4 4.4 9 3 8.1c2-1.4 6.2-.4 8.4 2.9.2-1.1.5-2.6 1.1-3.5.6.9.9 2.4 1.1 3.5 2.2-3.3 6.4-4.3 8.4-2.9-1.4.9-5 1.3-6.9 4.2C13.5 14.6 13 17.7 13 22Z" />
    </svg>
  );
}

const LINKS = [
  { href: "/visit", label: "Entry Check" },
  { href: "/passport", label: "Passports" },
  { href: "/destination", label: "Destinations" },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 sm:gap-6 sm:px-8">
        <Link
          href="/"
          aria-label="Passport Power - home"
          aria-current={path === "/" ? "page" : undefined}
          className="flex items-center gap-2 text-stamp transition hover:opacity-75"
        >
          <WhaleMark className="h-5 w-5" />
          <span className="font-display text-[15px] font-semibold tracking-tight">Passport Power</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
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

        <div className="mono ml-auto flex items-center gap-2.5 text-[10px] uppercase tracking-[0.18em]">
          <span className="hidden text-vfree sm:inline">Official sources only</span>
          <span className="hidden h-3 w-px bg-line-strong sm:inline" aria-hidden="true" />
          <span className="text-ink-mute" title={`Data last updated ${dataset.meta.lastUpdated}`}>
            Updated {fmtDate(dataset.meta.lastUpdated)}
          </span>
        </div>
      </div>
    </nav>
  );
}
