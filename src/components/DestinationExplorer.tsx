"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dataset, flagFor, nameFor, isoToFlag } from "@/lib/dataset";
import { useDetectedPassport } from "@/lib/geo";
import { compute, LEVEL_LABEL, type CombinedEdge } from "@/lib/compute";
import type { AccessLevel, PassportType, VisaType } from "@/lib/types";

// ── Constants (duplicated from PassportExplorer for isolation) ────────────────

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

const CRED_SHORT: Record<string, string> = Object.fromEntries(
  dataset.credentials.map((c) => [c.id, c.short]),
);

/** noun phrase for a credential group, used in the "can unlock entry" hint */
const HUB_LABEL: Record<string, string> = {
  "United States": "the US",
  "United Kingdom": "the UK",
  "Gulf (GCC)": "the GCC",
  "Schengen / EU": "the Schengen area",
};

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

const CREDENTIAL_GROUPS: { name: string; items: typeof dataset.credentials }[] = [];
{
  const map = new Map<string, typeof dataset.credentials>();
  for (const c of dataset.credentials) {
    if (!map.has(c.group)) map.set(c.group, []);
    map.get(c.group)!.push(c);
  }
  for (const [name, items] of map) CREDENTIAL_GROUPS.push({ name, items });
}

const LEVEL_STYLE: Record<AccessLevel, string> = {
  visa_free:     "text-vfree bg-vfree/[0.08] border border-vfree/25",
  visa_on_arrival: "text-voa bg-voa/[0.08] border border-voa/25",
  eta:           "text-eta bg-eta/[0.08] border border-eta/25",
  e_visa:        "text-evisa bg-evisa/[0.08] border border-evisa/25",
};

const LEVEL_LEFT_BORDER: Record<AccessLevel, string> = {
  visa_free:     "border-l-vfree",
  visa_on_arrival: "border-l-voa",
  eta:           "border-l-eta",
  e_visa:        "border-l-evisa",
};


// ── Helpers ───────────────────────────────────────────────────────────────────

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** country names that take "the" in running prose ("travelling to the United States") */
const ARTICLE_COUNTRIES = new Set([
  "Bahamas", "Central African Republic", "Comoros", "Democratic Republic of the Congo",
  "Dominican Republic", "Gambia", "Holy See (Vatican City)", "Maldives", "Marshall Islands",
  "Netherlands", "Philippines", "Republic of the Congo", "Solomon Islands",
  "United Arab Emirates", "United Kingdom", "United States",
]);

