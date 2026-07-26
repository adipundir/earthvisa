# Data architecture

One rule: **`data/` is the source of truth. Everything the app reads is derived from it by one pipeline.**

```
data/                     SOURCE - hand-authored or crawler-written. Edit here.
  countries/<ISO3>.json     visa policy, visa types, CBI/RBI, conditional access
  vfs/<nat>-<dest>.json     per-corridor document checklists (VFS Global)
  visa-fees/<ISO3>.json     fee schedules
  proof-of-funds/<KEY>.json bank-balance guidance
  acceptance-rates/<DEST>.json  official per-nationality refusal statistics
  countries.json            the canonical 199-country list

src/data/                 DERIVED - never hand-edit. Regenerated from data/.
public/explorer/          DERIVED - gitignored client slices.
```

## Changing data

```bash
# 1. edit something under data/
# 2. rebuild everything that depends on it
npm run data
# 3. commit BOTH the source change and the regenerated files in src/data/
```

That is the whole workflow. `npm run data` works out what is stale and rebuilds
only that, so it is cheap to run — under a second when nothing changed.

| command | does |
|---|---|
| `npm run data` | rebuild whatever is out of date |
| `npm run data:check` | report staleness, change nothing, exit 1 if stale |
| `npm run data:force` | rebuild everything unconditionally |
| `npm run build` | runs `npm run data` first, then `next build` |

## Why a pipeline instead of separate scripts

Each derived file used to have its own merge script that someone had to remember
to run, and `prebuild` only rebuilt the explorer slices. `npm run build` therefore
shipped whatever happened to be sitting in `src/data/`.

That is not hypothetical. `src/data/proof-of-funds.json` was two weeks behind its
source: the guidance prose was rewritten on 2026-07-12, the merge was never
re-run, and the site quietly served the older text. Nothing failed, which is
precisely the problem.

Now there is one DAG, one command, and staleness is an error rather than a silent
default. Freshness is decided by **hashing inputs**, not mtimes — a git checkout
rewrites mtimes and would make every file look permanently dirty.
`src/data/.build-manifest.json` records the hash each stage was last built from
and **must be committed**; CI relies on it (see below).

## The sitemap invariant, and why CI can fail on purpose

`build-dataset.mjs` derives each country's last-updated date from **git history**,
and `sitemap.ts` turns those into per-URL `lastModified`. Get them wrong in bulk
and the sitemap tells Google the whole site changed at once — that is exactly
what happened on 2026-07-20, when a cosmetic find-replace re-dated 91.7% of URLs
and impressions fell 97.7% in a day.

A shallow clone (`git clone --depth=1`, the CI default on Vercel and most others)
recreates that failure permanently: its single commit still contains every
country file, so all 199 get a date — **the same date** — and every corridor's
`lastModified` then moves together on every commit.

So `build-dataset.mjs` refuses to emit a dataset when the dates look untrustworthy:

- fewer than 150 of 199 countries dated, **or**
- fewer than 3 distinct dates across them (a full checkout currently yields 10;
  a `--depth=1` clone yields exactly 1)

Counting dated countries alone is not enough and gives false confidence — the
shallow clone passes that check.

In normal CI this never fires: the committed manifest matches, so the dataset
stage is skipped and git history is never consulted. It fires only when someone
edits `data/` and commits without running `npm run data`. The fix is in the error
message: rebuild on a full checkout and commit the result.

## Adding a new data source

1. Put the source under `data/<thing>/`.
2. Write a builder in `scripts/` that reads only from `data/` and writes only to
   `src/data/`.
3. Add a stage to `STAGES` in `scripts/data-pipeline.mjs` listing its inputs and
   outputs. Order the array by dependency.

Network-fetching scripts (`update-fx-rates`, `build-world-dots`,
`build-acceptance-*`) are deliberately **not** pipeline stages — they must not run
on every build. They write into `data/`, and the pipeline picks their output up
as ordinary source.
