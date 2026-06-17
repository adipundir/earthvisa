"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dataset, flagFor, nameFor, isoToFlag } from "@/lib/dataset";
import { compute, fmtMoney, LEVEL_LABEL, type CombinedEdge } from "@/lib/compute";
import type { AccessLevel, PassportType, VisaType } from "@/lib/types";

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

const EXAMPLE_PASSPORTS = ["IND", "DEU", "USA", "BRA", "NGA", "PHL", "PAK", "MEX"];

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
  visa_free: "text-vfree ring-vfree/45 bg-vfree/10",
  visa_on_arrival: "text-voa ring-voa/45 bg-voa/10",
  eta: "text-eta ring-eta/45 bg-eta/10",
  e_visa: "text-evisa ring-evisa/45 bg-evisa/10",
};

const CRED_SHORT: Record<string, string> = Object.fromEntries(
  dataset.credentials.map((c) => [c.id, c.short]),
);

// Short label shown on the chip inside a grouped row (country already visible from the row header)
const CRED_CHIP_LABEL: Record<string, string> = {
  US_VISA: "Visa",
  US_GREEN_CARD: "Green Card",
  CA_VISA: "Visa",
  CA_PR: "Permanent resident",
  UK_VISA: "Visa",
  UK_PR: "ILR / settled status",
  SCHENGEN_VISA: "Schengen visa",
  EU_RESIDENCE: "Residence / PR",
  AU_VISA: "Visa",
  AU_PR: "Permanent resident",
  NZ_VISA: "Visa or residence",
  JP_VISA: "Visa or residence",
  KR_VISA: "Visa or residence",
  SGP_VISA: "Visa or residence",
  GCC_RESIDENCE: "Residence permit",
  OCI: "OCI card",
  MX_VISA: "Visa",
  MX_PR: "Permanent resident",
  CHL_PR: "Permanent resident",
  COL_PR: "Permanent resident",
  PER_PR: "Permanent resident",
  BRA_PR: "Residence permit",
};

// Group credentials by issuing country (preserving CRED_CATALOG order)
const CREDENTIAL_GROUPS: { name: string; items: typeof dataset.credentials }[] = [];
{
  const map = new Map<string, typeof dataset.credentials>();
  for (const c of dataset.credentials) {
    if (!map.has(c.group)) map.set(c.group, []);
    map.get(c.group)!.push(c);
  }
  for (const [name, items] of map) CREDENTIAL_GROUPS.push({ name, items });
}

type TabKey = "visa_free" | "visa_on_arrival" | "eta" | "fom" | "cbi" | "rbi" | "fast" | "transit";

type Detail = {
  iso3: string;
  title: string;
  subtitle?: string;
  level?: AccessLevel;
  badges?: { text: string; tone: "stamp" | "bloc" | "vfree" }[];
  rows?: { label: string; value: React.ReactNode }[];
  options?: { label: string; value: string }[];
  notes?: string;
  sourceUrl?: string;
  sourceOfficial?: boolean;
};

