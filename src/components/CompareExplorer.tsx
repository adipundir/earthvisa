"use client";

// Compare two passports, side by side (design system v2 "Instrument").
//   Empty state - one title + two passport inputs (A vs B). Nothing else.
//   Selected - the page becomes the answer: a headline verdict ("{A} reaches N,
//     {B} reaches M") over three scannable destination grids: only {A},
//     only {B}, and both. Every tile links to its corridor page (falling back to
//     the destination page when the corridor was pruned).
// Data plumbing matches the landing: build-time slices via useExplorerCore /
// useComputeData - NEVER @/lib/dataset in a client bundle. We fetch ONE
// ComputeData assembly for [a, b] and derive each passport's reach from it with
// computeWith(data, [iso]) so the two sides share a single network round-trip.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { isoToFlag, nameToSlug } from "@/lib/format";
import {
  flagFor,
  isUsefulCorridor,
  nameFor,
  useComputeData,
  useExplorerCore,
  type CoreCountry,
  type ExplorerCore,
} from "@/lib/explorer-data";
import { computeWith, type CombinedEdge, type PassportResult } from "@/lib/compute-core";
import type { AccessLevel } from "@/lib/types";

// Hardcoded so the empty state is fully server-rendered (names must match the
// dataset allCountries entries). These read as popular, high-intent matchups.
const EXAMPLE_PAIRS: { a: CoreLite; b: CoreLite }[] = [
  { a: { iso3: "IND", iso2: "IN", name: "India" }, b: { iso3: "DEU", iso2: "DE", name: "Germany" } },
  { a: { iso3: "USA", iso2: "US", name: "United States" }, b: { iso3: "GBR", iso2: "GB", name: "United Kingdom" } },
  { a: { iso3: "ARE", iso2: "AE", name: "United Arab Emirates" }, b: { iso3: "IND", iso2: "IN", name: "India" } },
  { a: { iso3: "CHN", iso2: "CN", name: "China" }, b: { iso3: "JPN", iso2: "JP", name: "Japan" } },
];

interface CoreLite {
  iso3: string;
  iso2: string;
  name: string;
}

// ── Grid model (mirrors the landing's tile vocabulary) ───────────────────────

type TileKind = "free" | "fom" | "voa" | "online" | "req";

function levelKind(level: AccessLevel): TileKind {
  if (level === "visa_free") return "free";
  if (level === "visa_on_arrival") return "voa";
  return "online"; // eta + e_visa
}

// "fom" gets the same neutral/bordered treatment as PassportExplorer.tsx uses
// for its free-movement-only tiles - a full green fill would read identically
// to an ordinary visa-free grant, but the underlying right is broader (and not
// a bilateral edge at all).
const ONLY_TILE_CLASS: Record<TileKind, string> = {
  free: "tile tile-free",
  fom: "tile tile-voa",
  voa: "tile tile-voa",
  online: "tile tile-online",
  req: "tile tile-req",
};

function onlySub(edge: CombinedEdge): { text: string; cls: string } {
  const kind = levelKind(edge.level);
  const days = edge.maxStayDays != null ? `${edge.maxStayDays}d` : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
  switch (kind) {
    case "free":
      return { text: join(days ?? "Visa-free"), cls: "text-verdict" };
    case "voa":
      return { text: join("On arrival", days), cls: "text-voa" };
    case "online":
      return { text: edge.level === "eta" ? "eTA" : "eVisa", cls: "text-online" };
    default:
      return { text: "Visa required", cls: "text-change" };
  }
}

/** Corridor-existence gated link: corridor page when it exists for one of the
 * two passports (preferring the one that grants access), else the destination
 * page - never a dead tile. Mirrors PassportExplorer's tileHref. */
function tileHref(dest: string, via: string | null | undefined, pair: string[]): string {
  const nat = [via, ...pair].find(
    (n): n is string => !!n && n !== dest && isUsefulCorridor(n, dest),
  );
  return nat
    ? `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`
    : `/destination/${nameToSlug(nameFor(dest))}`;
}

