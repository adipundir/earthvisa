"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { isoToFlag, nameToSlug } from "@/lib/format";
import {
  credShort,
  flagFor,
  groupLabel,
  groupMembers,
  isUsefulCorridor,
  nameFor,
  useComputeData,
  useExplorerCore,
} from "@/lib/explorer-data";
import { useDetectedPassport } from "@/lib/geo";
import { computeWith, fmtMoney, LEVEL_LABEL, type CombinedEdge, type PassportResult } from "@/lib/compute-core";
import type { AccessLevel, Credential, PassportType } from "@/lib/types";

const PASSPORT_TYPES: { id: PassportType; label: string }[] = [
  { id: "ordinary", label: "Ordinary" },
  { id: "diplomatic", label: "Diplomatic" },
  { id: "service", label: "Service" },
  { id: "official", label: "Official" },
];

const PTYPE_SHORT: Record<PassportType, string> = {
  ordinary: "ORD",
  diplomatic: "DIP",
  service: "SVC",
  official: "OFF",
};

// Hardcoded (not read from the fetched core slice) so the empty state is fully
// server-rendered - names must match dataset allCountries entries.
const EXAMPLE_PASSPORTS = [
  { iso3: "IND", iso2: "IN", name: "India" },
  { iso3: "DEU", iso2: "DE", name: "Germany" },
  { iso3: "USA", iso2: "US", name: "United States" },
  { iso3: "BRA", iso2: "BR", name: "Brazil" },
  { iso3: "NGA", iso2: "NG", name: "Nigeria" },
  { iso3: "PHL", iso2: "PH", name: "Philippines" },
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

const LEVEL_STYLE: Record<AccessLevel, string> = {
  visa_free:       "text-vfree bg-vfree/[0.08] border border-vfree/25",
  visa_on_arrival: "text-voa bg-voa/[0.08] border border-voa/25",
  eta:             "text-eta bg-eta/[0.08] border border-eta/25",
  e_visa:          "text-evisa bg-evisa/[0.08] border border-evisa/25",
};

// Crawler annotations occasionally leak schema vocabulary ("min_amount",
// "source_official=false") into program notes. Drop those sentences at render
// time so internal field names never reach user-facing copy.
function cleanProgramNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/\b(min_amount|max_amount|source_official|total_example)\b/i.test(s))
    .join(" ")
    .trim();
  return cleaned || null;
}

// Short label shown on the chip inside a grouped row (country already visible from the row header)
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

type TabKey = "visa_free" | "visa_on_arrival" | "eta" | "fom" | "cbi" | "rbi" | "fast" | "transit";

type Detail = {
  iso3: string;
  title: string;
  subtitle?: string;
  level?: AccessLevel;
  /** passport that actually grants this access (may differ from selected[0] for dual citizens) */
  viaIso3?: string | null;
  /** freedom-of-movement results have no level but do have a corridor page */
  corridor?: boolean;
  badges?: { text: string; tone: "stamp" | "bloc" | "vfree" }[];
  rows?: { label: string; value: React.ReactNode }[];
  options?: { label: string; value: string }[];
  notes?: string;
  sourceUrl?: string;
  sourceOfficial?: boolean;
};

