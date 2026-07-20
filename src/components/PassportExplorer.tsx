"use client";

// The landing IS the product (design system v2 "Instrument"):
//   Empty state - one centered question + the passport input. Nothing else.
//   Selected - the same page transforms: compact context row (chips, rank,
//                  quiet credential entry), a count-up headline stat, level
//                  filter chips, and the fill-coded 199-destination grid.
// Every tile links to its corridor page (falling back to the destination page
// when the corridor was pruned). Data plumbing is unchanged: build-time slices
// via useExplorerCore/useComputeData - NEVER @/lib/dataset in a client bundle.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { isoToFlag, nameToSlug } from "@/lib/format";
import {
  credShort,
  flagFor,
  isUsefulCorridor,
  nameFor,
  useComputeData,
  useExplorerCore,
  type CoreCountry,
  type ExplorerCore,
} from "@/lib/explorer-data";
import { useDetectedPassport } from "@/lib/geo";
import WorldDotMap from "@/components/WorldDotMap";
import { computeWith, type CombinedEdge } from "@/lib/compute-core";
import type { Credential, PassportType } from "@/lib/types";

const PASSPORT_TYPES: { id: PassportType; label: string }[] = [
  { id: "ordinary", label: "Ordinary" },
  { id: "diplomatic", label: "Diplomatic" },
  { id: "service", label: "Service" },
  { id: "official", label: "Official" },
];

// Hardcoded (not read from the fetched core slice) so the empty state is fully
// server-rendered - names must match dataset allCountries entries.
const EXAMPLE_PASSPORTS = [
  { iso3: "IND", iso2: "IN", name: "India" },
  { iso3: "DEU", iso2: "DE", name: "Germany" },
  { iso3: "USA", iso2: "US", name: "US" },
];

// ISO3 to show as flag for each credential group
const GROUP_ISO3: Record<string, string> = {
  "United States": "USA",
  "Canada": "CAN",
  "United Kingdom": "GBR",
  "Gulf (GCC)": "ARE",
  "India": "IND",
  "Australia": "AUS",
  "Schengen / EU": "DEU",
  "Japan": "JPN",
  "New Zealand": "NZL",
  "South Korea": "KOR",
  "Singapore": "SGP",
  "Mexico": "MEX",
  "Chile": "CHL",
  "Colombia": "COL",
  "Peru": "PER",
  "Brazil": "BRA",
};

// Short label shown on a credential option (country already visible from the group header)
const CRED_CHIP_LABEL: Record<string, string> = {
  US_VISA: "Any visa",
  US_GREEN_CARD: "Green Card",
  CA_VISA: "Any visa",
  CA_PR: "Permanent resident",
  UK_VISA: "Any visa",
  UK_PR: "ILR / settled status",
  SCHENGEN_VISA: "Schengen visa",
  EU_RESIDENCE: "Residence / PR",
  AU_VISA: "Any visa",
  AU_PR: "Permanent resident",
  NZ_VISA: "Visa or residence",
  JP_VISA: "Visa or residence",
  KR_VISA: "Visa or residence",
  SGP_VISA: "Visa or residence",
  GCC_RESIDENCE: "Residence permit",
  OCI: "OCI card",
  MX_VISA: "Any visa",
  MX_PR: "Permanent resident",
  CHL_PR: "Permanent resident",
  COL_PR: "Permanent resident",
  PER_PR: "Permanent resident",
  BRA_PR: "Residence permit",
};

