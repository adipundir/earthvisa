// Finds grants that are PERMISSIVE in structure but EXCLUSIONARY in prose.
//
//   node scripts/audit-exclusions.mjs          # report
//   node scripts/audit-exclusions.mjs --strict # exit 1 if any are found
//
// The failure this exists to catch is the worst one this product has: telling
// someone they may enter a country that will in fact turn them away.
//
// It happens through a specific, repeatable mechanism. A `conditional_access`
// entry says `eligible_nationalities: "any"`, and the exclusion - "does not
// apply to nationals of Turkey and Azerbaijan" - is written only in the
// `conditions` prose. build-dataset.mjs resolves "any" to a null scope, which
// means EVERY nationality, and it never reads prose. The exclusion is therefore
// invisible to the compute engine, and the excluded nationalities are told they
// have access.
//
// The mechanism that fixes it is a structured `excluded_nationalities` list,
// which build-dataset subtracts from the full country set. This script finds
// every entry where the prose asserts an exclusion and that structured list is
// missing or empty - i.e. exactly the entries whose data has not caught up with
// its own note.
//
// It is a DETECTOR, not a fixer. Each hit needs an official source read by a
// human before a name goes in the list, because the conservative direction for
// a doubtful name is to exclude it, and getting that backwards re-grants access.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "countries");

// Phrases that assert "not everyone".
const EXCLUSION_CUES = [
  /\bexcept(?:ing)?\b/i,
  /\bexcluding\b/i,
  /\bdoes not apply to\b/i,
  /\bdo not apply to\b/i,
  /\bnot applicable to\b/i,
  /\bnot available to\b/i,
  /\bother than\b/i,
  /\bwith the exception of\b/i,
  /\b(?:are|is) excluded\b/i,
  /\bineligible\b/i,
  /\bsave for\b/i,
  /\bapart from\b/i,
];

// The country vocabulary, longest name first so "Republic of the Congo" wins
// over "Congo" and "United States" is not eaten by a shorter alias.
const COUNTRIES = JSON.parse(readFileSync(join(ROOT, "data", "countries.json"), "utf8"));

// Short forms that appear in official prose but are not the canonical name.
// Without these the detector misses real exclusions: Macao's diplomatic waiver
// reads "(any nationality except US)", and "US" matches no country name.
const ALIASES = [
  "US", "USA", "U.S.", "U.S.A.", "America",
  "UK", "U.K.", "Britain", "Great Britain",
  "UAE", "Emirates",
  "DRC", "DR Congo",
  "PRC", "Mainland China",
  "North Korea", "South Korea",
  "Palestine State", "State of Palestine",
  "Russia", "Turkey", "Türkiye", "Syria", "Burma", "Ivory Coast",
  "Czechia", "Holland", "Vatican", "Cape Verde", "Swaziland", "Macedonia",
];

const NAMES = [...COUNTRIES.map((c) => c.name), ...ALIASES]
  .sort((a, b) => b.length - a.length);