export default function PassportExplorer({ hero }: { hero?: React.ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [creds, setCreds] = useState<string[]>([]);
  const [ptypes, setPtypes] = useState<Record<string, PassportType>>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [credQuery, setCredQuery] = useState("");
  const [credOpen, setCredOpen] = useState(false);
  const [credHi, setCredHi] = useState(-1); // highlighted option in credentials combobox
  const [showCreds, setShowCreds] = useState(false); // advanced "visas you hold" section, collapsed by default
  const [typeOpen, setTypeOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("visa_free");
  const [reachFilter, setReachFilter] = useState("");
  const [hi, setHi] = useState(-1); // highlighted option index in the passport combobox
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const detectedPassport = useDetectedPassport();
  const autoSeededRef = useRef(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const credBoxRef = useRef<HTMLDivElement>(null);
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
  // truly empty field, and never over a deep-link or a manual choice. The chip
  // is removable like any other; we surface a hint so it isn't a surprise.
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

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetail(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detail]);


  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (credBoxRef.current && !credBoxRef.current.contains(e.target as Node)) setCredOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);


  useEffect(() => {
    if (!typeOpen) return;
    function onClickOut(e: MouseEvent) {
      const el = typeRefs.current[typeOpen!];
      if (el && !el.contains(e.target as Node)) setTypeOpen(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setTypeOpen(null); }
    document.addEventListener("mousedown", onClickOut);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOut);
      document.removeEventListener("keydown", onKey);
    };
  }, [typeOpen]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (core?.allCountries ?? [])
      .filter((c) => !selected.includes(c.iso3))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.iso2.toLowerCase() === q)
      .slice(0, 80);
  }, [query, selected, core]);

  const hasInput = selected.length > 0 || creds.length > 0;
  const { snap, failed: dataFailed, retry: retryData } = useComputeData(selected, creds, hasInput);
  // Results render only when the fetched slices cover the CURRENT selection -
  // a slice that is still in flight must never silently shrink the numbers.
  const result = useMemo(() => {
    if (!snap) return null;
    if (snap.selected.join("|") !== selected.join("|") || snap.creds.join("|") !== creds.join("|")) return null;
    return computeWith(snap.data, snap.selected, snap.creds, ptypes);
  }, [snap, selected, creds, ptypes]);

  const credentialGroups = useMemo(() => buildCredentialGroups(core?.credentials ?? []), [core]);
  const credGroupOptions = useMemo(() => {
    const q = credQuery.trim().toLowerCase();
    if (!q) return credentialGroups;
    return credentialGroups.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.items.some((c) => c.short.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
    );
  }, [credQuery, credentialGroups]);

  const flatCredOptions = useMemo(() => credGroupOptions.flatMap((g) => g.items), [credGroupOptions]);
  const credIndexById = useMemo(
    () => new Map(flatCredOptions.map((c, i) => [c.id, i] as const)),
    [flatCredOptions],
  );


  function add(iso3: string) {
    setSelected((s) => (s.includes(iso3) ? s : [...s, iso3]));
    setPtypes((p) => (iso3 in p ? p : { ...p, [iso3]: "ordinary" }));
    setQuery("");
    setOpen(false);
  }
  function remove(iso3: string) {
    setSelected((s) => s.filter((x) => x !== iso3));
    setPtypes((p) => { const n = { ...p }; delete n[iso3]; return n; });
  }
  function setPassportType(iso3: string, t: PassportType) {
    setPtypes((p) => ({ ...p, [iso3]: t }));
  }
  function toggleCred(id: string) {
    setCreds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <>
      {/* ── Hero band (spec §10): copy left, the tool itself right - the tool IS
          the product, so it replaces the old decorative illustration. ── */}
      <section className="bg-grid-paper">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-5 pb-10 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 lg:pb-16 lg:pt-16">
          {hero}

          {/* The checker: a document card sitting on the paper ground */}
          <div className="card-doc card-doc-rule card-doc-ticks p-5 sm:p-6">
        <div className="mb-3">
          <p className="text-sub text-ink">Your Passport(s)</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">Enter the country whose passport you hold - add multiple if you have dual citizenship</p>
        </div>

        <div ref={boxRef} className="relative z-30 w-full">
          {/* Full-width search box */}
          <div className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-2 rounded-[2px] border border-line-strong bg-card px-4 py-2 transition-all focus-within:border-stamp">
            {selected.map((iso3) => {
              const currentType = ptypes[iso3] ?? "ordinary";
              const isNonOrdinary = currentType !== "ordinary";
              const isOpen = typeOpen === iso3;
              return (
                <span key={iso3} className="group/chip inline-flex items-center gap-1.5 rounded-md bg-paper-2 px-2.5 py-1.5 text-[14px] text-ink">
                  <span aria-hidden="true" className="text-lg leading-none">{flagFor(iso3)}</span>
                  <span className="font-display font-semibold">{nameFor(iso3)}</span>

                  {/* per-passport type selector - always visible so touch/keyboard users can reach it */}
                  <span
                    className="relative ml-0.5"
                    ref={(el) => { typeRefs.current[iso3] = el; }}
                    onKeyDown={(e) => {
                      // arrow keys walk the open listbox, matching aria-haspopup="listbox"
                      if (!isOpen || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
                      e.preventDefault();
                      const opts = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
                      const i = opts.indexOf(document.activeElement as HTMLButtonElement);
                      opts[e.key === "ArrowDown" ? Math.min(i + 1, opts.length - 1) : Math.max(i - 1, 0)]?.focus();
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setTypeOpen(isOpen ? null : iso3); }}
                      aria-expanded={isOpen}
                      aria-haspopup="listbox"
                      aria-label={`Passport type: ${currentType}`}
                      className={`mono relative inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] transition after:absolute after:-inset-1.5 after:content-[''] ${
                        isNonOrdinary
                          ? "bg-stamp/10 text-stamp"
                          : "text-ink-mute hover:bg-stamp/[0.08] hover:text-stamp"
                      } ${isOpen ? "bg-stamp/10 text-stamp" : ""}`}
                    >
                      {PTYPE_SHORT[currentType]}
                      <svg viewBox="0 0 10 6" className={`h-2 w-2 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} fill="currentColor">
                        <path d="M0 0l5 6 5-6z" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div
                        role="listbox"
                        aria-label="Passport type"
                        className="absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-[2px] border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-black/25"
                      >
                        <p className="mono-chrome border-b border-line px-3 pb-2 pt-2">
                          Passport type
                        </p>
                        {PASSPORT_TYPES.map((t) => {
                          const active = currentType === t.id;
                          return (
                            <button
                              key={t.id}
                              role="option"
                              aria-selected={active}
                              onClick={(e) => { e.stopPropagation(); setPassportType(iso3, t.id); setTypeOpen(null); }}
                              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                                active
                                  ? "bg-stamp/[0.07] text-stamp"
                                  : "text-ink hover:bg-stamp/[0.04]"
                              }`}
                            >
                              <span className={`mono w-7 shrink-0 text-[10px] font-bold tracking-[0.08em] ${active ? "text-stamp" : "text-ink-mute"}`}>
                                {PTYPE_SHORT[t.id]}
                              </span>
                              <span className="font-display text-[13px] font-medium">{t.label}</span>
                              {active && (
                                <span className="ml-auto text-[11px] text-stamp">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </span>

                  <button
                    onClick={() => remove(iso3)}
                    className="relative ml-0.5 grid h-6 w-6 place-items-center rounded-full text-[14px] text-ink-mute transition after:absolute after:-inset-2 after:content-[''] hover:bg-stamp/20 hover:text-stamp"
                    aria-label={`Remove ${nameFor(iso3)}`}
                  >×</button>
                </span>
              );
            })}
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setHi(-1); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, options.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter") { const pick = options[hi] ?? options[0]; if (pick) { e.preventDefault(); add(pick.iso3); setHi(-1); } }
              }}
              role="combobox"
              aria-expanded={open && (options.length > 0 || query.trim().length > 0)}
              aria-controls="passport-listbox"
              aria-autocomplete="list"
              aria-activedescendant={hi >= 0 ? `passport-opt-${hi}` : undefined}
              aria-label="Search for a passport country"
              placeholder={selected.length ? "Add another country…" : "Search for a country…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-ink-mute"
            />
          </div>

          {open && (options.length > 0 || query.trim().length > 0) && (
            <ul id="passport-listbox" role="listbox" aria-label="Matching countries" className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[2px] border border-line-strong bg-card py-1 shadow-xl shadow-black/10">
              {options.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-ink-mute">
                  {core
                    ? <>No country matches &ldquo;{query.trim()}&rdquo; - try the English name or ISO code</>
                    : "Loading countries…"}
                </li>
              )}
              {options.map((c, i) => (
                <li key={c.iso3} role="option" id={`passport-opt-${i}`} aria-selected={hi === i}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { add(c.iso3); setHi(-1); }}
                    onMouseEnter={() => setHi(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${hi === i ? "bg-paper-2" : "hover:bg-paper-2"}`}
                  >
                    <span aria-hidden="true" className="text-xl">{isoToFlag(c.iso2)}</span>
                    <span className="font-display text-[15px] text-ink">{c.name}</span>
                    <span className="mono ml-auto text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">{c.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {autoDetected && selected.includes(autoDetected) && (
          <p className="mt-2.5 text-[12px] text-ink-mute">
            <span aria-hidden="true">📍</span> Added{" "}
            <span className="font-medium text-ink-soft"><span aria-hidden="true">{flagFor(autoDetected)}</span> {nameFor(autoDetected)}</span>{" "}
            from your location. Not yours? Remove it above.
          </p>
        )}

      {/* ── Visas & permits - collapsed by default so the entry stays simple ── */}
      <details
        className="group mt-5"
        open={showCreds || creds.length > 0}
        onToggle={(e) => setShowCreds(e.currentTarget.open)}
      >
        <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-stamp transition hover:text-ink [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-[16px] font-normal leading-none transition group-open:rotate-45">+</span>
          <span className="group-open:hidden">Add a visa or permit you hold - optional</span>
          <span className="hidden group-open:inline">Visas &amp; permits you hold</span>
        </summary>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          Any valid US, UK, Schengen or Japan visa or residency unlocks extra countries.
        </p>

        <div ref={credBoxRef} className="relative z-20 mt-3 w-full">
          <div className={`flex min-h-[2.75rem] w-full flex-wrap items-center gap-2 rounded-[2px] border bg-card px-4 py-2 transition-all ${credOpen ? "border-stamp" : "border-line-strong"}`}>
            {/* Selected credential chips */}
            {creds.map((credId) => {
              const c = core?.credentials.find((x) => x.id === credId);
              if (!c) return null;
              return (
                <span key={credId} className="inline-flex items-center gap-1.5 rounded-md border border-stamp/30 bg-stamp/[0.06] px-2.5 py-1.5 text-[13px] text-stamp">
                  <span aria-hidden="true" className="text-base leading-none">{GROUP_ISO3[c.group] ? flagFor(GROUP_ISO3[c.group]) : ""}</span>
                  <span className="font-display font-medium">{c.short}</span>
                  <button
                    onClick={() => toggleCred(credId)}
                    className="relative ml-0.5 grid h-6 w-6 place-items-center rounded-full text-[14px] transition after:absolute after:-inset-2 after:content-[''] hover:bg-stamp/20"
                    aria-label={`Remove ${c.short}`}
                  >×</button>
                </span>
              );
            })}
            <input
              value={credQuery}
              onChange={(e) => { setCredQuery(e.target.value); setCredOpen(true); setCredHi(-1); }}
              onFocus={() => setCredOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setCredOpen(false); setCredHi(-1); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setCredOpen(true); setCredHi((h) => Math.min(h + 1, flatCredOptions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCredHi((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter" && credOpen) { const pick = flatCredOptions[credHi] ?? flatCredOptions[0]; if (pick) { e.preventDefault(); toggleCred(pick.id); setCredOpen(false); setCredHi(-1); } }
              }}
              role="combobox"
              aria-expanded={credOpen}
              aria-controls="passport-cred-listbox"
              aria-autocomplete="list"
              aria-activedescendant={credHi >= 0 ? `passport-cred-opt-${credHi}` : undefined}
              aria-label="Search visas and permits you hold"
              placeholder={creds.length ? "Add another visa or permit…" : "Search by country - e.g. Japan visa, US Green Card, Schengen…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-ink-mute"
              autoComplete="off"
            />
            {creds.length > 0 && (
              <button onClick={() => { setCreds([]); setCredQuery(""); }} className="mono inline-flex min-h-[32px] shrink-0 items-center px-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft transition hover:text-stamp">
                Clear
              </button>
            )}
          </div>

          {credOpen && (
            <div id="passport-cred-listbox" role="listbox" aria-label="Available visas and permits" className="absolute z-30 mt-1.5 max-h-[26rem] w-full overflow-auto rounded-[2px] border border-line-strong bg-card shadow-xl shadow-black/10">
              {credGroupOptions.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-mute">
                  {core ? <>No visas or permits found for &ldquo;{credQuery}&rdquo;</> : "Loading visas & permits…"}
                </p>
              )}
              {credGroupOptions.map(({ name, items }) => (
                <div key={name} role="group" aria-label={name} className="border-b border-line last:border-0">
                  <div aria-hidden="true" className="flex items-center gap-2.5 px-4 pt-3 pb-2">
                    <span className="text-xl leading-none">{GROUP_ISO3[name] ? flagFor(GROUP_ISO3[name]) : "🌐"}</span>
                    <span className="font-display text-[14px] font-semibold text-ink">{name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 pb-3 pl-11">
                    {items.map((c) => {
                      const on = creds.includes(c.id);
                      const idx = credIndexById.get(c.id) ?? -1;
                      return (
                        <button
                          key={c.id}
                          id={`passport-cred-opt-${idx}`}
                          role="option"
                          aria-selected={on}
                          tabIndex={-1}
                          onClick={() => { toggleCred(c.id); setCredOpen(false); setCredHi(-1); }}
                          onMouseEnter={() => setCredHi(idx)}
                          className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] transition ${
                            on
                              ? "border-stamp/40 bg-stamp/[0.06] font-semibold text-stamp"
                              : "border-line-strong bg-card text-ink-soft hover:border-ink-mute hover:text-ink"
                          } ${credHi === idx ? "ring-1 ring-stamp/60" : ""}`}
                        >
                          {on && <span className="text-[10px] font-bold">✓</span>}
                          {CRED_CHIP_LABEL[c.id] ?? c.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

          {/* ── Teaching state (spec §9): tappable examples that fill the input ── */}
          {!hasInput && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mono-chrome">No passport yet - tap one to try</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {EXAMPLE_PASSPORTS.map((c) => (
                  <button
                    key={c.iso3}
                    type="button"
                    onClick={() => add(c.iso3)}
                    className="mono inline-flex min-h-[36px] items-center gap-1.5 rounded-[2px] border border-line-strong bg-card px-3 text-[12px] text-ink-soft transition hover:border-stamp hover:text-stamp"
                  >
                    <span aria-hidden="true" className="text-base leading-none">{isoToFlag(c.iso2)}</span>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="mono-chrome mt-4">You get: visa-free list · stay limits · official sources</p>
            </div>
          )}
          </div>
        </div>
      </section>

      {/* ── Results ── */}
      {(hasInput || (coreFailed && !core)) && (
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
      {!hasInput ? (
        <DataError onRetry={retryCore} />
      ) : dataFailed ? (
        <DataError onRetry={retryData} />
      ) : !result ? (
        <DataPending />
      ) : (
        <>
          <StatBand result={result} activeTab={tab} setTab={setTab} />

          <div className="mt-7">
            {tab === "visa_free" && (
              <ReachPanel result={result} entries={result.reachByLevel.visa_free} filter={reachFilter} setFilter={setReachFilter} onOpen={setDetail} />
            )}
            {tab === "visa_on_arrival" && (
              <ReachPanel result={result} entries={result.reachByLevel.visa_on_arrival} filter={reachFilter} setFilter={setReachFilter} onOpen={setDetail} />
            )}
            {tab === "eta" && (
              <ReachPanel result={result} entries={[...result.reachByLevel.eta, ...result.reachByLevel.e_visa]} filter={reachFilter} setFilter={setReachFilter} onOpen={setDetail} />
            )}
            {tab === "fom" && <FomPanel result={result} onOpen={setDetail} />}
            {tab === "cbi" && <CbiPanel result={result} onOpen={setDetail} />}
            {tab === "rbi" && <RbiPanel result={result} onOpen={setDetail} />}
            {tab === "fast" && <FastPanel result={result} onOpen={setDetail} />}
            {tab === "transit" && <TransitPanel result={result} onOpen={setDetail} />}
          </div>
        </>
      )}
      </div>
      )}

      {detail && <DetailModal detail={detail} selectedIso3s={selected} onClose={() => setDetail(null)} />}
    </>
  );
}


function DataPending() {
  return (
    <div role="status" aria-live="polite" className="reveal mt-10 flex items-center justify-center gap-2.5 rounded-[2px] border border-line bg-card px-6 py-12">
      <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-stamp" />
      <span className="mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft">Loading official records…</span>
    </div>
  );
}

function DataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="reveal mt-10 rounded-[2px] border border-stamp/30 bg-stamp/[0.04] px-6 py-10 text-center">
      <p className="font-display text-xl font-semibold text-ink">Couldn&apos;t load the visa dataset</p>
      <p className="text-body mx-auto mt-2 max-w-md text-ink-soft">
        The connection dropped before the official records arrived. Rather than guess, nothing is shown until they load.
      </p>
      <button onClick={onRetry} className="btn-stamp mt-5">
        Retry
      </button>
    </div>
  );
}

function StatBand({ result, activeTab, setTab }: {
  result: PassportResult;
  activeTab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const strongest = result.perPassportReach[0];
  const etaCount = result.reachByLevel.eta.length + result.reachByLevel.e_visa.length;

  const cards: { tab: TabKey; count: number; label: string; accent: string; activeBar: string; tooltip: string }[] = [
    {
      tab: "visa_free",
      count: result.reachByLevel.visa_free.length,
      label: "Visa-free",
      accent: "text-vfree",
      activeBar: "border-t-vfree",
      tooltip: "You can enter with just your passport - no visa application, no fee, no border paperwork. Walk straight through.",
    },
    {
      tab: "visa_on_arrival",
      count: result.reachByLevel.visa_on_arrival.length,
      label: "Visa on arrival",
      accent: "text-voa",
      activeBar: "border-t-voa",
      tooltip: "You get a stamp or sticker at the airport when you land. No pre-application needed, but you typically pay a small fee on arrival.",
    },
    {
      tab: "eta",
      count: etaCount,
      label: "eTA / e-Visa",
      accent: "text-eta",
      activeBar: "border-t-eta",
      tooltip: "Apply online before you travel - usually takes minutes to a few days and costs a small fee. No embassy visit or paper visa needed.",
    },
    {
      tab: "fom",
      count: result.freedomOfMovement.length,
      label: "Free movement",
      accent: "text-bloc",
      activeBar: "border-t-bloc",
      tooltip: "As a member of a regional bloc (EU, GCC, ECOWAS…) you have the right to live, work, and travel in fellow member states with no visa at all.",
    },
    {
      tab: "cbi",
      count: result.cbi.length,
      label: "Citizenship (CBI)",
      accent: "text-stamp",
      activeBar: "border-t-stamp",
      tooltip: "Obtain a second citizenship through a qualifying investment - typically a donation, real estate purchase, or government fund contribution.",
    },
    {
      tab: "rbi",
      count: result.rbi.length,
      label: "Residency routes",
      accent: "text-voa",
      activeBar: "border-t-voa",
      tooltip: "Residency-by-investment programs: make a qualifying investment and receive the right to live in that country, often with a path to citizenship later.",
    },
  ];

  return (
    <div className="reveal mt-8">
      {/* headline */}
      <div className="mb-4 flex items-baseline gap-3 border-b border-line pb-4">
        <span className="font-display text-3xl font-semibold tabular-nums text-vfree">{result.reach.length}</span>
        <span className="text-ink-soft">destinations reachable without obtaining a prior visa</span>
        {result.selected.length > 1 && strongest && (
          <span className="ml-auto hidden text-sm italic text-ink-mute sm:inline">
            Strongest: <span aria-hidden="true">{flagFor(strongest.iso3)}</span> {nameFor(strongest.iso3)} ({strongest.total})
          </span>
        )}
      </div>

      {/* Claim teaser: the moment the user has a number is the moment it can
          become an identity - route them to the Earthling claim flow. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[2px] border border-stamp/25 bg-stamp/[0.04] px-4 py-2.5">
        <span className="text-sm text-ink-soft">That number is your <strong className="text-ink">reach</strong>. Lock it in on the leaderboard:</span>
        <Link href="/earthling" className="mono min-h-[32px] inline-flex items-center text-[12px] font-medium uppercase tracking-[0.12em] text-stamp underline-offset-2 hover:underline">
          Claim your Earthling ID →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <div key={i} className="group relative">
            <button
              onClick={() => setTab(c.tab)}
              aria-pressed={activeTab === c.tab}
              aria-describedby={`stat-tip-${c.tab}`}
              className={`flex h-[4.5rem] w-full flex-col justify-center rounded-[2px] border px-4 text-left transition ${
                activeTab === c.tab
                  ? `border-t-[3px] ${c.activeBar} border-x-line-strong border-b-line-strong bg-paper-2 ring-1 ring-inset ring-stamp/15`
                  : "border-line-strong bg-card hover:bg-paper-2"
              }`}
            >
              <div className={`font-display text-[28px] font-semibold tabular-nums leading-none ${c.accent}`}>{c.count}</div>
              <div className="mono mt-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-mute">
                <span className="whitespace-nowrap">{c.label}</span>
                <span className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[8px] font-bold leading-none text-ink-mute">?</span>
              </div>
            </button>
            {/* display:none at rest (not opacity-0) so the 224px tooltip never widens the page on mobile;
                shown on hover and on keyboard focus, right-aligned for even (right-column) cards */}
            <div
              id={`stat-tip-${c.tab}`}
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-56 max-w-[calc(100vw-2.5rem)] rounded-md border border-line-strong bg-card p-3 text-[12px] leading-relaxed text-ink-soft shadow-lg group-hover:block group-focus-within:block group-even:left-auto group-even:right-0"
            >
              {c.tooltip}
              <div className="absolute left-4 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-line-strong group-even:left-auto group-even:right-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Secondary navigation row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {result.viaCredentialCount > 0 && (() => {
          const fresh = result.viaCredentialNewCount;
          const upgraded = result.viaCredentialCount - fresh;
          return (
            <p className="text-sm text-ink-soft">
              {fresh > 0 ? (
                <>
                  <span className="stamp mr-1.5 bg-stamp/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stamp">+{fresh}</span>
                  extra destination{fresh === 1 ? "" : "s"} unlocked by visas you hold
                  {upgraded > 0 && <>, plus {upgraded} upgraded to easier access</>}.
                </>
              ) : (
                <>
                  {upgraded} destination{upgraded === 1 ? " gets" : "s get"} easier access with visas you hold.
                </>
              )}
            </p>
          );
        })()}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => setTab("transit")}
            aria-pressed={activeTab === "transit"}
            title="Destinations you can transit (change planes) without a visa. Some appear only once a held visa unlocks them."
            className={`mono inline-flex min-h-[36px] items-center gap-2 rounded-[2px] border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
              activeTab === "transit"
                ? "border-eta/40 bg-eta/[0.07] text-eta"
                : "border-line-strong bg-paper-2/60 text-ink-mute hover:border-eta/40 hover:text-ink"
            }`}
          >
            Transit access
            <span className="tabular-nums">{result.transitReach.length}</span>
          </button>
          <button
            onClick={() => setTab("fast")}
            aria-pressed={activeTab === "fast"}
            className={`mono inline-flex min-h-[36px] items-center gap-2 rounded-[2px] border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
              activeTab === "fast"
                ? "border-stamp/30 bg-stamp/[0.06] text-stamp"
                : "border-line-strong bg-paper-2/60 text-ink-mute hover:border-stamp/30 hover:text-ink"
            }`}
          >
            Fast-track immigration
            <span className="tabular-nums">{result.fastTrack.length}</span>
          </button>
        </div>
      </div>
    </div>
  );
}


