"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface FeeRow {
  rank: number;
  iso3: string;
  flag: string;
  name: string;
  slug: string;
  region: string;
  /** cheapest published tourist-oriented fee, in USD (0 = free) */
  feeUsd: number;
  /** formatted native-currency amount, e.g. "AED 100 (~$27)" or "Free" */
  feeLabel: string;
  kindLabel: string;
  sourceHost: string | null;
  sourceUrl: string | null;
}

type SortKey = "rank" | "name" | "region" | "feeUsd";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "rank", label: "Rank", numeric: true },
  { key: "name", label: "Destination", numeric: false },
  { key: "region", label: "Region", numeric: false },
  { key: "feeUsd", label: "Fee (from)", numeric: true },
];

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const TH_BASE = "sticky top-0 z-10 bg-paper-2 shadow-[0_1px_0_var(--color-line-strong)]";
const TH_STICKY_LEFT = "left-0 z-20 w-20 min-w-20";
const TH_STICKY_NAME = "left-20 z-20 min-w-44 shadow-[0_1px_0_var(--color-line-strong),1px_0_0_var(--color-line)]";
const TD_STICKY = "sticky z-[1] bg-card transition group-hover/row:bg-paper-2";

/**
 * Client-side sortable/filterable table of every destination with a
 * comparable official tourist-visa/e-visa/on-arrival/eTA fee. Rows are
 * computed server-side (fully static page); this island only re-orders and
 * filters them in the browser - no data fetching.
 */
export default function FeesTable({ rows }: { rows: FeeRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" || key === "name" || key === "region" ? "asc" : "desc");
    }
  }

  const visible = useMemo(() => {
    const q = fold(query.trim());
    const filtered = q
      ? rows.filter((r) => fold(r.name).includes(q) || fold(r.region).includes(q) || r.iso3.toLowerCase() === q)
      : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name" || sortKey === "region") return a[sortKey].localeCompare(b[sortKey]) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [rows, sortKey, sortDir, query]);

  return (
    <div>
      <label className="block max-w-xs">
        <span className="sr-only">Filter destinations by country or region</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by country or region..."
          className="mono min-h-[44px] w-full rounded-sm border border-line bg-card px-3.5 py-2 text-sm text-ink placeholder:text-ink-mute outline-none focus:border-stamp"
        />
      </label>

      <div className="card-doc mt-4 max-h-[75vh] overflow-auto">
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
                      className={`mono inline-flex min-h-[44px] w-full cursor-pointer items-center gap-1.5 px-3.5 py-2 text-[11px] uppercase tracking-[0.15em] transition hover:text-ink ${
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
              <th scope="col" className={`${TH_BASE} text-left`}>
                <span className="mono inline-flex min-h-[44px] items-center px-3.5 py-2 text-[11px] uppercase tracking-[0.15em] text-ink-mute">
                  Product / source
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.iso3} className="group/row transition hover:bg-paper-2">
                <td className={`${TD_STICKY} left-0 mono px-3.5 py-2 text-sm tabular-nums text-ink-mute`}>#{r.rank}</td>
                <td className={`${TD_STICKY} left-20 px-3.5 py-1 shadow-[1px_0_0_var(--color-line)]`}>
                  <Link
                    href={`/destination/${r.slug}`}
                    className="group/link flex min-h-[44px] items-center gap-2 py-1 text-sm font-medium text-ink transition hover:text-stamp"
                  >
                    <span className="text-base leading-none">{r.flag}</span>
                    {r.name}
                  </Link>
                </td>
                <td className="px-3.5 py-2 text-sm text-ink-soft">{r.region}</td>
                <td className={`mono px-3.5 py-2 text-right text-sm font-semibold tabular-nums ${r.feeUsd === 0 ? "text-vfree" : r.feeUsd >= 150 ? "text-stamp" : "text-ink"}`}>
                  {r.feeUsd === 0 ? "Free" : `$${r.feeUsd.toLocaleString()}`}
                </td>
                <td className="mono px-3.5 py-2 text-[11px] text-ink-mute">
                  <span>{r.kindLabel}</span>
                  {r.sourceUrl && r.sourceHost && (
                    <>
                      {" · "}
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 transition hover:text-ink hover:underline">
                        {r.sourceHost} ↗
                      </a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && (
        <p className="mono mt-4 text-center text-sm text-ink-mute">No destinations match &quot;{query}&quot;.</p>
      )}
    </div>
  );
}
