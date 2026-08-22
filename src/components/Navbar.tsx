"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";

const LINKS = [
  { href: "/visit", label: "Entry check" },
  { href: "/passport", label: "Passports" },
  { href: "/destination", label: "Destinations" },
  { href: "/rankings", label: "Rankings" },
  { href: "/earthling", label: "Earthling" },
];

// Slim system nav (design system v2): ground-colored bar, hairline bottom,
// Archivo, blue active states. No meta chrome - the footer carries
// "official sources / updated" sitewide.
export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-hair bg-ground/90 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] w-full max-w-6xl flex-nowrap items-center gap-2 px-4 sm:gap-6 sm:px-8">
        <Link
          href="/"
          aria-label="Earth Visa - home"
          aria-current={path === "/" ? "page" : undefined}
          className="flex min-h-[44px] shrink-0 items-center gap-2 text-ink transition hover:opacity-70"
        >
          <BrandMark size={26} className="shrink-0" />
          {/* The wordmark costs 91px, which on a 390px screen pushed three of the
              five rail links off-screen. The mark alone still links home. */}
          <span className="hidden text-[18px] font-bold tracking-tight sm:inline">Earth Visa</span>
        </Link>

        {/* Horizontally scrollable link rail (scrollbar hidden; right-edge fade
            below xl). min-w-0 + flex-1 absorbs leftover width so the bar never
            wraps; -my-1/py-1 give focus rings room inside the scroll clip. */}
        <div className="nav-scroll -my-1 ml-auto flex min-w-0 flex-nowrap items-center gap-0.5 py-1 xl:flex-none">
          {LINKS.map(({ href, label }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-[13.5px] transition sm:px-3 sm:text-[14.5px] ${
                  active
                    ? "font-semibold text-accent"
                    : "font-medium text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <span className="shrink-0">
          <ThemeToggle />
        </span>
      </div>
    </nav>
  );
}
