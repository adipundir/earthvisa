"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isoToFlag } from "@/lib/format";

interface Opt { slug: string; name: string; iso2: string }

// Common shorthand -> the canonical dataset name (lowercase) it should match.
// Users type "UK" or "Dubai" far more often than the official country name.
const ALIASES: Record<string, string> = {
  uk: "united kingdom",
  britain: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  wales: "united kingdom",
  uae: "united arab emirates",
  dubai: "united arab emirates",
  "abu dhabi": "united arab emirates",
  usa: "united states",
  us: "united states",
  america: "united states",
  holland: "netherlands",
  korea: "south korea",
  burma: "myanmar",
  "czech republic": "czechia",
  "ivory coast": "côte d'ivoire",
  turkiye: "turkey",
  "türkiye": "turkey",
};

// Header search on /passport/[slug]: type a destination to jump to the
// nationality-specific visa guide (corridor page) when one exists, otherwise
// that country's entry-rules page. No 404s - corridorSlugs is the exact set of
// built corridor pages for this nationality.
export default function PassportDestinationSearch({
  natSlug,
  citizens,
  options,
  corridorSlugs,
}: {
  natSlug: string;
  /** grammatical subject phrase, e.g. "Indian citizens" or "citizens of Palau" */
  citizens: string;
  options: Opt[];
  corridorSlugs: string[];
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const corridor = useMemo(() => new Set(corridorSlugs), [corridorSlugs]);
  const norm = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!norm) return [];
    // Countries reachable via an alias: exact ("uk") or, from two characters
    // on, an alias prefix ("dub" -> "dubai" -> United Arab Emirates).
    const aliasHits = new Set<string>();
    for (const [alias, target] of Object.entries(ALIASES)) {
      if (alias === norm || (norm.length >= 2 && alias.startsWith(norm))) aliasHits.add(target);
    }
    return options
      .map((o) => {
        const name = o.name.toLowerCase();
        const score =
          ALIASES[norm] === name ? 0 // exact alias match ranks first ("uk")
          : name.startsWith(norm) ? 1
          : aliasHits.has(name) ? 2
          : name.includes(norm) ? 3
          : -1;
        return { o, score };
      })
      .filter((m) => m.score >= 0)
      .sort((a, b) => a.score - b.score || a.o.name.localeCompare(b.o.name))
      .slice(0, 8)
      .map((m) => m.o);
  }, [norm, options]);

  const go = (o: Opt) =>
    router.push(corridor.has(o.slug) ? `/passport/${natSlug}/${o.slug}` : `/destination/${o.slug}`);

  return (
    <div className="relative mt-6 max-w-xl">
      <label className="mono mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
        Do {citizens} need a visa for…?
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
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[hi] ? `${listId}-opt-${hi}` : undefined}
          aria-label={`Check visa requirements for ${citizens} by destination country`}
          placeholder="Type a country - e.g. Thailand, UK, Dubai…"
          className="w-full rounded-lg border border-line-strong bg-card py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-stamp"
        />
      </div>
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-lg border border-line-strong bg-card py-1 shadow-xl shadow-black/10">
          {matches.map((o, i) => (
            <li key={o.slug} id={`${listId}-opt-${i}`} role="option" aria-selected={hi === i}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => { e.preventDefault(); go(o); }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${hi === i ? "bg-paper-2" : "hover:bg-paper-2"}`}
              >
                <span className="text-xl">{isoToFlag(o.iso2)}</span>
                <span className="font-display text-[15px] text-ink">{o.name}</span>
                <span className="mono ml-auto text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">
                  {corridor.has(o.slug) ? "visa guide →" : "entry rules →"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && norm.length > 0 && matches.length === 0 && (
        <div className="absolute z-30 mt-1.5 w-full rounded-lg border border-line-strong bg-card px-4 py-3 shadow-xl shadow-black/10">
          <p className="text-sm text-ink-mute">No countries match &ldquo;{q.trim()}&rdquo;. Try the official country name.</p>
        </div>
      )}
    </div>
  );
}
