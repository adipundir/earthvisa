"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function WhaleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 22c0-4.3-.5-7.4-2.1-9.7C8 9.4 4.4 9 3 8.1c2-1.4 6.2-.4 8.4 2.9.2-1.1.5-2.6 1.1-3.5.6.9.9 2.4 1.1 3.5 2.2-3.3 6.4-4.3 8.4-2.9-1.4.9-5 1.3-6.9 4.2C13.5 14.6 13 17.7 13 22Z" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Passport Explorer" },
  { href: "/visit", label: "Entry Check" },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-line-strong bg-paper-2/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3 sm:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 text-ink transition hover:text-stamp">
          <WhaleMark className="h-5 w-5 text-stamp" />
          <span className="font-display text-[15px] font-semibold tracking-tight">Passport Power</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 font-display text-[14px] font-medium transition ${
                  active
                    ? "bg-stamp/[0.08] text-stamp"
                    : "text-ink-soft hover:bg-stamp/[0.05] hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side: data note */}
        <span className="mono ml-auto hidden text-[10px] uppercase tracking-[0.18em] text-vfree sm:block">
          Official sources only
        </span>
      </div>
    </nav>
  );
}
