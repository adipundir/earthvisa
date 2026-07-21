// Client-side data loader for the two explorers (PassportExplorer,
// DestinationExplorer). Instead of importing @/lib/dataset (~18MB in the
// client bundle), the explorers fetch small build-time slices from
// public/explorer/ (emitted by scripts/build-explorer-slices.mjs):
//   core.json               ~55KB  - countries, credentials, groups (eager)
//   programs.json          ~580KB  - cbi/rbi/fastTrack (first compute)
//   passport/{ISO3}.json   ~60KB   - per selected passport
//   credential/{ID}.json           - per held credential
//   destination/{ISO3}.json        - per selected destination
// Every fetch is cached in module state, so each slice travels at most once
// per session. Failures surface as explicit error states - the explorers must
// never quietly render partial numbers.
import { useEffect, useState } from "react";
import { isoToFlag } from "./format";
import { assertShape } from "./validate-shape";
import type { ComputeData } from "./compute-core";
import type {
  AccessEdge,
  CbiProgram,
  Credential,
  CredentialEdge,
  FastTrackProgram,
  RbiProgram,
  VfsCorridorSummary,
  VisaType,
} from "./types";

export interface CoreCountry {
  iso2: string;
  iso3: string;
  name: string;
  region: string;
}

export interface ExplorerCore {
  allCountries: CoreCountry[];
  credentials: Credential[];
  groups: Record<string, string[]>;
  groupLabels: Record<string, string>;
  diplomaticAny: AccessEdge[];
  /** passports with any derived visa-policy edges (geo auto-detect gate) */
  passportsWithPolicy: string[];
  /** global rank by total reach (#N of allCountries.length) - matches /rankings */
  ranks: Record<string, number>;
}

interface ExplorerPrograms {
  cbi: CbiProgram[];
  rbi: RbiProgram[];
  fastTrack: FastTrackProgram[];
}

interface PassportSlice {
  iso3: string;
  access: AccessEdge[];
  diplomatic: AccessEdge[];
  /** destinations with a real (non-pruned) corridor page for this passport */
  corridorDests: string[];
}

interface CredentialSlice {
  id: string;
  access: CredentialEdge[];
}

export interface DestinationSlice {
  iso3: string;
  visaTypes: VisaType[];
  vfsCorridors: VfsCorridorSummary[];
  /** credentials with a non-transit unlock edge into this destination */
  credUnlocks: { id: string; nationalityScope: string[] | null }[];
}

