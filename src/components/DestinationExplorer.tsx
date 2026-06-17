"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { dataset, flagFor, nameFor, isoToFlag } from "@/lib/dataset";
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
  visa_free: "text-vfree ring-vfree/45 bg-vfree/10",
  visa_on_arrival: "text-voa ring-voa/45 bg-voa/10",
  eta: "text-eta ring-eta/45 bg-eta/10",
  e_visa: "text-evisa ring-evisa/45 bg-evisa/10",
};

const EXAMPLE_PASSPORTS = ["IND", "DEU", "USA", "BRA", "NGA", "PHL"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function AccessPill({ level }: { level: AccessLevel }) {
  return (
    <span className={`mono rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ring-1 ${LEVEL_STYLE[level]}`}>
      {LEVEL_LABEL[level]}
    </span>
  );
}

function SourceDot({ official }: { official: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ring-2 ${official ? "bg-vfree ring-vfree/30" : "bg-eta ring-eta/30"}`}
      title={official ? "Official government source" : "Non-official source"}
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

  // Passport type dropdown
  const [typeOpen, setTypeOpen] = useState<string | null>(null);

  const destBoxRef = useRef<HTMLDivElement>(null);
  const passBoxRef = useRef<HTMLDivElement>(null);
  const credBoxRef = useRef<HTMLDivElement>(null);
  const typeRefs = useRef<Record<string, HTMLElement | null>>({});

  // ── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const d = localStorage.getItem("pp.dest");
      if (d) setDestIso3(d);
      const p = JSON.parse(localStorage.getItem("pp.passports") || "[]");
      if (Array.isArray(p) && p.length) setSelected(p);
      const c = JSON.parse(localStorage.getItem("pp.creds") || "[]");
      if (Array.isArray(c) && c.length) setCreds(c);
      const pt = JSON.parse(localStorage.getItem("pp.ptypes") || "{}");
      if (pt && typeof pt === "object") setPtypes(pt);
    } catch {}
  }, []);
  useEffect(() => { try { if (destIso3) localStorage.setItem("pp.dest", destIso3); else localStorage.removeItem("pp.dest"); } catch {} }, [destIso3]);
  useEffect(() => { try { localStorage.setItem("pp.passports", JSON.stringify(selected)); } catch {} }, [selected]);
  useEffect(() => { try { localStorage.setItem("pp.creds", JSON.stringify(creds)); } catch {} }, [creds]);
  useEffect(() => { try { localStorage.setItem("pp.ptypes", JSON.stringify(ptypes)); } catch {} }, [ptypes]);

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

  // Stat: total visa-free for passport combination
  const vfreeCount = result?.reachByLevel.visa_free.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">

      {/* ── DESTINATION — primary, big ── */}
      <div className="mt-8">
        <div className="mb-3">
          <p className="font-display text-[17px] font-semibold text-ink">Destination</p>
          <p className="mt-0.5 text-sm text-ink-soft">Where do you want to go? Start here — enter your destination first</p>
        </div>

        <div ref={destBoxRef} className="relative z-30 w-full">
          <div className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border-2 bg-paper-2 px-5 py-4 transition-all ${
            destIso3
              ? "border-bloc/40 bg-paper-2"
              : destOpen
              ? "border-stamp/70 shadow-[0_0_0_3px_rgba(178,53,40,0.07)]"
              : "border-line-strong hover:border-stamp/40"
          }`}>
            {destIso3 ? (
              <span className="inline-flex flex-1 items-center gap-3">
                <span className="text-3xl leading-none">{flagFor(destIso3)}</span>
                <span className="font-display text-xl font-semibold text-ink">{nameFor(destIso3)}</span>
                <button
                  onClick={clearDest}
                  className="ml-auto grid h-6 w-6 place-items-center rounded-full text-[13px] text-ink-mute transition hover:bg-stamp/20 hover:text-stamp"
                  aria-label={`Remove destination ${nameFor(destIso3)}`}
                >×</button>
              </span>
            ) : (
              <>
                <span className="text-2xl text-ink-mute/40">🌍</span>
                <input
                  value={destQuery}
                  onChange={(e) => { setDestQuery(e.target.value); setDestOpen(true); }}
                  onFocus={() => setDestOpen(true)}
                  placeholder="Type a destination — France, Japan, UAE, Brazil…"
                  className="flex-1 bg-transparent py-1 font-display text-[16px] text-ink outline-none placeholder:text-ink-mute/50"
                  autoComplete="off"
                />
              </>
            )}
          </div>

          {destOpen && !destIso3 && destOptions.length > 0 && (
            <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-ink/20">
              {destOptions.map((c) => (
                <li key={c.iso3}>
                  <button
                    onClick={() => selectDest(c.iso3)}
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
      </div>

      {/* ── PASSPORT(S) ── */}
      <div className="mt-7">
        <div className="mb-3">
          <p className="font-display text-[17px] font-semibold text-ink">Your Passport(s)</p>
          <p className="mt-0.5 text-sm text-ink-soft">Add one or more — dual citizens get the best access from either</p>
        </div>

        <div ref={passBoxRef} className="relative z-20 w-full">
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
                              {active && <span className="ml-auto text-[11px] text-stamp">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </span>

                  <button
                    onClick={() => removePassport(iso3)}
                    className="grid h-4 w-4 place-items-center rounded-full text-[11px] text-ink-mute transition hover:bg-stamp/20 hover:text-stamp"
                    aria-label={`Remove ${nameFor(iso3)}`}
                  >×</button>
                </span>
              );
            })}
            <input
              value={passQuery}
              onChange={(e) => { setPassQuery(e.target.value); setPassOpen(true); }}
              onFocus={() => setPassOpen(true)}
              placeholder={selected.length ? "Add another country…" : "Type a country — India, Germany, USA…"}
              className="min-w-[200px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-mute/55"
            />
          </div>

          {passOpen && passOptions.length > 0 && (
            <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line-strong bg-paper-2 py-1 shadow-2xl shadow-ink/20">
              {passOptions.map((c) => (
                <li key={c.iso3}>
                  <button
                    onClick={() => addPassport(c.iso3)}
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

        {/* Quick-add popular passports */}
        {selected.length === 0 && !passQuery && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute/70">Popular:</span>
            {EXAMPLE_PASSPORTS.map((iso3) => (
              <button
                key={iso3}
                onClick={() => addPassport(iso3)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-paper-2/80 px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-stamp/40 hover:bg-stamp/[0.04] hover:text-ink"
              >
                <span>{flagFor(iso3)}</span>
                <span>{nameFor(iso3)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Stat: visa-free count */}
        {result && selected.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            <span className="font-semibold tabular-nums text-vfree">{vfreeCount}</span>
            {" "}visa-free destinations with your passport{selected.length > 1 ? "s" : ""}.
          </p>
        )}
      </div>

      {/* ── CREDENTIALS ── */}
      <div className="mt-7">
        <div className="mb-3">
          <p className="font-display text-[17px] font-semibold text-ink">
            Visas &amp; Permits
            <span className="ml-2 font-display text-[13px] font-normal italic text-ink-soft">optional</span>
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">A US visa, Schengen visa, or Japan residence permit can unlock extra access</p>
        </div>

        <div ref={credBoxRef} className="relative z-10 w-full">
          <div className={`flex min-h-[3.25rem] w-full flex-wrap items-center gap-2 rounded-lg border-2 bg-paper-2 px-4 py-2.5 transition-all ${
            credOpen ? "border-stamp/70 shadow-[0_0_0_3px_rgba(178,53,40,0.07)]" : "border-line-strong"
          }`}>
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
              placeholder={creds.length ? "Add another visa or permit…" : "Search — US Green Card, Schengen visa, Japan residence…"}
              className="min-w-[220px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-mute/55"
            />
            {creds.length > 0 && (
              <button onClick={() => { setCreds([]); setCredQuery(""); }} className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-mute/60 hover:text-stamp">
                Clear
              </button>
            )}
          </div>

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
                          onClick={() => toggleCred(c.id)}
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
            </div>
          )}
        </div>
      </div>

      {/* ── RESULT CARD ── */}
      {destIso3 && (
        <div className="mt-10">
          {selected.length === 0 ? (
            /* No passport yet — prompt */
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
            />
          )}
        </div>
      )}

      {/* ── "Also check" cross-link ── */}
      {destIso3 && selected.length > 0 && (
        <div className="mt-8 flex items-center gap-3 rounded-lg border border-line-strong bg-paper-2/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-medium text-ink">Also check — your full passport power</p>
            <p className="mt-0.5 text-sm text-ink-soft">See all visa-free destinations, freedom of movement rights, golden visas and citizenship programs open to you</p>
          </div>
          <Link
            href="/"
            className="mono shrink-0 rounded-md border border-stamp/40 bg-stamp/[0.06] px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-stamp transition hover:bg-stamp/10"
          >
            Passport Explorer →
          </Link>
        </div>
      )}

      {/* If no destination selected at all */}
      {!destIso3 && (
        <div className="mt-14 rounded-xl border border-dashed border-line-strong bg-paper-2/40 px-8 py-16 text-center">
          <p className="font-display text-2xl font-semibold text-ink">Enter your destination above</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            Type the country you want to visit. Then add your passport — we&apos;ll tell you exactly what access you have with conditions and official source links.
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

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
  destIso3,
  isOwnCountry,
  accessEdge,
  transitEdge,
  fomEdge,
  result,
  selected,
}: {
  destIso3: string;
  isOwnCountry: boolean;
  accessEdge: (CombinedEdge & { conditions?: string | null }) | undefined;
  transitEdge: (CombinedEdge & { conditions?: string | null }) | undefined;
  fomEdge: ReturnType<typeof compute>["freedomOfMovement"][number] | undefined;
  result: ReturnType<typeof compute>;
  selected: string[];
}) {
  const flag = flagFor(destIso3);
  const name = nameFor(destIso3);

  // Determine card border/bg based on access type
  const cardStyle = (() => {
    if (isOwnCountry) return "border-bloc/25 bg-bloc/[0.03]";
    if (fomEdge) return "border-bloc/30 bg-bloc/[0.06]";
    if (!accessEdge && !transitEdge) return "border-stamp/25 bg-stamp/[0.04]";
    if (accessEdge?.level === "visa_free") return "border-vfree/30 bg-vfree/[0.06]";
    if (accessEdge?.level === "visa_on_arrival") return "border-voa/30 bg-voa/[0.06]";
    if (accessEdge?.level === "eta" || accessEdge?.level === "e_visa") return "border-eta/30 bg-eta/[0.06]";
    return "border-line-strong bg-paper-2/60";
  })();

  return (
    <div className={`overflow-hidden rounded-xl border-2 ${cardStyle}`}>
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-line px-6 py-5">
        <span className="text-4xl leading-none">{flag}</span>
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">Entry requirements for</p>
          <h2 className="font-display text-2xl font-semibold text-ink">{name}</h2>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {isOwnCountry ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-display font-semibold text-ink">This is one of your home countries</p>
              <p className="mt-0.5 text-sm text-ink-soft">You hold citizenship here — no visa needed to enter.</p>
            </div>
          </div>
        ) : fomEdge ? (
          /* Freedom of movement */
          <div>
            <div className="inline-block rounded-lg border-2 border-bloc/30 bg-bloc/[0.08] px-5 py-3.5">
              <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Access type</p>
              <p className="mt-1 font-display text-xl font-semibold text-bloc">Freedom of movement</p>
              <p className="mt-1 text-sm text-ink-soft">Right to live and work — no visa required</p>
            </div>
            {fomEdge.groups.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fomEdge.groups.map((g) => (
                  <span key={g} className="mono rounded-[3px] bg-bloc/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-bloc">
                    {dataset.groupLabels[g] ?? g}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : accessEdge ? (
          /* Has direct access */
          <div>
            {/* Access type + stats row */}
            <div className="flex flex-wrap items-start gap-3">
              {/* Access level card */}
              <div className={`rounded-lg border-2 px-5 py-3.5 ${
                accessEdge.level === "visa_free" ? "border-vfree/30 bg-vfree/[0.08]"
                : accessEdge.level === "visa_on_arrival" ? "border-voa/30 bg-voa/[0.08]"
                : "border-eta/30 bg-eta/[0.08]"
              }`}>
                <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Access type</p>
                <AccessPill level={accessEdge.level} />
                <p className={`mt-1.5 font-display text-sm font-medium ${
                  accessEdge.level === "visa_free" ? "text-vfree"
                  : accessEdge.level === "visa_on_arrival" ? "text-voa"
                  : "text-eta"
                }`}>
                  {accessEdge.level === "visa_free"
                    ? "Enter with just your passport"
                    : accessEdge.level === "visa_on_arrival"
                    ? "Get your visa stamp at the airport"
                    : "Apply online before you travel"}
                </p>
              </div>

              {/* Max stay */}
              {accessEdge.maxStayDays != null && (
                <div className="rounded-lg border-2 border-line-strong bg-paper-2/80 px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Maximum stay</p>
                  <p className="font-display text-2xl font-semibold tabular-nums text-ink">{accessEdge.maxStayDays}</p>
                  <p className="mono text-[11px] text-ink-mute">days</p>
                </div>
              )}

              {/* Via passport */}
              {accessEdge.viaIso3 && (
                <div className="rounded-lg border-2 border-line-strong bg-paper-2/80 px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Via passport</p>
                  <p className="font-display font-semibold text-ink">
                    {flagFor(accessEdge.viaIso3)} {nameFor(accessEdge.viaIso3)}
                  </p>
                </div>
              )}

              {/* Via credential */}
              {accessEdge.viaCredential && (
                <div className="rounded-lg border-2 border-stamp/25 bg-stamp/[0.04] px-5 py-3.5">
                  <p className="mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">Unlocked by</p>
                  <p className="font-display font-semibold text-stamp">{CRED_SHORT[accessEdge.viaCredential] ?? "held visa"}</p>
                </div>
              )}
            </div>

            {/* Conditions / notes */}
            {(accessEdge.conditions || accessEdge.notes) && (
              <div className="mt-4 rounded-md border border-eta/20 bg-eta/[0.04] px-4 py-3">
                <p className="mono mb-1 text-[10px] uppercase tracking-[0.15em] text-eta">Conditions &amp; notes</p>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {accessEdge.conditions && accessEdge.notes
                    ? `${accessEdge.conditions} — ${accessEdge.notes}`
                    : accessEdge.conditions ?? accessEdge.notes}
                </p>
              </div>
            )}

            {/* Source */}
            {accessEdge.sourceUrl && (
              <div className="mt-4">
                <SourceLink url={accessEdge.sourceUrl} official={accessEdge.sourceOfficial} />
              </div>
            )}
          </div>
        ) : transitEdge ? (
          /* Transit only */
          <div>
            <div className="mb-3 rounded-md border border-eta/25 bg-eta/[0.05] px-4 py-3 text-sm leading-relaxed text-ink-soft">
              <span className="mono mr-2 font-semibold uppercase tracking-[0.1em] text-eta">Transit only</span>
              You can change planes or transit without a visa — but{" "}
              <strong className="font-semibold text-ink">not for tourism or extended stays</strong>.
            </div>
            {transitEdge.maxStayDays != null && (
              <p className="mono text-sm text-ink-mute">Transit up to {transitEdge.maxStayDays} hours.</p>
            )}
            {transitEdge.conditions && <p className="mt-2 text-sm text-ink-soft">{transitEdge.conditions}</p>}
            {transitEdge.sourceUrl && (
              <div className="mt-3">
                <SourceLink url={transitEdge.sourceUrl} official={transitEdge.sourceOfficial} />
              </div>
            )}
          </div>
        ) : (
          /* Visa required */
          <div>
            <div className="rounded-lg border-2 border-stamp/25 bg-stamp/[0.04] px-5 py-4">
              <p className="mono text-[10px] uppercase tracking-[0.15em] text-stamp">Access status</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">Visa required</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                No automatic entry found for your passport{selected.length > 1 ? "s" : ""} and credentials. You will need to apply for a visa before travelling to {name}.
              </p>
            </div>

            {/* What you can do */}
            <div className="mt-4 rounded-md border border-line bg-paper-2/70 px-4 py-3">
              <p className="mono mb-2 text-[10px] uppercase tracking-[0.15em] text-ink-mute">What you can do</p>
              <ul className="space-y-1.5 text-sm text-ink-soft">
                <li>→ Apply for a tourist/visitor visa at {name}&apos;s embassy or consulate</li>
                <li>→ Check if holding a US, Schengen, UK, or Japan visa unlocks access (add credentials above)</li>
                {result.cbi.some((p) => p.iso3 === destIso3) && (
                  <li>→ <span className="font-medium text-stamp">CBI program available</span> — invest to obtain citizenship here</li>
                )}
                {result.rbi.some((p) => p.iso3 === destIso3) && (
                  <li>→ <span className="font-medium text-voa">Golden visa available</span> — invest to obtain residency here</li>
                )}
              </ul>
            </div>

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
