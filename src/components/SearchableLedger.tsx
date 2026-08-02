"use client";

import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";

// Adds a search box on top of an already server-rendered ledger list, without
// ever re-rendering the rows on the client. This exists because these lists
// live inside Server Components (passport/[slug], destination/[slug], etc.):
// React cannot serialize function props (renderRow/matchText/etc.) across the
// server -> client boundary, only plain data and already-rendered ReactNode
// children - so this component takes the page's EXISTING preview+`<details>`
// "Show all" markup unchanged as `children`, and filters it imperatively via
// a `data-search="..."` attribute the caller puts on each row. No row is ever
// added/removed from the DOM by this component, only shown/hidden - so a
// crawler with JS disabled (or a crawler that never types into the box) sees
// exactly the same HTML the page produced before this component existed.
//
// Usage: give every row a `data-search="lowercase match text"` attribute,
// then wrap the section's existing preview-ul + `<details>` markup as-is:
//
//   <SearchableLedger count={vfEdges.length} noun="visa-free destinations">
//     <ul>...rows with data-search=.../ul>
//     <details><ul>...more rows.../ul></details>
//   </SearchableLedger>
export default function SearchableLedger({
  children,
  count,
  noun,
  searchThreshold = 12,
}: {
  children: ReactNode;
  /** Total row count across preview + "Show all" tail - gates whether a search box renders at all. */
  count: number;
  /** Plural noun for copy, e.g. "visa-free destinations", "guides". */
  noun: string;
  /** Minimum item count before a search input is shown at all. */
  searchThreshold?: number;
}) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [noMatches, setNoMatches] = useState(false);

  function handleChange(value: string) {
    setQuery(value);
    const root = rootRef.current;
    if (!root) return;
    const normalized = value.trim().toLowerCase();
    const rows = root.querySelectorAll<HTMLElement>("[data-search]");
    let visible = 0;
    rows.forEach((row) => {
      const match = !normalized || (row.dataset.search ?? "").includes(normalized);
      row.hidden = !match;
      if (match) visible++;
    });
    // A match inside the collapsed "Show all" tail must become visible even
    // though its <details> is closed - force it open while searching, and
    // let it fall back to its native (closed) default once the query clears.
    root.querySelectorAll("details").forEach((d) => {
      d.open = normalized.length > 0;
    });
    setNoMatches(normalized.length > 0 && visible === 0);
  }

  const showSearch = count > searchThreshold;

  return (
    <div ref={rootRef}>
      {showSearch && (
        <div className="relative mt-4 max-w-sm">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute"
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
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Search ${noun}…`}
            aria-label={`Search ${noun}`}
            autoComplete="off"
            className="w-full rounded-lg border border-line-strong bg-card py-2 pl-9 pr-3 text-[14px] text-ink outline-none transition placeholder:text-ink-mute focus:border-stamp"
          />
        </div>
      )}
      {noMatches && (
        <p className="mt-4 text-[14px] text-ink-soft">
          No {noun} match <span className="font-display text-ink">“{query.trim()}”</span>.
        </p>
      )}
      {children}
    </div>
  );
}
