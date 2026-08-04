"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

// A category menu bar over the corridor page's visa-type grid. The grid itself
// is server-rendered (all types, each wrapped in a [data-vt="<category>"]
// element) and passed as children, so every type is in the DOM for crawlers
// and no-JS readers - this component only shows/hides on click, the same
// imperative pattern as SearchableLedger. Filtering matters here because a
// corridor like India->Japan carries 40+ visa types and a flat list buries the
// tourist visa most people actually want under work/family/investment ones.
export default function VisaTypeFilter({
  categories,
  children,
}: {
  /** {key, label, count} per category present in the grid, already ordered. */
  categories: { key: string; label: string; count: number }[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("all");
  const total = categories.reduce((n, c) => n + c.count, 0);

  function pick(key: string) {
    setActive(key);
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-vt]").forEach((el) => {
      el.hidden = key !== "all" && el.dataset.vt !== key;
    });
  }

  return (
    <div ref={rootRef}>
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => pick("all")} aria-pressed={active === "all"} className="chip shrink-0">
          All <span className="tabular-nums opacity-70">{total}</span>
        </button>
        {categories.map((c) => (
          <button key={c.key} type="button" onClick={() => pick(c.key)} aria-pressed={active === c.key} className="chip shrink-0">
            {c.label} <span className="tabular-nums opacity-70">{c.count}</span>
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