// ---- fetch layer -------------------------------------------------------------

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`/explorer/${path}`).then((r) => {
      if (!r.ok) throw new Error(`explorer slice ${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    // A failed fetch must be retryable: drop it from the cache so the next
    // call re-hits the network instead of replaying the rejection forever.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

// ---- core + synchronous lookups ---------------------------------------------
// The nested panel/modal components look countries and credentials up ad hoc
// (nameFor / flagFor / credShort). They only render after core has resolved,
// so a module-level registry keeps their call sites synchronous.

let coreState: ExplorerCore | null = null;
const countryByIso3 = new Map<string, CoreCountry>();

export function loadCore(): Promise<ExplorerCore> {
  return fetchJson<ExplorerCore>("core.json").then((c) => {
    assertShape(c, [
      "allCountries", "credentials", "groups", "groupLabels",
      "diplomaticAny", "passportsWithPolicy", "ranks",
    ], "explorer core.json");
    if (!coreState) {
      coreState = c;
      for (const x of c.allCountries) countryByIso3.set(x.iso3, x);
    }
    return coreState;
  });
}

export function nameFor(iso3: string): string {
  return countryByIso3.get(iso3)?.name ?? iso3;
}

export function flagFor(iso3: string): string {
  const c = countryByIso3.get(iso3);
  return c ? isoToFlag(c.iso2) : "\u{1F3F3}\u{FE0F}";
}

export function groupLabel(key: string): string {
  return coreState?.groupLabels[key] ?? key;
}

export function groupMembers(key: string): string[] {
  return coreState?.groups[key] ?? [];
}

export function credShort(id: string): string | undefined {
  return coreState?.credentials.find((c) => c.id === id)?.short;
}

// ---- corridor gating ---------------------------------------------------------
// Populated from each loaded passport slice. Client callers only ever ask
// about currently selected passports, whose slices are loaded before any
// result renders; unknown passports gate to false, which safely falls back to
// the passport-hub link (never a 404).

const corridorDests = new Map<string, Set<string>>();

export function isUsefulCorridor(nat: string, dest: string): boolean {
  return corridorDests.get(nat)?.has(dest) ?? false;
}

function loadPassportSlice(iso3: string): Promise<PassportSlice> {
  return fetchJson<PassportSlice>(`passport/${iso3}.json`).then((s) => {
    assertShape(s, ["iso3", "access"], `explorer passport/${iso3}.json`);
    if (!corridorDests.has(s.iso3)) corridorDests.set(s.iso3, new Set(s.corridorDests));
    return s;
  });
}

// ---- compute-data assembly ---------------------------------------------------

async function assembleComputeData(selected: string[], creds: string[]): Promise<ComputeData> {
  const [core, programs, passportSlices, credSlices] = await Promise.all([
    loadCore(),
    fetchJson<ExplorerPrograms>("programs.json"),
    Promise.all(selected.map(loadPassportSlice)),
    Promise.all(creds.map((id) => fetchJson<CredentialSlice>(`credential/${id}.json`))),
  ]);
  assertShape(programs, ["cbi", "rbi", "fastTrack"], "explorer programs.json");
  const passportAccess: Record<string, AccessEdge[]> = {};
  const diplomaticAccess: Record<string, AccessEdge[]> = {};
  for (const s of passportSlices) {
    passportAccess[s.iso3] = s.access;
    diplomaticAccess[s.iso3] = s.diplomatic;
  }
  const credentialAccess: Record<string, CredentialEdge[]> = {};
  for (const s of credSlices) credentialAccess[s.id] = s.access;
  return {
    allCountries: core.allCountries,
    groups: core.groups,
    groupLabels: core.groupLabels,
    diplomaticAny: core.diplomaticAny,
    passportAccess,
    credentialAccess,
    diplomaticAccess,
    cbi: programs.cbi,
    rbi: programs.rbi,
    fastTrack: programs.fastTrack,
  };
}

// ---- hooks -------------------------------------------------------------------

export function useExplorerCore(): { core: ExplorerCore | null; failed: boolean; retry: () => void } {
  const [core, setCore] = useState<ExplorerCore | null>(coreState);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadCore()
      .then((c) => { if (!cancelled) setCore(c); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tick]);
  return { core, failed, retry: () => { setFailed(false); setTick((t) => t + 1); } };
}

/** A ComputeData assembly pinned to the exact selection it was fetched for.
 * Callers must compute from snap.selected/snap.creds (not live state), so a
 * still-loading slice can never silently shrink the rendered numbers. */
export interface ComputeSnapshot {
  data: ComputeData;
  selected: string[];
  creds: string[];
}

export function useComputeData(
  selected: string[],
  creds: string[],
  enabled: boolean,
): { snap: ComputeSnapshot | null; loading: boolean; failed: boolean; retry: () => void } {
  const [snap, setSnap] = useState<ComputeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Deferred a tick so state updates never run synchronously in the effect
    // flush (react-hooks/set-state-in-effect), matching the explorers' pattern.
    const t = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      assembleComputeData(selected, creds)
        .then((data) => {
          if (cancelled) return;
          setSnap({ data, selected, creds });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setFailed(true);
          setLoading(false);
        });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [selected, creds, enabled, tick]);
  return { snap, loading, failed, retry: () => setTick((t) => t + 1) };
}

export function useDestinationSlice(
  destIso3: string | null,
): { slice: DestinationSlice | null; failed: boolean; retry: () => void } {
  const [state, setState] = useState<DestinationSlice | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!destIso3) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setFailed(false);
      fetchJson<DestinationSlice>(`destination/${destIso3}.json`)
        .then((s) => { if (!cancelled) setState(s); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [destIso3, tick]);
  const slice = destIso3 && state?.iso3 === destIso3 ? state : null;
  return { slice, failed, retry: () => setTick((t) => t + 1) };
}
