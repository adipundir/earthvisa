#!/usr/bin/env node
// Compile data/proof-of-funds/*.json into src/data/proof-of-funds.json for the
// app. Keeps official vs community strictly separate; trims long prose.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "data", "proof-of-funds");
const OUT = join(process.cwd(), "src", "data", "proof-of-funds.json");
const FALLBACK_DATE = "2026-07-03"; // crawl date; some records recorded "undefined"
const trim = (s, n = 600) => (typeof s === "string" && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s ?? "");
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
      guidance: trim(o.guidance, 700),
      per_member: Array.isArray(o.per_member)
        ? o.per_member.map((m) => ({
            state: m.state, amount: m.amount ?? null, currency: m.currency ?? null,
            basis: m.basis ?? "per day", note: trim(m.note, 200), source_url: m.source_url ?? null,
          }))
        : [],
    },
    community: {
      typical_approved: trim(d.community?.typical_approved, 500),
      notes: trim(d.community?.notes, 500),
      sources: (d.community?.sources ?? []).slice(0, 6),
    },
    documents: (d.documents ?? []).map((x) => trim(x, 200)).slice(0, 10),
    red_flags: (d.red_flags ?? []).map((x) => trim(x, 200)).slice(0, 8),
    sources: (d.sources ?? []).slice(0, 8),
  };
  if (entry.official.published) official++;
  out[d.key] = entry;
  count++;
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`merged ${count} proof-of-funds records (${official} with a published official figure) → ${OUT}`);
