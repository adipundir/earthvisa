# 🐋 Project Bluewhale

Pick your citizenship(s) and instantly see what your passport unlocks — **visa-free travel**,
**freedom-of-movement** rights, **citizenship-by-investment**, **golden visas**, and **fast-track
immigration** programs — built from **official government & immigration sources**.

## How the data is built

The hard constraint: facts come from official government / immigration / foreign-ministry / official
program websites — not aggregators. Each datum carries its exact source URL and an `official` flag.

Governments rarely publish "where can MY passport go visa-free." They publish the **inverse**: which
nationalities may enter **their** country visa-free / visa-on-arrival / e-visa / eTA. So:

1. **Crawl** (`scripts/crawl.workflow.mjs`) — one agent per country (~199) scrapes that country's own
   official visa-policy, CBI, golden-visa and fast-track pages and writes `data/countries/<ISO3>.json`.
   A verification pass re-checks investment amounts for CBI/RBI countries against the official page.
2. **Build** (`scripts/build-dataset.mjs`) — reads every country file, resolves visa-policy nationality
   strings → ISO3 (with alias + regional-bloc expansion, e.g. "all EU citizens", "ECOWAS nationals"),
   then **inverts the matrix** to derive each passport's reach. Emits `src/data/dataset.json`.
3. **App** (`src/`) — a Next.js (App Router) UI that combines the best access across your selected
   passports and surfaces the programs open to you.

Because we stay official-source-first, the dataset has **honest gaps** where governments don't publish
enumerated lists. Reach is derived only from destinations that do; every row links to its source.

## Develop

```bash
node scripts/gen-countries.mjs      # (re)generate data/countries.json (the input list)
node scripts/build-dataset.mjs      # rebuild src/data/dataset.json from data/countries/*.json
npm run dev                         # http://localhost:3000
npm run build                       # production build
node scripts/ui-smoke.mjs           # Playwright smoke test (needs dev server running)
```

## Re-running the crawl

The crawl is a background orchestration. To re-run or extend it, re-invoke the workflow script at
`scripts/crawl.workflow.mjs`. Country files in `data/countries/` are overwritten idempotently, then
run the build step to regenerate the dataset.

> Informational only — not legal or immigration advice. Always confirm with the relevant authorities.
