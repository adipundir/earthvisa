#!/usr/bin/env node
// Fetch current exchange rates (base USD) and snapshot them into
// src/data/fx-rates.json. Fees are stored in their ORIGINAL currency in
// data/visa-fees/ - the app converts to USD at render time via this snapshot,
// so approximate-$ figures track reality instead of being hand-baked per fee.
// Re-run periodically (and before deploys): node scripts/update-fx-rates.mjs
// Source: open.er-api.com (free, no key, daily rates).
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "src", "data", "fx-rates.json");
const res = await fetch("https://open.er-api.com/v6/latest/USD");
if (!res.ok) { console.error(`FX fetch failed: HTTP ${res.status}`); process.exit(1); }
const j = await res.json();
if (j.result !== "success" || !j.rates?.USD) { console.error("FX response malformed"); process.exit(1); }

writeFileSync(OUT, JSON.stringify({
  base: "USD",
  // provider's own publication date, not the crawl date
  date: j.time_last_update_utc ?? null,
  rates: j.rates,
}, null, 1) + "\n");
console.log(`src/data/fx-rates.json: ${Object.keys(j.rates).length} currencies, updated ${j.time_last_update_utc}`);
