"use client";

import { useMemo, useState, useId } from "react";
import Link from "next/link";
import { isoToFlag, nameToSlug } from "@/lib/dataset";

export interface CountryRow {
  iso2: string;
  iso3: string;
  name: string;
}

export interface RegionGroup {
  region: string;
  countries: CountryRow[];
}

type Kind = "passport" | "destination";

function regionAnchor(region: string): string {
  return `region-${region.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function CountryIndex({
  regions,
  kind,
}: {
  regions: RegionGroup[];
  kind: Kind;
}) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const normalized = query.trim().toLowerCase();

  // Per-region filtered rows (memoized on the query).
  const filtered = useMemo(() => {
    return regions.map((g) => ({
      region: g.region,
      countries: normalized
        ? g.countries.filter((c) => c.name.toLowerCase().includes(normalized))
        : g.countries,
    }));
  }, [regions, normalized]);

  const matchCount = useMemo(
    () => filtered.reduce((sum, g) => sum + g.countries.length, 0),
    [filtered]
  );

  const hrefBase = kind === "passport" ? "/passport" : "/destination";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      {/* Search filter */}
      <div className="mb-6">
        <label
          htmlFor={inputId}
          className="mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-ink-mute"
        >
          Filter countries
        </label>
        <div className="relative max-w-md">
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a country name…"
            aria-label="Filter countries by name"
            autoComplete="off"
            className="w-full rounded-md border border-line bg-paper-2/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-mute outline-none transition focus:border-line-strong focus:bg-paper-2"
          />
        </div>
        <p className="mono mt-2 text-[11px] uppercase tracking-[0.15em] text-ink-mute" aria-live="polite">
          {normalized
            ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}`
            : `${matchCount} countries`}
        </p>
      </div>

      {/* Sticky region jump bar */}
      <nav
        aria-label="Jump to region"
        className="sticky top-0 z-10 -mx-5 mb-8 border-y border-line bg-paper/90 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:-mx-8 sm:px-8"
      >
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {filtered.map((g) => {
            const empty = g.countries.length === 0;
            return (
              <li key={g.region}>
                <a
                  href={`#${regionAnchor(g.region)}`}
                  aria-disabled={empty}
                  className={[
                    "mono flex min-h-[44px] items-center rounded-md px-3 text-[11px] uppercase tracking-[0.18em] transition",
                    empty
                      ? "pointer-events-none text-ink-mute/40"
                      : "text-stamp hover:bg-paper-2 hover:text-ink",
                  ].join(" ")}
                >
                  {g.region}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Region sections */}
      {filtered.map((g) => {
        const empty = g.countries.length === 0;
        return (
          <section
            key={g.region}
            id={regionAnchor(g.region)}
            hidden={empty}
            className="mb-10 scroll-mt-20"
          >
            <h2 className="mono mb-4 text-[11px] uppercase tracking-[0.2em] text-stamp">
              {g.region}
            </h2>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {g.countries.map((c) => (
                <li key={c.iso3}>
                  <Link
                    href={`${hrefBase}/${nameToSlug(c.name)}`}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-md px-2 py-2 text-[15px] text-ink-soft transition hover:bg-paper-2 hover:text-ink"
                  >
                    <span className="text-lg">{isoToFlag(c.iso2)}</span>
                    <span className="font-display">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* No-results state */}
      {matchCount === 0 && (
        <p className="text-base leading-relaxed text-ink-soft">
          No countries match{" "}
          <span className="font-display text-ink">“{query.trim()}”</span>. Try a different spelling.
        </p>
      )}
    </div>
  );
}
