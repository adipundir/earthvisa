#!/usr/bin/env node
/**
 * The single entry point for turning source data into what the app ships.
 *
 *   data/            SOURCE OF TRUTH - hand-authored or crawler-written.
 *   src/data/        DERIVED - never hand-edit; regenerated from data/.
 *   public/explorer/ DERIVED - gitignored slices for client explorers.
 *
 * Why this exists. Each derived file used to have its own merge script that
 * somebody had to remember to run. `prebuild` only rebuilt the explorer slices,
 * so `npm run build` shipped whatever happened to be sitting in src/data/. That
 * is not hypothetical: src/data/proof-of-funds.json was two weeks behind its
 * source for a fortnight because the prose was rewritten and the merge was never
 * re-run. The site served the older text and nothing failed.
 *
 * So: one DAG, one command, and staleness is an error rather than a silent
 * default. Freshness is decided by hashing inputs, not by mtimes - a git
 * checkout rewrites mtimes and would make everything look permanently dirty.
 *
 * Usage
 *   node scripts/data-pipeline.mjs           rebuild whatever is stale
 *   node scripts/data-pipeline.mjs --force   rebuild everything
 *   node scripts/data-pipeline.mjs --check   report staleness, change nothing,
 *                                            exit 1 if anything is out of date
 *
 * Deliberately NOT included: update-fx-rates, build-world-dots and the
 * build-acceptance-* scripts. Each fetches from the network, so they must not
 * run on every build; they write into data/ and their output is picked up here
 * as ordinary source.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "src", "data", ".build-manifest.json");

/**
 * Stage order is dependency order. `inputs` are paths relative to the repo root;
 * a directory means "every .json inside it".
 */
const STAGES = [
  {
    name: "visa-fees",
    script: "merge-visa-fees.mjs",
    inputs: ["data/visa-fees"],
    outputs: ["src/data/visa-fees.json"],
  },
  {
    name: "proof-of-funds",
    script: "merge-proof-of-funds.mjs",
    inputs: ["data/proof-of-funds"],
    outputs: ["src/data/proof-of-funds.json"],
  },
  {
    name: "update-sources",
    script: "extract-update-sources.mjs",
    inputs: ["data/countries"],
    outputs: ["data/update-sources.json"],
  },
  {
    // Needs FULL git history (per-country dates -> sitemap lastModified), so on a
    // shallow CI clone it must be skipped, not rebuilt. It is skippable because
    // its output is committed.
    name: "dataset",
    script: "build-dataset.mjs",
    inputs: ["data/countries", "data/vfs", "data/acceptance-rates", "data/countries.json"],
    outputs: ["src/data/dataset.json"],
  },
  {
    // Separate stage precisely because public/explorer/ is GITIGNORED: on a fresh
    // clone it is always missing, so this stage always runs - which is correct,
    // it must, since nothing ships it. Keeping it fused to `dataset` meant
    // "missing output" forced a dataset rebuild on every CI clone, which then hit
    // the shallow-repository sitemap guard and broke every Vercel deploy.
    // This stage reads only the committed dataset and needs no git history.
    name: "explorer-slices",
    script: "build-explorer-slices.mjs",
    inputs: ["src/data/dataset.json"],
    outputs: ["public/explorer/core.json"],
  },
];

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const CHECK = args.has("--check");

/** Every .json under a directory, recursively, sorted for a stable hash. */
function jsonFilesUnder(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        // _raw holds large re-fetchable source archives (statistical PDFs and
        // spreadsheets); they are inputs to the acceptance-rate builders, not
        // to this pipeline, and hashing 30MB on every build is pure cost.
        if (entry.name === "_raw") continue;
        walk(p);
      } else if (entry.name.endsWith(".json")) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function resolveInputs(patterns) {
  const files = [];
  for (const pattern of patterns) {
    const abs = join(ROOT, pattern);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) files.push(...jsonFilesUnder(abs));
    else files.push(abs);
  }
  return files.sort();
}

/** Hash of (relative path + content) for every input, so a rename counts too. */
function hashInputs(files) {
  const h = createHash("sha256");
  for (const f of files) {
    h.update(relative(ROOT, f));
    h.update("\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

const manifest = loadManifest();
const results = [];
let ran = 0;
let stale = 0;

for (const stage of STAGES) {
  // The builder script is an input too. Hashing only data/ meant editing a merge
  // script left its output stale while the pipeline reported "fresh" - which is
  // exactly the silent-staleness failure this tool exists to prevent, and it bit
  // us once already: merge-visa-fees.mjs gained a field and nothing rebuilt.
  const files = [...resolveInputs(stage.inputs), join(ROOT, "scripts", stage.script)];
  const hash = hashInputs(files);
  const outputsExist = stage.outputs.every((o) => existsSync(join(ROOT, o)));
  const fresh = !FORCE && outputsExist && manifest[stage.name] === hash;

  if (fresh) {
    results.push(`  ok      ${stage.name.padEnd(16)} ${files.length} source files`);
    continue;
  }

  const why = !outputsExist ? "missing output" : manifest[stage.name] ? "sources changed" : "never built";
  stale++;

  if (CHECK) {
    results.push(`  STALE   ${stage.name.padEnd(16)} ${why}`);
    continue;
  }

  process.stdout.write(`  build   ${stage.name.padEnd(16)} (${why})\n`);
  execFileSync(process.execPath, [join(ROOT, "scripts", stage.script)], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
  });

  const missing = stage.outputs.filter((o) => !existsSync(join(ROOT, o)));
  if (missing.length) {
    console.error(`\n  x ${stage.name}: expected output not produced: ${missing.join(", ")}`);
    process.exit(1);
  }
  // Re-hash: a stage may legitimately write into data/ (update-sources does),
  // and the manifest must record what was actually consumed. It MUST use the
  // same file list as the freshness comparison above, script included - storing
  // a hash of a different set means stored never equals computed, every stage
  // reports "sources changed" forever, and the manifest silently stops working.
  // That is exactly what broke: it made CI rebuild the dataset on a shallow
  // clone and trip the sitemap guard on every deploy.
  manifest[stage.name] = hashInputs([
    ...resolveInputs(stage.inputs),
    join(ROOT, "scripts", stage.script),
  ]);
  ran++;
}

if (CHECK) {
  console.log("data pipeline - freshness check\n");
  results.forEach((r) => console.log(r));
  if (stale) {
    console.error(`\n  ${stale} stage(s) out of date. Run: npm run data`);
    process.exit(1);
  }
  console.log("\n  all derived data is up to date with data/");
  process.exit(0);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
results.forEach((r) => console.log(r));
console.log(ran === 0 ? "\n  data pipeline: everything already fresh" : `\n  data pipeline: rebuilt ${ran} stage(s)`);
