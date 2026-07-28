#!/usr/bin/env node
/**
 * Pick which corridors get pre-rendered at build time, from MEASURED search
 * demand rather than assumed popularity.
 *
 * Why this exists. preWarmCorridorPairs() used to be "top nationalities x top
 * destinations", a curated guess. Measured against a Search Console export:
 *
 *   - 92% of what it pre-rendered had never received a single impression
 *   - it covered only 25.7% of corridors that actually get search traffic
 *
 * Meanwhile a cold corridor answers in ~0.87s versus ~0.11s cached (measured on
 * production), and every deploy starts with a cold ISR cache. Googlebot throttles
 * crawl rate on slow responses, so warming the wrong 2,000 pages actively costs
 * crawl budget during a recovery.
 *
 * Pre-rendering ALL 39,402 corridors is not an option: at ~177 KB of output each
 * that is ~6.7 GB, which is what made deploys fail on output size before.
 *
 * So: warm exactly the corridors search engines actually surface, and let the
 * long tail render on demand (dynamicParams stays true, so they still work).
 *
 * Usage:
 *   node scripts/build-prerender-list.mjs ~/Downloads/earthvisa-4/Pages.csv
 *   node scripts/build-prerender-list.mjs <csv> --limit 2000
 *
 * The export is not in the repo, so the OUTPUT is committed and this is re-run
 * by hand when a fresh Search Console export is available.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "prerender-corridors.json");

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 4000;

if (!csvPath) {
  console.error("usage: node scripts/build-prerender-list.mjs <Search Console Pages.csv> [--limit N]");
  process.exit(1);
}

const dataset = JSON.parse(readFileSync(join(ROOT, "src", "data", "dataset.json"), "utf8"));
const slugOf = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const bySlug = new Map(dataset.allCountries.map((c) => [slugOf(c.name), c.iso3]));

/** Minimal CSV reader: these exports are quoted, comma-separated, no embedded newlines. */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const split = (line) => {
    const out = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const cols = Object.keys(rows[0] ?? {});
const urlCol = cols[0];
const impCol = cols.find((c) => /impress/i.test(c));
if (!impCol) {
  console.error(`no impressions column found in ${csvPath} (columns: ${cols.join(", ")})`);
  process.exit(1);
}

const demand = new Map();
for (const r of rows) {
  const m = /\/passport\/([^/]+)\/([^/?#]+)/.exec(r[urlCol] ?? "");
  if (!m) continue;
  const nat = bySlug.get(m[1]);
  const dest = bySlug.get(m[2]);
  if (!nat || !dest || nat === dest) continue;
  const imps = parseInt(String(r[impCol]).replace(/,/g, ""), 10) || 0;
  const key = `${nat}|${dest}`;
  demand.set(key, (demand.get(key) ?? 0) + imps);
}

const ranked = [...demand.entries()]
  .filter(([, v]) => v > 0)
  .sort((a, b) => b[1] - a[1])
  .slice(0, LIMIT);

const payload = {
  _readme:
    "GENERATED - do not hand-edit. Corridors pre-rendered at build time, chosen by measured " +
    "Search Console impressions rather than assumed popularity. Regenerate: " +
    "node scripts/build-prerender-list.mjs <Pages.csv>. Corridors absent from this list still " +
    "work - they render on demand via dynamicParams and cache from then on.",
  generated_from: csvPath.replace(process.env.HOME ?? "", "~"),
  corridors: ranked.map(([k, imps]) => {
    const [nat, dest] = k.split("|");
    return { nat, dest, impressions: imps };
  }),
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

const total = [...demand.values()].reduce((a, b) => a + b, 0);
const covered = ranked.reduce((a, [, v]) => a + v, 0);
console.log(`${ranked.length} corridors -> ${OUT}`);
console.log(`  covers ${((100 * covered) / total).toFixed(1)}% of measured corridor impressions`);
console.log(`  estimated pre-render output: ~${Math.round((ranked.length * 177.1) / 1024)} MB`);
