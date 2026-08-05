// Emits the offline data bundles the Earth Visa iOS app ships and updates from.
//
// The app is offline-first: the entire visa graph, every destination's visa
// types, every fee schedule and all 1,207 VFS document checklists are carried
// on the device. Nothing about the core "where can you go" answer, and nothing
// about an application's document checklist, requires a network call.
//
// Three bundles, split by when the app needs them:
//   core   - decoded at launch. Countries, groups, credentials, ranks and every
//            access edge. This is what feeds the reach computation.
//   detail - decoded lazily on the first corridor open. Visa types, fee
//            schedules, proof-of-funds guidance, acceptance rates, advance notes.
//   vfs    - decoded lazily on the first apply flow. Document checklists.
//
// Wire format: JSON with a shared string table, brotli-compressed. Source URLs
// and policy notes repeat enormously across edges (the raw passportAccess map is
// 10.8MB, most of it the same few thousand strings), so interning them is what
// makes a launch-time decode affordable. Positional tuples are used ONLY for the
// hot edge lists; everything else keeps object keys so the payload stays
// debuggable with `brotli -d | jq`. Tuple layouts are documented at each emitter
// and mirrored comment-for-comment in EarthVisaKit's decoder.
//
// Reads only committed derived data (src/data/*.json) plus data/vfs, so it needs
// no git history and cannot trip the shallow-clone sitemap guard that guards
// build-dataset.mjs. See data/README.md.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "public", "mobile");

/** Bump only on a BREAKING wire-format change. The app refuses a bundle whose
 *  format it does not implement and keeps running on its baked-in copy, so a
 *  bump must be paired with an app release before it is published. */
const FORMAT = 1;

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const dataset = read("src/data/dataset.json");
const visaFees = read("src/data/visa-fees.json");
const proofOfFunds = read("src/data/proof-of-funds.json");
const fxRates = read("src/data/fx-rates.json");

// ---------------------------------------------------------------------------
// String interning
// ---------------------------------------------------------------------------

/** Index 0 is always "", so an absent-but-required string costs one character
 *  in the payload and needs no null branch in the decoder. A genuinely absent
 *  OPTIONAL string is -1, which the decoder maps to nil. */
function makeStringTable() {
  const list = [""];
  const index = new Map([["", 0]]);
  return {
    list,
    /** required string -> index (>= 0) */
    intern(s) {
      const v = s == null ? "" : String(s);
      let i = index.get(v);
      if (i === undefined) {
        i = list.length;
        list.push(v);
        index.set(v, i);
      }
      return i;
    },
    /** Optional string -> index, or -1 when the field is genuinely ABSENT.
     *
     *  An empty string is a present value and interns to 0. Treating "" as
     *  absent here silently collapsed the 5 credential edges that carry
     *  `conditions: ""` into edges with no conditions field at all, which the
     *  round-trip check caught. The distinction is small but it is exactly the
     *  class of quiet semantic drift this format has to avoid. */
    internOptional(s) {
      if (s == null) return -1;
      return this.intern(s);
    },
  };
}

// ---------------------------------------------------------------------------
// Shared vocabularies
// ---------------------------------------------------------------------------

/** Wire ordinal for AccessLevel. The decoder maps these back by index, so the
 *  ORDER IS PART OF THE FORMAT and must never be reordered without a FORMAT
 *  bump. Note this is declaration order, NOT precedence order: precedence
 *  (visa_free > visa_on_arrival > eta > e_visa) lives in the compute engine on
 *  both sides, exactly as LEVEL_RANK does in src/lib/compute-core.ts. */
const LEVELS = ["visa_free", "visa_on_arrival", "eta", "e_visa"];
const levelOrd = new Map(LEVELS.map((l, i) => [l, i]));

/** The four passport types src/lib/types.ts models. Everything else in the data
 *  is tracked for the build log but encoded verbatim like any other type. */
const MODELLED_PASSPORT_TYPES = new Set(["ordinary", "diplomatic", "service", "official"]);

/** Passport types present in the data but absent from the PassportType union,
 *  counted for the build log. */
const unmodelledPassportTypes = new Map();

