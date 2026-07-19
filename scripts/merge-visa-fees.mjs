#!/usr/bin/env node
// Compile data/visa-fees/*.json (one file per destination, written by the fee
// crawl) into a single src/data/visa-fees.json consumed by the app at build
// time. Keeps the headline fee kinds and trims long notes so the merged file
// stays small; the raw per-country files remain the source of truth.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "data", "visa-fees");
const OUT = join(process.cwd(), "src", "data", "visa-fees.json");
// Trim overlong prose at the last sentence boundary before the cap - never mid-word/mid-clause,
// which used to leave dangling "…" fragments (and drop caveats) in rendered fee callouts.
const trim = (s, n = 900) => {
  if (typeof s !== "string") return s ?? "";
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = cut.lastIndexOf(". ");
  return at > n * 0.4 ? cut.slice(0, at + 1) : cut.slice(0, n - 1).trimEnd() + "…";
};

const out = {};
let files = 0, fees = 0, vfsCount = 0;
for (const f of readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
  let d;
  try { d = JSON.parse(readFileSync(join(SRC, f), "utf8")); } catch { console.error(`skip ${f}: invalid JSON`); continue; }
  if (!d?.iso3) { console.error(`skip ${f}: no iso3`); continue; }
  const entry = {
    updated: d.updated ?? null,
    confidence: d.confidence ?? "low",
    fees: (d.fees ?? [])
      .filter((x) => x && x.kind)
      .map((x) => ({
        kind: x.kind,
        name: typeof x.name === "string" ? x.name : "",
        amount: typeof x.amount === "number" ? x.amount : null,
        currency: x.currency ?? null,
        amount_usd: typeof x.amount_usd === "number" ? x.amount_usd : null,
        validity: trim(x.validity, 200) || null,
        official: !!x.official,
        source_url: x.source_url ?? null,
        notes: trim(x.notes),
        // when present, this fee row only applies to (and only renders for) these nationalities
        ...(Array.isArray(x.applies_nationalities) && x.applies_nationalities.length ? { applies_nationalities: x.applies_nationalities } : {}),
      })),
    variations: (d.reciprocity_variations ?? [])
      .filter((v) => v && Array.isArray(v.nationalities))
      .map((v) => ({
        nationalities: v.nationalities,
        kind: v.kind ?? null,
        amount: typeof v.amount === "number" ? v.amount : null,
        currency: v.currency ?? null,
        note: trim(v.note),
        ...(v.source_url ? { source_url: v.source_url } : {}),
        // itemized per-category schedule (entries/duration tiers) in the variation's currency
        ...(Array.isArray(v.items) && v.items.length
          ? { items: v.items.filter((it) => it && typeof it.amount === "number" && it.label).map((it) => ({ label: String(it.label), amount: it.amount })) }
          : {}),
      })),
    vfs: d.vfs?.used
      ? {
          used: true,
          operator: d.vfs.operator ?? "VFS Global",
          service_fee: d.vfs.service_fee != null ? String(d.vfs.service_fee) : null,
          currency: d.vfs.currency ?? null,
          note: trim(d.vfs.note),
          source_url: d.vfs.source_url ?? null,
        }
      : { used: false },
    free_visa_notes: trim(d.free_visa_notes, 1500),
  };
  out[d.iso3] = entry;
  files++; fees += entry.fees.length; if (entry.vfs.used) vfsCount++;
}
writeFileSync(OUT, JSON.stringify(out));
console.log(`merged ${files} destinations, ${fees} fees, ${vfsCount} with VFS/outsourced centres → ${OUT}`);
