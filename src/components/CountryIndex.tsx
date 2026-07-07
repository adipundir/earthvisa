"use client";

import { useMemo, useState, useId } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { isoToFlag, nameToSlug } from "@/lib/dataset";
import { ALIASES, SHORT_NAME } from "@/lib/colloquial";

// Searchable synonyms per ISO3, built from the site's own colloquial alias map:
// "dubai" and "uae" should find the United Arab Emirates row, "uk" Great Britain, etc.
const SYNONYMS: Record<string, string[]> = {};
for (const a of ALIASES) (SYNONYMS[a.iso3] ??= []).push(a.alias.toLowerCase());
for (const [iso3, short] of Object.entries(SHORT_NAME)) (SYNONYMS[iso3] ??= []).push(short.toLowerCase());

export interface CountryRow {
  iso2: string;
  iso3: string;
  name: string;
  /** small per-country figure shown at the row's end (e.g. "142 visa-free") */
  stat?: string;
}

export interface RegionGroup {
  region: string;
  countries: CountryRow[];
}

type Kind = "passport" | "destination";

export default function CountryIndex({
  regions,
  kind,
}: {
  regions: RegionGroup[];
  kind: Kind;
}) {
  // Seed the filter from the ?q= search param so the sitelinks search box
  // (WebSite SearchAction) lands users on a pre-filtered list.
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const inputId = useId();

  const normalized = query.trim().toLowerCase();

  // Flat, alphabetical list of every country (no continent grouping).
  const all = useMemo(
    () =>
      regions
        .flatMap((g) => g.countries)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [regions]
  );

  const rows = useMemo(
    () =>
      normalized
        ? all.filter(
            (c) =>
              c.name.toLowerCase().includes(normalized) ||
              (SYNONYMS[c.iso3] ?? []).some((s) => s.includes(normalized))
          )
        : all,
    [all, normalized]
  );

  const hrefBase = kind === "passport" ? "/passport" : "/destination";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      {/* Search */}
      <div className="mb-8">
        <label
          htmlFor={inputId}
          className="mono mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-ink-mute"
        >
          Search countries
        </label>
        <div className="relative w-full">
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
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a country name…"
            aria-label="Search countries by name"
            autoComplete="off"
            className="w-full rounded-lg border border-line-strong bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-stamp"
          />
        </div>
        <p
          className="mono mt-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute"
          aria-live="polite"
        >
          {normalized
            ? `${rows.length} ${rows.length === 1 ? "match" : "matches"}`
            : `${rows.length} countries`}
        </p>
      </div>

      {/* Flat A–Z country list */}
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <li key={c.iso3}>
            <Link
              href={`${hrefBase}/${nameToSlug(c.name)}`}
              className="flex min-h-[44px] items-center gap-2.5 rounded-md px-2 py-2 text-[15px] text-ink-soft transition hover:bg-paper-2 hover:text-ink"
            >
              <span className="text-lg">{isoToFlag(c.iso2)}</span>
              <span className="min-w-0 font-display">{c.name}</span>
              {c.stat && <span className="mono ml-auto shrink-0 whitespace-nowrap pl-2 text-[11px] tabular-nums text-ink-mute">{c.stat}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {/* No-results state */}
      {rows.length === 0 && (
        <p className="text-base leading-relaxed text-ink-soft">
          No countries match{" "}
          <span className="font-display text-ink">“{query.trim()}”</span>. Try a different spelling.
          {kind === "destination" && /europ|schengen/.test(normalized) && (
            <>
              {" "}
              Looking for Europe? See{" "}
              <Link href="/destination/europe" className="text-stamp underline decoration-stamp/40 underline-offset-2 transition hover:decoration-stamp">
                visa requirements for Europe
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