function withArticle(name: string): string {
  return ARTICLE_COUNTRIES.has(name) ? `the ${name}` : name;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/** Render text with bare or parenthesised URLs turned into real links. */
function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const re = /\((https?:\/\/[^\s()]*[^\s().,;:])\)|(https?:\/\/[^\s()]*[^\s().,;:])/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const url = (m[1] ?? m[2])!;
    nodes.push(
      <a key={m.index} href={url} target="_blank" rel="noreferrer" className="text-stamp hover:underline">
        {/\.pdf(?:$|[?#])/i.test(url) ? "Download PDF" : hostOf(url)} ↗
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <p className={className}>{nodes}</p>;
}

/** VFS publishes some visa-type names in ALL CAPS - bring those in line with the rest. */
const VFS_ACRONYMS = new Set(["VFS", "COE", "UK", "US", "USA", "EU", "UAE", "GCC", "PDF", "ID"]);
function normalizeVfsName(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (!letters || letters.replace(/[^A-Z]/g, "").length / letters.length < 0.8) return name;
  return name.toLowerCase().replace(/[a-z]+/g, (w) => {
    const up = w.toUpperCase();
    return VFS_ACRONYMS.has(up) ? up : w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function AccessPill({ level }: { level: AccessLevel }) {
  return (
    <span className={`mono inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${LEVEL_STYLE[level]}`}>
      {LEVEL_LABEL[level]}
    </span>
  );
}

function SourceDot({ official }: { official: boolean }) {
  const label = official ? "Official government source" : "Non-official source";
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-block h-2 w-2 rounded-full ${official ? "bg-vfree" : "bg-eta"}`}
      title={label}
    />
  );
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

// ── Main component ────────────────────────────────────────────────────────────

export default function DestinationExplorer() {
  // Destination is the primary focus
  const [destIso3, setDestIso3] = useState<string | null>(null);
  const [destQuery, setDestQuery] = useState("");
  const [destOpen, setDestOpen] = useState(false);

  // Passports
  const [selected, setSelected] = useState<string[]>([]);
  const [ptypes, setPtypes] = useState<Record<string, PassportType>>({});
  const [passQuery, setPassQuery] = useState("");
  const [passOpen, setPassOpen] = useState(false);

  // Credentials
  const [creds, setCreds] = useState<string[]>([]);
  const [credQuery, setCredQuery] = useState("");
  const [credOpen, setCredOpen] = useState(false);
  const [credHi, setCredHi] = useState(-1); // highlighted option in credentials combobox

  // Passport type dropdown
  const [typeOpen, setTypeOpen] = useState<string | null>(null);
  const [destHi, setDestHi] = useState(-1); // highlighted option in destination combobox
  const [passHi, setPassHi] = useState(-1); // highlighted option in passport combobox
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const detectedPassport = useDetectedPassport();
  const autoSeededRef = useRef(false);

  const destBoxRef = useRef<HTMLDivElement>(null);
  const passBoxRef = useRef<HTMLDivElement>(null);
  const credBoxRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);
  const credInputRef = useRef<HTMLInputElement>(null);
  const typeRefs = useRef<Record<string, HTMLElement | null>>({});


  // Seed from deep-link query params (e.g. /visit?dest=PRT&passport=IND) so links
  // from the static destination pages land pre-filled on the right destination.
  useEffect(() => {
    // Deferred a tick so state updates never run synchronously in the effect
    // flush (react-hooks/set-state-in-effect); behavior is unchanged.
    const t = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      const valid = new Set(dataset.allCountries.map((c) => c.iso3));
      const dest = (sp.get("dest") ?? "").trim().toUpperCase();
      if (valid.has(dest)) setDestIso3(dest);
      const passports = (sp.get("passport") ?? "")
        .split(",").map((s) => s.trim().toUpperCase()).filter((s) => valid.has(s));
      if (passports.length) {
        setSelected(passports);
        setPtypes(Object.fromEntries(passports.map((p) => [p, "ordinary" as PassportType])));
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Auto-fill the passport from the visitor's detected country - only on an empty
  // field, never over a deep-link or manual choice. Removable like any chip.
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

  // ── Click-outside handlers ───────────────────────────────────────────────────
  useEffect(() => {
    function h(e: MouseEvent) { if (destBoxRef.current && !destBoxRef.current.contains(e.target as Node)) setDestOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    function h(e: MouseEvent) { if (passBoxRef.current && !passBoxRef.current.contains(e.target as Node)) setPassOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    function h(e: MouseEvent) { if (credBoxRef.current && !credBoxRef.current.contains(e.target as Node)) setCredOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!typeOpen) return;
    function hClick(e: MouseEvent) { const el = typeRefs.current[typeOpen!]; if (el && !el.contains(e.target as Node)) setTypeOpen(null); }
    function hKey(e: KeyboardEvent) { if (e.key === "Escape") setTypeOpen(null); }
    document.addEventListener("mousedown", hClick);
    document.addEventListener("keydown", hKey);
    return () => { document.removeEventListener("mousedown", hClick); document.removeEventListener("keydown", hKey); };
  }, [typeOpen]);

  // ── Filtered options ─────────────────────────────────────────────────────────
  const destOptions = useMemo(() => {
    const q = destQuery.trim().toLowerCase();
    return dataset.allCountries
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.iso2.toLowerCase() === q)
      .slice(0, 80);
  }, [destQuery]);

  const passOptions = useMemo(() => {
    const q = passQuery.trim().toLowerCase();
    return dataset.allCountries
      .filter((c) => !selected.includes(c.iso3))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.iso2.toLowerCase() === q)
      .slice(0, 80);
  }, [passQuery, selected]);

  const credGroupOptions = useMemo(() => {
    const q = credQuery.trim().toLowerCase();
    if (!q) return CREDENTIAL_GROUPS;
    return CREDENTIAL_GROUPS.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.items.some((c) => c.short.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
    );
  }, [credQuery]);

  const flatCredOptions = useMemo(() => credGroupOptions.flatMap((g) => g.items), [credGroupOptions]);
  const credIndexById = useMemo(
    () => new Map(flatCredOptions.map((c, i) => [c.id, i] as const)),
    [flatCredOptions],
  );

  // ── Actions ──────────────────────────────────────────────────────────────────
  function addPassport(iso3: string) {
    setSelected((s) => (s.includes(iso3) ? s : [...s, iso3]));
    setPtypes((p) => (iso3 in p ? p : { ...p, [iso3]: "ordinary" }));
    setPassQuery("");
    setPassOpen(false);
  }
  function removePassport(iso3: string) {
    setSelected((s) => s.filter((x) => x !== iso3));
    setPtypes((p) => { const n = { ...p }; delete n[iso3]; return n; });
  }
  function setPassportType(iso3: string, t: PassportType) {
    setPtypes((p) => ({ ...p, [iso3]: t }));
  }
  function toggleCred(id: string) {
    setCreds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
  function selectDest(iso3: string) {
    setDestIso3(iso3);
    setDestQuery("");
    setDestOpen(false);
  }
  function clearDest() {
    setDestIso3(null);
    setDestQuery("");
  }

  // ── Compute results ──────────────────────────────────────────────────────────
  const result = useMemo(
    () => (selected.length > 0 ? compute(selected, creds, ptypes) : null),
    [selected, creds, ptypes]
  );

  const accessEdge = useMemo(
    () => (result && destIso3 ? (result.reach.find((e) => e.dest === destIso3) as (CombinedEdge & { conditions?: string | null }) | undefined) : undefined),
    [result, destIso3]
  );
  const transitEdge = useMemo(
    () => (result && destIso3 ? (result.transitReach.find((e) => e.dest === destIso3) as (CombinedEdge & { conditions?: string | null }) | undefined) : undefined),
    [result, destIso3]
  );
  const fomEdge = useMemo(
    () => (result && destIso3 ? result.freedomOfMovement.find((e) => e.dest === destIso3) : undefined),
    [result, destIso3]
  );
  const isOwnCountry = destIso3 != null && selected.includes(destIso3);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">

      {/* ── DESTINATION - primary ── */}
      <div className="mt-8">
        <div className="mb-2">
          <p className="font-display text-lg font-bold text-ink">Destination</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">Where do you want to go? Start here - enter your destination first</p>
        </div>

        <div ref={destBoxRef} className="relative z-30 w-full">
          <div
            onClick={(e) => { if (e.target === e.currentTarget) destInputRef.current?.focus(); }}
            className={`flex min-h-[2.75rem] w-full items-center gap-3 rounded-lg border bg-card px-4 py-2 transition-colors focus-within:ring-1 focus-within:ring-stamp ${
              destIso3
                ? "border-line-strong"
                : destOpen
                ? "cursor-text border-stamp"
                : "cursor-text border-line-strong hover:border-ink-mute"
            }`}
          >
            {destIso3 ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-2xl leading-none">{flagFor(destIso3)}</span>
                <span className="font-display text-lg font-semibold text-ink">{nameFor(destIso3)}</span>
                <button
                  onClick={clearDest}
                  className="relative grid h-6 w-6 place-items-center rounded-full text-[13px] text-ink-mute transition after:absolute after:-inset-2 after:content-[''] hover:bg-stamp/20 hover:text-stamp"
                  aria-label={`Remove destination ${nameFor(destIso3)}`}
                >×</button>
              </span>
            ) : (
              <>
                <input
                  ref={destInputRef}
                  value={destQuery}
                  onChange={(e) => { setDestQuery(e.target.value); setDestOpen(true); setDestHi(-1); }}
                  onFocus={() => setDestOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setDestOpen(false); setDestHi(-1); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); setDestOpen(true); setDestHi((h) => Math.min(h + 1, destOptions.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setDestHi((h) => Math.max(h - 1, 0)); }
                    else if (e.key === "Enter") { const pick = destOptions[destHi] ?? destOptions[0]; if (pick) { e.preventDefault(); selectDest(pick.iso3); setDestHi(-1); } }
                  }}
                  role="combobox"
                  aria-expanded={destOpen && destOptions.length > 0}
                  aria-controls="dest-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={destHi >= 0 ? `dest-opt-${destHi}` : undefined}
                  aria-label="Search for a destination country"
                  placeholder="Type a destination - France, Japan, UAE, Brazil…"
                  className="flex-1 bg-transparent py-1 font-display text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-ink-mute/70"
                  autoComplete="off"
                />
              </>
            )}
          </div>

          {destOpen && !destIso3 && destOptions.length > 0 && (
            <ul id="dest-listbox" role="listbox" aria-label="Matching destinations" className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-card py-1 shadow-xl shadow-black/10">
              {destOptions.map((c, i) => (
                <li key={c.iso3} role="option" id={`dest-opt-${i}`} aria-selected={destHi === i}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => selectDest(c.iso3)}
                    onMouseEnter={() => setDestHi(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${destHi === i ? "bg-paper-2" : "hover:bg-paper-2"}`}
                  >
                    <span className="text-xl">{isoToFlag(c.iso2)}</span>
                    <span className="font-display text-[15px] text-ink">{c.name}</span>
                    <span className="mono ml-auto text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">{c.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── PASSPORT(S) ── */}
      <div className="mt-6">
        <div className="mb-2">
          <p className="font-display text-lg font-bold text-ink">Your Passport(s)</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">Add one or more - dual citizens get the best access from either</p>
        </div>

        <div ref={passBoxRef} className="relative z-20 w-full">
          <div
            onClick={(e) => { if (e.target === e.currentTarget) passInputRef.current?.focus(); }}
            className="flex min-h-[2.75rem] w-full cursor-text flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-card px-4 py-2 transition-colors focus-within:border-stamp focus-within:ring-1 focus-within:ring-stamp"
          >
            {selected.map((iso3) => {
              const currentType = ptypes[iso3] ?? "ordinary";
              const isNonOrdinary = currentType !== "ordinary";
              const isOpen = typeOpen === iso3;
              return (
                <span key={iso3} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-paper-2 px-2.5 py-1.5 text-[14px] text-ink">
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
                      className={`mono inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition ${
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
                        className="absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-black/25"
                      >
                        <p className="mono border-b border-line px-3 pb-2 pt-2 text-[9px] uppercase tracking-[0.18em] text-ink-mute">
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
                              {active && <span className="ml-auto text-[11px] text-stamp">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </span>

                  <button
                    onClick={() => removePassport(iso3)}
                    className="relative ml-0.5 grid h-6 w-6 place-items-center rounded-full text-[14px] text-ink-mute transition after:absolute after:-inset-2 after:content-[''] hover:bg-stamp/20 hover:text-stamp"
                    aria-label={`Remove ${nameFor(iso3)}`}
                  >×</button>
                </span>
              );
            })}
            <input
              ref={passInputRef}
              value={passQuery}
              onChange={(e) => { setPassQuery(e.target.value); setPassOpen(true); setPassHi(-1); }}
              onFocus={() => setPassOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setPassOpen(false); setPassHi(-1); }
                else if (e.key === "ArrowDown") { e.preventDefault(); setPassOpen(true); setPassHi((h) => Math.min(h + 1, passOptions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setPassHi((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter") { const pick = passOptions[passHi] ?? passOptions[0]; if (pick) { e.preventDefault(); addPassport(pick.iso3); setPassHi(-1); } }
              }}
              role="combobox"
              aria-expanded={passOpen && passOptions.length > 0}
              aria-controls="dest-pass-listbox"
              aria-autocomplete="list"
              aria-activedescendant={passHi >= 0 ? `dest-pass-opt-${passHi}` : undefined}
              aria-label="Search for a passport country"
              placeholder={selected.length ? "Add another country…" : "Type a country - India, Germany, USA…"}
              className="min-w-[200px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-ink-mute/70"
            />
          </div>

          {passOpen && passOptions.length > 0 && (
            <ul id="dest-pass-listbox" role="listbox" aria-label="Matching countries" className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-card py-1 shadow-xl shadow-black/10">
              {passOptions.map((c, i) => (
                <li key={c.iso3} role="option" id={`dest-pass-opt-${i}`} aria-selected={passHi === i}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => addPassport(c.iso3)}
                    onMouseEnter={() => setPassHi(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${passHi === i ? "bg-paper-2" : "hover:bg-paper-2"}`}
                  >
                    <span className="text-xl">{isoToFlag(c.iso2)}</span>
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
            <span className="font-medium text-ink-soft">{flagFor(autoDetected)} {nameFor(autoDetected)}</span>{" "}
            from your location. Not yours? Remove it above.
          </p>
        )}

      </div>

      {/* ── CREDENTIALS ── */}
      <div className="mt-6">
        <div className="mb-2">
          <p className="font-display text-lg font-bold text-ink">
            Visas &amp; Permits
            <span className="ml-2 font-display text-[13px] font-normal italic text-ink-soft">optional</span>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-soft">A valid US, UK, Schengen or Japan visa - any type (tourist, work, student) - or residency can unlock extra countries</p>
        </div>

        <div ref={credBoxRef} className="relative z-10 w-full">
          <div
            onClick={(e) => { if (e.target === e.currentTarget) credInputRef.current?.focus(); }}
            className={`flex min-h-[2.75rem] w-full cursor-text flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2 transition-colors focus-within:ring-1 focus-within:ring-stamp ${
              credOpen ? "border-stamp" : "border-line-strong"
            }`}
          >
            {creds.map((credId) => {
              const c = dataset.credentials.find((x) => x.id === credId);
              if (!c) return null;
              return (
                <span key={credId} className="inline-flex items-center gap-1.5 rounded-md border border-stamp/30 bg-stamp/[0.06] px-2.5 py-1.5 text-[13px] text-stamp">
                  <span className="text-base leading-none">{GROUP_ISO3[c.group] ? flagFor(GROUP_ISO3[c.group]) : ""}</span>
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
              ref={credInputRef}
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
              aria-controls="cred-listbox"
              aria-autocomplete="list"
              aria-activedescendant={credHi >= 0 ? `cred-opt-${credHi}` : undefined}
              aria-label="Search visas and permits you hold"
              placeholder={creds.length ? "Add another visa or permit…" : "Search - Green Card, Schengen visa…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-ink-mute/70"
              autoComplete="off"
            />
            {creds.length > 0 && (
              <button onClick={() => { setCreds([]); setCredQuery(""); }} className="mono shrink-0 text-[11px] uppercase tracking-[0.1em] text-ink-soft transition hover:text-stamp">
                Clear
              </button>
            )}
          </div>

          {credOpen && (
            <div id="cred-listbox" role="listbox" aria-label="Available visas and permits" className="absolute z-30 mt-1.5 max-h-[26rem] w-full overflow-auto rounded-lg border border-line-strong bg-card shadow-xl shadow-black/10">
              {credGroupOptions.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-mute">No visas or permits found for &ldquo;{credQuery}&rdquo;</p>
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
                          id={`cred-opt-${idx}`}
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

      </div>

      {/* ── "Also check" cross-link - shown above result when passport is selected ── */}
      {destIso3 && selected.length > 0 && (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-line bg-paper-2 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-medium text-ink">Also check - everything your passport unlocks</p>
            <p className="mt-0.5 text-sm text-ink-soft">See all visa-free destinations, freedom of movement rights, golden visas and citizenship programs open to you</p>
          </div>
          <Link
            href={`/?passport=${selected.join(",")}${creds.length ? `&cred=${creds.join(",")}` : ""}`}
            className="mono shrink-0 rounded border border-stamp/30 bg-card px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-stamp transition hover:bg-stamp/[0.05]"
          >
            Explore your passport →
          </Link>
        </div>
      )}

      {/* ── RESULT CARD ── */}
      {destIso3 && (
        <div className="mt-6">
          {selected.length === 0 ? (
            /* No passport yet - prompt */
            <div className="rounded-xl border-2 border-dashed border-line-strong bg-paper-2/40 px-8 py-12 text-center">
              <p className="font-display text-lg font-medium text-ink">Add your passport above</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Select the country whose passport you hold to see whether you need a visa for{" "}
                <span className="font-medium text-ink">{nameFor(destIso3)}</span>.
              </p>
            </div>
          ) : (
            <ResultCard
              destIso3={destIso3}
              isOwnCountry={isOwnCountry}
              accessEdge={accessEdge}
              transitEdge={transitEdge}
              fomEdge={fomEdge}
              result={result!}
              selected={selected}
              creds={creds}
            />
          )}
        </div>
      )}

      {!destIso3 && (
        <div className="mt-14 rounded-xl border border-dashed border-line px-8 py-16 text-center">
          <p className="font-display text-2xl font-semibold text-ink">Enter your destination above</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            Type the country you want to visit. Then add your passport - we&apos;ll tell you exactly what access you have with conditions and official source links.
          </p>
        </div>
      )}
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

// The four categories that show up together most often (tourist/business/
// work/student) each get a fully distinct hue so the eye can tell them apart
// at a glance; rarer categories double up on a hue since they seldom co-occur.
const CATEGORY_COLOR: Record<string, string> = {
  tourist: "text-vfree bg-vfree/10 ring-vfree/30",
  business: "text-voa bg-voa/10 ring-voa/30",
  student: "text-eta bg-eta/10 ring-eta/30",
  work: "text-evisa bg-evisa/10 ring-evisa/30",
  transit: "text-ink-soft bg-paper-3/60 ring-line-strong",
  medical: "text-voa bg-voa/10 ring-voa/30",
  retirement: "text-evisa bg-evisa/10 ring-evisa/30",
  working_holiday: "text-vfree bg-vfree/10 ring-vfree/30",
  digital_nomad: "text-eta bg-eta/10 ring-eta/30",
  family: "text-stamp bg-stamp/10 ring-stamp/30",
  investment: "text-bloc bg-bloc/10 ring-bloc/30",
};

function NotesField({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <p className={`text-[11px] leading-relaxed text-ink-mute ${expanded ? "" : "line-clamp-2"}`}>{notes}</p>
      {notes.length > 120 && (
        <button onClick={() => setExpanded(e => !e)} className="mono mt-0.5 text-[11px] text-ink-soft transition hover:text-ink">
          {expanded ? "Show less ▴" : "Show more ▾"}
        </button>
      )}
    </div>
  );
}

function VisaTypeCards({ visaTypes }: { visaTypes: VisaType[] }) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const cats = Array.from(new Set(visaTypes.map(v => v.category)));
  const filtered = categoryFilter ? visaTypes.filter(v => v.category === categoryFilter) : visaTypes;
  return (
    <div className="mt-6 border-t border-line pt-6">
      <p className="mono mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
        {visaTypes.length} visa type{visaTypes.length !== 1 ? "s" : ""} available
      </p>
      {cats.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`mono rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition ${!categoryFilter ? "bg-stamp text-white" : "border border-line-strong text-ink-mute hover:border-ink-mute hover:text-ink"}`}
          >All</button>
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              className={`mono rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition ${categoryFilter === cat ? "bg-stamp text-white" : "border border-line-strong text-ink-mute hover:border-ink-mute hover:text-ink"}`}
            >{CATEGORY_LABEL[cat] ?? cat}</button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {filtered.map((v, i) => {
          const stats: { label: string; value: string; accent?: string }[] = [];
          if (v.max_stay_days != null) stats.push({ label: "Max stay", value: `${v.max_stay_days} days` });
          if (v.validity_days != null) stats.push({ label: "Validity", value: `${v.validity_days} days` });
          if (v.entries) stats.push({ label: "Entries", value: v.entries.charAt(0).toUpperCase() + v.entries.slice(1) });
          if (v.fee_usd != null) stats.push({ label: "Fee", value: v.fee_usd === 0 ? "Free" : `~$${v.fee_usd}`, accent: "text-stamp" });
          if (v.processing_days_min != null || v.processing_days_max != null) {
            const { processing_days_min: min, processing_days_max: max } = v;
            const value = min != null && max != null && min !== max
              ? `${min}–${max} days`
              : (() => { const d = (min ?? max)!; return d === 0 ? "Immediate" : `${d} day${d === 1 ? "" : "s"}`; })();
            stats.push({ label: "Processing", value });
          }
          stats.push({
            label: "Apply",
            value: v.on_arrival ? "On arrival" : v.online ? "Online" : "In advance",
            accent: v.on_arrival ? "text-voa" : v.online ? "text-vfree" : undefined,
          });
          return (
            <div key={i} className="rounded-lg border border-line-strong bg-paper-2 px-4 py-3.5">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`mono shrink-0 rounded-[3px] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] ring-1 ${CATEGORY_COLOR[v.category] ?? "text-ink-soft bg-paper-3 ring-line"}`}>
                  {CATEGORY_LABEL[v.category] ?? v.category}
                </span>
                <span className="font-display text-[13px] font-semibold text-ink">{v.name}</span>
              </div>
              {v.purpose && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{v.purpose}</p>
              )}
              <dl className="mono mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[9px] uppercase tracking-[0.14em] text-ink-mute">{s.label}</dt>
                    <dd className={`mt-0.5 text-[13px] font-semibold ${s.accent ?? "text-ink"}`}>{s.value}</dd>
                  </div>
                ))}
              </dl>
              {v.notes && <NotesField notes={v.notes} />}
              {v.official_url && (
                <a href={v.official_url} target="_blank" rel="noreferrer"
                  className="mono mt-2 inline-flex items-center gap-1 text-[10px] text-ink-mute transition hover:text-ink">
                  {hostOf(v.official_url)} ↗
                </a>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-ink-mute">No visa types match this filter.</p>
        )}
      </div>
    </div>
  );
}

// ── VFS Global document checklists (corridor-specific, fetched on demand) ──────

type VfsVisaType = {
  name: string;
  category: string;
  documents_required: string | null;
  visa_fees: string | null;
  processing_time: string | null;
  forms: string | null;
  overview: string | null;
};
type VfsCorridorDetail = {
  source_code: string;
  destination_code: string;
  source_url: string;
  visa_types: VfsVisaType[];
};

function VfsTypeRow({ v }: { v: VfsVisaType }) {
  const [open, setOpen] = useState(false);
  const docs = v.documents_required?.trim();
  return (
    <div className="rounded-lg border border-line-strong bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className={`mono shrink-0 rounded-[3px] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] ring-1 ${CATEGORY_COLOR[v.category] ?? "text-ink-soft bg-paper-3 ring-line"}`}>
          {CATEGORY_LABEL[v.category] ?? v.category}
        </span>
        <span className="font-display text-[13px] font-semibold text-ink">{normalizeVfsName(v.name)}</span>
        <svg viewBox="0 0 10 6" className={`ml-auto h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M0 0l5 6 5-6z" /></svg>
      </button>
      {open && (
        <div className="border-t border-line px-4 py-3">
          {docs ? (
            <div>
              <p className="mono mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">Documents required</p>
              <LinkifiedText text={docs} className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft" />
            </div>
          ) : (
            <p className="text-[12px] text-ink-mute">No document checklist published for this type.</p>
          )}
        </div>
      )}
    </div>
  );
}

function VfsDocuments({ destIso3, selected }: { destIso3: string; selected: string[] }) {
  // Find the VFS corridor for one of the held passports → this destination.
  const corridor = useMemo(() => {
    const list = dataset.vfsCorridors?.[destIso3] ?? [];
    for (const iso3 of selected) {
      const c = list.find((x) => x.sourceIso3 === iso3);
      if (c) return c;
    }
    return null;
  }, [destIso3, selected]);

  const [detail, setDetail] = useState<VfsCorridorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  useEffect(() => {
    // State updates deferred a tick (react-hooks/set-state-in-effect).
    let cancelled = false;
    const t = setTimeout(() => {
      if (!corridor) { setDetail(null); return; }
      setLoading(true); setFailed(false); setDetail(null); setCatFilter(null);
      fetch(`/api/vfs?src=${corridor.sourceCode}&dest=${corridor.destCode}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: VfsCorridorDetail) => { if (!cancelled) setDetail(d); })
        .catch(() => { if (!cancelled) setFailed(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [corridor]);

  if (!corridor) return null;

  const types = detail?.visa_types?.filter((v) => v.documents_required || v.visa_fees) ?? [];
  const cats = Array.from(new Set(types.map((v) => v.category)));
  const shown = catFilter ? types.filter((v) => v.category === catFilter) : types;
  const srcName = nameFor(corridor.sourceIso3);

  return (
    <div className="mt-6 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
          Document checklists - applying from {srcName}
        </p>
        <span className="mono text-[10px] text-ink-mute">via VFS Global</span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
        Required documents for {srcName} residents applying for {nameFor(destIso3)} at the VFS visa application centre, by visa type. VFS is the official outsourcing partner - confirm against the embassy before applying.
      </p>

      {loading && <p className="mt-4 text-sm text-ink-mute">Loading document checklists…</p>}
      {failed && (
        <p className="mt-4 text-sm text-ink-mute">
          Couldn&apos;t load checklists. <a href={corridor.sourceUrl} target="_blank" rel="noreferrer" className="text-stamp hover:underline">View on VFS Global ↗</a>
        </p>
      )}

      {!loading && !failed && types.length > 0 && (
        <>
          {cats.length > 1 && (
            <div className="mt-4 mb-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setCatFilter(null)}
                className={`mono rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition ${!catFilter ? "bg-stamp text-white" : "border border-line-strong text-ink-mute hover:border-ink-mute hover:text-ink"}`}
              >All</button>
              {cats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat === catFilter ? null : cat)}
                  className={`mono rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition ${catFilter === cat ? "bg-stamp text-white" : "border border-line-strong text-ink-mute hover:border-ink-mute hover:text-ink"}`}
                >{CATEGORY_LABEL[cat] ?? cat}</button>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {shown.map((v, i) => <VfsTypeRow key={i} v={v} />)}
          </div>
          <a href={corridor.sourceUrl} target="_blank" rel="noreferrer"
            className="mono mt-3 inline-flex items-center gap-1 text-[10px] text-ink-mute transition hover:text-ink">
            {hostOf(corridor.sourceUrl)} ↗
          </a>
        </>
      )}
      {!loading && !failed && detail && types.length === 0 && (
        <p className="mt-4 text-sm text-ink-mute">No document checklists published for this corridor.</p>
      )}
    </div>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
  destIso3,
  isOwnCountry,
  accessEdge,
  transitEdge,
  fomEdge,
  result,
  selected,
  creds,
}: {
  destIso3: string;
  isOwnCountry: boolean;
  accessEdge: (CombinedEdge & { conditions?: string | null }) | undefined;
  transitEdge: (CombinedEdge & { conditions?: string | null }) | undefined;
  fomEdge: ReturnType<typeof compute>["freedomOfMovement"][number] | undefined;
  result: ReturnType<typeof compute>;
  selected: string[];
  creds: string[];
}) {
  const flag = flagFor(destIso3);
  const name = nameFor(destIso3);

  const leftBorder = (() => {
    if (isOwnCountry || fomEdge) return "border-l-bloc";
    if (accessEdge) return LEVEL_LEFT_BORDER[accessEdge.level] ?? "border-l-line-strong";
    if (transitEdge) return "border-l-eta"; // matches the "Transit only" pill
    return "border-l-ink-mute/40";
  })();

  // Credential hubs whose visa/permit would unlock this destination for one of the
  // held passports (data-driven; excludes the destination's own credentials).
  const credHintLabels = (() => {
    if (creds.length > 0) return [];
    const labels: string[] = [];
    for (const cred of dataset.credentials) {
      if (GROUP_ISO3[cred.group] === destIso3) continue;
      const helps = (dataset.credentialAccess[cred.id] ?? []).some(
        (e) =>
          e.dest === destIso3 &&
          !e.transit &&
          (!e.nationalityScope || e.nationalityScope.length === 0 || e.nationalityScope.some((n) => selected.includes(n))),
      );
      if (!helps) continue;
      const label = HUB_LABEL[cred.group] ?? cred.group;
      if (!labels.includes(label)) labels.push(label);
    }
    return labels;
  })();

  return (
    <div className={`overflow-hidden rounded-xl border border-line-strong bg-card shadow-sm border-l-4 ${leftBorder}`}>
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-line px-6 py-5">
        <span className="text-4xl leading-none">{flag}</span>
        <div>
          <p className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">Entry requirements for</p>
          <h2 className="font-display text-[22px] font-semibold text-ink">{name}</h2>
        </div>
      </div>

      <div className="space-y-4 px-6 py-6">
        {isOwnCountry ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-semibold text-ink">This is one of your home countries</p>
              <p className="mt-0.5 text-sm text-ink-soft">You hold citizenship here - no visa required.</p>
            </div>
          </div>
        ) : fomEdge ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono inline-flex items-center rounded border border-bloc/30 bg-bloc/[0.08] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-bloc">
                Freedom of movement
              </span>
              <span className="text-sm text-ink-soft">Right to live and work - no visa required</span>
            </div>
            {fomEdge.groups.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fomEdge.groups.map((g) => (
                  <span key={g} className="mono rounded bg-paper-3 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {dataset.groupLabels[g] ?? g}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : accessEdge ? (
          <div>
            {/* Single info row */}
            <div className="flex flex-wrap items-center gap-3">
              <AccessPill level={accessEdge.level} />
              {accessEdge.maxStayDays != null && (
                <span className="text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{accessEdge.maxStayDays}</span> days max stay
                </span>
              )}
              {accessEdge.viaIso3 && (
                <span className="text-sm text-ink-soft">
                  via {flagFor(accessEdge.viaIso3)} <span className="font-medium text-ink">{nameFor(accessEdge.viaIso3)}</span>
                </span>
              )}
              {accessEdge.viaCredential && (
                <span className="mono rounded border border-stamp/30 bg-stamp/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-stamp">
                  via {CRED_SHORT[accessEdge.viaCredential] ?? "held visa"}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {accessEdge.level === "visa_free"
                ? "Enter with just your passport - no visa application needed."
                : accessEdge.level === "visa_on_arrival"
                ? "Get your visa stamp at the airport on arrival."
                : "Apply online before you travel - no embassy visit required."}
            </p>

            {(accessEdge.conditions || accessEdge.notes) && (
              <div className="mt-4 rounded-lg border border-line-strong bg-paper-2 px-4 py-3">
                <p className="mono mb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">Conditions &amp; notes</p>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {accessEdge.conditions && accessEdge.notes
                    ? `${accessEdge.conditions} - ${accessEdge.notes}`
                    : accessEdge.conditions ?? accessEdge.notes}
                </p>
              </div>
            )}

            {accessEdge.sourceUrl && (
              <div className="mt-4">
                <SourceLink url={accessEdge.sourceUrl} official={accessEdge.sourceOfficial} />
              </div>
            )}
          </div>
        ) : transitEdge ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono inline-flex items-center rounded border border-eta/30 bg-eta/[0.08] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-eta">
                Transit only
              </span>
              {transitEdge.maxStayDays != null && (
                <span className="text-sm text-ink-soft">
                  up to <span className="font-semibold text-ink">{transitEdge.maxStayDays}</span> day{transitEdge.maxStayDays === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              You can change planes or transit without a visa - but <strong className="font-medium text-ink">not for tourism or extended stays</strong>.
            </p>
            {transitEdge.conditions && <p className="mt-2 text-sm text-ink-soft">{transitEdge.conditions}</p>}
            {transitEdge.sourceUrl && (
              <div className="mt-3">
                <SourceLink url={transitEdge.sourceUrl} official={transitEdge.sourceOfficial} />
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono inline-flex items-center rounded border border-line-strong bg-paper-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                Visa required
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              No automatic entry found for your passport{selected.length > 1 ? "s" : ""} and credentials. You will need to apply for a visa before travelling to {withArticle(name)}.
            </p>

            <div className="mt-4 rounded-lg border border-line-strong bg-paper-2 px-4 py-3">
              <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">What you can do</p>
              <ul className="space-y-1.5 text-sm text-ink-soft">
                <li>→ Apply for a tourist/visitor visa at an embassy or consulate of {withArticle(name)}</li>
                {credHintLabels.length > 0 && (
                  <li>→ Holding a visa or residence permit from {listJoin(credHintLabels)} can unlock entry here - add it above</li>
                )}
                {result.cbi.some((p) => p.iso3 === destIso3) && (
                  <li>→ <Link href="/programs/citizenship-by-investment" className="font-medium text-stamp hover:underline">CBI program available</Link> - invest to obtain citizenship here</li>
                )}
                {result.rbi.some((p) => p.iso3 === destIso3) && (
                  <li>→ <Link href="/programs/golden-visa" className="font-medium text-voa hover:underline">Golden visa available</Link> - invest to obtain residency here</li>
                )}
              </ul>
            </div>

          </div>
        )}

        {/* Visa types - shown when data is available (citizens don't need a visa for home) */}
        {!isOwnCountry && (() => {
          const visaTypes = dataset.destinationVisaTypes?.[destIso3];
          return visaTypes && visaTypes.length > 0 ? <VisaTypeCards visaTypes={visaTypes} /> : null;
        })()}

        {/* VFS Global document checklists - corridor-specific, for the held passport */}
        {!isOwnCountry && <VfsDocuments destIso3={destIso3} selected={selected} />}
      </div>
    </div>
  );
}
