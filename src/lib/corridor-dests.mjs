// Pure corridor-destination derivation, shared by:
//   - src/lib/corridors.ts        (server link mesh / corridorPairs())
//   - scripts/build-explorer-slices.mjs  (per-passport corridorDests in
//     public/explorer/passport/*.json, which gate the client "Full guide" CTAs)
// ONE implementation means the client gating can never drift from the set of
// corridor pages the server actually publishes.
//
// Quality bar (unchanged): a (nationality, destination) corridor only exists
// when it carries genuinely differentiated content - an access grant
// (visa-free / VoA / eTA / e-visa), freedom of movement, a VFS document
// checklist, a held-credential unlock, or an explicit force-include below.
// Corridors that would only say a generic "visa required, apply at an embassy"
// are skipped so we never publish thin, near-duplicate pages.

// High-search-demand corridors that the thin-content prune would otherwise drop
// (visa-required, no grant/VFS docs). These render destination visa types + fee
// data instead, so they carry real content. "nat|dest" keys.
export const FORCE_CORRIDORS = new Set([
  "IND|IRL", "PAK|IRL",
  "NGA|CAN",
  "IND|GBR", "PAK|GBR", "NGA|GBR",
  "CHN|JPN", "SAU|JPN", "ZAF|JPN", // reclassified visa-required (Japan eVISA is residence-based, not a nationality grant); keep - fee data + application note
  // Top Indian outbound destinations that are visa-required with no VFS
  // checklist - previously 404ed while Tuvalu got a page. All carry rich fee
  // + visa-type data (audit-verified); FRA/GRC also close the two holes in
  // /guide/schengen/india's destination links.
  "IND|USA", "IND|CAN", "IND|AUS", "IND|SAU", "IND|KWT", "IND|FRA", "IND|GRC",
  "IND|ESP", // previously existed only via the mis-mapped Malta VFS file; Spain is a top Indian destination with full fee + visa-type data
  // ~50% of site traffic is the US passport - these 16 destinations are
  // genuinely visa-required with no VFS checklist, but each carries a
  // researched advanceVisaNotes entry (fee, process, current suspension/
  // advisory status where relevant) that would otherwise never render.
  "USA|BFA", "USA|CAF", "USA|COG", "USA|DZA", "USA|ERI", "USA|LBR", "USA|NER",
  "USA|NRU", "USA|IRN", "USA|PRK", "USA|RUS", "USA|SDN", "USA|TCD", "USA|TKM",
  "USA|YEM", "USA|CHN",
]);

// Memoized per dataset object: credential-unlock destinations by nationality
// scope ("*" = any nationality), mirroring the corridor page's own credGroups
// filter (non-transit, tourist entry, no refugee documents).
const credDestsCache = new WeakMap();
function credDestsFor(data) {
  let m = credDestsCache.get(data);
  if (m) return m;
  m = new Map();
  for (const edges of Object.values(data.credentialAccess ?? {})) {
    for (const e of edges) {
      if (e.transit) continue;
      if (/refugee|airport transit/i.test(`${e.notes ?? ""} ${e.conditions ?? ""}`)) continue;
      const scopes = e.nationalityScope == null ? ["*"] : e.nationalityScope;
      for (const s of scopes) {
        if (!m.has(s)) m.set(s, new Set());
        m.get(s).add(e.dest);
      }
    }
  }
  credDestsCache.set(data, m);
  return m;
}

const validIso3Cache = new WeakMap();
function validIso3For(data) {
  let s = validIso3Cache.get(data);
  if (!s) {
    s = new Set(data.allCountries.map((c) => c.iso3));
    validIso3Cache.set(data, s);
  }
  return s;
}

const LEVEL_RANK = { visa_free: 4, visa_on_arrival: 3, eta: 2, e_visa: 1 };

/**
 * Destinations for which a corridor page exists for the given nationality.
 * `data` needs: allCountries, passportAccess, groups, vfsCorridors,
 * credentialAccess (the full Dataset satisfies this). Returns iso3 strings in
 * stable insertion order (grant, FoM, VFS, credential unlocks, force-includes)
 * matching what compute([nat]).reach / .freedomOfMovement historically fed
 * corridorPairs() - some pages render corridorsForNationality() unsorted.
 */
export function corridorDestsForNat(data, nat) {
  const credDests = credDestsFor(data);
  const anyNatCredDests = credDests.get("*") ?? new Set();
  const valid = validIso3For(data);
  const names = new Map(data.allCountries.map((c) => [c.iso3, c.name]));
  const nameOf = (iso3) => names.get(iso3) ?? iso3;
  const candidates = new Set();
  // Access grants: exactly compute([nat]).reach for a single ordinary passport
  // with no credentials - that passport's own edges (best level per dest,
  // excluding itself), in reach order: level rank desc, then display name.
  const best = new Map();
  for (const e of data.passportAccess[nat] ?? []) {
    if (e.dest === nat) continue;
    const prev = best.get(e.dest);
    if (!prev || LEVEL_RANK[e.level] > LEVEL_RANK[prev.level]) best.set(e.dest, e);
  }
  const reach = [...best.values()].sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || nameOf(a.dest).localeCompare(nameOf(b.dest)),
  );
  for (const e of reach) candidates.add(e.dest);
  // Freedom of movement: fellow members of any shared regional bloc, in
  // display-name order (matching compute().freedomOfMovement).
  const fom = new Set();
  for (const members of Object.values(data.groups ?? {})) {
    if (members.includes(nat)) {
      for (const m of members) if (m !== nat) fom.add(m);
    }
  }
  for (const m of [...fom].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) candidates.add(m);
  // VFS document checklists sourced from this nationality.
  for (const [dst, corrs] of Object.entries(data.vfsCorridors ?? {})) {
    if (corrs.some((c) => c.sourceIso3 === nat)) candidates.add(dst);
  }
  // Held-credential unlocks (any-nationality first, then nationality-scoped).
  for (const dst of anyNatCredDests) candidates.add(dst);
  for (const dst of credDests.get(nat) ?? []) candidates.add(dst);
  // Explicit force-includes.
  for (const key of FORCE_CORRIDORS) {
    const [fn, fd] = key.split("|");
    if (fn === nat) candidates.add(fd);
  }
  const out = [];
  for (const dst of candidates) {
    if (dst === nat) continue;
    if (!valid.has(dst)) continue;
    out.push(dst);
  }
  return out;
}
