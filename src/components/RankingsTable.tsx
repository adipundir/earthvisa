"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface RankingRow {
  rank: number;
  iso3: string;
  flag: string;
  name: string;
  slug: string;
  visaFree: number;
  visaOnArrival: number;
  /** eTA + e-Visa combined */
  eta: number;
  total: number;
}

type SortKey = "rank" | "name" | "visaFree" | "visaOnArrival" | "eta" | "total";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "rank", label: "Rank", numeric: true },
  { key: "name", label: "Passport", numeric: false },
  { key: "visaFree", label: "Visa-free", numeric: true },
  { key: "visaOnArrival", label: "Visa on arrival", numeric: true },
  { key: "eta", label: "eTA / e-Visa", numeric: true },
  { key: "total", label: "Total reach", numeric: true },
];

/**
 * Client-side sortable ranking table for all 199 passports. The rows are
 * computed on the server (fully static page); this island only re-orders and
 * filters them in the browser - no data fetching.
 */
export default function RankingsTable({ rows }: { rows: RankingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Counts read most naturally highest-first; rank and name lowest/A-first.
      setSortDir(key === "rank" || key === "name" ? "asc" : "desc");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [rows, sortKey, sortDir, query]);

  return (
    <div>
      <label className="block max-w-xs">
        <span className="sr-only">Filter passports by country name</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by country..."
          className="mono min-h-[44px] w-full rounded-sm border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-mute outline-none focus:border-stamp"
        />
      </label>

      <div className="mt-4 overflow-x-auto rounded-sm border border-line">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line-strong bg-paper-2/70">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={col.numeric && col.key !== "rank" ? "text-right" : "text-left"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`mono inline-flex min-h-[44px] w-full items-center gap-1.5 px-3.5 py-2 text-[10px] uppercase tracking-[0.15em] transition hover:text-ink ${
                        col.numeric && col.key !== "rank" ? "justify-end" : "justify-start"
                      } ${active ? "text-ink" : "text-ink-mute"}`}
                    >
                      {col.label}
                      <span aria-hidden className={active ? "text-stamp" : "text-transparent"}>
                        {active && sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.iso3} className="transition hover:bg-paper-2/70">
                <td className="mono px-3.5 py-2 text-sm tabular-nums text-ink-mute">#{r.rank}</td>
                <td className="px-3.5 py-1">
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5"
                  >
                    <span className="text-lg">{r.flag}</span>
                    <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">
                      {r.name}
                    </span>
                  </Link>
                </td>
                <td className="mono px-3.5 py-2 text-right text-sm tabular-nums text-vfree">{r.visaFree}</td>
                <td className="mono px-3.5 py-2 text-right text-sm tabular-nums text-voa">{r.visaOnArrival}</td>
                <td className="mono px-3.5 py-2 text-right text-sm tabular-nums text-eta">{r.eta}</td>
                <td className="mono px-3.5 py-2 text-right text-sm font-semibold tabular-nums text-ink">{r.total}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-6 text-center text-sm text-ink-mute">
                  No passports match &quot;{query}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