function AccessPill({ level }: { level: AccessLevel }) {
  return (
    <span className={`mono inline-flex shrink-0 items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${LEVEL_STYLE[level]}`}>
      {LEVEL_LABEL[level]}
    </span>
  );
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function SourceLink({ url, official }: { url: string; official: boolean }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mono inline-flex items-center gap-1.5 text-[11px] text-ink-mute transition hover:text-ink">
      <SourceDot official={official} />
      {hostOf(url)} ↗
    </a>
  );
}

function SourceDot({ official }: { official: boolean }) {
  const label = official ? "Official government source" : "Non-official source";
  return <span role="img" aria-label={label} className={`inline-block h-2 w-2 rounded-full ${official ? "bg-vfree" : "bg-eta"}`} title={label} />;
}

// Document-card surface for interactive result cards - the .card-doc recipe
// hand-rolled in utilities so hover/focus border states still apply (the
// unlayered .card-doc class would override hover:border-* utilities).
const CARD = "cursor-pointer rounded-[2px] border border-line-strong bg-card transition hover:border-ink-mute focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp/30";

function ClickCard({ onOpen, className, style, children }: { onOpen: () => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

function reachDetail(e: CombinedEdge): Detail {
  const badges: Detail["badges"] = [];
  if (e.viaCredential) badges.push({ text: `via ${credShort(e.viaCredential) ?? "held visa"}`, tone: "stamp" });
  if (e.viaPassportType) badges.push({ text: `${e.viaPassportType} passport`, tone: "bloc" });
  const rows: Detail["rows"] = [];
  if (e.maxStayDays != null) rows.push({ label: "Maximum stay", value: `${e.maxStayDays} days` });
  if (e.viaIso3) rows.push({ label: "Via passport", value: <><span aria-hidden="true">{flagFor(e.viaIso3)}</span> {nameFor(e.viaIso3)}</> });
  return {
    iso3: e.dest, title: nameFor(e.dest), subtitle: LEVEL_LABEL[e.level], level: e.level,
    viaIso3: e.viaIso3, badges, rows, notes: e.notes, sourceUrl: e.sourceUrl, sourceOfficial: e.sourceOfficial,
  };
}

function ReachPanel({ result, entries, filter, setFilter, onOpen }: { result: PassportResult; entries: CombinedEdge[]; filter: string; setFilter: (s: string) => void; onOpen: (d: Detail) => void }) {
  const q = filter.trim().toLowerCase();
  const rows = entries.filter((e) => !q || nameFor(e.dest).toLowerCase().includes(q));
  if (entries.length === 0) return <Note>No official visa-policy data yet maps to this passport. Many governments don&apos;t publish enumerated visa-free lists; reach is derived only from destinations that do.</Note>;
  return (
    <div className="reveal">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setFilter(""); }}
        aria-label="Filter destinations by name"
        placeholder="Filter destinations…"
        className="mono mb-5 w-full max-w-xs rounded-sm border border-line-strong bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-stamp placeholder:text-ink-mute"
      />
      {rows.length === 0 && (
        <p className="text-body rounded-[2px] border border-line-strong bg-card px-4 py-6 text-center text-ink-soft">
          No destinations match &ldquo;{filter}&rdquo;.{" "}
          <button onClick={() => setFilter("")} className="font-medium text-stamp underline-offset-2 hover:underline">Clear filter</button>
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((e) => (
          <ClickCard key={e.dest} onOpen={() => onOpen(reachDetail(e))} className={`group flex items-start gap-3 p-3.5 ${CARD}`}>
            <span aria-hidden="true" className="text-2xl leading-none">{flagFor(e.dest)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display min-w-0 truncate font-medium text-ink">{nameFor(e.dest)}</span>
                <AccessPill level={e.level} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.maxStayDays != null && <span className="mono text-[11px] text-ink-mute">≤ {e.maxStayDays} days</span>}
                {e.viaCredential && (
                  <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-stamp ring-1 ring-stamp/30">
                    via {credShort(e.viaCredential) ?? "held visa"}
                  </span>
                )}
                {e.viaPassportType && (
                  <span className="mono rounded-[3px] bg-bloc/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-bloc ring-1 ring-bloc/30">
                    {e.viaPassportType} passport
                  </span>
                )}
                {e.sourceUrl && <span className="mono inline-flex items-center gap-1.5 text-[11px] text-ink-mute"><SourceDot official={e.sourceOfficial} />{hostOf(e.sourceUrl)}</span>}
              </div>
              {e.notes && <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-ink-soft">{e.notes}</p>}
              <span className="mono mt-1.5 block text-[10px] font-medium uppercase tracking-[0.1em] text-stamp">Details ›</span>
            </div>
          </ClickCard>
        ))}
      </div>
    </div>
  );
}

function TransitPanel({ result, onOpen }: { result: PassportResult; onOpen: (d: Detail) => void }) {
  if (result.transitReach.length === 0)
    return <Note>No transit-only destinations in your current credential combination.</Note>;
  return (
    <div className="reveal">
      <div className="text-body mb-5 rounded-[2px] border border-eta/25 bg-eta/[0.05] px-4 py-3 text-ink-soft">
        <span className="mono mr-2 font-semibold uppercase tracking-[0.1em] text-eta">Transit only</span>
        These destinations allow you to change planes or transit the country without a visa - but{" "}
        <strong className="font-semibold text-ink">not for tourism or extended stays</strong>. They appear here separately so they aren&apos;t confused with regular visa-free access.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.transitReach.map((e) => (
          <ClickCard key={e.dest} onOpen={() => onOpen(reachDetail(e))} className={`group flex items-start gap-3 p-3.5 ${CARD}`}>
            <span aria-hidden="true" className="text-2xl leading-none">{flagFor(e.dest)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display min-w-0 truncate font-medium text-ink">{nameFor(e.dest)}</span>
                <span className="mono shrink-0 whitespace-nowrap rounded-[3px] bg-eta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">Transit</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.maxStayDays != null && <span className="mono text-[11px] text-ink-mute">≤ {e.maxStayDays}h transit</span>}
                {e.viaCredential && (
                  <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-stamp ring-1 ring-stamp/30">
                    via {credShort(e.viaCredential) ?? "held visa"}
                  </span>
                )}
                {e.sourceUrl && <span className="mono inline-flex items-center gap-1.5 text-[11px] text-ink-mute"><SourceDot official={e.sourceOfficial} />{hostOf(e.sourceUrl)}</span>}
              </div>
              {e.notes && <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-ink-soft">{e.notes}</p>}
            </div>
          </ClickCard>
        ))}
      </div>
    </div>
  );
}

function FomPanel({ result, onOpen }: { result: PassportResult; onOpen: (d: Detail) => void }) {
  if (result.freedomOfMovement.length === 0)
    return <Note>None of your passports belong to a free-movement bloc in our dataset (EU/EEA, GCC, CARICOM, ECOWAS, ASEAN, Mercosur, Common Travel Area, Trans-Tasman…).</Note>;
  return (
    <div>
      <p className="mb-5 max-w-2xl leading-relaxed text-ink-soft">
        Regional bloc privileges from your membership - these typically grant visa-free entry, and
        depending on the bloc the right to{" "}
        <span className="font-medium text-bloc">live and work</span> (e.g. EU/EEA, GCC, ECOWAS,
        Mercosur). Confirm the specific rights per bloc.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.freedomOfMovement.map((e, i) => (
          <ClickCard
            key={e.dest}
            onOpen={() => onOpen({
              iso3: e.dest, title: nameFor(e.dest), subtitle: "Freedom of movement",
              // the granting passport = the selected one that belongs to a shared bloc
              viaIso3: result.selected.find((s) => e.groups.some((g) => groupMembers(g).includes(s))),
              corridor: true,
              badges: e.groups.map((g) => ({ text: groupLabel(g), tone: "bloc" as const })),
              notes: "Shared regional-bloc membership - typically grants visa-free entry and, depending on the bloc, the right to live and work. Confirm the specific rights per bloc.",
            })}
            className="reveal flex cursor-pointer items-center gap-3 rounded-[2px] border border-bloc/25 bg-bloc/[0.04] p-3.5 transition hover:border-bloc/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp/30"
            style={{ animationDelay: `${(i % 10) * 35}ms` }}
          >
            <span aria-hidden="true" className="text-2xl">{flagFor(e.dest)}</span>
            <div className="min-w-0">
              <div className="font-display truncate font-medium text-ink">{nameFor(e.dest)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {e.groups.map((g) => (
                  <span key={g} className="mono rounded-[2px] bg-bloc/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-bloc">
                    {groupLabel(g)}
                  </span>
                ))}
              </div>
            </div>
          </ClickCard>
        ))}
      </div>
    </div>
  );
}

// ── Program panels (CBI / golden visas / fast-track) ─────────────────────────

// Human labels for program type / category values whose raw form reads badly even
// after underscores become spaces. Everything else falls through to the humaniser.
const PROGRAM_TYPE_LABEL: Record<string, string> = {
  real_estate: "Real estate",
  digital_nomad: "Digital nomad",
  "digital-nomad": "Digital nomad",
  "digital nomad": "Digital nomad",
  remote_work_residence: "Remote-work residence",
  remote_worker_residence: "Remote-worker residence",
  digital_nomad_remote_worker: "Digital nomad / remote worker",
  job_seeker_startup: "Job seeker / startup",
  job_search_startup: "Job search / startup",
  job_search_points_based: "Job search (points-based)",
  points_based_skilled_migration: "Points-based skilled migration",
  intra_company_transfer: "Intra-company transfer",
  "intra-company_transfer": "Intra-company transfer",
  intra_corporate_transfer: "Intra-corporate transfer",
  startup_entrepreneur: "Startup / entrepreneur",
  "highly-skilled": "Highly skilled",
  "skilled-worker": "Skilled worker",
  fee_based_residency: "Fee-based residency",
  express_evisa: "Express e-Visa",
  "e-visa fast track": "e-Visa fast track",
  passive_income: "Passive income",
};

/** Turn a raw program type/category value into readable copy - no underscores, sensible casing. */
function programTypeLabel(raw: string): string {
  if (!raw) return "";
  const mapped = PROGRAM_TYPE_LABEL[raw];
  if (mapped) return mapped;
  const s = raw.replace(/_+/g, " ").replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Prefix "~" only when the processing time is an actual duration ("4-6 months"), not prose. */
function fmtProcessing(t: string): string {
  const s = t.trim();
  return /^\d/.test(s) ? `~${s}` : s;
}

function PanelFilter({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Escape") onChange(""); }}
      aria-label={placeholder}
      placeholder={placeholder}
      className="mono mb-5 w-full max-w-xs rounded-sm border border-line-strong bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-stamp placeholder:text-ink-mute"
    />
  );
}

function NoMatch({ filter, onClear }: { filter: string; onClear: () => void }) {
  return (
    <p className="text-body rounded-[2px] border border-line-strong bg-card px-4 py-6 text-center text-ink-soft">
      No programs match &ldquo;{filter}&rdquo;.{" "}
      <button onClick={onClear} className="font-medium text-stamp underline-offset-2 hover:underline">Clear filter</button>
    </p>
  );
}

function CbiPanel({ result, onOpen }: { result: PassportResult; onOpen: (d: Detail) => void }) {
  if (result.cbi.length === 0) return <Note>No citizenship-by-investment programs found on official sources yet.</Note>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {result.cbi.map((p, i) => {
        // Collapse option rows that would render identically (same type + amount) -
        // some sources list several routes under one type at the same minimum.
        const options = p.options.filter((o, idx, arr) =>
          arr.findIndex((x) => x.type === o.type && x.min_amount === o.min_amount && x.currency === o.currency) === idx);
        const rows: Detail["rows"] = [];
        if (p.dual_citizenship_allowed != null) rows.push({ label: "Dual citizenship", value: p.dual_citizenship_allowed ? "Allowed" : "Not allowed" });
        if (p.residency_required != null) rows.push({ label: "Residency required", value: p.residency_required ? "Yes" : "No" });
        if (p.processing_time) rows.push({ label: "Processing time", value: fmtProcessing(p.processing_time) });
        return (
        <ClickCard
          key={p.iso3}
          onOpen={() => onOpen({
            iso3: p.iso3, title: nameFor(p.iso3), subtitle: p.program_name,
            badges: p.verified ? [{ text: "verified", tone: "vfree" }] : [],
            options: options.map((o) => ({ label: o.type.replace(/_/g, " "), value: o.min_amount != null ? fmtMoney(o.min_amount, o.currency) : "not specified" })),
            rows, notes: p.notes, sourceUrl: p.official_url, sourceOfficial: p.source_official,
          })}
          className={`reveal p-5 ${CARD}`}
          style={{ animationDelay: `${(i % 8) * 40}ms` }}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl">{flagFor(p.iso3)}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold text-ink">{nameFor(p.iso3)}</span>
                {p.verified && <span className="stamp bg-vfree/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-vfree">verified</span>}
              </div>
              <div className="text-sm italic text-ink-soft">{p.program_name}</div>
            </div>
          </div>
          {options.length > 0 && (
            <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
              {options.map((o, j) => (
                <li key={j} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm capitalize text-ink-soft">{o.type.replace(/_/g, " ")}</span>
                  {o.min_amount != null ? (
                    <span className="mono text-sm font-semibold tabular-nums text-stamp">{fmtMoney(o.min_amount, o.currency)}</span>
                  ) : (
                    <span className="mono text-[11px] text-ink-mute">not specified</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mono mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            {p.dual_citizenship_allowed != null && <span>Dual: {p.dual_citizenship_allowed ? "allowed" : "no"}</span>}
            {p.residency_required != null && <span>Residency: {p.residency_required ? "required" : "no"}</span>}
            {p.processing_time && <span>{fmtProcessing(p.processing_time)}</span>}
            {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
          </div>
        </ClickCard>
        );
      })}
    </div>
  );
}

function RbiPanel({ result, onOpen }: { result: PassportResult; onOpen: (d: Detail) => void }) {
  const [filter, setFilter] = useState("");
  if (result.rbi.length === 0) return <Note>No residence-by-investment / golden-visa programs found on official sources yet.</Note>;
  // Drop entries that would render identically (same country, program name and amount).
  const programs = result.rbi.filter((p, idx, arr) =>
    arr.findIndex((x) => x.iso3 === p.iso3 && x.program_name === p.program_name && x.min_amount === p.min_amount) === idx);
  const q = filter.trim().toLowerCase();
  const rows = q
    ? programs.filter((p) =>
        nameFor(p.iso3).toLowerCase().includes(q) ||
        p.program_name.toLowerCase().includes(q) ||
        programTypeLabel(p.type).toLowerCase().includes(q))
    : programs;
  return (
    <div className="reveal">
      <PanelFilter value={filter} onChange={setFilter} placeholder="Filter by country or program…" />
      {rows.length === 0 && <NoMatch filter={filter} onClear={() => setFilter("")} />}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((p, i) => {
          const detailRows: Detail["rows"] = [{ label: "Minimum investment", value: p.min_amount != null ? fmtMoney(p.min_amount, p.currency) : "Not specified" }];
          if (p.path_to_pr_years != null) detailRows.push({ label: "Path to PR", value: `${p.path_to_pr_years} years` });
          if (p.path_to_citizenship_years != null) detailRows.push({ label: "Path to citizenship", value: `${p.path_to_citizenship_years} years` });
          return (
          <ClickCard
            key={p.iso3 + i}
            onOpen={() => onOpen({ iso3: p.iso3, title: p.program_name, subtitle: `${nameFor(p.iso3)}${p.type ? ` · ${programTypeLabel(p.type)}` : ""}`, rows: detailRows, notes: p.notes, sourceUrl: p.official_url, sourceOfficial: p.source_official })}
            className={`reveal p-4 ${CARD}`}
            style={{ animationDelay: `${(i % 10) * 30}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="text-2xl">{flagFor(p.iso3)}</span>
              <div className="min-w-0">
                <div className="font-display truncate font-medium text-ink">{p.program_name}</div>
                <div className="mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-mute">{nameFor(p.iso3)}{p.type ? ` · ${programTypeLabel(p.type)}` : ""}</div>
              </div>
              {p.min_amount != null ? (
                <span className="mono ml-auto shrink-0 text-sm font-semibold tabular-nums text-voa">{fmtMoney(p.min_amount, p.currency)}</span>
              ) : (
                <span className="mono ml-auto shrink-0 text-[11px] text-ink-mute">not specified</span>
              )}
            </div>
            <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
              {p.path_to_pr_years != null && <span>PR in {p.path_to_pr_years}y</span>}
              {p.path_to_citizenship_years != null && <span>Citizenship in {p.path_to_citizenship_years}y</span>}
              {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
            </div>
            {cleanProgramNote(p.notes) && <p className="mt-2 line-clamp-2 text-[15px] leading-snug text-ink-soft">{cleanProgramNote(p.notes)}</p>}
          </ClickCard>
          );
        })}
      </div>
    </div>
  );
}

function FastPanel({ result, onOpen }: { result: PassportResult; onOpen: (d: Detail) => void }) {
  const [filter, setFilter] = useState("");
  if (result.fastTrack.length === 0) return <Note>No fast-track / skilled / talent / digital-nomad programs found on official sources yet.</Note>;
  // Drop entries that would render identically (same country, program name and category).
  const programs = result.fastTrack.filter((p, idx, arr) =>
    arr.findIndex((x) => x.iso3 === p.iso3 && x.program_name === p.program_name && x.category === p.category) === idx);
  const q = filter.trim().toLowerCase();
  const rows = q
    ? programs.filter((p) =>
        nameFor(p.iso3).toLowerCase().includes(q) ||
        p.program_name.toLowerCase().includes(q) ||
        programTypeLabel(p.category).toLowerCase().includes(q))
    : programs;
  return (
    <div className="reveal">
      <PanelFilter value={filter} onChange={setFilter} placeholder="Filter by country or program…" />
      {rows.length === 0 && <NoMatch filter={filter} onClear={() => setFilter("")} />}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((p, i) => {
          const detailRows: Detail["rows"] = [];
          if (p.processing_time) detailRows.push({ label: "Processing time", value: fmtProcessing(p.processing_time) });
          const notes = [p.eligibility, p.notes].filter(Boolean).join("\n\n");
          return (
          <ClickCard
            key={p.iso3 + i}
            onOpen={() => onOpen({ iso3: p.iso3, title: p.program_name, subtitle: `${nameFor(p.iso3)}${p.category ? ` · ${programTypeLabel(p.category)}` : ""}`, rows: detailRows, notes, sourceUrl: p.official_url, sourceOfficial: p.source_official })}
            className={`reveal p-4 ${CARD}`}
            style={{ animationDelay: `${(i % 10) * 30}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="text-2xl">{flagFor(p.iso3)}</span>
              <div className="min-w-0">
                <div className="font-display truncate font-medium text-ink">{p.program_name}</div>
                <div className="mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-mute">{nameFor(p.iso3)}{p.category ? ` · ${programTypeLabel(p.category)}` : ""}</div>
              </div>
            </div>
            {p.eligibility && <p className="mt-2 line-clamp-3 text-[15px] leading-snug text-ink-soft">{p.eligibility}</p>}
            <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
              {p.processing_time && <span>{fmtProcessing(p.processing_time)}</span>}
              {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
            </div>
          </ClickCard>
          );
        })}
      </div>
    </div>
  );
}

function DetailModal({ detail, selectedIso3s, onClose }: { detail: Detail; selectedIso3s: string[]; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Corridor guide CTA: only for access-level / FoM results, linked from the
  // passport that actually grants the access - and only when that corridor
  // page really exists (pruned thin corridors 404).
  const guideNat = useMemo(() => {
    if (!detail.level && !detail.corridor) return null;
    return [detail.viaIso3, ...selectedIso3s].find(
      (n): n is string => !!n && n !== detail.iso3 && isUsefulCorridor(n, detail.iso3),
    ) ?? null;
  }, [detail, selectedIso3s]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  // Focus management: role="dialog" aria-modal="true" tells assistive tech the
  // rest of the page is inert, so this has to actually be true - move focus in
  // on open, trap Tab within the panel while open, restore it to the trigger
  // (e.g. the ClickCard that opened this) on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, []);
  const toneCls = (tone: string) =>
    tone === "bloc" ? "bg-bloc/10 text-bloc ring-bloc/30"
      : tone === "vfree" ? "bg-vfree/10 text-vfree ring-vfree/30"
      : "bg-stamp/10 text-stamp ring-stamp/30";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={detail.title}>
      <div className="reveal absolute inset-0 bg-black/40 backdrop-blur-[2px]" style={{ animationDuration: "0.25s" }} onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="reveal relative z-10 w-full max-w-lg overflow-hidden rounded-[2px] border border-line-strong bg-card shadow-2xl shadow-black/20 outline-none" style={{ animationDuration: "0.3s" }}>
        <div className="rule-double flex items-start gap-3 px-6 pb-4 pt-6">
          <span aria-hidden="true" className="text-4xl leading-none">{flagFor(detail.iso3)}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-semibold leading-tight text-ink">{detail.title}</h3>
            {detail.subtitle && <div className="mt-0.5 text-sm italic text-ink-soft">{detail.subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-ink-mute transition hover:bg-stamp hover:text-white dark:hover:bg-stamp-deep">×</button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-6 py-5">
          {(detail.level || (detail.badges && detail.badges.length > 0)) && (
            <div className="flex flex-wrap items-center gap-2">
              {detail.level && <AccessPill level={detail.level} />}
              {detail.badges?.map((b, i) => (
                <span key={i} className={`mono rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ring-1 ${toneCls(b.tone)}`}>{b.text}</span>
              ))}
            </div>
          )}
          {detail.options && detail.options.length > 0 && (
            <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
              {detail.options.map((o, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm capitalize text-ink-soft">{o.label}</span>
                  <span className="mono text-sm font-semibold tabular-nums text-stamp">{o.value}</span>
                </li>
              ))}
            </ul>
          )}
          {detail.rows && detail.rows.length > 0 && (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
              {detail.rows.map((r, i) => (
                <div key={i} className="contents">
                  <dt className="mono-chrome self-center text-[10px]">{r.label}</dt>
                  <dd className="text-[15px] text-ink">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {cleanProgramNote(detail.notes) && <p className="text-body mt-4 whitespace-pre-line text-ink-soft">{cleanProgramNote(detail.notes)}</p>}
          {guideNat ? (
            <Link
              href={`/passport/${nameToSlug(nameFor(guideNat))}/${nameToSlug(detail.title)}`}
              className="btn-stamp mt-5 w-full"
            >
              Full {nameFor(guideNat)} → {detail.title} guide: fees, documents, how to apply
            </Link>
          ) : (detail.level || detail.corridor) && selectedIso3s.length > 0 && selectedIso3s[0] !== detail.iso3 ? (
            /* corridor page pruned - fall back to the passport hub, which always exists */
            <Link
              href={`/passport/${nameToSlug(nameFor(selectedIso3s[0]))}`}
              className="btn-stamp mt-5 w-full"
            >
              {`Full ${nameFor(selectedIso3s[0])} passport guide: every destination & entry rule`}
            </Link>
          ) : null}
          {detail.sourceUrl && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <SourceLink url={detail.sourceUrl} official={!!detail.sourceOfficial} />
              <span className="mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-mute">· {detail.sourceOfficial ? "official source" : "non-official source"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-doc px-5 py-6">
      <p className="mono-chrome">No entries</p>
      <p className="text-body measure mt-2 text-ink-soft">{children}</p>
    </div>
  );
}
