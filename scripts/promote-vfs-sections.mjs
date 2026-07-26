#!/usr/bin/env node
/**
 * Promote the useful sections still buried in each VFS record's `full_text`
 * into real fields, then drop `full_text` itself.
 *
 * Why. scripts/vfs-crawl.mjs stores every visa type twice: once as promoted
 * fields (documents_required, visa_fees, processing_time, forms, overview,
 * insurance) and once as the raw `full_text` those fields were parsed out of.
 * Measured across data/vfs: full_text is 55.1 MB, and 74% of it (40.8 MB) is a
 * verbatim re-store of the promoted fields. Two representations of one fact in
 * one file is the single-source-of-truth problem in miniature - if they ever
 * disagree, nothing says which wins.
 *
 * Of the 25% that was NOT already promoted, photo requirements are half of it
 * (7.3 MB across 7,797 records) and were being re-parsed out of full_text at
 * render time on every build. Application-form instructions and eligibility
 * criteria are the next two.
 *
 * What is lost: roughly 5 MB of long-tail sections (per-corridor FAQs, service-fee
 * restatements, photo sub-headings). Recovery paths, in order of cost: git
 * history still holds every byte, and scripts/vfs-crawl.mjs is idempotent and
 * can re-fetch a corridor.
 *
 * Idempotent: running it twice is a no-op, because records that already have the
 * promoted fields and no full_text are skipped.
 *
 * Usage:
 *   node scripts/promote-vfs-sections.mjs --dry-run   report, write nothing
 *   node scripts/promote-vfs-sections.mjs             migrate in place
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "vfs");
const DRY = process.argv.includes("--dry-run");

/**
 * Heading spellings VFS uses for the same thing, in priority order. The first
 * match wins, so a record carrying both "Photo Specifications" and the narrower
 * "Photograph Quality" keeps the fuller one.
 */
const SECTIONS = [
  {
    field: "photo_specifications",
    headings: [
      /^photo specifications?$/i,
      /^photo specifications? and fingerprints$/i,
      /^photograph quality$/i,
    ],
  },
  {
    field: "application_form",
    headings: [/^(?:visa |online )?application forms?$/i],
  },
  {
    field: "eligibility",
    headings: [/^eligibility criteria$/i, /^who (?:should|can) apply\??$/i],
  },
];

/** Body of the first matching heading, up to the next heading of any level. */
function sectionBody(fullText, patterns) {
  if (typeof fullText !== "string") return "";
  const lines = fullText.split("\n");
  for (const rx of patterns) {
    const start = lines.findIndex((l) => {
      const m = /^#{1,6}[ \t]*(.+?)[ \t]*:?[ \t]*$/.exec(l.trim());
      return m ? rx.test(m[1].trim()) : false;
    });
    if (start < 0) continue;
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i])) break;
      body.push(lines[i]);
    }
    const text = body.join("\n").trim();
    if (text) return text;
  }
  return "";
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "_index.json").sort();
let touchedFiles = 0;
let recordsMigrated = 0;
let bytesBefore = 0;
let bytesAfter = 0;
const promoted = Object.fromEntries(SECTIONS.map((s) => [s.field, 0]));

for (const file of files) {
  const path = join(DIR, file);
  const before = readFileSync(path, "utf8");
  bytesBefore += Buffer.byteLength(before);
  let doc;
  try {
    doc = JSON.parse(before);
  } catch {
    console.error(`skip ${file}: bad JSON`);
    bytesAfter += Buffer.byteLength(before);
    continue;
  }

  let changed = false;
  for (const v of doc.visa_types ?? []) {
    if (!("full_text" in v)) continue;
    for (const { field, headings } of SECTIONS) {
      const body = sectionBody(v.full_text, headings);
      if (body) {
        v[field] = body;
        promoted[field]++;
      } else if (!(field in v)) {
        // Explicit null, not an absent key: "we looked and there was nothing"
        // is different from "this record predates the field".
        v[field] = null;
      }
    }
    delete v.full_text;
    recordsMigrated++;
    changed = true;
  }

  if (!changed) {
    bytesAfter += Buffer.byteLength(before);
    continue;
  }
  const after = JSON.stringify(doc, null, 2) + "\n";
  bytesAfter += Buffer.byteLength(after);
  touchedFiles++;
  if (!DRY) writeFileSync(path, after);
}

const mb = (b) => (b / 1048576).toFixed(1);
console.log(`${DRY ? "[dry run] " : ""}vfs section promotion`);
console.log(`  files touched     : ${touchedFiles} of ${files.length}`);
console.log(`  records migrated  : ${recordsMigrated}`);
for (const [field, n] of Object.entries(promoted)) {
  console.log(`    ${field.padEnd(22)} ${n} populated`);
}
console.log(`  data/vfs size     : ${mb(bytesBefore)} MB -> ${mb(bytesAfter)} MB (${mb(bytesBefore - bytesAfter)} MB removed)`);
if (DRY) console.log("\n  nothing written - drop --dry-run to apply");
