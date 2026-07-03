"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isoToFlag } from "@/lib/dataset";

interface Opt { slug: string; name: string; iso2: string }

// Header search on /passport/[slug]: type a destination to jump to the
// nationality-specific visa guide (corridor page) when one exists, otherwise
// that country's entry-rules page. No 404s - corridorSlugs is the exact set of
// built corridor pages for this nationality.
export default function PassportDestinationSearch({
  natSlug,
  demonym,
  options,
  corridorSlugs,
}: {
  natSlug: string;
  demonym: string;
  options: Opt[];
  corridorSlugs: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const corridor = useMemo(() => new Set(corridorSlugs), [corridorSlugs]);
  const norm = q.trim().toLowerCase();
  const matches = useMemo(
    () => (norm ? options.filter((o) => o.name.toLowerCase().includes(norm)).slice(0, 8) : []),
    [norm, options],
  );

  const go = (o: Opt) =>
    router.push(corridor.has(o.slug) ? `/passport/${natSlug}/${o.slug}` : `/destination/${o.slug}`);

  return (
    <div className="relative mt-6 max-w-xl">
      <label className="mono mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        Do {demonym} citizens need a visa for…?
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { const m = matches[hi]; if (m) { e.preventDefault(); go(m); } }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          type="search"
          autoComplete="off"
          aria-label={`Check ${demonym} visa requirements for a country`}
          placeholder="Type a country - e.g. Thailand, UK, Dubai…"
          className="w-full rounded-lg border border-line-strong bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-stamp"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-lg border border-line-strong bg-white py-1 shadow-xl shadow-ink/10">
          {matches.map((o, i) => (
            <li key={o.slug}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(o); }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${hi === i ? "bg-paper-2" : "hover:bg-paper-2"}`}
              >
                <span className="text-xl">{isoToFlag(o.iso2)}</span>
                <span className="font-display text-[15px] text-ink">{o.name}</span>
                <span className="mono ml-auto text-[9px] uppercase tracking-[0.15em] text-ink-mute">
                  {corridor.has(o.slug) ? "visa guide →" : "entry rules →"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
