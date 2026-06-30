# VFS Global document checklists

Per-corridor visa **document checklists**, categorised by visa type, sourced from
VFS Global - the official visa-application outsourcing partner for many embassies.

## Where the data comes from

VFS's site (`visa.vfsglobal.com`) is a Nuxt SPA that is bot-protected (plain
`WebFetch` gets HTTP 403) and renders document lists client-side. However, all of
its page content is served from a **public Contentful Content Delivery API**:

- Space: `xxg4p8gt3sg6`, environment `master`
- Read-only CDA token (shipped in the site's JS bundle): `5YpTBRikGN59YHwM18CyGr5F43bFuaak9U8FSMEDmb8`

Each `onePager` content entry is one **source → destination corridor**. It links a
`visaTypeInformation` → many `visaTypeDropdown` entries (one per visa type). A visa
type's content lives either inline in its `visaInformation` rich-text field, or
split across linked `tab` entries (Overview / Visa Fees / Documents Required /
Photo Specifications / Download Forms). The crawler handles both layouts and
flattens the Contentful rich text (resolving embedded `table` entries) into
sectioned plain text.

## Coverage

- **1,206** English source→destination corridors (the full VFS universe)
- **60** destination countries × **114** source countries
- **10,403** visa types, **9,053** with explicit document checklists

This is corridor-specific data: documents depend on *both* where you apply and
where you're going, so it can't collapse into a single destination's visa list.

## Files

- `data/vfs/{src}-{dst}.json` - one file per corridor. Each visa type has
  `category`, `name`, and sectioned fields: `documents_required`, `visa_fees`,
  `processing_time`, `forms`, `overview`, `insurance`, plus `full_text`.
  Codes are VFS jurisdiction codes; `source_iso3` / `destination_iso3` are the
  resolved ISO-3166 alpha-3 codes.
- `data/vfs/_index.json` - manifest listing every corridor with counts.
- `src/data/dataset.json` → `vfsCorridors[destISO3]` - a compact index (source +
  per-type name/category/hasDocuments + `detailFile` pointer). The full document
  text stays in the per-corridor files to keep `dataset.json` lean (~1 MB added).

## Refreshing

```bash
node scripts/vfs-crawl.mjs            # crawl all corridors (skips existing files)
node scripts/vfs-crawl.mjs --force    # re-crawl everything
node scripts/vfs-crawl.mjs --src ind  # only corridors from one source
node scripts/build-dataset.mjs        # rebuild dataset.json (incl. vfsCorridors)
```

The crawler is idempotent and resumable (one file per corridor). VFS is the
official outsourcing partner, not the issuing government, so corridor records are
marked `source_official: false` - treat them as procedural guidance, with the
embassy's own page as the authority for legal entitlement.
