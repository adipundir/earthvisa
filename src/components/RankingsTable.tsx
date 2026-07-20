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
  eta: number;
  eVisa: number;
  /** ranking score: visa-free + visa on arrival + eTA (e-visa NOT counted) */
  score: number;
  /** all four levels combined (score + e-visa) */
  total: number;
}

type SortKey = "rank" | "name" | "visaFree" | "visaOnArrival" | "eta" | "eVisa" | "score" | "total";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "rank", label: "Rank", numeric: true },
  { key: "name", label: "Passport", numeric: false },
  { key: "visaFree", label: "Visa-free", numeric: true },
  { key: "visaOnArrival", label: "Visa on arrival", numeric: true },
  { key: "eta", label: "eTA", numeric: true },
  { key: "eVisa", label: "e-Visa", numeric: true },
  { key: "score", label: "Score", numeric: true },
  { key: "total", label: "Total reach", numeric: true },
];

/** Lowercase and strip diacritics so "cote d'ivoire" matches "Côte d'Ivoire". */
function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Common search terms that never appear in a passport's display name, keyed by
// ISO3. Kept deliberately small and local to this client island.
const SEARCH_ALIASES: Record<string, string[]> = {
  USA: ["usa", "us", "america", "united states of america"],
  GBR: ["uk", "britain", "great britain", "england"],
  ARE: ["uae", "emirates", "dubai"],
  CIV: ["ivory coast"],
  CZE: ["czech republic"],
  MMR: ["burma"],
  NLD: ["holland"],
  CPV: ["cape verde"],
  TLS: ["east timor"],
  SWZ: ["swaziland"],
  COD: ["drc"],
  TUR: ["turkiye"],
};

// The Rank column is fixed at 5rem (w-20) so the Passport column can pin at
// left-20 - both stay visible while the numeric columns scroll on mobile.
// Header underline and sticky-edge rules are box-shadows because collapsed
// table borders do not travel with position:sticky cells.
const TH_BASE = "sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--color-hair-strong)]";
const TH_STICKY_LEFT = "left-0 z-20 w-20 min-w-20";
const TH_STICKY_NAME = "left-20 z-20 min-w-44 shadow-[0_1px_0_var(--color-hair-strong),1px_0_0_var(--color-hair)]";
const TD_STICKY = "sticky z-[1] bg-surface transition group-hover/row:bg-ground";

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
    const q = fold(query.trim());
    const filtered = q
      ? rows.filter(
          (r) =>
            fold(r.name).includes(q) ||
            r.iso3.toLowerCase() === q ||
            (SEARCH_ALIASES[r.iso3]?.some((alias) => alias.includes(q)) ?? false),
        )
      : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [rows, sortKey, sortDir, query]);

  return (
    <div>
      <label className="block max-w-xs">
        <span className="sr-only">Filter passports by country name or code</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by country..."
          className="min-h-[44px] w-full rounded-lg border border-hair-strong bg-surface px-3.5 py-2 text-[16px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent sm:text-[15px]"
        />
      </label>

      <div className="mt-4 max-h-[75vh] overflow-auto rounded-xl border border-hair bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={`${TH_BASE} ${
                      col.key === "rank" ? TH_STICKY_LEFT : col.key === "name" ? TH_STICKY_NAME : ""
                    } ${col.numeric && col.key !== "rank" ? "text-right" : "text-left"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex min-h-[44px] w-full cursor-pointer items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition hover:text-ink ${
                        col.numeric && col.key !== "rank" ? "justify-end" : "justify-start"
                      } ${active ? "text-ink" : "text-ink-2"}`}
                    >
                      {col.label}
                      <span aria-hidden className={active ? "text-accent" : "text-transparent"}>
                        {active && sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {visible.map((r) => (
              <tr key={r.iso3} className="group/row transition hover:bg-ground">
                <td className={`${TD_STICKY} left-0 px-3.5 py-2 text-sm font-medium tabular-nums text-ink-2`}>#{r.rank}</td>
                <td className={`${TD_STICKY} left-20 px-3.5 py-1 shadow-[1px_0_0_var(--color-hair)]`}>
                  <Link
                    href={`/passport/${r.slug}`}
                    className="group flex min-h-[44px] items-center gap-2.5"
                  >
                    <span className="text-lg">{r.flag}</span>
                    <span className="text-sm font-semibold text-ink transition group-hover:text-accent">
                      {r.name}
                    </span>
                  </Link>
                </td>
                <td className="px-3.5 py-2 text-right text-sm font-medium tabular-nums text-verdict">{r.visaFree}</td>
                <td className="px-3.5 py-2 text-right text-sm font-medium tabular-nums text-voa">{r.visaOnArrival}</td>
                <td className="px-3.5 py-2 text-right text-sm font-medium tabular-nums text-online">{r.eta}</td>
                <td className="px-3.5 py-2 text-right text-sm font-medium tabular-nums text-online/80">{r.eVisa}</td>
                <td className="px-3.5 py-2 text-right text-sm font-bold tabular-nums text-ink">{r.score}</td>
                <td className="px-3.5 py-2 text-right text-sm font-medium tabular-nums text-ink-2">{r.total}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-6 text-center text-sm text-ink-2">
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