/** passportTypes -> array of string-table indices, or null when the field was
 *  absent upstream.
 *
 *  null is load-bearing and is NOT the same as []. In compute-core.ts the
 *  diplomatic path reads `(e.passportTypes ?? []).includes(ptype)`, so an absent
 *  array means the edge applies to NOBODY. Both sides must round-trip that
 *  distinction exactly.
 *
 *  An earlier revision packed these into a bitmask. It was rejected: a bitmask
 *  cannot represent order, and it cannot represent the 13 passport types the
 *  dataset carries beyond the modelled four - "special" (285 edges),
 *  "flight_crew", "laissez-passer", "un_travel_document", and a tail that
 *  includes free text like "unknown - not specified in official source". Under a
 *  bitmask, ["flight_crew"] decoded to [] and ["diplomatic","special"] decoded
 *  to ["diplomatic"]. Neither changes an answer today, because an unmatched type
 *  is inert and these appear only on diplomatic edges. But an encoding that
 *  silently discards data is the wrong foundation for a dataset whose worst
 *  failure mode is claiming access that does not exist, so the types travel as
 *  interned strings and the encoding is lossless. It costs nothing measurable:
 *  only 2,275 of 25,206 edges carry the field at all. */
function passportTypeIndices(types, st) {
  if (!Array.isArray(types)) return null;
  for (const t of types) {
    if (!MODELLED_PASSPORT_TYPES.has(t)) {
      unmodelledPassportTypes.set(t, (unmodelledPassportTypes.get(t) ?? 0) + 1);
    }
  }
  return types.map((t) => st.intern(t));
}

// Country ordinals. Sorted by iso3 so the mapping is stable across builds and a
// diff of two bundles stays readable.
const countries = [...dataset.allCountries].sort((a, b) => a.iso3.localeCompare(b.iso3));
const ordOf = new Map(countries.map((c, i) => [c.iso3, i]));

/** Destinations appear in edges that reference countries; every one must resolve
 *  or the bundle would silently drop reach. */
function requireOrd(iso3, context) {
  const o = ordOf.get(iso3);
  if (o === undefined) throw new Error(`unknown country iso3 ${JSON.stringify(iso3)} in ${context}`);
  return o;
}

// ---------------------------------------------------------------------------
// core bundle
// ---------------------------------------------------------------------------

const coreStrings = makeStringTable();

/** AccessEdge tuple, 7 fields, fixed length:
 *    [0] dest        country ordinal
 *    [1] level       LEVELS ordinal
 *    [2] maxStay     days, or null
 *    [3] source      string index (required, "" when the dataset had none)
 *    [4] official    1 when sourceOfficial, else 0
 *    [5] notes       string index (required, "" when the dataset had none)
 *    [6] ptypes      array of string indices, or null when absent upstream
 */
function accessEdge(e, st, context) {
  const lvl = levelOrd.get(e.level);
  if (lvl === undefined) throw new Error(`unknown access level ${JSON.stringify(e.level)} in ${context}`);
  return [
    requireOrd(e.dest, context),
    lvl,
    e.maxStayDays ?? null,
    st.intern(e.sourceUrl),
    e.sourceOfficial ? 1 : 0,
    st.intern(e.notes),
    passportTypeIndices(e.passportTypes, st),
  ];
}

/** CredentialEdge tuple, 11 fields: the 7 AccessEdge fields then
 *    [7]  scope       array of country ordinals, or null for "any nationality".
 *                     null and [] mean different things upstream, so both survive.
 *    [8]  conditions  string index, or -1 when absent
 *    [9]  transit     1 when the edge is airside/landside transit ONLY. Compute
 *                     keeps these out of tourist reach entirely.
 *    [10] docLabel    string index, or -1 when absent
 */
function credentialEdge(e, st, context) {
  const base = accessEdge(e, st, context);
  const scope = e.nationalityScope == null
    ? null
    : e.nationalityScope.map((n) => requireOrd(n, `${context} nationalityScope`));
  return [...base, scope, st.internOptional(e.conditions), e.transit ? 1 : 0, st.internOptional(e.docLabel)];
}

