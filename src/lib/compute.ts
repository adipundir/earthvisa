import { dataset } from "./dataset";
import type { AccessEdge, AccessLevel, CbiProgram, RbiProgram, FastTrackProgram, PassportType } from "./types";

const LEVEL_RANK: Record<AccessLevel, number> = {
  visa_free: 4,
  visa_on_arrival: 3,
  eta: 2,
  e_visa: 1,
};

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  visa_free: "Visa-free",
  visa_on_arrival: "Visa on arrival",
  eta: "eTA / e-permit",
  e_visa: "e-Visa",
};

export interface CombinedEdge extends AccessEdge {
  /** which of the selected passports yields this best access (null if via a credential) */
  viaIso3: string | null;
  /** credential id that unlocked this access, if it beat passport access */
  viaCredential?: string | null;
  /** set when this access only applies to a non-ordinary passport type */
  viaPassportType?: PassportType | null;
}

export interface FomEdge {
  dest: string;
  groups: string[]; // group keys granting freedom of movement
}

export interface PassportResult {
  selected: string[];
  credentials: string[];
  passportTypes: Record<string, PassportType>;
  reach: CombinedEdge[];
  reachByLevel: Record<AccessLevel, CombinedEdge[]>;
  /** destinations whose best access is unlocked by a held credential */
  viaCredentialCount: number;
  /** destinations whose access depends on the (non-ordinary) passport type */
  viaPassportTypeCount: number;
  /** destinations reachable for airside/landside transit only (not tourist entry) */
  transitReach: CombinedEdge[];
  freedomOfMovement: FomEdge[];
  memberships: { key: string; label: string; members: string[] }[];
  cbi: CbiProgram[];
  rbi: RbiProgram[];
  fastTrack: FastTrackProgram[];
  /** per-passport reach totals, for "strongest passport" insight */
  perPassportReach: { iso3: string; total: number }[];
}

export function compute(
  selected: string[],
  credentials: string[] = [],
  ptypesInput: Record<string, PassportType> = {},
): PassportResult {
  const sel = [...new Set(selected)];
  const selSet = new Set(sel);
  const creds = [...new Set(credentials)].filter((c) => dataset.credentialAccess[c]);

  // --- combined visa reach (best level per destination across all passports) ---
  const best = new Map<string, CombinedEdge>();
  const perPassportReach: { iso3: string; total: number }[] = [];
  for (const iso3 of sel) {
    const edges = dataset.passportAccess[iso3] ?? [];
    perPassportReach.push({ iso3, total: edges.length });
    for (const e of edges) {
      if (selSet.has(e.dest)) continue; // your own / co-citizenship countries
      const prev = best.get(e.dest);
      if (!prev || LEVEL_RANK[e.level] > LEVEL_RANK[prev.level]) {
        best.set(e.dest, { ...e, viaIso3: iso3, viaCredential: null });
      }
    }
  }

  // --- diplomatic/service/official passport waivers - applied per-passport based on its own type ---
  for (const iso3 of sel) {
    const ptype = ptypesInput[iso3] ?? "ordinary";
    if (ptype === "ordinary") continue;
    const addDiplo = (e: AccessEdge, via: string | null) => {
      if (selSet.has(e.dest)) return;
      if (!(e.passportTypes ?? []).includes(ptype)) return;
      const prev = best.get(e.dest);
      if (!prev || LEVEL_RANK[e.level] > LEVEL_RANK[prev.level]) {
        best.set(e.dest, { ...e, viaIso3: via, viaCredential: null, viaPassportType: ptype });
      }
    };
    for (const e of dataset.diplomaticAny) addDiplo(e, iso3);
    for (const e of dataset.diplomaticAccess[iso3] ?? []) addDiplo(e, iso3);
  }

  // --- add reach unlocked by held credentials (e.g. "visa-free if you hold a US visa") ---
  // Transit-only entries (ATV exemptions, TWOV) are kept separate - they are NOT tourist access.
  const transitBest = new Map<string, CombinedEdge>();
  for (const cred of creds) {
    for (const e of dataset.credentialAccess[cred] ?? []) {
      if (selSet.has(e.dest)) continue;
      const scope = e.nationalityScope;
      if (scope && scope.length && !sel.some((p) => scope.includes(p))) continue;
      if (e.transit) {
        const prev = transitBest.get(e.dest);
        if (!prev || LEVEL_RANK[e.level] > LEVEL_RANK[prev.level]) {
          transitBest.set(e.dest, { ...e, viaIso3: null, viaCredential: cred, viaPassportType: null });
        }
      } else {
        const prev = best.get(e.dest);
        if (!prev || LEVEL_RANK[e.level] > LEVEL_RANK[prev.level]) {
          best.set(e.dest, { ...e, viaIso3: null, viaCredential: cred, viaPassportType: null });
        }
      }
    }
  }
  const transitReach = [...transitBest.values()].sort((a, b) => a.dest.localeCompare(b.dest));
  const reach = [...best.values()].sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.dest.localeCompare(b.dest),
  );
  const reachByLevel: Record<AccessLevel, CombinedEdge[]> = {
    visa_free: [], visa_on_arrival: [], eta: [], e_visa: [],
  };
  for (const e of reach) reachByLevel[e.level].push(e);
  const viaCredentialCount = reach.filter((e) => e.viaCredential).length;
  const viaPassportTypeCount = reach.filter((e) => e.viaPassportType).length;

  // --- freedom of movement via shared regional groups ---
  const fom = new Map<string, Set<string>>();
  const memberships: { key: string; label: string; members: string[] }[] = [];
  for (const [key, members] of Object.entries(dataset.groups)) {
    const memberSet = new Set(members);
    if (sel.some((s) => memberSet.has(s))) {
      memberships.push({ key, label: dataset.groupLabels[key] ?? key, members });
      for (const m of members) {
        if (selSet.has(m)) continue;
        if (!fom.has(m)) fom.set(m, new Set());
        fom.get(m)!.add(key);
      }
    }
  }
  const freedomOfMovement: FomEdge[] = [...fom.entries()]
    .map(([dest, groups]) => ({ dest, groups: [...groups] }))
    .sort((a, b) => a.dest.localeCompare(b.dest));

  // --- investment / migration programs (opportunities, exclude your own country) ---
  const cbi = dataset.cbi.filter((p) => !selSet.has(p.iso3));
  const rbi = dataset.rbi.filter((p) => !selSet.has(p.iso3));
  const fastTrack = dataset.fastTrack.filter((p) => !selSet.has(p.iso3));

  return {
    selected: sel,
    credentials: creds,
    passportTypes: ptypesInput,
    reach,
    reachByLevel,
    viaCredentialCount,
    viaPassportTypeCount,
    transitReach,
    freedomOfMovement,
    memberships,
    cbi,
    rbi,
    fastTrack,
    perPassportReach: perPassportReach.sort((a, b) => b.total - a.total),
  };
}

export function fmtMoney(amount: number | null, currency: string): string {
  if (amount == null) return "-";
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur.length === 3 ? cur : "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${cur} ${amount.toLocaleString("en-US")}`;
  }
}
