// Proves the mobile bundle is lossless with respect to the computation that
// matters, and emits the golden fixtures the Swift engine is held to.
//
// The bundle is a lossy-looking encoding: strings are interned, levels and
// passport types become integers, countries become ordinals. None of that is
// allowed to change a single answer. So this script decodes the bundle back
// into the exact ComputeData shape src/lib/compute-core.ts expects, runs the
// REAL computeWith() over both the original dataset and the decoded bundle
// across a large permutation matrix, and requires byte-identical results.
//
// It doubles as the reference decoder: EarthVisaKit's Swift decoder mirrors
// decodeCore() below field for field, and the fixtures written here are what
// the Swift conformance runner replays. A divergence in either direction fails
// a build rather than shipping a wrong visa answer.
//
//   node scripts/verify-mobile-bundle.mjs              verify only
//   node scripts/verify-mobile-bundle.mjs --fixtures   verify, then write fixtures
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { computeWith } from "../src/lib/compute-core.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MOBILE = join(ROOT, "public", "mobile");

const WRITE_FIXTURES = process.argv.includes("--fixtures");

// ---------------------------------------------------------------------------
// Reference decoder. EarthVisaKit/Sources/EarthVisaKit/BundleDecoder.swift is a
// line-for-line port of this. Keep them in step.
// ---------------------------------------------------------------------------

/** Mirror of the emitter's tuple layout. Any drift here is caught by the
 *  round-trip assertions below, not by inspection. */
function decodeCore(core) {
  const strings = core.strings;
  const levels = core.levels;
  const iso3 = core.countries.map((c) => c[1]);

  const decodeAccess = (t) => {
    const edge = {
      dest: iso3[t[0]],
      level: levels[t[1]],
      maxStayDays: t[2],
      sourceUrl: strings[t[3]],
      sourceOfficial: t[4] === 1,
      notes: strings[t[5]],
    };
    // null means the field was absent upstream, and it must STAY absent rather
    // than becoming []. compute-core.ts reads `(e.passportTypes ?? []).includes(ptype)`,
    // so both absent and empty deny the edge today, but only preserving absence
    // keeps the decoded edge indistinguishable from the original.
    if (t[6] !== null) edge.passportTypes = t[6].map((i) => strings[i]);
    return edge;
  };

  const decodeCredential = (t) => {
    const edge = decodeAccess(t);
    edge.nationalityScope = t[7] === null ? null : t[7].map((o) => iso3[o]);
    if (t[8] !== -1) edge.conditions = strings[t[8]];
    edge.transit = t[9] === 1;
    if (t[10] !== -1) edge.docLabel = strings[t[10]];
    return edge;
  };

  const mapRecord = (rec, fn) =>
    Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.map(fn)]));

  return {
    allCountries: core.countries.map((c) => ({ iso2: c[0], iso3: c[1], name: c[2], region: c[3] })),
    // Rebuilt in the bundle's declared order. computeWith() iterates this to
    // build `memberships`, so the order is part of the answer, not incidental.
    groups: Object.fromEntries(core.groups.map(([k, , ords]) => [k, ords.map((o) => iso3[o])])),
    groupLabels: Object.fromEntries(core.groups.map(([k, label]) => [k, label])),
    passportAccess: mapRecord(core.passportAccess, decodeAccess),
    credentialAccess: mapRecord(core.credentialAccess, decodeCredential),
    diplomaticAccess: mapRecord(core.diplomaticAccess, decodeAccess),
    diplomaticAny: core.diplomaticAny.map(decodeAccess),
    credentials: core.credentials.map((c) => ({ id: c[0], label: c[1], short: c[2], group: c[3] })),
    ranks: core.ranks,
  };
}

