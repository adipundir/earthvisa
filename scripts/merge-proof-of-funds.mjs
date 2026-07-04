#!/usr/bin/env node
// Compile data/proof-of-funds/*.json into src/data/proof-of-funds.json for the
// app. Keeps official vs community strictly separate; trims long prose.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "data", "proof-of-funds");
const OUT = join(process.cwd(), "src", "data", "proof-of-funds.json");
const FALLBACK_DATE = "2026-07-03"; // crawl date; some records recorded "undefined"
// Official guidance must never be clipped mid-sentence: caps sit above the longest curated
// string, and the post-merge audit below fails the build if any output still ends in "…".
const trim = (s, n = 1200) => (typeof s === "string" && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s ?? "");
const fixDate = (d) => (d && d !== "undefined" ? d : FALLBACK_DATE);

const out = {};
let count = 0, official = 0;
for (const f of readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
  let d;
  try { d = JSON.parse(readFileSync(join(SRC, f), "utf8")); } catch { console.error(`skip ${f}: bad JSON`); continue; }
  if (!d?.key) { console.error(`skip ${f}: no key`); continue; }
  const o = d.official ?? {};
  const entry = {
    key: d.key,
    name: d.name ?? d.key,
    visa: d.visa ?? "",
    scope: d.scope ?? "country",
    updated: fixDate(d.updated),
    confidence: d.confidence ?? "medium",
    official: {
      published: !!o.published,
      daily_minimum: o.daily_minimum ?? null,
      total_example: o.total_example ?? null,
      guidance: trim(o.guidance),
      per_member: Array.isArray(o.per_member)
        ? o.per_member.map((m) => ({
            state: m.state, amount: m.amount ?? null, currency: m.currency ?? null,
            basis: m.basis ?? "per day", note: trim(m.note, 400), source_url: m.source_url ?? null,
          }))
        : [],
    },
    community: {
      typical_approved: trim(d.community?.typical_approved),
      notes: trim(d.community?.notes),
      sources: (d.community?.sources ?? []).slice(0, 6),
    },
    documents: (d.documents ?? []).map((x) => trim(x, 400)).slice(0, 16),
    red_flags: (d.red_flags ?? []).map((x) => trim(x, 400)).slice(0, 12),
    sources: (d.sources ?? []).slice(0, 8),
  };
  if (entry.official.published) official++;
  out[d.key] = entry;
  count++;
}
// sanity audit: no merged string may end mid-sentence with a truncation ellipsis
const clipped = [];
(function walk(node, path) {
  if (typeof node === "string") { if (node.endsWith("…")) clipped.push(path); return; }
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (node && typeof node === "object") for (const k of Object.keys(node)) walk(node[k], `${path}.${k}`);
})(out, "");
if (clipped.length) {
  console.error(`ERROR: ${clipped.length} merged string(s) truncated with "…" - raise the cap or shorten the canonical text:`);
  clipped.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`merged ${count} proof-of-funds records (${official} with a published official figure) → ${OUT}`);
