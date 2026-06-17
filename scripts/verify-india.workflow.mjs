export const meta = {
  name: 'verify-india-discrepancies',
  description: "Verify India's entry treatment at ~22 destinations where our data disagrees with an aggregator (IndiGo). Each agent re-visits that destination's OWN official immigration/MFA/e-visa site, determines how Indian ORDINARY passport holders are treated (visa-free / VoA / eTA / e-visa / visa-required / conditional), and corrects the India row in data/countries/<ISO3>.json. Official-source-first; never trust the aggregator.",
  phases: [{ title: 'VerifyIndia', detail: "one agent per destination checks India's treatment on the official site and fixes the India row (Sonnet, WebFetch-first)" }],
};

const DATA_DIR = '/Users/adityapundir/Documents/Projects/project-bluewhale/data/countries';

// [iso3, name] — destinations where IndiGo and our data disagree about India
const TARGETS = [
  ['SLV', 'El Salvador'], ['TUN', 'Tunisia'], ['OMN', 'Oman'], ['QAT', 'Qatar'],
  ['DMA', 'Dominica'], ['HTI', 'Haiti'], ['JAM', 'Jamaica'], ['KNA', 'Saint Kitts and Nevis'],
  ['VCT', 'Saint Vincent and the Grenadines'], ['HKG', 'Hong Kong'], ['LCA', 'Saint Lucia'],
  ['KHM', 'Cambodia'], ['LAO', 'Laos'], ['IRN', 'Iran'], ['BOL', 'Bolivia'],
  ['CPV', 'Cabo Verde'], ['GAB', 'Gabon'], ['MRT', 'Mauritania'], ['MOZ', 'Mozambique'],
  ['SLE', 'Sierra Leone'], ['SOM', 'Somalia'], ['TGO', 'Togo'],
];

const SCHEMA = {
  type: 'object',
  required: ['iso3', 'india_level', 'changed'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    india_level: { type: 'string', enum: ['visa_free', 'visa_on_arrival', 'eta', 'e_visa', 'visa_required', 'conditional', 'unknown'] },
    changed: { type: 'boolean' },
    prior_level: { type: 'string' },
    max_stay_days: { type: ['integer', 'null'] },
    source_url: { type: 'string' },
    source_official: { type: 'boolean' },
    note: { type: 'string' },
  },
};

function prompt(iso3, name) {
  const file = `${DATA_DIR}/${iso3}.json`;
  return `Determine how **${name}** (${iso3}) treats ORDINARY **Indian passport** holders for short tourist/business entry, and correct our record. An airline aggregator claims India is visa-free or visa-on-arrival here; verify the TRUTH from ${name}'s OWN official source — do NOT trust the aggregator.

## STEP 1 — official source
Load WebSearch + WebFetch (ToolSearch select:WebSearch,WebFetch). Find ${name}'s official immigration / MFA / e-visa page (government domain) and read how Indian nationals enter. Fall back to Firecrawl (select:mcp__firecrawl-mcp__firecrawl_scrape) only if WebFetch is blocked. If ${name} has no usable official English page, say so and do not invent.

## STEP 2 — classify India's treatment (ordinary passport)
One of: visa_free | visa_on_arrival | eta | e_visa | visa_required | conditional (only with a held third-country visa/permit). Capture max stay (days) and the exact official source_url. Note any condition (fee, pre-registration like HK, hotel booking, etc.).

## STEP 3 — correct the file
Read ${file}. Update ONLY the India-relevant data; keep everything else intact:
- visa_free / visa_on_arrival / eta / e_visa → ensure an India entry exists in that level array {nationality:"India", iso3:"IND", max_stay_days, notes, source_url, source_official:true}, and remove any stale India entry from the other levels.
- conditional → put it in conditional_access (basis=credential, eligible_nationalities:["India"], credential{...}) and ensure India is NOT in any visa_policy level.
- visa_required → ensure India is NOT present in any visa_policy level or conditional_access (India simply needs a normal visa).
Add a one-line entry to data_quality.validation_notes describing the change + source. Write the file back to ${file} with the Write tool.

Your FINAL message must be ONLY the structured verdict.`;
}

phase('VerifyIndia');
log(`Verifying India's treatment at ${TARGETS.length} disputed destinations (official sources, WebFetch-first).`);

const results = await parallel(TARGETS.map(([iso3, name]) => () =>
  agent(prompt(iso3, name), { label: `india:${iso3}`, phase: 'VerifyIndia', model: 'sonnet', schema: SCHEMA })
    .then((s) => s).catch(() => null),
));

const ok = results.filter(Boolean);
const changed = ok.filter((r) => r.changed);
return {
  total: TARGETS.length,
  verified: ok.length,
  changed: changed.length,
  failures: TARGETS.filter(([iso3]) => !ok.find((r) => r.iso3 === iso3)).map(([iso3]) => iso3),
  verdicts: ok.map((r) => ({ iso3: r.iso3, level: r.india_level, was: r.prior_level, changed: r.changed, src: r.source_url, note: r.note })),
};