const NAME_RE = new RegExp(
  `\\b(${NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "g",
);

// A cue alone means nothing - "non-convertible except for medical emergencies"
// and "issued by another EU Member State (excluding Ireland and Denmark)" both
// match one, and neither excludes a NATIONALITY. What matters is whether the
// clause the cue introduces names countries AND is talking about people rather
// than about which state issued the document or which passport class it is.
const PASSPORT_CLASS_RE = /\b(diplomatic|official|service|emergency|temporary|alien'?s?|refugee|stateless)\b.{0,24}\b(passport|travel document|document)/i;
const ISSUER_CONTEXT_RE = /\b(issued|granted|delivered)\s+by\b|\bmember state\b|\bissuing\b/i;
const PERSON_CONTEXT_RE = /\b(national|citizen|passport holder|holder|person|traveller|traveler|applicant)s?\b/i;

/** The text a cue introduces: from the cue to the end of that clause. */
function clauseAfter(prose, cueMatchIndex) {
  const rest = prose.slice(cueMatchIndex);
  const end = rest.search(/[.;|]|$/);
  return rest.slice(0, end === -1 ? rest.length : end);
}

/**
 * Classifies one entry's prose. Returns null when nothing worrying is said,
 * otherwise { confidence, names, clause }.
 *
 * high   - the clause names countries and is about people. This is the CYP
 *          shape ("does NOT apply to nationals of Turkey and Azerbaijan") and
 *          is almost certainly a real false-permissive grant.
 * low    - a cue and country names, but the clause reads as being about the
 *          issuing state or the passport class, which are different mechanisms
 *          (passport_type basis, or simply which credential is accepted).
 */
function classify(prose) {
  for (const cue of EXCLUSION_CUES) {
    const m = cue.exec(prose);
    if (!m) continue;
    const clause = clauseAfter(prose, m.index);
    const names = [...new Set(clause.match(NAME_RE) || [])];
    if (!names.length) continue;

    // "Not applicable to diplomatic or official passport holders" is handled by
    // the passport_type basis, not by excluded_nationalities.
    if (PASSPORT_CLASS_RE.test(clause) && !PERSON_CONTEXT_RE.test(clause.replace(PASSPORT_CLASS_RE, "")))
      continue;

    const aboutIssuer = ISSUER_CONTEXT_RE.test(clause);
    const aboutPeople = PERSON_CONTEXT_RE.test(clause);
    if (aboutIssuer && !aboutPeople) return { confidence: "low", names, clause };
    return { confidence: aboutPeople ? "high" : "low", names, clause };
  }
  return null;
}

// An entry is "broadcast to everyone" when the scope label means any. This
// mirrors resolveNatList's own rule: null/absent, or the literal word "any".
const isAnyScope = (v) =>
  v == null || (typeof v === "string" && /^any$/i.test(v.trim()));

const proseOf = (entry) =>
  [
    entry.conditions,
    entry.notes,
    entry.credential?.subtype,
    entry.credential?.issuer,
    entry.label,
  ]
    .filter((s) => typeof s === "string" && s)
    .join(" | ");

const hits = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const iso3 = file.replace(/\.json$/, "");
  let doc;
  try {
    doc = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (err) {
    hits.push({ iso3, where: file, kind: "unparseable", detail: String(err) });
    continue;
  }

  const ca = Array.isArray(doc.conditional_access) ? doc.conditional_access : [];
  ca.forEach((entry, i) => {
    if (!isAnyScope(entry.eligible_nationalities)) return; // scoped: not a broadcast

    const excluded = entry.excluded_nationalities;
    const hasStructured = Array.isArray(excluded) && excluded.length > 0;

    const prose = proseOf(entry);
    const verdict = classify(prose);

    if (verdict && !hasStructured) {
      hits.push({
        iso3,
        where: `conditional_access[${i}]`,
        confidence: verdict.confidence,
        kind: Array.isArray(excluded)
          ? "empty excluded_nationalities, prose names excluded countries"
          : "prose excludes nationalities, no excluded_nationalities",
        basis: entry.basis || "(none)",
        level: entry.level || "(none)",
        names: verdict.names,
        detail: verdict.clause.slice(0, 200),
      });
    }

    // An empty array is worse than a missing one: it reads as "we checked and
    // nobody is excluded", and build-dataset's `if (excluded.size)` guard means
    // it silently widens the grant back to everyone.
    if (!verdict && Array.isArray(excluded) && excluded.length === 0) {
      hits.push({
        iso3,
        where: `conditional_access[${i}]`,
        confidence: "high",
        kind: "empty excluded_nationalities widens an 'any' grant back to everyone",
        basis: entry.basis || "(none)",
        level: entry.level || "(none)",
        names: [],
        detail: prose.slice(0, 200),
      });
    }

    // build-dataset honours excluded_nationalities ONLY for credential-basis
    // entries. A structured list on any other basis is silently ignored, which
    // looks handled in the data and is not.
    if (hasStructured && entry.basis !== "credential") {
      hits.push({
        iso3,
        where: `conditional_access[${i}]`,
        kind: `excluded_nationalities ignored: build-dataset honours it only for basis="credential", this is "${entry.basis}"`,
        basis: entry.basis || "(none)",
        level: entry.level || "(none)",
        detail: prose.slice(0, 220),
      });
    }
  });

  // CBI bans are a separate code path with the same failure mode.
  const cbi = doc.cbi || {};
  if (cbi.has_program) {
    const prose = [cbi.notes, cbi.eligibility].filter(Boolean).join(" | ");
    const hasStructured =
      Array.isArray(cbi.excluded_nationalities) && cbi.excluded_nationalities.length > 0;
    const verdict = classify(prose);
    if (verdict && !hasStructured) {
      hits.push({
        iso3,
        where: "cbi",
        confidence: verdict.confidence,
        kind: "CBI prose names banned nationalities, no excluded_nationalities",
        basis: "cbi",
        level: "-",
        names: verdict.names,
        detail: verdict.clause.slice(0, 200),
      });
    }
  }
}

if (hits.length === 0) {
  console.log("no unscoped grants with exclusionary prose");
  process.exit(0);
}

const byCountry = new Map();
for (const h of hits) {
  if (!byCountry.has(h.iso3)) byCountry.set(h.iso3, []);
  byCountry.get(h.iso3).push(h);
}

const high = hits.filter((h) => h.confidence === "high");
console.log(
  `${hits.length} suspect grant(s) across ${byCountry.size} countr(y/ies) - ` +
    `${high.length} high confidence, ${hits.length - high.length} to triage\n`,
);
for (const level of ["high", "low"]) {
  const group = [...byCountry].filter(([, l]) => l.some((h) => h.confidence === level));
  if (!group.length) continue;
  console.log(level === "high"
    ? "── HIGH: prose names nationalities that structure still grants ──\n"
    : "\n── LOW: cue names countries but reads as issuer/passport-class, triage by hand ──\n");
  for (const [iso3, list] of group.sort()) {
    const rows = list.filter((h) => h.confidence === level);
    if (!rows.length) continue;
    console.log(`${iso3}  (${rows.length})`);
    for (const h of rows) {
      console.log(`  ${h.where}  [${h.basis}/${h.level}]  ${h.kind}`);
      if (h.names.length) console.log(`    names: ${h.names.join(", ")}`);
      console.log(`    "${h.detail.replace(/\s+/g, " ")}"`);
    }
    console.log();
  }
}

// --strict fails only on HIGH. The low-confidence bucket is a triage queue, and
// a check that cannot be made green is a check people learn to ignore.
if (process.argv.includes("--strict") && high.length) process.exit(1);
