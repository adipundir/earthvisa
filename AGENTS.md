<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Data

`data/` is the single source of truth. `src/data/` and `public/explorer/` are
derived and must never be hand-edited.

After changing anything under `data/`, run `npm run data` and commit the
regenerated files alongside the source change. `npm run data:check` reports
staleness without writing.

Full architecture, and why the build can fail on a shallow clone, is in
`data/README.md`. Read it before adding a data source or touching
`scripts/build-dataset.mjs` - the per-country dates it derives from git history
become the sitemap's `lastModified`, and getting them wrong in bulk has already
cost this site 97.7% of its search impressions once.
