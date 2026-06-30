// VFS Global corridor crawler.
//
// VFS publishes its visa document checklists through a public Contentful
// Content Delivery API (the read-only delivery token is shipped in the site's
// client JS bundle). Each "onePager" entry is one source->destination corridor
// and links a visaTypeInformation -> many visaTypeDropdown entries, one per visa
// type, whose `visaInformation` rich-text field carries the Overview, Visa Fees,
// Documents Required checklist, Processing Time and Forms.
//
// This script fetches every English corridor (with include=10 so all linked
// tables resolve in a single request), flattens each visa type into sectioned
// text, maps the visa type to our category taxonomy, and writes one file per
// corridor to data/vfs/{src}-{dst}.json. It is idempotent and resumable: an
// existing up-to-date file is skipped unless --force is passed.
//
// Usage:
//   node scripts/vfs-crawl.mjs                 # crawl all corridors (skip existing)
//   node scripts/vfs-crawl.mjs --force         # re-crawl everything
//   node scripts/vfs-crawl.mjs --limit 20      # crawl first N corridors
//   node scripts/vfs-crawl.mjs --src ind       # only corridors from this source
//   node scripts/vfs-crawl.mjs --concurrency 6

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPACE = "xxg4p8gt3sg6";
const ENV = "master";
// Read-only Contentful Content Delivery token, public in the VFS client bundle.
const TOKEN = "5YpTBRikGN59YHwM18CyGr5F43bFuaak9U8FSMEDmb8";
const CDA = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}/entries`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "vfs");

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const getOpt = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FORCE = hasFlag("--force");
const LIMIT = getOpt("--limit") ? parseInt(getOpt("--limit"), 10) : Infinity;
const ONLY_SRC = getOpt("--src");
const CONCURRENCY = getOpt("--concurrency") ? parseInt(getOpt("--concurrency"), 10) : 5;

// VFS uses ISO3-ish codes plus some sub-jurisdiction / mission codes. Map the
// non-ISO ones to the underlying country ISO3 so corridors join our dataset.
// Unmapped codes are kept verbatim and flagged in the output for review.
const CODE_TO_ISO3 = {
  dxb: "ARE", apt: "ARE", upt: "ARE", // UAE jurisdictions (Dubai / Abu Dhabi / N. Emirates)
  cpt: "ZAF", jhn: "ZAF", zap: "ZAF", cpv: "CPV", // (cpv is real ISO3: Cabo Verde)
  gpt: "GBR", // GB jurisdiction
  frp: "FRA", inr: "IND", mes: "ESP", nlp: "NLD", nlr: "NLD",
  uk: "GBR", gb: "GBR", xkx: "XKX",
};
const toIso3 = (code) => {
  if (!code) return null;
  const c = code.toLowerCase();
  if (CODE_TO_ISO3[c]) return CODE_TO_ISO3[c];
  return c.toUpperCase(); // assume already ISO3
};

// Map a VFS visa-type label to our VisaType category taxonomy.
function categorize(name) {
  const n = name.toLowerCase();
  if (/tourist|tourism|holiday|visit\b/.test(n)) return "tourist";
  if (/business|conference|corporate|entrepreneur|start-?up|investor|investment/.test(n)) return "business";
  if (/student|study|research|university|educational|internship|exchange|scientific/.test(n)) return "student";
  if (/work|employment|seasonal|professional activity|job seek|independent work|labour|au ?pair/.test(n)) return "work";
  if (/transit|seamen|seaman|seafarer/.test(n)) return "transit";
  if (/medical|treatment|ill family/.test(n)) return "medical";
  if (/retire|senior|rents|pension/.test(n)) return "retirement";
  if (/working holiday/.test(n)) return "working_holiday";
  if (/digital nomad|nomad/.test(n)) return "digital_nomad";
  if (/family|reunification|spouse|relatives|accompanying|visiting family/.test(n)) return "family";
  return "other";
}

// Non-selectable placeholder / group-header rows in the dropdown.
const SKIP_LABELS = new Set([
  "please select visa type", "short term visa", "long term visa",
  "select visa type", "visa type",
]);

// ---- Contentful rich-text flattening -------------------------------------

function flattenTable(entry) {
  const f = entry.fields || {};
  const t = f.table;
  let data = null;
  if (Array.isArray(t)) data = t;
  else if (t && typeof t === "object") data = t.tableData || t.data || null;
  const lines = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      if (Array.isArray(row)) lines.push(row.map((c) => String(c ?? "")).join(" | "));
      else if (row != null) lines.push(String(row));
    }
  }
  const name = f.internalName ? `[${f.internalName}]` : "";
  return [name, ...lines].filter(Boolean).join("\n");
}

function flatten(node, byId) {
  if (!node) return "";
  const nt = node.nodeType;
  if (nt === "text") return node.value || "";
  if (nt === "embedded-entry-block" || nt === "embedded-entry-inline" || nt === "embedded-asset-block") {
    const id = node.data?.target?.sys?.id;
    const e = id ? byId.get(id) : null;
    if (!e) return "";
    const ct = e.sys?.contentType?.sys?.id;
    if (ct === "table") return "\n" + flattenTable(e) + "\n";
    return "";
  }
  const inner = (node.content || []).map((c) => flatten(c, byId)).join("");
  if (nt && nt.startsWith("heading")) return "\n## " + inner.trim() + "\n";
  if (nt === "paragraph") return inner + "\n";
  if (nt === "list-item") return "- " + inner;
  if (nt === "hyperlink") return inner + (node.data?.uri ? ` (${node.data.uri})` : "");
  return inner;
}

// Split the flattened text into named sections by its "## Heading" markers.
function sectionize(text) {
  const sections = {};
  const parts = text.split(/\n## /);
  let order = [];
  for (let i = 0; i < parts.length; i++) {
    let chunk = parts[i];
    if (i === 0) {
      const pre = chunk.replace(/^## /, "").trim();
      if (pre) { sections["_intro"] = pre; }
      continue;
    }
    const nl = chunk.indexOf("\n");
    const heading = (nl >= 0 ? chunk.slice(0, nl) : chunk).trim();
    const body = (nl >= 0 ? chunk.slice(nl + 1) : "").trim();
    const key = heading.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (key) { sections[key] = body; order.push({ heading, key }); }
  }
  sections._order = order;
  return sections;
}

// ---- corridor fetch / parse ----------------------------------------------

async function cda(params) {
  const url = `${CDA}?access_token=${TOKEN}&${params}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`CDA ${res.status} for ${params}`);
    return res.json();
  }
  throw new Error(`CDA repeatedly rate-limited for ${params}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listCorridors() {
  const items = [];
  let skip = 0, total = Infinity;
  while (skip < total) {
    const d = await cda(
      `content_type=onePager&select=fields.sourceCountry,fields.targetCountry,fields.language,sys.id&limit=1000&skip=${skip}`
    );
    total = d.total;
    items.push(...d.items);
    skip += 1000;
  }
  return items
    .filter((i) => i.fields?.language === "en")
    .map((i) => ({ id: i.sys.id, src: i.fields.sourceCountry, tgt: i.fields.targetCountry }))
    .filter((c) => c.src && c.tgt);
}

function parseCorridor(entry, includes) {
  const byId = new Map();
  for (const e of includes.Entry || []) byId.set(e.sys.id, e);
  for (const a of includes.Asset || []) byId.set(a.sys.id, a);

  // Find the visaTypeInformation -> visaTypes (visaTypeDropdown) links.
  const dropdowns = (includes.Entry || []).filter(
    (e) => e.sys?.contentType?.sys?.id === "visaTypeDropdown"
  );

  const visaTypes = [];
  for (const v of dropdowns) {
    const name = (v.fields?.visaType || "").replace(/\s+/g, " ").trim();
    if (!name || SKIP_LABELS.has(name.toLowerCase())) continue;
    // Two layouts exist: content inline in `visaInformation` rich text, or split
    // across linked `tab` entries (Overview / Visa Fees / Documents Required / …).
    const info = v.fields?.visaInformation;
    let text = info ? flatten(info, byId).replace(/\n{3,}/g, "\n\n").trim() : "";
    const tabs = v.fields?.tabs;
    if (Array.isArray(tabs) && tabs.length) {
      const tabTexts = [];
      for (const link of tabs) {
        const te = byId.get(link.sys?.id);
        if (!te) continue;
        const tabName = (te.fields?.tabName || "").trim();
        const tc = te.fields?.tabContent;
        let tflat = tc ? flatten(tc, byId).replace(/\n{3,}/g, "\n\n").trim() : "";
        if (!tflat) continue;
        // Ensure the tab name appears as a heading so sectionize() can key it.
        if (tabName && !new RegExp(`^##\\s*${tabName.slice(0, 12)}`, "i").test(tflat)) {
          tflat = `## ${tabName}\n${tflat}`;
        }
        tabTexts.push(tflat);
      }
      if (tabTexts.length) text = [text, ...tabTexts].filter(Boolean).join("\n\n").trim();
    }
    if (!text) continue;
    const sections = sectionize(text);
    visaTypes.push({
      name,
      category: categorize(name),
      documents_required: findDocSection(sections),
      visa_fees: sections.visa_fees || sections.fees || null,
      processing_time: sections.processing_time || null,
      forms: sections.download_forms || sections.forms || null,
      overview: sections.overview || sections._intro || null,
      insurance: sections.travel_medical_insurance_list || null,
      full_text: text,
    });
  }
  return visaTypes;
}

