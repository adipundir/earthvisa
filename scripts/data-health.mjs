// Data-freshness report. There was no way to see how stale the dataset was;
// this surfaces it. Run: node scripts/data-health.mjs
//   --stale <days>   flag countries whose data file hasn't changed in N days (default 120)
//   --top <n>        show the N oldest countries (default 20)
//
// Freshness comes from dataset.meta + per-country git commit dates already baked
// into dataset.countryLastUpdated by scripts/build-dataset.mjs (rebuild first for
// current numbers). Link-rot checking of the 5k+ source URLs is intentionally a
// separate scheduled job, not this synchronous local report.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), "utf8"));

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};
const staleDays = arg("--stale", 120);
const top = arg("--top", 20);

const NOW = Date.now();
const ageDays = (iso) => (Number.isNaN(Date.parse(iso)) ? Infinity : (NOW - Date.parse(iso)) / 86_400_000);

// FX snapshot
const fx = readJson("src/data/fx-rates.json");
const fxAge = Math.round(ageDays(fx.date));
console.log(`FX snapshot: ${fx.date}  (${fxAge} days old)${fxAge > 45 ? "  ⚠ run scripts/update-fx-rates.mjs" : ""}`);

// Per-country freshness from the built dataset
const ds = readJson("src/data/dataset.json");
console.log(`Dataset built: ${ds.meta.lastUpdated} · ${ds.meta.totalCountries} countries · ${ds.meta.destinationsWithVisaPolicy} with enumerated policy`);

const lu = ds.countryLastUpdated || {};
const rows = Object.entries(lu)
  .map(([iso, date]) => ({ iso, date, age: Math.round(ageDays(date)) }))
  .sort((a, b) => b.age - a.age);

const stale = rows.filter((r) => r.age >= staleDays);
console.log(`\nOldest ${Math.min(top, rows.length)} country data files:`);
for (const r of rows.slice(0, top)) console.log(`  ${r.iso}  ${r.date}  (${r.age}d)`);
console.log(`\n${stale.length} countr${stale.length === 1 ? "y" : "ies"} not updated in >= ${staleDays} days.`);
if (!rows.length) console.log("  (no countryLastUpdated in dataset - rebuild with scripts/build-dataset.mjs)");

// exit non-zero if anything is materially stale, so CI/cron can alert on it
process.exit(fxAge > 60 || stale.length > 0 ? 1 : 0);