// Global passport rank (#N of 199) by SCORE: visa-free + VoA + eTA. e-visa does
// NOT count (it is a visa application, merely an online one). This MUST stay
// identical to the derivation in scripts/build-explorer-slices.mjs, buildRows()
// in src/app/rankings/page.tsx and rankOf in src/app/passport/[slug]/page.tsx,
// or the app and the site would disagree about the same passport.
const RANK_LEVELS = new Set(["visa_free", "visa_on_arrival", "eta"]);
const ranks = Object.fromEntries(
  Object.entries(dataset.passportAccess)
    .map(([iso3, edges]) => [iso3, edges.filter((e) => RANK_LEVELS.has(e.level)).length])
    .sort((a, b) => b[1] - a[1])
    .map(([iso3], i) => [iso3, i + 1]),
);

function mapEdges(record, fn) {
  const out = {};
  for (const [key, edges] of Object.entries(record)) out[key] = edges.map((e) => fn(e, key));
  return out;
}

const core = {
  format: FORMAT,
  kind: "core",
  meta: {
    // The date the DATA was last updated, which is what the app shows as "as of".
    // Never the build date: a rebuild with no data change must not make the app
    // claim fresher knowledge than it has.
    lastUpdated: dataset.meta.lastUpdated,
    totalCountries: dataset.meta.totalCountries,
    countriesWithData: dataset.meta.countriesWithData,
    destinationsWithVisaPolicy: dataset.meta.destinationsWithVisaPolicy,
  },
  levels: LEVELS,
  // [iso2, iso3, name, region] by ordinal. iso2 is carried for the flag emoji.
  countries: countries.map((c) => [c.iso2, c.iso3, c.name, c.region]),
  // An ARRAY of [key, label, memberOrdinals], not an object.
  //
  // computeWith() builds its `memberships` list by iterating groups in order,
  // and JavaScript objects iterate string keys in insertion order, so the web
  // result is implicitly ordered by this map's key order. Swift's Dictionary has
  // no defined iteration order at all, so a Swift port reading an object would
  // produce memberships in an arbitrary and run-varying order. Making the order
  // explicit in the wire format is the only way both sides can agree.
  groups: Object.entries(dataset.groups).map(([k, members]) => [
    k,
    dataset.groupLabels[k] ?? k,
    members.map((m) => requireOrd(m, `group ${k}`)),
  ]),
  credentials: dataset.credentials.map((c) => [c.id, c.label, c.short, c.group]),
  ranks,
  passportAccess: mapEdges(dataset.passportAccess, (e, k) =>
    accessEdge(e, coreStrings, `passportAccess.${k}`)),
  diplomaticAccess: mapEdges(dataset.diplomaticAccess, (e, k) =>
    accessEdge(e, coreStrings, `diplomaticAccess.${k}`)),
  diplomaticAny: dataset.diplomaticAny.map((e) => accessEdge(e, coreStrings, "diplomaticAny")),
  credentialAccess: mapEdges(dataset.credentialAccess, (e, k) =>
    credentialEdge(e, coreStrings, `credentialAccess.${k}`)),
  countryLastUpdated: dataset.countryLastUpdated,
  // Nationality labels the crawler could not resolve to an ISO3 country. Carried
  // so the app can say WHY a reach count is a lower bound rather than implying
  // the dataset is complete.
  unresolvedNationalityLabels: dataset.meta.unresolvedNationalityLabels ?? [],
  strings: coreStrings.list,
};

// ---------------------------------------------------------------------------
// detail bundle
// ---------------------------------------------------------------------------
// Per-destination reference data. Kept out of core because none of it is needed
// to answer "where can you go", and together it is three times core's size.

const detail = {
  format: FORMAT,
  kind: "detail",
  meta: { lastUpdated: dataset.meta.lastUpdated },
  destinationVisaTypes: dataset.destinationVisaTypes,
  // Only the US, UK, Ireland, NZ and Netherlands publish per-nationality refusal
  // data. An absent destination means "not published", never "no refusals", and
  // label/definition/scope/caveats travel with the numbers because each source
  // measures a different thing.
  acceptanceRates: dataset.acceptanceRates,
  // Nationality-scoped process notes for corridors that genuinely require a visa
  // in advance, where no access edge exists at all.
  advanceVisaNotes: dataset.advanceVisaNotes,
  visaFees,
  proofOfFunds,
  // Fees are authored in their original currency; this snapshot is what turns
  // them into an approximate USD. Carried so the app converts exactly as the
  // site does rather than reimplementing rates.
  fxRates,
  vfsCorridors: dataset.vfsCorridors,
};