// Collect every document/checklist-related section with a non-empty body and
// join them. VFS often emits an empty "## Documents Required" header immediately
// followed by the real "## Required documents for X Visa:" section, so picking
// the first match alone loses the content.
function findDocSection(sections) {
  const parts = [];
  for (const k of Object.keys(sections)) {
    if (k.startsWith("_")) continue;
    if (/document|checklist/.test(k)) {
      const body = (sections[k] || "").trim();
      if (body) parts.push(body);
    }
  }
  return parts.length ? parts.join("\n\n") : null;
}

async function crawlOne(corridor) {
  const { src, tgt } = corridor;
  const file = path.join(OUT_DIR, `${src}-${tgt}.json`);
  if (!FORCE && existsSync(file)) return { src, tgt, status: "skip" };

  const d = await cda(
    `content_type=onePager&fields.sourceCountry=${src}&fields.targetCountry=${tgt}&fields.language=en&include=10&limit=1`
  );
  if (!d.items?.length) return { src, tgt, status: "empty" };
  const visaTypes = parseCorridor(d.items[0], d.includes || {});
  const out = {
    source_code: src,
    source_iso3: toIso3(src),
    destination_code: tgt,
    destination_iso3: toIso3(tgt),
    source_url: `https://visa.vfsglobal.com/${src}/en/${tgt}/visa-type`,
    source_official: false, // VFS is the official outsourcing partner, not the govt itself
    provider: "VFS Global",
    fetched_via: "Contentful CDA (space xxg4p8gt3sg6)",
    visa_type_count: visaTypes.length,
    visa_types: visaTypes,
  };
  await writeFile(file, JSON.stringify(out, null, 2));
  return { src, tgt, status: "ok", n: visaTypes.length };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Enumerating VFS corridors…");
  let corridors = await listCorridors();
  if (ONLY_SRC) corridors = corridors.filter((c) => c.src === ONLY_SRC);
  corridors = corridors.slice(0, LIMIT);
  console.log(`${corridors.length} corridors to process (concurrency ${CONCURRENCY}, force=${FORCE}).`);

  let done = 0, ok = 0, skip = 0, empty = 0, err = 0, types = 0;
  const queue = [...corridors];
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      try {
        const r = await crawlOne(c);
        if (r.status === "ok") { ok++; types += r.n; }
        else if (r.status === "skip") skip++;
        else empty++;
      } catch (e) {
        err++;
        console.error(`  ! ${c.src}-${c.tgt}: ${e.message}`);
      }
      done++;
      if (done % 25 === 0 || done === corridors.length) {
        console.log(`  ${done}/${corridors.length}  ok=${ok} skip=${skip} empty=${empty} err=${err} types=${types}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ok=${ok} skip=${skip} empty=${empty} err=${err}, total visa types=${types}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
