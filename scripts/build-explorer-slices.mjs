// Emits the client-explorer data slices under public/explorer/ from
// src/data/dataset.json, so PassportExplorer / DestinationExplorer never
// import the ~18MB dataset into their client bundle:
//   core.json               - eager: allCountries, credentials, groups,
//                             groupLabels, diplomaticAny, passportsWithPolicy
//   programs.json           - cbi / rbi / fastTrack (fetched with the first compute)
//   passport/{ISO3}.json    - that passport's access + diplomatic edges and the
//                             set of destinations with a real corridor page
//                             (shared derivation: src/lib/corridor-dests.mjs)
//   credential/{ID}.json    - per-credential unlock edges
//   destination/{ISO3}.json - visa types, VFS corridors, credential-unlock hints
// Runs at the end of scripts/build-dataset.mjs and as npm's prebuild step, so
// the slices always match the committed dataset.json.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { corridorDestsForNat } from "../src/lib/corridor-dests.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "public", "explorer");

const dataset = JSON.parse(readFileSync(join(ROOT, "src", "data", "dataset.json"), "utf8"));

// Clean rebuild so renamed/removed countries never leave stale slice files.
rmSync(OUT, { recursive: true, force: true });
for (const d of ["passport", "credential", "destination"]) mkdirSync(join(OUT, d), { recursive: true });

let files = 0;
let bytes = 0;
const write = (rel, obj) => {
  const json = JSON.stringify(obj);
  writeFileSync(join(OUT, rel), json + "\n");
  files += 1;
  bytes += json.length + 1;
  return json.length;
};

// ---- core.json (eager, must stay small - it blocks explorer first paint) ----
const coreBytes = write("core.json", {
  allCountries: dataset.allCountries,
  credentials: dataset.credentials,
  groups: dataset.groups,
  groupLabels: dataset.groupLabels,
  diplomaticAny: dataset.diplomaticAny,
  // passports that have any derived visa-policy edges (geo auto-detect gate)
  passportsWithPolicy: Object.keys(dataset.passportAccess),
});
if (coreBytes > 300_000) {
  console.error(`  ✗ explorer core.json is ${coreBytes} bytes (budget 300KB) - move the offending field to a lazy slice.`);
  process.exit(1);
}

// ---- programs.json (needed for any reach computation / program panels) -----
write("programs.json", { cbi: dataset.cbi, rbi: dataset.rbi, fastTrack: dataset.fastTrack });

// ---- per-passport slices ----------------------------------------------------
for (const c of dataset.allCountries) {
  write(join("passport", `${c.iso3}.json`), {
    iso3: c.iso3,
    access: dataset.passportAccess[c.iso3] ?? [],
    diplomatic: dataset.diplomaticAccess[c.iso3] ?? [],
    corridorDests: corridorDestsForNat(dataset, c.iso3),
  });
}

// ---- per-credential slices --------------------------------------------------
// Union of the catalog and the access map, so a fetch for any valid credential
// id never 404s (a catalog credential without edges yields an empty slice).
const credIds = new Set([
  ...dataset.credentials.map((c) => c.id),
  ...Object.keys(dataset.credentialAccess ?? {}),
]);
for (const id of credIds) {
  write(join("credential", `${id}.json`), { id, access: dataset.credentialAccess[id] ?? [] });
}

// ---- per-destination slices -------------------------------------------------
// credUnlocks: which credentials have a non-transit unlock edge into this
// destination, with their nationality scope - powers the "a US/Schengen visa
// can unlock entry here" hint without shipping all of credentialAccess.
const credUnlocksByDest = new Map();
for (const [id, edges] of Object.entries(dataset.credentialAccess ?? {})) {
  for (const e of edges) {
    if (e.transit) continue;
    if (!credUnlocksByDest.has(e.dest)) credUnlocksByDest.set(e.dest, []);
    credUnlocksByDest.get(e.dest).push({ id, nationalityScope: e.nationalityScope ?? null });
  }
}
for (const c of dataset.allCountries) {
  write(join("destination", `${c.iso3}.json`), {
    iso3: c.iso3,
    visaTypes: dataset.destinationVisaTypes?.[c.iso3] ?? [],
    vfsCorridors: dataset.vfsCorridors?.[c.iso3] ?? [],
    credUnlocks: credUnlocksByDest.get(c.iso3) ?? [],
  });
}

console.log(
  `Built public/explorer/: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)}MB total ` +
    `(core.json ${(coreBytes / 1024).toFixed(0)}KB).`,
);