export default function PassportExplorer() {
  const [selected, setSelected] = useState<string[]>([]);
  const [creds, setCreds] = useState<string[]>([]);
  const [ptypes, setPtypes] = useState<Record<string, PassportType>>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [credQuery, setCredQuery] = useState("");
  const [credOpen, setCredOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("visa_free");
  const [reachFilter, setReachFilter] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const credBoxRef = useRef<HTMLDivElement>(null);
  const typeRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetail(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detail]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bw.passports") || "[]");
      if (Array.isArray(saved) && saved.length) setSelected(saved);
      const savedC = JSON.parse(localStorage.getItem("bw.creds") || "[]");
      if (Array.isArray(savedC) && savedC.length) setCreds(savedC);
      const savedPtypes = JSON.parse(localStorage.getItem("bw.ptypes") || "{}");
      if (savedPtypes && typeof savedPtypes === "object") setPtypes(savedPtypes);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("bw.passports", JSON.stringify(selected)); } catch {} }, [selected]);
  useEffect(() => { try { localStorage.setItem("bw.creds", JSON.stringify(creds)); } catch {} }, [creds]);
  useEffect(() => { try { localStorage.setItem("bw.ptypes", JSON.stringify(ptypes)); } catch {} }, [ptypes]);

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
    return dataset.allCountries
      .filter((c) => !selected.includes(c.iso3))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.iso2.toLowerCase() === q)
      .slice(0, 80);
  }, [query, selected]);

  const result = useMemo(() => compute(selected, creds, ptypes), [selected, creds, ptypes]);

  const credGroupOptions = useMemo(() => {
    const q = credQuery.trim().toLowerCase();
    if (!q) return CREDENTIAL_GROUPS;
    return CREDENTIAL_GROUPS.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.items.some((c) => c.short.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
    );
  }, [credQuery]);


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

  const hasInput = selected.length > 0 || creds.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">

      {/* ── Passport search — full width ── */}
      <div className="mt-8">
        <div className="mb-3">
          <p className="font-display text-[17px] font-semibold text-ink">Your Passport(s)</p>
          <p className="mt-0.5 text-sm text-ink-soft">Enter the country whose passport you hold — add multiple if you have dual citizenship</p>
        </div>

        <div ref={boxRef} className="relative z-30 w-full">
          {/* Full-width search box */}
          <div className="flex min-h-[3.75rem] w-full flex-wrap items-center gap-2 rounded-lg border-2 border-line-strong bg-paper-2 px-4 py-3 transition-all focus-within:border-stamp/70 focus-within:shadow-[0_0_0_3px_rgba(178,53,40,0.07)]">
            {selected.map((iso3) => {
              const currentType = ptypes[iso3] ?? "ordinary";
              const isNonOrdinary = currentType !== "ordinary";
              const isOpen = typeOpen === iso3;
              return (
                <span key={iso3} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-paper-3/70 px-2.5 py-1.5 text-[14px] text-ink">
                  <span className="text-lg leading-none">{flagFor(iso3)}</span>
                  <span className="font-display font-semibold">{nameFor(iso3)}</span>

                  {/* per-passport type selector */}
                  <span
                    className="relative ml-0.5"
                    ref={(el) => { typeRefs.current[iso3] = el; }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setTypeOpen(isOpen ? null : iso3); }}
                      aria-expanded={isOpen}
                      aria-haspopup="listbox"
                      aria-label={`Passport type: ${currentType}`}
                      className={`mono inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] uppercase tracking-[0.1em] transition ${
                        isNonOrdinary
                          ? "border border-stamp/40 bg-stamp/10 text-stamp"
                          : "border border-line-strong bg-paper-2 text-ink-mute hover:border-stamp/40 hover:bg-stamp/[0.05] hover:text-stamp"
                      } ${isOpen ? "border-stamp/50 bg-stamp/10 text-stamp" : ""}`}
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
                        className="absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-ink/25"
                      >
                        <p className="mono border-b border-line px-3 pb-2 pt-2 text-[9px] uppercase tracking-[0.18em] text-ink-mute/60">
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
                    className="grid h-4 w-4 place-items-center rounded-full text-[11px] text-ink-mute transition hover:bg-stamp/20 hover:text-stamp"
                    aria-label={`Remove ${nameFor(iso3)}`}
                  >×</button>
                </span>
              );
            })}
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={selected.length ? "Add another country…" : "Type a country name — e.g. India, Germany, Nigeria, United States…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-mute/55"
            />
          </div>

          {/* Dropdown */}
          {open && options.length > 0 && (
            <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-ink/20">
              {options.map((c) => (
                <li key={c.iso3}>
                  <button
                    onClick={() => add(c.iso3)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-stamp/[0.06]"
                  >
                    <span className="text-xl">{isoToFlag(c.iso2)}</span>
                    <span className="font-display text-[15px] text-ink">{c.name}</span>
                    <span className="mono ml-auto text-[10px] uppercase tracking-[0.15em] text-ink-mute">{c.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick-add popular countries */}
        {selected.length === 0 && !query && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute/70">Popular:</span>
            {EXAMPLE_PASSPORTS.map((iso3) => (
              <button
                key={iso3}
                onClick={() => add(iso3)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-paper-2/80 px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-stamp/40 hover:bg-stamp/[0.04] hover:text-ink"
              >
                <span>{flagFor(iso3)}</span>
                <span>{nameFor(iso3)}</span>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* ── Visas & permits — search-based selector ── */}
      <div className="mt-8">
        <div className="mb-3">
          <p className="font-display text-[17px] font-semibold text-ink">
            Visas &amp; Permits You Hold
            <span className="ml-2 font-display text-[13px] font-normal italic text-ink-soft">optional</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">Holding a US visa, Schengen visa, or Japan residence permit unlocks extra destinations beyond your passport alone</p>
        </div>

        <div ref={credBoxRef} className="relative z-20 w-full">
          <div className={`flex min-h-[3.25rem] w-full flex-wrap items-center gap-2 rounded-lg border-2 bg-paper-2 px-4 py-2.5 transition-all ${credOpen ? "border-stamp/70 shadow-[0_0_0_3px_rgba(178,53,40,0.07)]" : "border-line-strong"}`}>
            {/* Selected credential chips */}
            {creds.map((credId) => {
              const c = dataset.credentials.find((x) => x.id === credId);
              if (!c) return null;
              return (
                <span key={credId} className="inline-flex items-center gap-1.5 rounded-md border border-stamp/30 bg-stamp/[0.06] px-2.5 py-1.5 text-[13px] text-stamp">
                  <span className="text-base leading-none">{GROUP_ISO3[c.group] ? flagFor(GROUP_ISO3[c.group]) : ""}</span>
                  <span className="font-display font-medium">{c.short}</span>
                  <button
                    onClick={() => toggleCred(credId)}
                    className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[11px] transition hover:bg-stamp/20"
                    aria-label={`Remove ${c.short}`}
                  >×</button>
                </span>
              );
            })}
            <input
              value={credQuery}
              onChange={(e) => { setCredQuery(e.target.value); setCredOpen(true); }}
              onFocus={() => setCredOpen(true)}
              placeholder={creds.length ? "Add another visa or permit…" : "Search by country — e.g. Japan visa, US Green Card, Schengen…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-mute/55"
            />
            {creds.length > 0 && (
              <button onClick={() => { setCreds([]); setCredQuery(""); }} className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-mute/60 hover:text-stamp">
                Clear
              </button>
            )}
          </div>

          {/* Credential dropdown */}
          {credOpen && credGroupOptions.length > 0 && (
            <div className="absolute z-30 mt-1.5 max-h-[26rem] w-full overflow-auto rounded-lg border border-line-strong bg-paper-2 shadow-2xl shadow-ink/20">
              {credGroupOptions.map(({ name, items }) => (
                <div key={name} className="border-b border-line last:border-0">
                  <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
                    <span className="text-xl leading-none">{GROUP_ISO3[name] ? flagFor(GROUP_ISO3[name]) : "🌐"}</span>
                    <span className="font-display text-[14px] font-semibold text-ink">{name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 pb-3 pl-11">
                    {items.map((c) => {
                      const on = creds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => { toggleCred(c.id); }}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                            on
                              ? "border-stamp bg-stamp/10 font-semibold text-stamp"
                              : "border-line-strong bg-paper-2/80 text-ink-soft hover:border-stamp/50 hover:text-ink"
                          }`}
                        >
                          {on && <span className="text-[10px] font-bold">✓</span>}
                          {CRED_CHIP_LABEL[c.id] ?? c.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {credGroupOptions.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-mute">No credentials found for "{credQuery}"</p>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ── Results ── */}
      {!hasInput ? (
        <EmptyState onAdd={add} />
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

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}


function EmptyState({ onAdd }: { onAdd: (iso3: string) => void }) {
  return (
    <div className="reveal mt-14 overflow-hidden rounded-sm border border-line-strong bg-paper-2/60 px-6 py-16 text-center">
      <PassportBook className="mx-auto h-14 w-14 text-ink/75" />
      <h2 className="font-display mt-5 text-2xl font-semibold text-ink">Add your passport above to get started</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        See visa-free destinations, freedom-of-movement rights, golden visas, citizenship programs, and fast-track immigration open to you — all from official government sources.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {EXAMPLE_PASSPORTS.slice(0, 6).map((iso3) => (
          <button
            key={iso3}
            onClick={() => onAdd(iso3)}
            className="mono inline-flex items-center gap-2 rounded-sm border border-line-strong bg-paper-2 px-3 py-2 text-[12px] text-ink-soft transition hover:border-stamp/50 hover:bg-stamp/[0.05] hover:text-ink"
          >
            <span className="text-base">{flagFor(iso3)}</span>
            {nameFor(iso3)}
          </button>
        ))}
      </div>
    </div>
  );
}

const iso3ToRegion = new Map(dataset.allCountries.map((c) => [c.iso3, c.region]));

function StatBand({ result, activeTab, setTab }: {
  result: ReturnType<typeof compute>;
  activeTab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const strongest = result.perPassportReach[0];
  const etaCount = result.reachByLevel.eta.length + result.reachByLevel.e_visa.length;

  const cards: { tab: TabKey; count: number; label: string; accent: string; border: string; bg: string; tooltip: string }[] = [
    {
      tab: "visa_free",
      count: result.reachByLevel.visa_free.length,
      label: "Visa-free",
      accent: "text-vfree",
      border: "border-vfree/30",
      bg: "bg-vfree/[0.05]",
      tooltip: "You can enter with just your passport — no visa application, no fee, no border paperwork. Walk straight through.",
    },
    {
      tab: "visa_on_arrival",
      count: result.reachByLevel.visa_on_arrival.length,
      label: "Visa on arrival",
      accent: "text-voa",
      border: "border-voa/30",
      bg: "bg-voa/[0.05]",
      tooltip: "You get a stamp or sticker at the airport when you land. No pre-application needed, but you typically pay a small fee on arrival.",
    },
    {
      tab: "eta",
      count: etaCount,
      label: "eTA / e-Visa",
      accent: "text-eta",
      border: "border-eta/30",
      bg: "bg-eta/[0.05]",
      tooltip: "Apply online before you travel — usually takes minutes to a few days and costs a small fee. No embassy visit or paper visa needed.",
    },
    {
      tab: "fom",
      count: result.freedomOfMovement.length,
      label: "Free movement",
      accent: "text-bloc",
      border: "border-bloc/30",
      bg: "bg-bloc/[0.05]",
      tooltip: "As a member of a regional bloc (EU, GCC, ECOWAS…) you have the right to live, work, and travel in fellow member states with no visa at all.",
    },
    {
      tab: "cbi",
      count: result.cbi.length,
      label: "Citizenship (CBI)",
      accent: "text-stamp",
      border: "border-stamp/30",
      bg: "bg-stamp/[0.05]",
      tooltip: "Obtain a second citizenship through a qualifying investment — typically a donation, real estate purchase, or government fund contribution.",
    },
    {
      tab: "rbi",
      count: result.rbi.length,
      label: "Golden visas",
      accent: "text-voa",
      border: "border-voa/30",
      bg: "bg-voa/[0.05]",
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
            Strongest: {flagFor(strongest.iso3)} {nameFor(strongest.iso3)} ({strongest.total})
          </span>
        )}
      </div>

      {/* clickable stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <div key={i} className="group relative">
            <button
              onClick={() => setTab(c.tab)}
              className={`flex h-[4.75rem] w-full flex-col justify-center rounded-lg border-2 px-4 text-left transition hover:shadow-sm ${
                activeTab === c.tab
                  ? `${c.border} ${c.bg} shadow-sm`
                  : "border-line-strong bg-paper-2/60 hover:border-line-strong/70"
              }`}
            >
              <div className={`font-display text-3xl font-semibold tabular-nums leading-none ${c.accent}`}>{c.count}</div>
              <div className="mono mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                <span className="whitespace-nowrap">{c.label}</span>
                <span className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-ink-mute/40 text-[8px] font-bold leading-none text-ink-mute/60">?</span>
              </div>
            </button>
            {/* tooltip */}
            <div className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-56 rounded-md border border-line-strong bg-paper-2 p-3 text-[12px] leading-relaxed text-ink-soft shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {c.tooltip}
              <div className="absolute left-4 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-line-strong" />
            </div>
          </div>
        ))}
      </div>

      {/* Secondary navigation row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {result.viaCredentialCount > 0 && (
          <p className="text-sm text-ink-soft">
            <span className="stamp mr-1.5 bg-stamp/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stamp">+{result.viaCredentialCount}</span>
            extra destination{result.viaCredentialCount === 1 ? "" : "s"} unlocked by visas you hold.
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {result.transitReach.length > 0 && (
            <button
              onClick={() => setTab("transit")}
              className={`mono inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] transition ${
                activeTab === "transit"
                  ? "border-eta/40 bg-eta/[0.07] text-eta"
                  : "border-line-strong bg-paper-2/60 text-ink-mute hover:border-eta/40 hover:text-ink"
              }`}
            >
              Transit access
              <span className="tabular-nums">{result.transitReach.length}</span>
            </button>
          )}
          <button
            onClick={() => setTab("fast")}
            className={`mono inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] transition ${
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


// ── Visa Type Cards ───────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  tourist: "Tourist",
  business: "Business",
  student: "Student",
  work: "Work",
  transit: "Transit",
  medical: "Medical",
  retirement: "Retirement",
  working_holiday: "Working Holiday",
  digital_nomad: "Digital Nomad",
  family: "Family",
  investment: "Investment",
};

const CATEGORY_COLOR: Record<string, string> = {
  tourist: "text-vfree bg-vfree/10 ring-vfree/30",
  business: "text-bloc bg-bloc/10 ring-bloc/30",
  student: "text-eta bg-eta/10 ring-eta/30",
  work: "text-stamp bg-stamp/10 ring-stamp/30",
  transit: "text-ink-soft bg-paper-3/60 ring-line-strong",
  medical: "text-voa bg-voa/10 ring-voa/30",
  retirement: "text-voa bg-voa/10 ring-voa/30",
  working_holiday: "text-vfree bg-vfree/10 ring-vfree/30",
  digital_nomad: "text-bloc bg-bloc/10 ring-bloc/30",
  family: "text-stamp bg-stamp/10 ring-stamp/30",
  investment: "text-voa bg-voa/10 ring-voa/30",
};

function VisaTypeCards({ visaTypes }: { visaTypes: VisaType[] }) {
  return (
    <div className="mt-5">
      <p className="mono mb-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        Visa types offered
      </p>
      <div className="divide-y divide-line/60">
        {visaTypes.map((v, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span className={`mono shrink-0 rounded-[3px] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] ring-1 ${CATEGORY_COLOR[v.category] ?? "text-ink-soft bg-paper-3 ring-line"}`}>
              {CATEGORY_LABEL[v.category] ?? v.category}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{v.name}</span>
            <span className="mono ml-auto flex shrink-0 items-center gap-3 text-[11px] text-ink-mute">
              {v.max_stay_days != null && <span>≤{v.max_stay_days}d</span>}
              {v.fee_usd != null && (
                <span className="text-stamp">{v.fee_usd === 0 ? "free" : `~$${v.fee_usd}`}</span>
              )}
              {v.on_arrival && <span>on arrival</span>}
              {!v.on_arrival && v.online && (
                v.official_url
                  ? <a href={v.official_url} target="_blank" rel="noreferrer" className="text-vfree hover:underline">online ↗</a>
                  : <span className="text-vfree">online</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DestinationResult({
  destIso3,
  result,
  onOpen,
  onClear,
}: {
  destIso3: string;
  result: ReturnType<typeof compute>;
  onOpen: (d: Detail) => void;
  onClear: () => void;
}) {
  const reach = result.reach.find((e) => e.dest === destIso3) as (CombinedEdge & { conditions?: string | null }) | undefined;
  const transit = result.transitReach.find((e) => e.dest === destIso3) as (CombinedEdge & { conditions?: string | null }) | undefined;
  const fom = result.freedomOfMovement.find((e) => e.dest === destIso3);
  const isOwnCountry = result.selected.includes(destIso3);

  const flag = flagFor(destIso3);
  const name = nameFor(destIso3);

  return (
    <div className="reveal mt-8 overflow-hidden rounded-lg border-2 border-bloc/25 bg-bloc/[0.03]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{flag}</span>
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">Your access to</p>
            <h3 className="font-display text-xl font-semibold text-ink">{name}</h3>
          </div>
        </div>
        <button
          onClick={onClear}
          className="mono text-[10px] uppercase tracking-[0.12em] text-ink-mute transition hover:text-stamp"
        >
          Clear ×
        </button>
      </div>

      <div className="px-6 py-5">
        {isOwnCountry ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-display font-semibold text-ink">This is one of your home countries</p>
              <p className="mt-0.5 text-sm text-ink-soft">You hold citizenship here — no visa needed to enter.</p>
            </div>
          </div>
        ) : reach ? (
          <div>
            {/* Access status */}
            <div className="flex flex-wrap items-start gap-4">
              <div className={`rounded-lg border-2 ${
                reach.level === "visa_free" ? "border-vfree/30 bg-vfree/[0.06]"
                : reach.level === "visa_on_arrival" ? "border-voa/30 bg-voa/[0.06]"
                : "border-eta/30 bg-eta/[0.06]"
              } px-5 py-3.5`}>
                <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Access type</p>
                <AccessPill level={reach.level} />
                <p className={`mt-1.5 font-display text-sm font-medium ${
                  reach.level === "visa_free" ? "text-vfree"
                  : reach.level === "visa_on_arrival" ? "text-voa"
                  : "text-eta"
                }`}>
                  {reach.level === "visa_free"
                    ? "Enter with just your passport — no visa needed"
                    : reach.level === "visa_on_arrival"
                    ? "Get your visa at the airport on arrival"
                    : "Apply online before travel"}
                </p>
              </div>

              {reach.maxStayDays != null && (
                <div className="rounded-lg border-2 border-line-strong bg-paper-2/80 px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Maximum stay</p>
                  <p className="font-display text-2xl font-semibold text-ink">{reach.maxStayDays}</p>
                  <p className="mono text-[11px] text-ink-mute">days</p>
                </div>
              )}

              {reach.viaIso3 && (
                <div className="rounded-lg border-2 border-line-strong bg-paper-2/80 px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Via passport</p>
                  <p className="font-display font-semibold text-ink">{flagFor(reach.viaIso3)} {nameFor(reach.viaIso3)}</p>
                </div>
              )}

              {reach.viaCredential && (
                <div className="rounded-lg border-2 border-stamp/25 bg-stamp/[0.04] px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Unlocked by</p>
                  <p className="font-display font-semibold text-stamp">{CRED_SHORT[reach.viaCredential] ?? "held visa"}</p>
                </div>
              )}
            </div>

            {/* Conditions */}
            {(reach.conditions || reach.notes) && (
              <div className="mt-4 rounded-md border border-eta/20 bg-eta/[0.04] px-4 py-3">
                <p className="mono mb-1 text-[10px] uppercase tracking-[0.15em] text-eta">Conditions &amp; notes</p>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {reach.conditions && reach.notes ? `${reach.conditions} — ${reach.notes}` : reach.conditions ?? reach.notes}
                </p>
              </div>
            )}

            {/* Source */}
            <div className="mt-4 flex items-center gap-3">
              {reach.sourceUrl && <SourceLink url={reach.sourceUrl} official={reach.sourceOfficial} />}
              <button
                onClick={() => onOpen(reachDetail(reach))}
                className="mono text-[10px] uppercase tracking-[0.12em] text-stamp transition hover:underline"
              >
                Full details →
              </button>
            </div>
          </div>
        ) : fom ? (
          <div>
            <div className="flex items-start gap-4">
              <div className="rounded-lg border-2 border-bloc/30 bg-bloc/[0.06] px-5 py-3.5">
                <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Access type</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-bloc">Freedom of movement</p>
                <p className="mt-1 text-sm text-ink-soft">Right to live and work — no visa required</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {fom.groups.map((g) => (
                <span key={g} className="mono rounded-[3px] bg-bloc/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-bloc">
                  {dataset.groupLabels[g] ?? g}
                </span>
              ))}
            </div>
          </div>
        ) : transit ? (
          <div>
            <div className="mb-3 rounded-md border border-eta/25 bg-eta/[0.05] px-4 py-3 text-sm leading-relaxed text-ink-soft">
              <span className="mono mr-2 font-semibold uppercase tracking-[0.1em] text-eta">Transit only</span>
              You can change planes or transit the country without a visa — but <strong className="font-semibold text-ink">not for tourism or extended stays</strong>.
            </div>
            {transit.maxStayDays != null && (
              <p className="mono text-sm text-ink-mute">Transit up to {transit.maxStayDays} hours.</p>
            )}
            {transit.conditions && <p className="mt-2 text-sm text-ink-soft">{transit.conditions}</p>}
          </div>
        ) : (
          /* No access found */
          <div>
            <div className="flex items-start gap-4">
              <div className="rounded-lg border-2 border-stamp/25 bg-stamp/[0.04] px-5 py-4">
                <p className="mono text-[10px] uppercase tracking-[0.15em] text-stamp">Access status</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-ink">Visa required</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {result.selected.length === 0
                    ? "Add your passport above to see visa requirements."
                    : "No automatic access found with your current passport(s) and credentials. You will need to apply for a visa before travelling."}
                </p>
              </div>
            </div>
            {result.selected.length > 0 && (
              <div className="mt-4 rounded-md border border-line bg-paper-2/70 px-4 py-3">
                <p className="mono mb-2 text-[10px] uppercase tracking-[0.15em] text-ink-mute">What you can do</p>
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  <li>→ Apply for a tourist/visitor visa at {name}&apos;s embassy or consulate</li>
                  <li>→ Check if holding a US, Schengen, UK, or Japan visa unlocks access (add credentials above)</li>
                  {result.cbi.some(p => p.iso3 === destIso3) && (
                    <li>→ <span className="font-medium text-stamp">CBI program available</span> — invest to obtain citizenship here</li>
                  )}
                  {result.rbi.some(p => p.iso3 === destIso3) && (
                    <li>→ <span className="font-medium text-voa">Golden visa available</span> — invest to obtain residency here</li>
                  )}
                </ul>
              </div>
            )}
            {(() => {
              const visaTypes = dataset.destinationVisaTypes?.[destIso3];
              return visaTypes && visaTypes.length > 0 ? <VisaTypeCards visaTypes={visaTypes} /> : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function AccessPill({ level }: { level: AccessLevel }) {
  return (
    <span className={`mono rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ring-1 ${LEVEL_STYLE[level]}`}>
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
  return <span className={`inline-block h-2 w-2 rounded-full ring-2 ${official ? "bg-vfree ring-vfree/30" : "bg-eta ring-eta/30"}`} title={official ? "Official government source" : "Non-official source"} />;
}

const CARD = "cursor-pointer rounded-sm border border-line bg-paper-2/70 shadow-[0_1px_2px_rgba(24,37,60,0.06)] transition hover:-translate-y-0.5 hover:border-stamp/40 hover:shadow-[0_8px_22px_-12px_rgba(24,37,60,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp/50";

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
  if (e.viaCredential) badges.push({ text: `via ${CRED_SHORT[e.viaCredential] ?? "held visa"}`, tone: "stamp" });
  if (e.viaPassportType) badges.push({ text: `${e.viaPassportType} passport`, tone: "bloc" });
  const rows: Detail["rows"] = [];
  if (e.maxStayDays != null) rows.push({ label: "Maximum stay", value: `${e.maxStayDays} days` });
  if (e.viaIso3) rows.push({ label: "Via passport", value: `${flagFor(e.viaIso3)} ${nameFor(e.viaIso3)}` });
  return {
    iso3: e.dest, title: nameFor(e.dest), subtitle: LEVEL_LABEL[e.level], level: e.level,
    badges, rows, notes: e.notes, sourceUrl: e.sourceUrl, sourceOfficial: e.sourceOfficial,
  };
}

function ReachPanel({ result, entries, filter, setFilter, onOpen }: { result: ReturnType<typeof compute>; entries: ReturnType<typeof compute>["reach"]; filter: string; setFilter: (s: string) => void; onOpen: (d: Detail) => void }) {
  const q = filter.trim().toLowerCase();
  const rows = entries.filter((e) => !q || nameFor(e.dest).toLowerCase().includes(q));
  if (entries.length === 0) return <Note>No official visa-policy data yet maps to this passport. Many governments don&apos;t publish enumerated visa-free lists; reach is derived only from destinations that do.</Note>;
  return (
    <div className="reveal">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter destinations…"
        className="mono mb-5 w-full max-w-xs rounded-sm border border-line-strong bg-paper-2/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40 placeholder:text-ink-mute/70"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((e) => (
          <ClickCard key={e.dest} onOpen={() => onOpen(reachDetail(e))} className={`group flex items-start gap-3 p-3.5 ${CARD}`}>
            <span className="text-2xl leading-none">{flagFor(e.dest)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display truncate font-medium text-ink">{nameFor(e.dest)}</span>
                <AccessPill level={e.level} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.maxStayDays != null && <span className="mono text-[11px] text-ink-mute">≤ {e.maxStayDays} days</span>}
                {e.viaCredential && (
                  <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-stamp ring-1 ring-stamp/30">
                    via {CRED_SHORT[e.viaCredential] ?? "held visa"}
                  </span>
                )}
                {e.viaPassportType && (
                  <span className="mono rounded-[3px] bg-bloc/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-bloc ring-1 ring-bloc/30">
                    {e.viaPassportType} passport
                  </span>
                )}
                {e.sourceUrl && <span className="mono inline-flex items-center gap-1.5 text-[11px] text-ink-mute"><SourceDot official={e.sourceOfficial} />{hostOf(e.sourceUrl)}</span>}
              </div>
              {e.notes && <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink-mute">{e.notes}</p>}
              <span className="mono mt-1.5 block text-[10px] uppercase tracking-[0.1em] text-stamp opacity-0 transition group-hover:opacity-100">Click for details →</span>
            </div>
          </ClickCard>
        ))}
      </div>
    </div>
  );
}

function TransitPanel({ result, onOpen }: { result: ReturnType<typeof compute>; onOpen: (d: Detail) => void }) {
  if (result.transitReach.length === 0)
    return <Note>No transit-only destinations in your current credential combination.</Note>;
  return (
    <div className="reveal">
      <div className="mb-5 rounded-md border border-eta/25 bg-eta/[0.05] px-4 py-3 text-sm leading-relaxed text-ink-soft">
        <span className="mono mr-2 font-semibold uppercase tracking-[0.1em] text-eta">Transit only</span>
        These destinations allow you to change planes or transit the country without a visa — but{" "}
        <strong className="font-semibold text-ink">not for tourism or extended stays</strong>. They appear here separately so they aren't confused with regular visa-free access.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.transitReach.map((e) => (
          <ClickCard key={e.dest} onOpen={() => onOpen(reachDetail(e))} className={`group flex items-start gap-3 p-3.5 ${CARD}`}>
            <span className="text-2xl leading-none">{flagFor(e.dest)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display truncate font-medium text-ink">{nameFor(e.dest)}</span>
                <span className="mono rounded-[3px] bg-eta/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-eta ring-1 ring-eta/30">Transit</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.maxStayDays != null && <span className="mono text-[11px] text-ink-mute">≤ {e.maxStayDays}h transit</span>}
                {e.viaCredential && (
                  <span className="mono rounded-[3px] bg-stamp/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-stamp ring-1 ring-stamp/30">
                    via {CRED_SHORT[e.viaCredential] ?? "held visa"}
                  </span>
                )}
                {e.sourceUrl && <span className="mono inline-flex items-center gap-1.5 text-[11px] text-ink-mute"><SourceDot official={e.sourceOfficial} />{hostOf(e.sourceUrl)}</span>}
              </div>
              {e.notes && <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink-mute">{e.notes}</p>}
            </div>
          </ClickCard>
        ))}
      </div>
    </div>
  );
}

function FomPanel({ result, onOpen }: { result: ReturnType<typeof compute>; onOpen: (d: Detail) => void }) {
  if (result.freedomOfMovement.length === 0)
    return <Note>None of your passports belong to a free-movement bloc in our dataset (EU/EEA, GCC, CARICOM, ECOWAS, ASEAN, Mercosur, Common Travel Area, Trans-Tasman…).</Note>;
  return (
    <div>
      <p className="mb-5 max-w-2xl leading-relaxed text-ink-soft">
        Regional bloc privileges from your membership — these typically grant visa-free entry, and
        depending on the bloc the right to{" "}
        <span className="font-medium text-bloc">live and work</span> (e.g. EU/EEA, GCC, ECOWAS,
        Mercosur). Confirm the specific rights per bloc.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.freedomOfMovement.map((e, i) => (
          <ClickCard
            key={e.dest}
            onOpen={() => onOpen({
              iso3: e.dest, title: nameFor(e.dest), subtitle: "Freedom of movement",
              badges: e.groups.map((g) => ({ text: dataset.groupLabels[g] ?? g, tone: "bloc" as const })),
              notes: "Shared regional-bloc membership — typically grants visa-free entry and, depending on the bloc, the right to live and work. Confirm the specific rights per bloc.",
            })}
            className={`reveal flex items-center gap-3 border-bloc/20 bg-bloc/[0.04] p-3.5 ${CARD}`}
            style={{ animationDelay: `${(i % 10) * 35}ms` }}
          >
            <span className="text-2xl">{flagFor(e.dest)}</span>
            <div className="min-w-0">
              <div className="font-display truncate font-medium text-ink">{nameFor(e.dest)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {e.groups.map((g) => (
                  <span key={g} className="mono rounded-[2px] bg-bloc/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-bloc">
                    {dataset.groupLabels[g] ?? g}
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

function CbiPanel({ result, onOpen }: { result: ReturnType<typeof compute>; onOpen: (d: Detail) => void }) {
  if (result.cbi.length === 0) return <Note>No citizenship-by-investment programs found on official sources yet.</Note>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {result.cbi.map((p, i) => {
        const rows: Detail["rows"] = [];
        if (p.dual_citizenship_allowed != null) rows.push({ label: "Dual citizenship", value: p.dual_citizenship_allowed ? "Allowed" : "Not allowed" });
        if (p.residency_required != null) rows.push({ label: "Residency required", value: p.residency_required ? "Yes" : "No" });
        if (p.processing_time) rows.push({ label: "Processing time", value: `~${p.processing_time}` });
        return (
        <ClickCard
          key={p.iso3}
          onOpen={() => onOpen({
            iso3: p.iso3, title: nameFor(p.iso3), subtitle: p.program_name,
            badges: p.verified ? [{ text: "verified", tone: "vfree" }] : [],
            options: p.options.map((o) => ({ label: o.type.replace(/_/g, " "), value: fmtMoney(o.min_amount, o.currency) })),
            rows, notes: p.notes, sourceUrl: p.official_url, sourceOfficial: p.source_official,
          })}
          className={`reveal p-5 ${CARD}`}
          style={{ animationDelay: `${(i % 8) * 40}ms` }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{flagFor(p.iso3)}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold text-ink">{nameFor(p.iso3)}</span>
                {p.verified && <span className="stamp bg-vfree/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-vfree">verified</span>}
              </div>
              <div className="text-sm italic text-ink-soft">{p.program_name}</div>
            </div>
          </div>
          {p.options.length > 0 && (
            <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
              {p.options.map((o, j) => (
                <li key={j} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm capitalize text-ink-soft">{o.type.replace(/_/g, " ")}</span>
                  <span className="mono text-sm font-semibold tabular-nums text-stamp">{fmtMoney(o.min_amount, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mono mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            {p.dual_citizenship_allowed != null && <span>Dual: {p.dual_citizenship_allowed ? "allowed" : "no"}</span>}
            {p.residency_required != null && <span>Residency: {p.residency_required ? "required" : "no"}</span>}
            {p.processing_time && <span>~{p.processing_time}</span>}
            {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
          </div>
        </ClickCard>
        );
      })}
    </div>
  );
}

function RbiPanel({ result, onOpen }: { result: ReturnType<typeof compute>; onOpen: (d: Detail) => void }) {
  if (result.rbi.length === 0) return <Note>No residence-by-investment / golden-visa programs found on official sources yet.</Note>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {result.rbi.map((p, i) => {
        const rows: Detail["rows"] = [{ label: "Minimum investment", value: fmtMoney(p.min_amount, p.currency) }];
        if (p.path_to_pr_years != null) rows.push({ label: "Path to PR", value: `${p.path_to_pr_years} years` });
        if (p.path_to_citizenship_years != null) rows.push({ label: "Path to citizenship", value: `${p.path_to_citizenship_years} years` });
        return (
        <ClickCard
          key={p.iso3 + i}
          onOpen={() => onOpen({ iso3: p.iso3, title: p.program_name, subtitle: `${nameFor(p.iso3)}${p.type ? ` · ${p.type}` : ""}`, rows, notes: p.notes, sourceUrl: p.official_url, sourceOfficial: p.source_official })}
          className={`reveal p-4 ${CARD}`}
          style={{ animationDelay: `${(i % 10) * 30}ms` }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{flagFor(p.iso3)}</span>
            <div className="min-w-0">
              <div className="font-display truncate font-medium text-ink">{p.program_name}</div>
              <div className="mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">{nameFor(p.iso3)}{p.type ? ` · ${p.type}` : ""}</div>
            </div>
            <span className="mono ml-auto text-sm font-semibold tabular-nums text-voa">{fmtMoney(p.min_amount, p.currency)}</span>
          </div>
          <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            {p.path_to_pr_years != null && <span>PR in {p.path_to_pr_years}y</span>}
            {p.path_to_citizenship_years != null && <span>Citizenship in {p.path_to_citizenship_years}y</span>}
            {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
          </div>
          {p.notes && <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink-mute">{p.notes}</p>}
        </ClickCard>
        );
      })}
    </div>
  );
}

function FastPanel({ result, onOpen }: { result: ReturnType<typeof compute>; onOpen: (d: Detail) => void }) {
  if (result.fastTrack.length === 0) return <Note>No fast-track / skilled / talent / digital-nomad programs found on official sources yet.</Note>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {result.fastTrack.map((p, i) => {
        const rows: Detail["rows"] = [];
        if (p.processing_time) rows.push({ label: "Processing time", value: `~${p.processing_time}` });
        const notes = [p.eligibility, p.notes].filter(Boolean).join("\n\n");
        return (
        <ClickCard
          key={p.iso3 + i}
          onOpen={() => onOpen({ iso3: p.iso3, title: p.program_name, subtitle: `${nameFor(p.iso3)}${p.category ? ` · ${p.category}` : ""}`, rows, notes, sourceUrl: p.official_url, sourceOfficial: p.source_official })}
          className={`reveal p-4 ${CARD}`}
          style={{ animationDelay: `${(i % 10) * 30}ms` }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{flagFor(p.iso3)}</span>
            <div className="min-w-0">
              <div className="font-display truncate font-medium text-ink">{p.program_name}</div>
              <div className="mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">{nameFor(p.iso3)}{p.category ? ` · ${p.category}` : ""}</div>
            </div>
          </div>
          {p.eligibility && <p className="mt-2 line-clamp-3 text-sm leading-snug text-ink-soft">{p.eligibility}</p>}
          <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-mute">
            {p.processing_time && <span>~{p.processing_time}</span>}
            {p.official_url && <span className="inline-flex items-center gap-1.5"><SourceDot official={p.source_official} />{hostOf(p.official_url)}</span>}
          </div>
        </ClickCard>
        );
      })}
    </div>
  );
}

function DetailModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const toneCls = (tone: string) =>
    tone === "bloc" ? "bg-bloc/10 text-bloc ring-bloc/30"
      : tone === "vfree" ? "bg-vfree/10 text-vfree ring-vfree/30"
      : "bg-stamp/10 text-stamp ring-stamp/30";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={detail.title}>
      <div className="reveal absolute inset-0 bg-ink/40 backdrop-blur-[2px]" style={{ animationDuration: "0.25s" }} onClick={onClose} />
      <div className="reveal relative z-10 w-full max-w-lg overflow-hidden rounded-sm border border-line-strong bg-paper-2 shadow-2xl shadow-ink/30" style={{ animationDuration: "0.3s" }}>
        <div className="rule-double flex items-start gap-3 px-6 pb-4 pt-6">
          <span className="text-4xl leading-none">{flagFor(detail.iso3)}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-semibold leading-tight text-ink">{detail.title}</h3>
            {detail.subtitle && <div className="mt-0.5 text-sm italic text-ink-soft">{detail.subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-ink-mute transition hover:bg-stamp hover:text-paper-2">×</button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-6 py-5">
          {(detail.level || (detail.badges && detail.badges.length > 0)) && (
            <div className="flex flex-wrap items-center gap-2">
              {detail.level && <AccessPill level={detail.level} />}
              {detail.badges?.map((b, i) => (
                <span key={i} className={`mono rounded-[3px] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ring-1 ${toneCls(b.tone)}`}>{b.text}</span>
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
                  <dt className="mono self-center text-[10px] uppercase tracking-[0.12em] text-ink-mute">{r.label}</dt>
                  <dd className="text-sm text-ink">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {detail.notes && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{detail.notes}</p>}
          {detail.sourceUrl && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <SourceLink url={detail.sourceUrl} official={!!detail.sourceOfficial} />
              <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">· {detail.sourceOfficial ? "official source" : "non-official source"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong bg-paper-2/40 px-5 py-10 text-center leading-relaxed text-ink-soft">
      {children}
    </div>
  );
}

function PassportBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 5h22a2 2 0 0 1 2 2v34a2 2 0 0 1-2 2H13a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" />
      <path d="M9 38a4 4 0 0 1 4-3h24" />
      <circle cx="23" cy="18" r="5" />
      <path d="M18 18h10M23 13v10" className="opacity-50" />
      <path d="M18 28h10M20 32h6" />
    </svg>
  );
}