// ---------------------------------------------------------------------------
// vfs bundle
// ---------------------------------------------------------------------------
// The document checklists that fuel the apply flow. 1,207 corridor files, 55MB
// raw, and the single biggest thing the app carries, so it is its own bundle and
// is only decoded when a user actually starts an application.

const vfsDir = join(ROOT, "data", "vfs");
const vfsCorridors = {};
for (const file of readdirSync(vfsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  vfsCorridors[file.slice(0, -".json".length)] = JSON.parse(readFileSync(join(vfsDir, file), "utf8"));
}

const vfs = {
  format: FORMAT,
  kind: "vfs",
  meta: { lastUpdated: dataset.meta.lastUpdated, corridorCount: Object.keys(vfsCorridors).length },
  // Keyed "<srcCode>-<destCode>", matching the data/vfs filenames and the
  // detailFile field on VfsCorridorSummary.
  corridors: vfsCorridors,
};

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
const versionDir = join(OUT, `v${FORMAT}`);
mkdirSync(versionDir, { recursive: true });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Brotli quality per bundle.
 *
 *  This runs on every deploy, so the cost is real. Measured on the actual
 *  payloads: the 53.8MB vfs bundle takes 22.0s at quality 11 for 2.21MB, and
 *  0.66s at quality 9 for 2.42MB. That is 33x the build time to save 9% of a
 *  download that happens once per data update, which is not a trade worth
 *  making. core and detail are small enough that maximum compression is free,
 *  and core is the one that gates first launch. */
const QUALITY = { core: 11, detail: 11, vfs: 9 };

function emit(name, obj) {
  const raw = Buffer.from(JSON.stringify(obj));
  const compressed = brotliCompressSync(raw, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: QUALITY[name] ?? 11,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  // Content-addressed filename, so every bundle URL is immutable and can be
  // cached forever. manifest.json is the only URL that ever changes.
  const digest = sha256(compressed);
  const filename = `${name}-${digest.slice(0, 12)}.json.br`;
  writeFileSync(join(versionDir, filename), compressed);
  return {
    name,
    url: `/mobile/v${FORMAT}/${filename}`,
    sha256: digest,
    bytes: compressed.length,
    rawBytes: raw.length,
  };
}

const bundles = [emit("core", core), emit("detail", detail), emit("vfs", vfs)];

const manifest = {
  format: FORMAT,
  // What the DATA says about itself. The app compares this against its baked-in
  // copy to decide whether an update is worth downloading, and shows it as the
  // "as of" date. Deliberately not a build timestamp.
  dataVersion: dataset.meta.lastUpdated,
  bundles: Object.fromEntries(bundles.map((b) => [b.name, b])),
};

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const mb = (n) => (n / 1024 / 1024).toFixed(2).padStart(6);
console.log(`mobile bundle v${FORMAT}  data ${manifest.dataVersion}`);
for (const b of bundles) {
  const ratio = ((1 - b.bytes / b.rawBytes) * 100).toFixed(1);
  console.log(`  ${b.name.padEnd(7)} ${mb(b.rawBytes)}MB raw -> ${mb(b.bytes)}MB br  (${ratio}% smaller)`);
}
console.log(`  ${"total".padEnd(7)} ${mb(bundles.reduce((s, b) => s + b.rawBytes, 0))}MB raw -> ${mb(bundles.reduce((s, b) => s + b.bytes, 0))}MB br`);
console.log(`  strings interned in core: ${coreStrings.list.length.toLocaleString()}`);

if (unmodelledPassportTypes.size) {
  // Not fatal: these round-trip verbatim and match no modelled passport type,
  // exactly as they already match nothing in compute-core.ts. Surfaced because
  // several are plainly data-quality bugs in data/countries rather than real
  // passport categories, and they should not decay into background noise.
  const sorted = [...unmodelledPassportTypes].sort((a, b) => b[1] - a[1]);
  console.log(`  note: ${sorted.length} passport types are absent from the PassportType union in src/lib/types.ts.`);
  console.log(`        They are carried verbatim and are inert in compute (diplomatic edges only):`);
  for (const [type, n] of sorted) console.log(`         ${String(n).padStart(4)}x ${JSON.stringify(type)}`);
}