// ---------------------------------------------------------------------------
// Load both sides
// ---------------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(join(MOBILE, "manifest.json"), "utf8"));
const coreRaw = JSON.parse(
  brotliDecompressSync(readFileSync(join(ROOT, "public", manifest.bundles.core.url.replace(/^\//, "")))).toString("utf8"),
);
const decoded = decodeCore(coreRaw);

const dataset = JSON.parse(readFileSync(join(ROOT, "src", "data", "dataset.json"), "utf8"));

// cbi/rbi/fastTrack are not part of the reach answer and travel verbatim, so
// both sides share them. Feeding the same objects keeps the diff focused on the
// encoding under test rather than on data the encoder never touches.
const shared = { cbi: dataset.cbi, rbi: dataset.rbi, fastTrack: dataset.fastTrack };
const original = { ...dataset, ...shared };
const fromBundle = { ...decoded, ...shared };

// ---------------------------------------------------------------------------
// Permutation matrix
// ---------------------------------------------------------------------------
// Every case is a (selected passports, credentials, passport types) triple. The
// matrix has to cover each branch in computeWith(), not just the happy path,
// because the branches that are easy to forget are exactly the ones that
// produce a false visa-free: credential nationality scoping, transit-only edges,
// diplomatic waivers, and self-country exclusion.

const allPassports = Object.keys(dataset.passportAccess).sort();
const allCredentials = dataset.credentials.map((c) => c.id).sort();

/** Deterministic PRNG (mulberry32) so the fixture set is reproducible: a
 *  fixture file that changes for no reason would make every conformance
 *  failure look like drift. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260805);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const cases = [];
const add = (name, selected, credentials = [], passportTypes = {}) =>
  cases.push({ name, selected, credentials, passportTypes });

// 1. Every passport alone, ordinary. The baseline reach answer for all 199.
for (const p of allPassports) add(`solo:${p}`, [p]);

// 2. Every passport under each non-ordinary passport type. Exercises the
//    diplomaticAny + diplomaticAccess loops and the OTHER-bit encoding.
for (const p of allPassports) {
  for (const t of ["diplomatic", "service", "official"]) {
    add(`ptype:${p}:${t}`, [p], [], { [p]: t });
  }
}

// 3. Every credential against a spread of passports. Exercises nationalityScope
//    filtering and the transit-only split, which is where a scoped unlock could
//    wrongly leak to a nationality it does not apply to.
const credProbes = ["IND", "PAK", "CHN", "NGA", "USA", "DEU", "BRA", "RUS", "PHL", "EGY", "TUR", "ZAF"];
for (const c of allCredentials) {
  for (const p of credProbes) add(`cred:${p}:${c}`, [p], [c]);
}

// 4. Every passport holding every credential at once. The maximal-unlock case,
//    where any double-counting or precedence error shows up as a reach delta.
for (const p of allPassports) add(`credall:${p}`, [p], allCredentials);

// 5. Real dual-citizenship pairs plus deterministic random combinations, up to
//    four passports. Exercises best-level-across-passports and self-country
//    exclusion (a destination you hold a passport for must never appear).
const realPairs = [
  ["IND", "USA"], ["GBR", "IRL"], ["CAN", "FRA"], ["AUS", "NZL"], ["DEU", "TUR"],
  ["ISR", "USA"], ["MEX", "ESP"], ["BRA", "ITA"], ["ZAF", "GBR"], ["PAK", "GBR"],
  ["PHL", "USA"], ["NGA", "GBR"], ["CHN", "SGP"], ["RUS", "ISR"], ["ARG", "ITA"],
];
for (const pair of realPairs) add(`pair:${pair.join("+")}`, pair);
for (let i = 0; i < 120; i++) {
  const n = 2 + Math.floor(rand() * 3);
  const sel = [...new Set(Array.from({ length: n }, () => pick(allPassports)))];
  add(`combo:${i}:${sel.join("+")}`, sel);
}

// 6. Mixed: multiple passports, several credentials, mixed passport types. The
//    case where every branch runs at once.
for (let i = 0; i < 60; i++) {
  const sel = [...new Set([pick(allPassports), pick(allPassports)])];
  const creds = [...new Set([pick(allCredentials), pick(allCredentials)])];
  const types = {};
  for (const s of sel) if (rand() > 0.5) types[s] = pick(["diplomatic", "service", "official"]);
  add(`mixed:${i}`, sel, creds, types);
}

// 7. Degenerate and hostile inputs. These must not throw and must not invent
//    reach: an unknown code has no edges, and a duplicate is not a second
//    passport.
add("edge:empty", []);
add("edge:unknown-passport", ["ZZZ"]);
add("edge:unknown-credential", ["IND"], ["NOT_A_CREDENTIAL"]);
add("edge:duplicate-passport", ["IND", "IND"]);
add("edge:duplicate-credential", ["IND"], ["US_VISA", "US_VISA"]);
add("edge:type-for-unselected", ["IND"], [], { DEU: "diplomatic" });
add("edge:all-passports", allPassports.slice(0, 40));

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

/** Canonical form of a PassportResult. Covers every field the app renders, so a
 *  regression in a field the UI shows cannot pass by being absent here. Object
 *  key order is fixed explicitly rather than inherited from insertion order. */
function canonical(r) {
  const edge = (e) => ({
    dest: e.dest,
    level: e.level,
    maxStayDays: e.maxStayDays ?? null,
    sourceUrl: e.sourceUrl,
    sourceOfficial: !!e.sourceOfficial,
    notes: e.notes,
    passportTypes: e.passportTypes ?? null,
    viaIso3: e.viaIso3 ?? null,
    viaCredential: e.viaCredential ?? null,
    viaPassportType: e.viaPassportType ?? null,
    nationalityScope: e.nationalityScope ?? null,
    conditions: e.conditions ?? null,
    transit: e.transit ?? null,
    docLabel: e.docLabel ?? null,
  });
  return {
    selected: r.selected,
    credentials: r.credentials,
    reach: r.reach.map(edge),
    reachByLevel: Object.fromEntries(
      Object.entries(r.reachByLevel).map(([k, v]) => [k, v.map((e) => e.dest)]),
    ),
    viaCredentialCount: r.viaCredentialCount,
    viaCredentialNewCount: r.viaCredentialNewCount,
    viaPassportTypeCount: r.viaPassportTypeCount,
    transitReach: r.transitReach.map(edge),
    freedomOfMovement: r.freedomOfMovement.map((f) => ({ dest: f.dest, groups: [...f.groups].sort() })),
    memberships: r.memberships.map((m) => ({ key: m.key, label: m.label, members: m.members })),
    cbi: r.cbi.map((p) => p.iso3),
    rbi: r.rbi.map((p) => `${p.iso3}:${p.program_name}`),
    fastTrack: r.fastTrack.map((p) => `${p.iso3}:${p.program_name}`),
    perPassportReach: r.perPassportReach.map((p) => [p.iso3, p.total]),
  };
}

let failures = 0;
const fixtures = [];

for (const c of cases) {
  const a = canonical(computeWith(original, c.selected, c.credentials, c.passportTypes));
  const b = canonical(computeWith(fromBundle, c.selected, c.credentials, c.passportTypes));
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    failures++;
    if (failures <= 5) {
      console.error(`FAIL ${c.name}`);
      // Point at the first differing field rather than dumping two large blobs.
      for (const k of Object.keys(a)) {
        const x = JSON.stringify(a[k]);
        const y = JSON.stringify(b[k]);
        if (x !== y) {
          console.error(`  field ${k}`);
          console.error(`    dataset: ${x.slice(0, 400)}`);
          console.error(`    bundle:  ${y.slice(0, 400)}`);
          break;
        }
      }
    }
  }
  fixtures.push({ ...c, expected: a });
}

// ---------------------------------------------------------------------------
// Structural assertions the permutation matrix cannot see
// ---------------------------------------------------------------------------
// A result comparison only covers data the compute reads. These check the parts
// the app reads directly off the bundle.

const structural = [];
const assert = (name, ok, detail = "") => {
  structural.push({ name, ok, detail });
  if (!ok) failures++;
};

assert("country count", decoded.allCountries.length === dataset.allCountries.length,
  `${decoded.allCountries.length} vs ${dataset.allCountries.length}`);
assert("country fields round-trip",
  JSON.stringify([...decoded.allCountries].sort((a, b) => a.iso3.localeCompare(b.iso3))) ===
  JSON.stringify([...dataset.allCountries].sort((a, b) => a.iso3.localeCompare(b.iso3))));
// Key order differs (the dataset's objects are built in a different order), and
// that is not a difference anyone can observe, so compare canonically.
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
assert("credential list round-trips",
  JSON.stringify(decoded.credentials.map(sortKeys)) === JSON.stringify(dataset.credentials.map(sortKeys)));
assert("group membership round-trips",
  JSON.stringify(Object.fromEntries(Object.entries(decoded.groups).map(([k, v]) => [k, [...v].sort()]))) ===
  JSON.stringify(Object.fromEntries(Object.entries(dataset.groups).map(([k, v]) => [k, [...v].sort()]))));

// Rank must equal visa_free + visa_on_arrival + eTA, e-visa excluded. If this
// ever silently changed, the app would print a different rank from the website
// for the same passport.
const RANK_LEVELS = new Set(["visa_free", "visa_on_arrival", "eta"]);
const expectedRanks = Object.fromEntries(
  Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => [iso3, edges.filter((e) => RANK_LEVELS.has(e.level)).length])
    .sort((a, b) => b[1] - a[1])
    .map(([iso3], i) => [iso3, i + 1]),
);
assert("ranks match the site derivation (e-visa excluded)",
  JSON.stringify(coreRaw.ranks) === JSON.stringify(expectedRanks));

// Every edge must survive. Counting them independently of the compute catches an
// encoder that drops an edge whose destination happens to be dominated by a
// better one, which no reach comparison would notice.
const countEdges = (rec) => Object.values(rec).reduce((n, v) => n + v.length, 0);
assert("passportAccess edge count",
  countEdges(decoded.passportAccess) === countEdges(dataset.passportAccess),
  `${countEdges(decoded.passportAccess)} vs ${countEdges(dataset.passportAccess)}`);
assert("diplomaticAccess edge count",
  countEdges(decoded.diplomaticAccess) === countEdges(dataset.diplomaticAccess));
assert("credentialAccess edge count",
  countEdges(decoded.credentialAccess) === countEdges(dataset.credentialAccess));
assert("diplomaticAny edge count",
  decoded.diplomaticAny.length === dataset.diplomaticAny.length);

// Absent vs empty passportTypes is the distinction that could turn a
// special-passport waiver into an ordinary-passport one. Assert it directly.
const absentUpstream = Object.values(dataset.diplomaticAccess).flat().filter((e) => e.passportTypes === undefined).length;
const absentDecoded = Object.values(decoded.diplomaticAccess).flat().filter((e) => e.passportTypes === undefined).length;
assert("absent passportTypes stays absent", absentUpstream === absentDecoded,
  `${absentDecoded} vs ${absentUpstream}`);
assert("no ordinary passport edge gained a passportTypes restriction",
  Object.values(decoded.passportAccess).flat().every((e) => e.passportTypes === undefined));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

for (const s of structural) console.log(`  ${s.ok ? "ok  " : "FAIL"}  ${s.name}${s.detail ? `  (${s.detail})` : ""}`);
console.log(`\n${cases.length.toLocaleString()} compute cases, ${structural.length} structural assertions`);

if (failures) {
  console.error(`\n${failures} FAILURES - the mobile bundle is NOT equivalent to the dataset. Do not ship it.`);
  process.exit(1);
}
console.log("bundle is compute-equivalent to the dataset");

if (WRITE_FIXTURES) {
  // The expected results are stored in a COMPACT form rather than as full
  // canonical JSON. Two reasons. First, size: the full form carries every
  // sourceUrl and note on every edge, which is ~140MB across 1,461 cases.
  // Second, and more important, diagnosability: holding Swift to a hash of a
  // JSON string would make every failure a bare "digest mismatch" and would
  // also make the test sensitive to things that are not the answer, like key
  // order and float formatting. So the fixture encodes the ANSWER - which
  // destination, at which level, via which passport or credential - as
  // integers, and a failure can name the exact destination that diverged.
  //
  // Strings are covered separately by stringIntegrity below, because they come
  // from the bundle's string table rather than from the computation.
  const dir = join(ROOT, "public", "mobile", "fixtures");
  mkdirSync(dir, { recursive: true });

  const ord = new Map(decoded.allCountries.map((c, i) => [c.iso3, i]));
  const levelIdx = new Map(coreRaw.levels.map((l, i) => [l, i]));
  const credIdx = new Map(decoded.credentials.map((c, i) => [c.id, i]));
  const ptypeIdx = new Map([["ordinary", 0], ["diplomatic", 1], ["service", 2], ["official", 3]]);
  const o = (iso3) => (iso3 == null ? -1 : ord.get(iso3) ?? -1);

  /** [dest, level, viaIso3, viaCredential, viaPassportType, maxStay] */
  const edgeTuple = (e) => [
    o(e.dest),
    levelIdx.get(e.level),
    o(e.viaIso3),
    e.viaCredential == null ? -1 : credIdx.get(e.viaCredential) ?? -1,
    e.viaPassportType == null ? -1 : ptypeIdx.get(e.viaPassportType) ?? -1,
    e.maxStayDays ?? null,
  ];

  const compactCases = cases.map((c) => {
    const r = computeWith(fromBundle, c.selected, c.credentials, c.passportTypes);
    return {
      name: c.name,
      selected: c.selected,
      credentials: c.credentials,
      passportTypes: c.passportTypes,
      // Order is part of the expectation: computeWith sorts reach by level then
      // by DISPLAY NAME, not by ISO3, and a Swift port that sorts by code would
      // render the grid in a different order while passing any set comparison.
      reach: r.reach.map(edgeTuple),
      transitReach: r.transitReach.map(edgeTuple),
      byLevel: coreRaw.levels.map((l) => r.reachByLevel[l].length),
      viaCredentialCount: r.viaCredentialCount,
      viaCredentialNewCount: r.viaCredentialNewCount,
      viaPassportTypeCount: r.viaPassportTypeCount,
      freedomOfMovement: r.freedomOfMovement.map((f) => [o(f.dest), [...f.groups].sort()]),
      memberships: r.memberships.map((m) => m.key),
      programCounts: [r.cbi.length, r.rbi.length, r.fastTrack.length],
      perPassportReach: r.perPassportReach.map((p) => [o(p.iso3), p.total]),
    };
  });

  // String-table integrity. The computation never reads these, so a decoder
  // could get every reach answer right while mangling the source URL the app
  // shows under the verdict. Sampled deterministically across the whole table.
  const sampleIdx = [];
  for (let i = 0; i < coreRaw.strings.length; i += Math.max(1, Math.floor(coreRaw.strings.length / 200))) {
    sampleIdx.push(i);
  }
  const stringIntegrity = {
    count: coreRaw.strings.length,
    sha256OfAll: createHash("sha256").update(coreRaw.strings.join(" ")).digest("hex"),
    samples: sampleIdx.map((i) => [i, coreRaw.strings[i]]),
  };

  // Spot-check edges: full field values for a fixed set of well-known corridors,
  // so a decoder bug in maxStayDays or sourceOfficial fails loudly and readably
  // rather than only through an aggregate hash.
  const spotCorridors = [
    ["IND", "ARE"], ["IND", "THA"], ["IND", "JPN"], ["USA", "JPN"], ["USA", "BRA"],
    ["DEU", "JPN"], ["GBR", "USA"], ["NGA", "GBR"], ["PAK", "NPL"], ["CHN", "SGP"],
    ["PHL", "MAC"], ["RUS", "IDN"], ["BRA", "PRT"], ["ZAF", "KEN"], ["TUR", "DEU"],
  ];
  const spotChecks = [];
  for (const [from, to] of spotCorridors) {
    const e = (decoded.passportAccess[from] ?? []).find((x) => x.dest === to);
    spotChecks.push({
      from, to,
      present: !!e,
      level: e?.level ?? null,
      maxStayDays: e?.maxStayDays ?? null,
      sourceOfficial: e?.sourceOfficial ?? null,
      sourceUrl: e?.sourceUrl ?? null,
      notes: e?.notes ?? null,
    });
  }

  const payload = {
    format: manifest.format,
    dataVersion: manifest.dataVersion,
    coreSha256: manifest.bundles.core.sha256,
    note: "Golden fixtures generated from the real src/lib/compute-core.ts. The Swift engine in earthvisa-ios must reproduce every expected value exactly. Regenerate with: node scripts/verify-mobile-bundle.mjs --fixtures",
    levels: coreRaw.levels,
    passportTypes: ["ordinary", "diplomatic", "service", "official"],
    credentialOrder: decoded.credentials.map((c) => c.id),
    countryOrder: decoded.allCountries.map((c) => c.iso3),
    stringIntegrity,
    spotChecks,
    cases: compactCases,
  };
  const out = join(dir, "compute-fixtures.json");
  const json = JSON.stringify(payload);
  writeFileSync(out, json);
  console.log(`fixtures: ${compactCases.length.toLocaleString()} cases, ${spotChecks.length} spot checks, ${stringIntegrity.samples.length} string samples`);
  console.log(`          ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(1)}MB  ${out.replace(ROOT + "/", "")}`);
}
