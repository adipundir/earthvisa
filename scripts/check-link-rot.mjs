#!/usr/bin/env node
// Source-link-rot monitor. Reads data/update-sources.json (the DERIVED index of
// every official source URL per country) and checks that the pages we cite are
// still reachable. A dead official source is a silent data-quality risk: the
// dataset keeps quoting a page that has moved or 404'd. This surfaces them.
//
// Method: HTTP HEAD (fall back to GET on 405/501, which some servers return for
// HEAD), a small concurrency pool, and a per-request timeout so a hanging host
// can't stall the whole run. We flag non-2xx/3xx responses and network failures.
// No retries beyond the single HEAD->GET fallback: be a polite visitor.
//
// Usage:
//   node scripts/check-link-rot.mjs                 # sample 150 official URLs
//   node scripts/check-link-rot.mjs --sample 300    # sample a different size
//   node scripts/check-link-rot.mjs --all           # check every URL
//   node scripts/check-link-rot.mjs --iso THA       # one country only
//   node scripts/check-link-rot.mjs --all-sources   # include non-official too
//   node scripts/check-link-rot.mjs --concurrency 6 --timeout 8000
//
// Exit code is non-zero when dead links are found (CI-friendly).
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "data", "update-sources.json");

// ---- CLI ------------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) {
  return argv.includes(`--${name}`);
}
function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
}

const CHECK_ALL = flag("all");
const SAMPLE = Number(opt("sample", "150"));
const ISO = (opt("iso", "") || "").toUpperCase();
const INCLUDE_UNOFFICIAL = flag("all-sources");
const CONCURRENCY = Math.max(1, Number(opt("concurrency", "10")));
const TIMEOUT_MS = Math.max(1000, Number(opt("timeout", "10000")));

// ---- Collect the URLs to check --------------------------------------------
let doc;
try {
  doc = JSON.parse(readFileSync(SOURCES, "utf8"));
} catch (err) {
  console.error(`Could not read ${SOURCES}: ${err.message}`);
  console.error("Regenerate it with: node scripts/extract-update-sources.mjs");
  process.exit(2);
}

const index = doc?.index ?? {};
const isoKeys = ISO ? [ISO] : Object.keys(index);
if (ISO && !index[ISO]) {
  console.error(`No country '${ISO}' in the source index. Known example: THA, USA, IND.`);
  process.exit(2);
}

// De-dupe URLs across countries; keep the first country that cites each so the
// report can point at a concrete owner. Official-only by default.
const targets = new Map(); // url -> { iso, name }
for (const iso of isoKeys) {
  const entry = index[iso];
  if (!entry) continue;
  for (const s of entry.sources ?? []) {
    if (!s?.url || typeof s.url !== "string") continue;
    if (!INCLUDE_UNOFFICIAL && s.official === false) continue;
    if (!targets.has(s.url)) targets.set(s.url, { iso, name: entry.name ?? iso });
  }
}

let urls = [...targets.keys()];
// Sample (unless --all or a single --iso, where checking the whole set is the point).
if (!CHECK_ALL && !ISO && urls.length > SAMPLE) {
  // Deterministic evenly-spaced stride so re-runs cover the same slice and
  // don't hammer a random hot subset each time.
  const stride = urls.length / SAMPLE;
  const picked = [];
  for (let i = 0; i < SAMPLE; i++) picked.push(urls[Math.floor(i * stride)]);
  urls = [...new Set(picked)];
}

const scope = ISO ? `country ${ISO}` : CHECK_ALL ? "all countries" : `sample of ${urls.length}`;
console.log(
  `Checking ${urls.length} ${INCLUDE_UNOFFICIAL ? "" : "official "}source URL(s) - ${scope}, ` +
    `concurrency ${CONCURRENCY}, timeout ${TIMEOUT_MS}ms\n`,
);

// ---- One request ----------------------------------------------------------
async function probe(url) {
  const meta = targets.get(url) ?? { iso: ISO || "?", name: ISO || "?" };
  async function once(method) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // A real UA: some gov servers reject the default undici string.
          "User-Agent": "EarthVisa-LinkRotBot/1.0 (+https://earthvisa.in)",
          Accept: "*/*",
        },
      });
      return { status: res.status, ok: res.ok };
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    let r = await once("HEAD");
    // Many servers mishandle HEAD (405/501, or a bogus 4xx); confirm with GET.
    if (r.status === 405 || r.status === 501 || (!r.ok && r.status >= 400)) {
      try {
        r = await once("GET");
      } catch {
        /* keep the HEAD result if GET itself throws */
      }
    }
    const dead = !(r.status >= 200 && r.status < 400);
    return { url, ...meta, status: r.status, dead, error: null };
  } catch (err) {
    const reason = err?.name === "AbortError" ? "timeout" : err?.cause?.code || err?.code || err?.message || "network error";
    return { url, ...meta, status: 0, dead: true, error: String(reason) };
  }
}

// ---- Concurrency pool -----------------------------------------------------
async function run(list) {
  const results = [];
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      const r = await probe(list[i]);
      results[i] = r;
      done++;
      if (r.dead) {
        process.stdout.write(`  DEAD  ${r.status || r.error}  [${r.iso}] ${r.url}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  return { results, done };
}

const { results } = await run(urls);

// ---- Summary --------------------------------------------------------------
const dead = results.filter((r) => r.dead);
const byStatus = new Map();
for (const r of results) {
  const key = r.error ? r.error : String(r.status);
  byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
}

console.log("\n" + "-".repeat(56));
console.log(`Checked : ${results.length}`);
console.log(`Alive   : ${results.length - dead.length}`);
console.log(`Dead    : ${dead.length}`);
console.log("\nBy status/reason:");
for (const [k, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(k).padEnd(24)} ${n}`);
}

if (dead.length) {
  console.log("\nDead links (fix the source in data/countries/<ISO>.json, then");
  console.log("re-run node scripts/extract-update-sources.mjs):");
  for (const r of dead.sort((a, b) => a.iso.localeCompare(b.iso))) {
    console.log(`  [${r.iso}] ${r.status || r.error}  ${r.url}`);
  }
}

// A run where EVERY request failed the same network way usually means the
// environment blocks outbound fetch, not that every source rotted. Say so, but
// still exit non-zero so a real CI run treats dead links as a failure.
const allNetwork = results.length > 0 && dead.length === results.length && dead.every((r) => r.error);
if (allNetwork) {
  console.log(
    "\nNote: every request failed at the network layer - outbound fetch may be " +
      "blocked in this environment rather than the sources being dead.",
  );
}

console.log("");
process.exit(dead.length ? 1 : 0);
