"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// A category menu bar over the corridor page's visa-type grid. The grid itself
// is server-rendered (all types, each wrapped in a [data-vt="<category>"]
// element) and passed as children, so every type is in the DOM for crawlers
// and no-JS readers - this component only shows/hides on click, the same
// imperative pattern as SearchableLedger. Filtering matters here because a
// corridor like India->Japan carries 40+ visa types and a flat list buries the
// tourist visa most people actually want under work/family/investment ones.
//
// It now OPENS on the common categories rather than on all of them. India to
// Japan rendered 44 rows at load and the tourist visa - the reason almost
// everyone opens the page - sat somewhere among work, research, entertainer
// and investor types. The narrowing happens in an effect after mount, never on
// the server, so the HTML still carries every row: a crawler and a reader with
// no JavaScript both get the full list, and a browser hides what one tap on
// "All" brings back.
export default function VisaTypeFilter({
  categories,
  commonKeys = [],
  children,
}: {
  /** {key, label, count} per category present in the grid, already ordered. */
  categories: { key: string; label: string; count: number }[];
  /** Categories worth opening on, when the list is long enough to need it. */
  commonKeys?: string[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const total = categories.reduce((n, c) => n + c.count, 0);
  const commonCount = categories
    .filter((c) => commonKeys.includes(c.key))
    .reduce((n, c) => n + c.count, 0);
  // Only worth a narrowed default when it actually hides something: a corridor
  // with six tourist types and nothing else should not offer "Common 6"
  // alongside "All 6".
  const useCommon = commonCount > 0 && commonCount < total;
  const [active, setActive] = useState(useCommon ? "common" : "all");

  function apply(key: string) {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-vt]").forEach((el) => {
      const cat = el.dataset.vt ?? "";
      el.hidden =
        key === "all" ? false : key === "common" ? !commonKeys.includes(cat) : cat !== key;
    });
  }

  function pick(key: string) {
    setActive(key);
    apply(key);
  }

  // After mount only. During render it would be a hydration mismatch, and on
  // the server it would take the rows out of the HTML.
  useEffect(() => {
    if (useCommon) apply("common");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef}>
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {useCommon && (
          <button type="button" onClick={() => pick("common")} aria-pressed={active === "common"} className="chip shrink-0">
            Common <span className="tabular-nums opacity-70">{commonCount}</span>
          </button>
        )}
        {categories.map((c) => (
          <button key={c.key} type="button" onClick={() => pick(c.key)} aria-pressed={active === c.key} className="chip shrink-0">
            {c.label} <span className="tabular-nums opacity-70">{c.count}</span>
          </button>
        ))}
        <button type="button" onClick={() => pick("all")} aria-pressed={active === "all"} className="chip shrink-0">
          All <span className="tabular-nums opacity-70">{total}</span>
        </button>
      </div>
      {children}
    </div>
  );
}