// Group credentials by issuing country (preserving CRED_CATALOG order)
function buildCredentialGroups(credentials: Credential[]): { name: string; items: Credential[] }[] {
  const map = new Map<string, Credential[]>();
  for (const c of credentials) {
    if (!map.has(c.group)) map.set(c.group, []);
    map.get(c.group)!.push(c);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

// ── Count-up (respects prefers-reduced-motion) ───────────────────────────────

function useCountUp(target: number, duration = 750): number {
  const [val, setVal] = useState(target);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      if (reduced) { setVal(target); return; }
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

// ── Grid model ───────────────────────────────────────────────────────────────

type TileKind = "free" | "fom" | "voa" | "online" | "req";
type FilterKey = "all" | "free" | "voa" | "online" | "req";

interface Tile {
  iso3: string;
  kind: TileKind;
  edge?: CombinedEdge;
  /** destination shares a free-movement bloc with a selected passport */
  fom?: boolean;
}

const TILE_CLASS: Record<TileKind, string> = {
  free: "tile tile-free",
  fom: "tile tile-voa",
  voa: "tile tile-voa",
  online: "tile tile-online",
  req: "tile tile-req",
};

function tileSub(t: Tile): { text: string; cls: string; srPrefix?: string } {
  const via = t.edge?.viaCredential ? `via ${credShort(t.edge.viaCredential) ?? "visa held"}` : null;
  const dip = t.edge?.viaPassportType ? t.edge.viaPassportType : null;
  const days = t.edge?.maxStayDays != null ? `${t.edge.maxStayDays}d` : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
  switch (t.kind) {
    case "free":
      return t.fom
        ? { text: "Free movement", cls: "text-verdict" }
        : { text: join(days ?? "Visa-free", via, dip), cls: "text-verdict", srPrefix: days ? "Visa-free, " : undefined };
    case "fom":
      return { text: "Free movement", cls: "text-verdict" };
    case "voa":
      return { text: join("On arrival", days, via), cls: "text-voa" };
    case "online":
      return { text: join(t.edge!.level === "eta" ? "eTA" : "eVisa", days, via), cls: "text-online" };
    case "req":
      return { text: "Visa required", cls: "text-change" };
  }
}

/** Corridor-existence gated link: corridor page when it exists for a selected
 * passport (preferring the one that grants the access), else the destination
 * page - never a dead tile. */
function tileHref(dest: string, viaIso3: string | null | undefined, selected: string[]): string {
  const nat = [viaIso3, ...selected].find(
    (n): n is string => !!n && n !== dest && isUsefulCorridor(n, dest),
  );
  return nat
    ? `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(dest))}`
    : `/destination/${nameToSlug(nameFor(dest))}`;
}

// ── Country combobox (hero-sized on the empty state, compact inline after) ───

function CountrySearch({
  core,
  exclude,
  onPick,
  hero,
  autoFocus,
  inputId,
}: {
  core: ExplorerCore | null;
  exclude: string[];
  onPick: (iso3: string) => void;
  hero?: boolean;
  autoFocus?: boolean;
  inputId: string;
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
        aria-label="Search for a passport country"
        id={inputId}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={hero ? "Your passport - e.g. India" : "Add a passport…"}
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

// ── Main component ───────────────────────────────────────────────────────────

export default function PassportExplorer() {
  const [selected, setSelected] = useState<string[]>([]);
  const [creds, setCreds] = useState<string[]>([]);
  const [ptypes, setPtypes] = useState<Record<string, PassportType>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const detectedPassport = useDetectedPassport();
  const autoSeededRef = useRef(false);
  const addRef = useRef<HTMLDivElement>(null);
  const credRef = useRef<HTMLDivElement>(null);
  const typeRefs = useRef<Record<string, HTMLElement | null>>({});

  const { core, failed: coreFailed, retry: retryCore } = useExplorerCore();

  // Seed selection from deep-link query params (e.g. /?passport=IND,DEU&cred=US_VISA)
  // so links from the static passport/destination pages land pre-filled.
  // Waits for the core slice - params are validated against the country list.
  useEffect(() => {
    if (!core) return;
    // Deferred a tick so state updates never run synchronously in the effect
    // flush (react-hooks/set-state-in-effect); behavior is unchanged.
    const t = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      const valid = new Set(core.allCountries.map((c) => c.iso3));
      const passports = (sp.get("passport") ?? "")
        .split(",").map((s) => s.trim().toUpperCase()).filter((s) => valid.has(s));
      if (passports.length) {
        setSelected(passports);
        setPtypes(Object.fromEntries(passports.map((p) => [p, "ordinary" as PassportType])));
      }
      const credParam = (sp.get("cred") ?? "")
        .split(",").map((s) => s.trim()).filter((id) => core.credentials.some((c) => c.id === id));
      if (credParam.length) setCreds(credParam);
    }, 0);
    return () => clearTimeout(t);
  }, [core]);

  // Auto-fill the passport from the visitor's detected country - but only on a
  // truly empty field, and never over a deep-link or a manual choice.
  useEffect(() => {
    if (!detectedPassport || autoSeededRef.current) return;
    if (new URLSearchParams(window.location.search).get("passport")) return;
    const t = setTimeout(() => {
      autoSeededRef.current = true;
      setSelected((prev) => (prev.length ? prev : [detectedPassport]));
      setPtypes((prev) => (detectedPassport in prev ? prev : { ...prev, [detectedPassport]: "ordinary" }));
      setAutoDetected(detectedPassport);
    }, 0);
    return () => clearTimeout(t);
  }, [detectedPassport]);

  // Close the add-passport / credential popovers on outside click or Escape.
  useEffect(() => {
    if (!addOpen && !credOpen && !typeOpen) return;
    function onClick(e: MouseEvent) {
      const n = e.target as Node;
      if (addOpen && addRef.current && !addRef.current.contains(n)) setAddOpen(false);
      if (credOpen && credRef.current && !credRef.current.contains(n)) setCredOpen(false);
      if (typeOpen) {
        const el = typeRefs.current[typeOpen];
        if (el && !el.contains(n)) setTypeOpen(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setAddOpen(false); setCredOpen(false); setTypeOpen(null); }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen, credOpen, typeOpen]);

  const hasInput = selected.length > 0 || creds.length > 0;
  const { snap, failed: dataFailed, retry: retryData } = useComputeData(selected, creds, hasInput);
  // Results render only when the fetched slices cover the CURRENT selection -
  // a slice that is still in flight must never silently shrink the numbers.
  const result = useMemo(() => {
    if (!snap) return null;
    if (snap.selected.join("|") !== selected.join("|") || snap.creds.join("|") !== creds.join("|")) return null;
    return computeWith(snap.data, snap.selected, snap.creds, ptypes);
  }, [snap, selected, creds, ptypes]);

  // The 199-destination grid: reach order (level desc, name asc), then
  // free-movement-only, then visa-required alphabetically. FoM-only bloc
  // co-members must NEVER fall through to "visa required".
  const tiles = useMemo<Tile[]>(() => {
    if (!result || !core) return [];
    const fomSet = new Set(result.freedomOfMovement.map((f) => f.dest));
    const covered = new Set(result.reach.map((e) => e.dest));
    const selSet = new Set(result.selected);
    const out: Tile[] = [];
    for (const e of result.reachByLevel.visa_free) out.push({ iso3: e.dest, kind: "free", edge: e, fom: fomSet.has(e.dest) });
    for (const f of result.freedomOfMovement) if (!covered.has(f.dest)) out.push({ iso3: f.dest, kind: "fom" });
    for (const e of result.reachByLevel.visa_on_arrival) out.push({ iso3: e.dest, kind: "voa", edge: e });
    for (const e of [...result.reachByLevel.eta, ...result.reachByLevel.e_visa].sort((a, b) => nameFor(a.dest).localeCompare(nameFor(b.dest)))) {
      out.push({ iso3: e.dest, kind: "online", edge: e });
    }
    const rest = core.allCountries
      .filter((c) => !selSet.has(c.iso3) && !covered.has(c.iso3) && !fomSet.has(c.iso3))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const c of rest) out.push({ iso3: c.iso3, kind: "req" });
    return out;
  }, [result, core]);

  const counts = useMemo(() => {
    const c = { all: tiles.length, free: 0, voa: 0, online: 0, req: 0 };
    for (const t of tiles) {
      if (t.kind === "free" || t.kind === "fom") c.free++;
      else if (t.kind === "voa") c.voa++;
      else if (t.kind === "online") c.online++;
      else c.req++;
    }
    return c;
  }, [tiles]);

  const visible = useMemo(() => {
    if (filter === "all") return tiles;
    if (filter === "free") return tiles.filter((t) => t.kind === "free" || t.kind === "fom");
    return tiles.filter((t) => t.kind === filter);
  }, [tiles, filter]);

  const total = core?.allCountries.length ?? 199;
  const reachCount = result?.reach.length ?? 0;
  const shown = useCountUp(reachCount);

  const credentialGroups = useMemo(() => buildCredentialGroups(core?.credentials ?? []), [core]);

  // iso3 -> access kind for the reach map (req included so required
  // countries render as faint neutral dots rather than unknowns).
  const kindByIso3 = useMemo(() => {
    const m: Record<string, TileKind> = {};
    for (const t of tiles) m[t.iso3] = t.kind;
    return m;
  }, [tiles]);

  function add(iso3: string) {
    setSelected((s) => (s.includes(iso3) ? s : [...s, iso3]));
    setPtypes((p) => (iso3 in p ? p : { ...p, [iso3]: "ordinary" }));
    setAddOpen(false);
  }
  function remove(iso3: string) {
    setSelected((s) => s.filter((x) => x !== iso3));
    setPtypes((p) => { const n = { ...p }; delete n[iso3]; return n; });
    if (autoDetected === iso3) setAutoDetected(null);
  }
  function toggleCred(id: string) {
    setCreds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  // ── Empty state: the question, the input, one Try line. Nothing else. ──
  if (!hasInput) {
    return (
      <section className="flex min-h-[calc(100svh-61px)] flex-col items-center justify-center px-5 pb-24 sm:px-8">
        <div className="w-full text-center">
          <h1 className="text-question mx-auto max-w-[13ch] text-ink lg:max-w-none">Where can you&nbsp;go?</h1>
          <div className="mx-auto mt-9 max-w-[560px] text-left">
            {coreFailed && !core ? (
              <DataError onRetry={retryCore} />
            ) : (
              <CountrySearch core={core} exclude={selected} onPick={add} hero inputId="passport-search-input" />
            )}
          </div>
          <p className="mt-6 text-[14px] text-ink-3">
            Try:{" "}
            {EXAMPLE_PASSPORTS.map((c, i) => (
              <span key={c.iso3}>
                {i > 0 && <span aria-hidden> · </span>}
                <button
                  type="button"
                  onClick={() => add(c.iso3)}
                  className="relative font-medium text-ink-2 underline decoration-hair-strong underline-offset-4 transition after:absolute after:-inset-2 after:content-[''] hover:text-accent hover:decoration-accent"
                >
                  <span aria-hidden="true">{isoToFlag(c.iso2)}</span> {c.name}
                </button>
              </span>
            ))}
          </p>
        </div>
      </section>
    );
  }

  // ── Selected state: the page becomes the answer. ──
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-7 sm:px-8">
      <h1 className="sr-only">Where can you go?</h1>

      {/* Context row: passport chips + rank + quiet add controls */}
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((iso3) => {
          const t = ptypes[iso3] ?? "ordinary";
          const isOpen = typeOpen === iso3;
          return (
            <span key={iso3} className="flex items-center gap-2">
              <span className="chip !gap-0 py-1 pl-3 pr-1.5 text-ink">
                <span aria-hidden="true" className="mr-2 text-[17px] leading-none">{flagFor(iso3)}</span>
                <span className="font-semibold">{nameFor(iso3)}</span>
                {/* passport-type control: quiet, sentence case, on the chip */}
                <span className="relative" ref={(el) => { typeRefs.current[iso3] = el; }}>
                  <button
                    onClick={() => setTypeOpen(isOpen ? null : iso3)}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-label={`Passport type for ${nameFor(iso3)}: ${t}`}
                    className="ml-1 inline-flex min-h-[28px] items-center gap-1 rounded-full px-1.5 text-[12.5px] font-medium text-ink-2 transition hover:text-accent"
                  >
                    {t !== "ordinary" && <span className="capitalize">{t}</span>}
                    <svg viewBox="0 0 10 6" className={`h-[7px] w-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true">
                      <path d="M0 0l5 6 5-6z" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div role="listbox" aria-label="Passport type" className="float-panel absolute left-1/2 top-full z-50 mt-2 w-44 -translate-x-1/2 overflow-hidden py-1.5">
                      <p className="px-3.5 pb-1.5 pt-1 text-[12px] font-semibold text-ink-3">Passport type</p>
                      {PASSPORT_TYPES.map((pt) => {
                        const active = t === pt.id;
                        return (
                          <button
                            key={pt.id}
                            role="option"
                            aria-selected={active}
                            onClick={() => { setPtypes((p) => ({ ...p, [iso3]: pt.id })); setTypeOpen(null); }}
                            className={`flex w-full items-center px-3.5 py-2 text-left text-[14px] transition ${
                              active ? "font-semibold text-accent" : "text-ink hover:bg-ground"
                            }`}
                          >
                            {pt.label}
                            {active && <span className="ml-auto" aria-hidden="true">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </span>
                <button
                  onClick={() => remove(iso3)}
                  aria-label={`Remove ${nameFor(iso3)}`}
                  className="ml-0.5 grid h-7 w-7 place-items-center rounded-full text-[15px] text-ink-3 transition hover:bg-ground hover:text-change"
                >×</button>
              </span>
            </span>
          );
        })}

        {creds.map((id) => {
          const c = core?.credentials.find((x) => x.id === id);
          if (!c) return null;
          return (
            <span key={id} className="chip py-1 pl-3 pr-1.5 !text-accent" style={{ borderColor: "color-mix(in srgb, var(--stamp) 35%, transparent)" }}>
              {GROUP_ISO3[c.group] && <span aria-hidden="true" className="text-[15px] leading-none">{flagFor(GROUP_ISO3[c.group])}</span>}
              <span className="font-medium">{c.short}</span>
              <button
                onClick={() => toggleCred(id)}
                aria-label={`Remove ${c.short}`}
                className="grid h-7 w-7 place-items-center rounded-full text-[15px] text-ink-3 transition hover:bg-ground hover:text-change"
              >×</button>
            </span>
          );
        })}

        {/* + add passport (dual citizens) */}
        <span ref={addRef} className="relative">
          <button
            onClick={() => { setAddOpen((o) => !o); setCredOpen(false); }}
            aria-expanded={addOpen}
            className="chip border-dashed !bg-transparent"
          >
            + passport
          </button>
          {addOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-72">
              <CountrySearch core={core} exclude={selected} onPick={add} autoFocus inputId="passport-add-input" />
            </div>
          )}
        </span>

        {/* + add a visa you hold (credentials appear only post-selection) */}
        <span ref={credRef} className="relative">
          <button
            onClick={() => { setCredOpen((o) => !o); setAddOpen(false); }}
            aria-expanded={credOpen}
            className="chip border-dashed !bg-transparent"
          >
            + add a visa you hold
          </button>
          {credOpen && (
            <div className="float-panel absolute left-0 top-full z-40 mt-2 max-h-[24rem] w-[21rem] overflow-auto py-2 max-sm:-left-24">
              <p className="px-4 pb-2 pt-1 text-[13px] text-ink-2">
                A US, UK, Schengen or Japan visa or residency unlocks extra countries.
              </p>
              {credentialGroups.map(({ name, items }) => (
                <div key={name} className="border-t border-hair px-4 py-2.5">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                    <span aria-hidden="true" className="text-[16px] leading-none">{GROUP_ISO3[name] ? flagFor(GROUP_ISO3[name]) : "🌐"}</span>
                    {name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {items.map((c) => {
                      const on = creds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          aria-pressed={on}
                          onClick={() => toggleCred(c.id)}
                          className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 text-[12.5px] transition ${
                            on
                              ? "border-accent-deep bg-accent-deep font-semibold text-white"
                              : "border-hair-strong text-ink-2 hover:border-ink-3 hover:text-ink"
                          }`}
                        >
                          {on && <span aria-hidden="true">✓</span>}
                          {CRED_CHIP_LABEL[c.id] ?? c.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </span>

        {/* Passport ranking: quiet meta, right side */}
        {selected.some((iso3) => core?.ranks[iso3] != null) && (
          <span className="ml-auto flex items-center gap-3">
            {selected.map((iso3) => {
              const rank = core?.ranks[iso3];
              if (rank == null) return null;
              return (
                <Link
                  key={iso3}
                  href="/rankings"
                  title={`${nameFor(iso3)} passport ranking`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium tabular-nums text-ink-2 underline-offset-4 transition hover:text-accent hover:underline"
                >
                  {selected.length > 1 && <span aria-hidden="true" className="text-[14px] leading-none">{flagFor(iso3)}</span>}
                  #{rank}/{total}
                </Link>
              );
            })}
          </span>
        )}
      </div>

      {autoDetected && selected.includes(autoDetected) && (
        <p className="mt-2.5 text-[13px] text-ink-2">
          Detected from your location - not your passport? Remove it above.
        </p>
      )}

      {/* The answer */}
      {dataFailed ? (
        <DataError onRetry={retryData} />
      ) : !result ? (
        <DataPending />
      ) : (
        <>
          <div className="mt-8 flex items-center gap-10" aria-live="polite">
            <div className="min-w-0">
            <p className="stat-num text-[clamp(88px,13vw,148px)] text-ink">
              {shown}
              <span className="text-[0.36em] font-bold text-ink-3">/{total}</span>
            </p>
            <p className="mt-1 text-[15.5px] font-medium text-ink-2">
              destinations, no embassy visit
              {selected.length > 0 && (
                <> · {selected.map((s) => nameFor(s)).join(" + ")} passport{selected.length > 1 ? "s" : ""}</>
              )}
            </p>
            {/* One quiet line (never a tour): the reach number is the hook for
                the Earthling ID - claim it while it's on screen. */}
            <p className="mt-2 text-[13px]">
              <Link href="/earthling" className="relative text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-accent hover:underline">
                Claim this reach as your Earthling ID - citizen of Earth, on record →
              </Link>
            </p>
            </div>
            {/* The reach map fills the count row's empty right half on
                desktop - same hues as the grid, no text. */}
            <div className="hidden min-w-0 max-w-[560px] flex-1 lg:block" aria-hidden="true">
              <WorldDotMap kinds={kindByIso3} selected={selected} />
            </div>
          </div>

          {/* Level filter chips */}
          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filter by access level">
            {([
              ["all", "All", counts.all],
              ["free", "Visa-free", counts.free],
              ["voa", "On arrival", counts.voa],
              ["online", "Online", counts.online],
              ["req", "Visa required", counts.req],
            ] as [FilterKey, string, number][]).map(([key, label, n]) => (
              <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className="chip">
                {label}
                <span className={`tabular-nums ${filter === key ? "text-white/75" : "text-ink-3"}`}>{n}</span>
              </button>
            ))}
          </div>

          {/* The destination grid - every tile is a corridor link */}
          <ul className="mt-5 grid list-none grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Destinations">
            {visible.map((t) => {
              const sub = tileSub(t);
              return (
                <li key={t.iso3}>
                  <Link href={tileHref(t.iso3, t.edge?.viaIso3, selected)} className={TILE_CLASS[t.kind]}>
                    <span aria-hidden="true" className="text-[19px] leading-none">{flagFor(t.iso3)}</span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[13.5px] font-semibold leading-tight ${t.kind === "req" ? "text-ink-2" : "text-ink"}`}>
                        {nameFor(t.iso3)}
                      </span>
                      <span className={`block truncate text-[11.5px] font-medium leading-tight ${sub.cls}`}>
                        {sub.srPrefix && <span className="sr-only">{sub.srPrefix}</span>}
                        {sub.text}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {result.transitReach.length > 0 && (
            <p className="mt-5 text-[13.5px] text-ink-2">
              +{result.transitReach.length} more for airport transit only, unlocked by visas you hold:{" "}
              {result.transitReach.map((e, i) => (
                <span key={e.dest}>
                  {i > 0 && ", "}
                  <Link href={tileHref(e.dest, e.viaIso3, selected)} className="font-medium text-ink underline decoration-hair-strong underline-offset-4 hover:text-accent hover:decoration-accent">
                    {nameFor(e.dest)}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Loading / error (restyled v2) ────────────────────────────────────────────

function DataPending() {
  return (
    <div role="status" aria-live="polite" className="mt-8">
      <span className="sr-only">Loading official records…</span>
      <div aria-hidden="true" className="h-[120px] w-64 max-w-full animate-pulse rounded-xl bg-paper-2" />
      <div aria-hidden="true" className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-[9px] bg-paper-2" style={{ animationDelay: `${i * 60}ms` }} />
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
