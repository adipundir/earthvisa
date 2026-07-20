// Generates data/update-sources.json - the central index of every official
// source URL the dataset is built from, grouped per country. This answers
// "which links do we look at when updating the database?" without creating a
// hand-maintained registry: the country JSONs stay the single source of truth
// (sources_checked, source_url fields, official_domains, visa_types
// official_url) and this file is DERIVED from them. Re-run after any data
// change: node scripts/extract-update-sources.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "countries");
const OUT = join(ROOT, "data", "update-sources.json");

const index = {};
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  let d;
  try { d = JSON.parse(readFileSync(join(DIR, f), "utf8")); } catch { continue; }
  if (!d?.iso3) continue;

  const urls = new Map(); // url -> { description, official, contexts:Set }
  const add = (url, description, official, context) => {
    if (!url || typeof url !== "string" || !url.startsWith("http")) return;
    const u = url.trim();
    if (!urls.has(u)) urls.set(u, { description: description || "", official: official !== false, contexts: new Set() });
    const e = urls.get(u);
    if (description && description.length > (e.description?.length ?? 0)) e.description = description;
    e.contexts.add(context);
  };
  // Is a host a government / mission source? Used to flag string-form sources_checked
  // entries, which carry no explicit `official` field (unlike the object form).
  const isGovHost = (url) => {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return /(^|\.)(gov|gouv|gob|govt)(\.[a-z]{2,})*$/.test(h) || /\.gov\.[a-z]{2,}$/.test(h) ||
        /(^|\.)(mfa|mofa|embassy|consulate|immigration|migration|evisa|e-visa)\./.test(h);
    } catch { return false; }
  };

  // sources_checked appears in BOTH shapes across the dataset: {url,description,official}
  // objects (54 files) and bare URL strings (145 files). The string form was silently
  // dropped here (s.url === undefined), losing ~3300 source URLs from the maintenance
  // index. Handle both; derive `official` from the host for the flagless string form.
  for (const s of d.sources_checked ?? []) {
    if (typeof s === "string") add(s, "", isGovHost(s), "sources_checked");
    else if (s && typeof s === "object") add(s.url, s.description, s.official, "sources_checked");
  }
  for (const v of d.visa_types ?? []) add(v.official_url, `${v.name} official page`, true, "visa_types");
  for (const n of d.advance_visa_notes ?? []) add(n.source_url, `Advance-visa note (${(n.nationalities_iso3 ?? []).join(", ")})`, n.source_official, "advance_visa_notes");
  const walk = (node, context) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, context));
    if (node && typeof node === "object") {
      if (node.source_url) add(node.source_url, node.notes?.slice(0, 120), node.source_official, context);
      if (node.official_url && context !== "visa_types") add(node.official_url, node.notes?.slice(0, 120), true, context);
      for (const [k, v] of Object.entries(node)) {
        if (k === "source_url" || k === "official_url") continue;
        walk(v, context);
      }
    }
  };
  walk(d.visa_policy, "visa_policy");
  walk(d.conditional_access, "conditional_access");
  walk(d.cbi, "cbi"); walk(d.rbi, "rbi"); walk(d.fast_track, "fast_track");

  index[d.iso3] = {
    name: d.name,
    official_domains: d.official_domains ?? [],
    source_count: urls.size,
    sources: [...urls.entries()].map(([url, e]) => ({
      url,
      description: e.description,
      official: e.official,
      used_in: [...e.contexts].sort(),
    })),
  };
}

const total = Object.values(index).reduce((s, c) => s + c.source_count, 0);
writeFileSync(OUT, JSON.stringify({
  _readme: "GENERATED FILE - do not hand-edit. Central index of every official source URL per country, derived from data/countries/*.json (the single source of truth). Regenerate: node scripts/extract-update-sources.mjs. Use this to find which pages to re-check when updating a country's visa data.",
  generated_from: "data/countries/*.json",
  countries: Object.keys(index).length,
  total_source_urls: total,
  index,
}, null, 1) + "\n");
console.log(`data/update-sources.json: ${Object.keys(index).length} countries, ${total} source URLs`);