// ── Count-up (respects prefers-reduced-motion) ───────────────────────────────

function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(target);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ── Country combobox (hero-sized empty state, compact inline after) ──────────

function CountryPicker({
  core,
  exclude,
  onPick,
  hero,
  autoFocus,
  inputId,
  placeholder,
}: {
  core: ExplorerCore | null;
  exclude: string[];
  onPick: (iso3: string) => void;
  hero?: boolean;
  autoFocus?: boolean;
  inputId: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (core?.allCountries ?? [])
      .filter((c) => !exclude.includes(c.iso3))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.iso3.toLowerCase() === q || c.iso2.toLowerCase() === q)
      .slice(0, 80);
  }, [query, exclude, core]);

  const pick = (c: CoreCountry) => {
    onPick(c.iso3);
    setQuery("");
    setOpen(false);
    setHi(-1);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); setHi(-1); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, options.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { const p = options[hi] ?? options[0]; if (p) { e.preventDefault(); pick(p); } }
        }}
        role="combobox"
        aria-expanded={open && (options.length > 0 || query.trim().length > 0)}
        aria-controls={`${inputId}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={hi >= 0 ? `${inputId}-opt-${hi}` : undefined}
        aria-label={placeholder}
        id={inputId}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        className={
          hero
            ? "input-hero"
            : "h-11 w-full rounded-lg border border-hair-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent"
        }
      />
      {open && (options.length > 0 || query.trim().length > 0) && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          aria-label="Matching countries"
          className="float-panel absolute z-40 mt-2 max-h-72 w-full overflow-auto py-1.5 text-left"
        >
          {options.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-2">
              {core
                ? <>No country matches &ldquo;{query.trim()}&rdquo; - try the English name or ISO code</>
                : "Loading countries…"}
            </li>
          )}
          {options.map((c, i) => (
            <li key={c.iso3} role="option" id={`${inputId}-opt-${i}`} aria-selected={hi === i}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => pick(c)}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${hi === i ? "bg-ground" : "hover:bg-ground"}`}
              >
                <span aria-hidden="true" className="text-xl">{isoToFlag(c.iso2)}</span>
                <span className="text-[15px] font-medium text-ink">{c.name}</span>
                <span className="ml-auto text-[12.5px] text-ink-3">{c.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── URL <-> selection (readable, shareable deep links) ───────────────────────

function resolveCountry(core: ExplorerCore, raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const hit = core.allCountries.find(
    (c) => nameToSlug(c.name) === s || c.iso3.toLowerCase() === s || c.iso2.toLowerCase() === s,
  );
  return hit ? hit.iso3 : null;
}

// ── One destination grid (only-A / only-B / both) ────────────────────────────

interface GridItem {
  iso3: string;
  edge?: CombinedEdge;
  via: string | null;
  kind: TileKind;
  sub: { text: string; cls: string };
  bothVisaFree?: boolean;
}

function DestGrid({
  id,
  heading,
  sub,
  items,
  pair,
  emptyText,
}: {
  id: string;
  heading: React.ReactNode;
  sub: string;
  items: GridItem[];
  pair: string[];
  emptyText: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-11">
      <h2 id={id} className="text-[19px] font-bold tracking-tight text-ink">{heading}</h2>
      <p className="mt-1 text-[14px] text-ink-2">{sub}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-[14px] text-ink-3">{emptyText}</p>
      ) : (
        <ul className="mt-4 grid list-none grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label={typeof heading === "string" ? heading : undefined}>
          {items.map((t) => (
            <li key={t.iso3}>
              <Link
                href={tileHref(t.iso3, t.edge?.viaIso3 ?? t.via, pair)}
                className={t.kind === "req" ? "tile border-hair !bg-surface" : ONLY_TILE_CLASS[t.kind]}
              >
                <span aria-hidden="true" className="text-[19px] leading-none">{flagFor(t.iso3)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold leading-tight text-ink">
                    {nameFor(t.iso3)}
                  </span>
                  <span className={`block truncate text-[11.5px] font-medium leading-tight ${t.sub.cls}`}>
                    {t.sub.text}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Freedom-of-movement destinations (fellow Schengen/CARICOM/EU/... bloc
// members) are a real grant but never a bilateral access edge, so they never
// show up in `.reach` - a passport whose access runs through a bloc (e.g.
// Switzerland via Schengen) had every fellow member silently missing from
// every stat and grid on this page. Fold freedomOfMovement into each side's
// destination map before anything downstream reads it, mirroring the
// reach/fom merge PassportExplorer.tsx already does for its tile list.
interface DestInfo { edge?: CombinedEdge; isFom: boolean }

function extendedReach(r: PassportResult): Map<string, DestInfo> {
  const covered = new Set(r.reach.map((e) => e.dest));
  const map = new Map<string, DestInfo>();
  for (const e of r.reachByLevel.visa_free) map.set(e.dest, { edge: e, isFom: false });
  for (const f of r.freedomOfMovement) if (!covered.has(f.dest)) map.set(f.dest, { isFom: true });
  for (const e of r.reachByLevel.visa_on_arrival) map.set(e.dest, { edge: e, isFom: false });
  for (const e of [...r.reachByLevel.eta, ...r.reachByLevel.e_visa]) map.set(e.dest, { edge: e, isFom: false });
  return map;
}

function destItem(dest: string, info: DestInfo, via: string): GridItem {
  return info.isFom
    ? { iso3: dest, via, kind: "fom", sub: { text: "Freedom of movement", cls: "text-verdict" } }
    : { iso3: dest, edge: info.edge, via, kind: levelKind(info.edge!.level), sub: onlySub(info.edge!) };
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CompareExplorer() {
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const { core, failed: coreFailed, retry: retryCore } = useExplorerCore();
  const seededRef = useRef(false);

  // Seed selection from deep-link query params (/compare?a=india&b=germany).
  // Accepts a name slug, ISO3, or ISO2; validated against the country list.
  useEffect(() => {
    if (!core || seededRef.current) return;
    const t = setTimeout(() => {
      seededRef.current = true;
      const sp = new URLSearchParams(window.location.search);
      const ra = resolveCountry(core, sp.get("a"));
      const rb = resolveCountry(core, sp.get("b"));
      if (ra) setA(ra);
      if (rb && rb !== ra) setB(rb);
    }, 0);
    return () => clearTimeout(t);
  }, [core]);

  // Keep the URL in sync so any comparison is a shareable link (no history spam).
  useEffect(() => {
    if (!core || !seededRef.current) return;
    const sp = new URLSearchParams();
    if (a) sp.set("a", nameToSlug(nameFor(a)));
    if (b) sp.set("b", nameToSlug(nameFor(b)));
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/compare?${qs}` : "/compare");
  }, [a, b, core]);

  const pair = useMemo(() => [a, b].filter((x): x is string => !!x), [a, b]);
  const { snap, failed: dataFailed, retry: retryData } = useComputeData(pair, [], pair.length > 0);

  // Both sides derive from ONE assembled ComputeData (keyed to [a, b]); a slice
  // still in flight must never silently shrink a rendered number.
  const sides = useMemo(() => {
    if (!a || !b || !snap) return null;
    if (snap.selected.join("|") !== pair.join("|")) return null;
    const rA = computeWith(snap.data, [a], [], {});
    const rB = computeWith(snap.data, [b], [], {});
    const mapA = extendedReach(rA);
    const mapB = extendedReach(rB);

    const onlyA: GridItem[] = [...mapA.entries()]
      .filter(([dest]) => !mapB.has(dest))
      .map(([dest, info]) => destItem(dest, info, a));
    const onlyB: GridItem[] = [...mapB.entries()]
      .filter(([dest]) => !mapA.has(dest))
      .map(([dest, info]) => destItem(dest, info, b));
    const both: GridItem[] = [...mapA.entries()]
      .filter(([dest]) => mapB.has(dest))
      .map(([dest, infoA]) => {
        const infoB = mapB.get(dest)!;
        const bothVf = !infoA.isFom && !infoB.isFom && infoA.edge?.level === "visa_free" && infoB.edge?.level === "visa_free";
        const bothFom = infoA.isFom && infoB.isFom;
        return {
          iso3: dest,
          edge: infoA.edge,
          via: a,
          kind: "req" as TileKind, // neutral surface for the shared list
          sub: bothVf
            ? { text: "Visa-free for both", cls: "text-verdict" }
            : bothFom
            ? { text: "Freedom of movement for both", cls: "text-verdict" }
            : { text: "Both reach", cls: "text-ink-3" },
        };
      });

    return {
      a: { iso3: a, reach: mapA.size, vf: rA.reachByLevel.visa_free.length },
      b: { iso3: b, reach: mapB.size, vf: rB.reachByLevel.visa_free.length },
      onlyA,
      onlyB,
      both,
    };
  }, [a, b, snap, pair]);

  useEffect(() => {
    if (sides) track("compare_computed", { a: sides.a.iso3, b: sides.b.iso3 });
  }, [sides]);

  const total = core?.allCountries.length ?? 199;
  const showA = useCountUp(sides?.a.reach ?? 0);
  const showB = useCountUp(sides?.b.reach ?? 0);

  function clearA() { setA(null); }
  function clearB() { setB(null); }
  function swap() { setA(b); setB(a); }

  const bothSelected = !!a && !!b;

  // ── Empty state: the title + two inputs. Nothing else. ──
  if (!bothSelected) {
    return (
      <section className="mx-auto flex min-h-[calc(100svh-61px)] w-full max-w-3xl flex-col items-center justify-center px-5 pb-24 sm:px-8">
        <div className="w-full text-center">
          <h1 className="text-question text-ink">Compare two passports</h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-relaxed text-ink-2">
            Pick two passports to see where each can go with no embassy visit, side by side.
          </p>

          {coreFailed && !core ? (
            <DataError onRetry={retryCore} />
          ) : (
            <div className="mx-auto mt-9 flex max-w-[640px] flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-left">
                {a ? (
                  <SelectedSlot iso3={a} rank={core?.ranks[a]} onClear={clearA} />
                ) : (
                  <CountryPicker core={core} exclude={pair} onPick={setA} hero inputId="compare-a" placeholder="First passport - e.g. India" />
                )}
              </div>
              <span aria-hidden="true" className="shrink-0 text-[14px] font-semibold uppercase tracking-wide text-ink-3">vs</span>
              <div className="min-w-0 flex-1 text-left">
                {b ? (
                  <SelectedSlot iso3={b} rank={core?.ranks[b]} onClear={clearB} />
                ) : (
                  <CountryPicker core={core} exclude={pair} onPick={setB} hero inputId="compare-b" placeholder="Second passport - e.g. Germany" />
                )}
              </div>
            </div>
          )}

          <p className="mt-6 text-[14px] text-ink-3">
            Try:{" "}
            {EXAMPLE_PAIRS.map((p, i) => (
              <span key={`${p.a.iso3}-${p.b.iso3}`}>
                {i > 0 && <span aria-hidden> · </span>}
                <button
                  type="button"
                  onClick={() => { setA(p.a.iso3); setB(p.b.iso3); }}
                  className="relative font-medium text-ink-2 underline decoration-hair-strong underline-offset-4 transition after:absolute after:-inset-2 after:content-[''] hover:text-accent hover:decoration-accent"
                >
                  <span aria-hidden="true">{isoToFlag(p.a.iso2)}</span> {p.a.name}
                  {" vs "}
                  <span aria-hidden="true">{isoToFlag(p.b.iso2)}</span> {p.b.name}
                </button>
              </span>
            ))}
          </p>
        </div>
      </section>
    );
  }

  // ── Selected state: the page becomes the comparison. ──
  const leader = sides ? (sides.a.reach === sides.b.reach ? null : sides.a.reach > sides.b.reach ? a : b) : null;
  const diff = sides ? Math.abs(sides.a.reach - sides.b.reach) : 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-7 sm:px-8">
      {/* Picker row: A vs B chips with swap */}
      <div className="flex flex-wrap items-center gap-2">
        <PassportChip iso3={a!} rank={core?.ranks[a!]} onClear={clearA} />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap the two passports"
          title="Swap"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hair-strong bg-surface text-ink-2 transition hover:border-ink-3 hover:text-accent"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 3L1.5 5.5 4 8M1.5 5.5H11M12 13l2.5-2.5L12 8M14.5 10.5H5" />
          </svg>
        </button>
        <PassportChip iso3={b!} rank={core?.ranks[b!]} onClear={clearB} />
      </div>

      {dataFailed ? (
        <DataError onRetry={retryData} />
      ) : !sides ? (
        <DataPending />
      ) : (
        <>
          {/* The verdict: two reach numbers, side by side */}
          <div className="mt-8">
            <p className="sr-only" role="status" aria-live="polite">
              {nameFor(a!)} reaches {sides.a.reach} destinations with no embassy visit; {nameFor(b!)} reaches {sides.b.reach}.
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-8">
              <VerdictSide iso3={a!} count={showA} total={total} vf={sides.a.vf} leads={leader === a} />
              <span aria-hidden="true" className="pb-6 text-center text-[15px] font-semibold uppercase tracking-wide text-ink-3">vs</span>
              <VerdictSide iso3={b!} count={showB} total={total} vf={sides.b.vf} leads={leader === b} align="right" />
            </div>
            <p className="mt-5 text-[16px] font-medium text-ink-2">
              {leader
                ? <>The <span className="font-semibold text-ink">{nameFor(leader)}</span> passport reaches <span className="font-semibold text-ink tabular-nums">{diff}</span> more {diff === 1 ? "destination" : "destinations"} with no embassy visit.</>
                : <>Both passports reach the same number of destinations with no embassy visit.</>}
            </p>
          </div>

          {/* Only A - the differentiators */}
          <DestGrid
            id="only-a"
            heading={<>Only {nameFor(a!)} <span className="font-semibold tabular-nums text-ink-3">{sides.onlyA.length}</span></>}
            sub={`Destinations ${nameFor(a!)} can reach that ${nameFor(b!)} cannot.`}
            items={sides.onlyA}
            pair={pair}
            emptyText={`Every destination ${nameFor(a!)} reaches is also reachable by ${nameFor(b!)}.`}
          />

          {/* Only B */}
          <DestGrid
            id="only-b"
            heading={<>Only {nameFor(b!)} <span className="font-semibold tabular-nums text-ink-3">{sides.onlyB.length}</span></>}
            sub={`Destinations ${nameFor(b!)} can reach that ${nameFor(a!)} cannot.`}
            items={sides.onlyB}
            pair={pair}
            emptyText={`Every destination ${nameFor(b!)} reaches is also reachable by ${nameFor(a!)}.`}
          />

          {/* Both */}
          <DestGrid
            id="both"
            heading={<>Both <span className="font-semibold tabular-nums text-ink-3">{sides.both.length}</span></>}
            sub={`Reachable with no embassy visit on either passport.`}
            items={sides.both}
            pair={pair}
            emptyText="No destination is reachable by both passports."
          />
        </>
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictSide({
  iso3,
  count,
  total,
  vf,
  leads,
  align,
}: {
  iso3: string;
  count: number;
  total: number;
  vf: number;
  leads: boolean;
  align?: "right";
}) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <p className={`flex items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
        <span aria-hidden="true" className="text-[19px] leading-none">{flagFor(iso3)}</span>
        <span className="truncate text-[15.5px] font-semibold text-ink">{nameFor(iso3)}</span>
        {leads && (
          <span className="rounded-full border border-hair-strong px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            Wider
          </span>
        )}
      </p>
      <p className="stat-num mt-1 text-[clamp(56px,10vw,104px)] text-ink">
        {count}
        <span className="text-[0.34em] font-bold text-ink-3">/{total}</span>
      </p>
      <p className="mt-0.5 text-[13.5px] text-ink-2">
        no embassy visit · <span className="text-verdict">{vf} visa-free</span>
      </p>
    </div>
  );
}

function PassportChip({ iso3, rank, onClear }: { iso3: string; rank?: number; onClear: () => void }) {
  return (
    <span className="chip !gap-0 py-1 pl-3 pr-1.5 text-ink">
      <span aria-hidden="true" className="mr-2 text-[17px] leading-none">{flagFor(iso3)}</span>
      <span className="font-semibold">{nameFor(iso3)}</span>
      {rank != null && (
        <Link
          href="/rankings"
          title={`${nameFor(iso3)} passport ranking`}
          className="ml-2 text-[12.5px] font-medium tabular-nums text-ink-3 underline-offset-4 transition hover:text-accent hover:underline"
        >
          #{rank}
        </Link>
      )}
      <button
        onClick={onClear}
        aria-label={`Remove ${nameFor(iso3)}`}
        className="ml-1 grid h-7 w-7 place-items-center rounded-full text-[15px] text-ink-3 transition hover:bg-ground hover:text-change"
      >×</button>
    </span>
  );
}

// Empty-state slot: a selected passport shown as a full-width tile with a
// "change" affordance, so a partial pick (one of two) still reads clearly.
function SelectedSlot({ iso3, rank, onClear }: { iso3: string; rank?: number; onClear: () => void }) {
  return (
    <div className="flex h-[60px] items-center gap-3 rounded-lg border border-hair-strong bg-surface px-4 max-sm:h-14">
      <span aria-hidden="true" className="text-[22px] leading-none">{flagFor(iso3)}</span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-ink">{nameFor(iso3)}</span>
        {rank != null && <span className="block text-[12.5px] text-ink-3 tabular-nums">Rank #{rank}</span>}
      </span>
      <button
        onClick={onClear}
        aria-label={`Change ${nameFor(iso3)}`}
        className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[16px] text-ink-3 transition hover:bg-ground hover:text-change"
      >×</button>
    </div>
  );
}

// ── Loading / error (matches PassportExplorer) ───────────────────────────────

function DataPending() {
  return (
    <div role="status" aria-live="polite" className="mt-8">
      <span className="sr-only">Loading official records…</span>
      <div aria-hidden="true" className="grid grid-cols-[1fr_auto_1fr] items-end gap-8">
        <div className="h-[104px] animate-pulse rounded-xl bg-paper-2" />
        <div className="h-6 w-8" />
        <div className="h-[104px] animate-pulse rounded-xl bg-paper-2" />
      </div>
      <div aria-hidden="true" className="mt-11 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-[9px] bg-paper-2" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    </div>
  );
}

function DataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="float-panel mt-8 px-6 py-9 text-center">
      <p className="text-[19px] font-bold text-ink">Couldn&apos;t load the visa dataset</p>
      <p className="mx-auto mt-1.5 max-w-md text-[14.5px] text-ink-2">
        The connection dropped before the official records arrived. Nothing is shown until they load - we never guess.
      </p>
      <button onClick={onRetry} className="btn-stamp mt-5 min-w-32">
        Retry
      </button>
    </div>
  );
}
