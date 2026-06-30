export const meta = {
  name: 'reverify-update-database-and-ux',
  description: 'Re-verify ALL ~199 country immigration records against their OWN official sources (WebFetch/WebSearch; Firecrawl is offline), correct each file in place, then adversarially re-verify every risky change to visa-free/VoA/eTA/e-visa lists before trusting it. Concurrently runs an exhaustive UX audit of the running app (every screen and button) and synthesizes a prioritized usability report.',
  phases: [
    { title: 'DB-verify',   detail: 'one agent per country re-checks official sources and corrects its file (Sonnet)' },
    { title: 'DB-adversary', detail: 'independent verifier re-checks each visa-free/VoA/eTA/e-visa change and reverts unsupported ones (Opus)' },
    { title: 'UX-audit',     detail: 'agents drive every surface & button of the running app on :3001 (Sonnet)' },
    { title: 'UX-synth',     detail: 'synthesize UX findings into one prioritized report (Opus)' },
  ],
};

const DATA_DIR = '/Users/adityapundir/Documents/Projects/project-bluewhale/data/countries';
const APP = 'http://localhost:3001';

// [iso2, iso3, name, region]
const TUPLES = [
["DZ","DZA","Algeria","Africa"],["AO","AGO","Angola","Africa"],["BJ","BEN","Benin","Africa"],
["BW","BWA","Botswana","Africa"],["BF","BFA","Burkina Faso","Africa"],["BI","BDI","Burundi","Africa"],
["CV","CPV","Cabo Verde","Africa"],["CM","CMR","Cameroon","Africa"],["CF","CAF","Central African Republic","Africa"],
["TD","TCD","Chad","Africa"],["KM","COM","Comoros","Africa"],["CG","COG","Republic of the Congo","Africa"],
["CD","COD","Democratic Republic of the Congo","Africa"],["CI","CIV","Côte d'Ivoire","Africa"],["DJ","DJI","Djibouti","Africa"],
["EG","EGY","Egypt","Africa"],["GQ","GNQ","Equatorial Guinea","Africa"],["ER","ERI","Eritrea","Africa"],
["SZ","SWZ","Eswatini","Africa"],["ET","ETH","Ethiopia","Africa"],["GA","GAB","Gabon","Africa"],
["GM","GMB","Gambia","Africa"],["GH","GHA","Ghana","Africa"],["GN","GIN","Guinea","Africa"],
["GW","GNB","Guinea-Bissau","Africa"],["KE","KEN","Kenya","Africa"],["LS","LSO","Lesotho","Africa"],
["LR","LBR","Liberia","Africa"],["LY","LBY","Libya","Africa"],["MG","MDG","Madagascar","Africa"],
["MW","MWI","Malawi","Africa"],["ML","MLI","Mali","Africa"],["MR","MRT","Mauritania","Africa"],
["MU","MUS","Mauritius","Africa"],["MA","MAR","Morocco","Africa"],["MZ","MOZ","Mozambique","Africa"],
["NA","NAM","Namibia","Africa"],["NE","NER","Niger","Africa"],["NG","NGA","Nigeria","Africa"],
["RW","RWA","Rwanda","Africa"],["ST","STP","São Tomé and Príncipe","Africa"],["SN","SEN","Senegal","Africa"],
["SC","SYC","Seychelles","Africa"],["SL","SLE","Sierra Leone","Africa"],["SO","SOM","Somalia","Africa"],
["ZA","ZAF","South Africa","Africa"],["SS","SSD","South Sudan","Africa"],["SD","SDN","Sudan","Africa"],
["TZ","TZA","Tanzania","Africa"],["TG","TGO","Togo","Africa"],["TN","TUN","Tunisia","Africa"],
["UG","UGA","Uganda","Africa"],["ZM","ZMB","Zambia","Africa"],["ZW","ZWE","Zimbabwe","Africa"],
["AF","AFG","Afghanistan","Asia"],["AM","ARM","Armenia","Asia"],["AZ","AZE","Azerbaijan","Asia"],
["BH","BHR","Bahrain","Asia"],["BD","BGD","Bangladesh","Asia"],["BT","BTN","Bhutan","Asia"],
["BN","BRN","Brunei","Asia"],["KH","KHM","Cambodia","Asia"],["CN","CHN","China","Asia"],
["CY","CYP","Cyprus","Asia"],["GE","GEO","Georgia","Asia"],["IN","IND","India","Asia"],
["ID","IDN","Indonesia","Asia"],["IR","IRN","Iran","Asia"],["IQ","IRQ","Iraq","Asia"],
["IL","ISR","Israel","Asia"],["JP","JPN","Japan","Asia"],["JO","JOR","Jordan","Asia"],
["KZ","KAZ","Kazakhstan","Asia"],["KW","KWT","Kuwait","Asia"],["KG","KGZ","Kyrgyzstan","Asia"],
["LA","LAO","Laos","Asia"],["LB","LBN","Lebanon","Asia"],["MY","MYS","Malaysia","Asia"],
["MV","MDV","Maldives","Asia"],["MN","MNG","Mongolia","Asia"],["MM","MMR","Myanmar","Asia"],
["NP","NPL","Nepal","Asia"],["KP","PRK","North Korea","Asia"],["OM","OMN","Oman","Asia"],
["PK","PAK","Pakistan","Asia"],["PH","PHL","Philippines","Asia"],["QA","QAT","Qatar","Asia"],
["SA","SAU","Saudi Arabia","Asia"],["SG","SGP","Singapore","Asia"],["KR","KOR","South Korea","Asia"],
["LK","LKA","Sri Lanka","Asia"],["SY","SYR","Syria","Asia"],["TJ","TJK","Tajikistan","Asia"],
["TH","THA","Thailand","Asia"],["TL","TLS","Timor-Leste","Asia"],["TR","TUR","Turkey","Asia"],
["TM","TKM","Turkmenistan","Asia"],["AE","ARE","United Arab Emirates","Asia"],["UZ","UZB","Uzbekistan","Asia"],
["VN","VNM","Vietnam","Asia"],["YE","YEM","Yemen","Asia"],
["AL","ALB","Albania","Europe"],["AD","AND","Andorra","Europe"],["AT","AUT","Austria","Europe"],
["BY","BLR","Belarus","Europe"],["BE","BEL","Belgium","Europe"],["BA","BIH","Bosnia and Herzegovina","Europe"],
["BG","BGR","Bulgaria","Europe"],["HR","HRV","Croatia","Europe"],["CZ","CZE","Czechia","Europe"],
["DK","DNK","Denmark","Europe"],["EE","EST","Estonia","Europe"],["FI","FIN","Finland","Europe"],
["FR","FRA","France","Europe"],["DE","DEU","Germany","Europe"],["GR","GRC","Greece","Europe"],
["HU","HUN","Hungary","Europe"],["IS","ISL","Iceland","Europe"],["IE","IRL","Ireland","Europe"],
["IT","ITA","Italy","Europe"],["LV","LVA","Latvia","Europe"],["LI","LIE","Liechtenstein","Europe"],
["LT","LTU","Lithuania","Europe"],["LU","LUX","Luxembourg","Europe"],["MT","MLT","Malta","Europe"],
["MD","MDA","Moldova","Europe"],["MC","MCO","Monaco","Europe"],["ME","MNE","Montenegro","Europe"],
["NL","NLD","Netherlands","Europe"],["MK","MKD","North Macedonia","Europe"],["NO","NOR","Norway","Europe"],
["PL","POL","Poland","Europe"],["PT","PRT","Portugal","Europe"],["RO","ROU","Romania","Europe"],
["RU","RUS","Russia","Europe"],["SM","SMR","San Marino","Europe"],["RS","SRB","Serbia","Europe"],
["SK","SVK","Slovakia","Europe"],["SI","SVN","Slovenia","Europe"],["ES","ESP","Spain","Europe"],
["SE","SWE","Sweden","Europe"],["CH","CHE","Switzerland","Europe"],["UA","UKR","Ukraine","Europe"],
["GB","GBR","United Kingdom","Europe"],
["AG","ATG","Antigua and Barbuda","Americas"],["AR","ARG","Argentina","Americas"],["BS","BHS","Bahamas","Americas"],
["BB","BRB","Barbados","Americas"],["BZ","BLZ","Belize","Americas"],["BO","BOL","Bolivia","Americas"],
["BR","BRA","Brazil","Americas"],["CA","CAN","Canada","Americas"],["CL","CHL","Chile","Americas"],
["CO","COL","Colombia","Americas"],["CR","CRI","Costa Rica","Americas"],["CU","CUB","Cuba","Americas"],
["DM","DMA","Dominica","Americas"],["DO","DOM","Dominican Republic","Americas"],["EC","ECU","Ecuador","Americas"],
["SV","SLV","El Salvador","Americas"],["GD","GRD","Grenada","Americas"],["GT","GTM","Guatemala","Americas"],
["GY","GUY","Guyana","Americas"],["HT","HTI","Haiti","Americas"],["HN","HND","Honduras","Americas"],
["JM","JAM","Jamaica","Americas"],["MX","MEX","Mexico","Americas"],["NI","NIC","Nicaragua","Americas"],
["PA","PAN","Panama","Americas"],["PY","PRY","Paraguay","Americas"],["PE","PER","Peru","Americas"],
["KN","KNA","Saint Kitts and Nevis","Americas"],["LC","LCA","Saint Lucia","Americas"],
["VC","VCT","Saint Vincent and the Grenadines","Americas"],["SR","SUR","Suriname","Americas"],
["TT","TTO","Trinidad and Tobago","Americas"],["US","USA","United States","Americas"],
["UY","URY","Uruguay","Americas"],["VE","VEN","Venezuela","Americas"],
["AU","AUS","Australia","Oceania"],["FJ","FJI","Fiji","Oceania"],["KI","KIR","Kiribati","Oceania"],
["MH","MHL","Marshall Islands","Oceania"],["FM","FSM","Micronesia","Oceania"],["NR","NRU","Nauru","Oceania"],
["NZ","NZL","New Zealand","Oceania"],["PW","PLW","Palau","Oceania"],["PG","PNG","Papua New Guinea","Oceania"],
["WS","WSM","Samoa","Oceania"],["SB","SLB","Solomon Islands","Oceania"],["TO","TON","Tonga","Oceania"],
["TV","TUV","Tuvalu","Oceania"],["VU","VUT","Vanuatu","Oceania"],
["XK","XKX","Kosovo","Europe"],["TW","TWN","Taiwan","Asia"],["VA","VAT","Holy See (Vatican City)","Europe"],
["PS","PSE","Palestine","Asia"],["HK","HKG","Hong Kong","Asia"],["MO","MAC","Macau","Asia"],
];

const ALL = TUPLES.map(([iso2, iso3, name, region]) => ({ iso2, iso3, name, region }));
// args.only = optional array of iso3 to limit the run (for re-runs)
const only = args && Array.isArray(args.only) && args.only.length
  ? new Set(args.only.map((s) => String(s).toUpperCase())) : null;
const COUNTRIES = only ? ALL.filter((c) => only.has(c.iso3)) : ALL;

// ── DB re-verify ───────────────────────────────────────────────────────────────

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['iso3', 'written', 'visa_free_count', 'sources_reached'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    written: { type: 'boolean' },
    sources_reached: { type: 'integer' },         // how many official pages actually loaded
    visa_free_count: { type: 'integer' },
    voa_count: { type: 'integer' },
    evisa_count: { type: 'integer' },
    eta_count: { type: 'integer' },
    conditional_count: { type: 'integer' },
    corrections: { type: 'array', items: { type: 'string' } },
    // every change to a by-nationality access list the adversary must re-confirm
    risky_changes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['list', 'action', 'nationality', 'source_url'],
        properties: {
          list: { type: 'string', enum: ['visa_free', 'visa_on_arrival', 'eta', 'e_visa'] },
          action: { type: 'string', enum: ['added', 'removed', 'releveled', 'stay_changed'] },
          nationality: { type: 'string' },
          iso3: { type: ['string', 'null'] },
          source_url: { type: 'string' },
        },
      },
    },
    completeness: { type: 'string', enum: ['high', 'medium', 'low'] },
    gaps: { type: 'array', items: { type: 'string' } },
  },
};

function verifyPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are VALIDATING and CORRECTING the immigration record for ONE destination - **${c.name}** (iso2=${c.iso2}, iso3=${c.iso3}). Re-visit ${c.name}'s OWN official sources, verify the existing record against the live pages, correct anything genuinely wrong, and rewrite the file. This node captures who ${c.name} admits and on what terms.

## TOOLS
Load WebFetch + WebSearch: ToolSearch select:WebFetch,WebSearch. NOTE: Firecrawl is OFFLINE this run - do NOT try to load it. Use WebFetch to read official pages directly; use WebSearch to find the current official page. Be economical (~6–14 tool calls).

## STEP 1 - read current record
Read ${file}. Note its current visa_policy (visa_free / visa_on_arrival / e_visa / eta), conditional_access, visa_required (negation), cbi / rbi / fast_track, and source_urls.

## STEP 2 - re-visit OFFICIAL sources (a real re-fetch, not a memory check)
PREFER WebFetch on ${c.name}'s government / MFA / immigration / e-visa / citizenship domains (*.gov, *.gov.<cc>, *.gob.<cc>, *.govt.<cc>, *.gouv.<cc>). Re-open the source_urls already in the file, plus search for the current official visa-policy page.

## STEP 3 - verify + CORRECT, with strict classification
Record a fact ONLY from an official government/immigration domain; cite the exact source_url; never invent.
- **visa_policy** (visa_free / visa_on_arrival / e_visa / eta): ONLY grants available to an ORDINARY passport by NATIONALITY alone (freedom-of-movement blocs, Annex II/ETIAS, plain nationality waivers). Entry: {nationality, iso3|null, max_stay_days, notes, source_url, source_official}.
- **conditional_access**: anything NOT an unconditional ordinary-nationality grant - held-credential ("with a valid US/Schengen/etc. visa/residence/PR"), diplomatic/service/official-only waivers, OCI/diaspora. These must NOT be in visa_policy.
- **visa_required** (ONLY if policy is "visa-free for all EXCEPT a list"): {default_visa_free:true, nationalities_iso3:[…], source_url, source_official}. NEVER expand a negation into an explicit universal visa-free list.
- **cbi / rbi / fast_track**: re-confirm program names + min amounts + currency; null-out anything unconfirmable.

## CRITICAL SAFETY RULES
- A FALSE visa-free is the WORST possible error. When in doubt, classify DOWN (visa_required), never up.
- If you CANNOT reach an official source for a claim, DO NOT change or delete the existing entry - KEEP it as-is and add the item to data_quality.gaps. Preservation beats guessing. Only change data you re-confirmed (or disproved) against a live official page.
- Keep the same file shape (iso2/iso3/name/region preserved). Put what you CHANGED into data_quality.validation_notes (2026-06-27) and unverifiable items into data_quality.gaps.

## STEP 4 - write + report
Write the corrected JSON back to EXACTLY ${file}. Your FINAL message MUST be only the structured summary. In risky_changes[] list EVERY change you made to any by-nationality access list (visa_free/visa_on_arrival/eta/e_visa) - additions, removals, level changes, or max-stay changes - each with its official source_url, so it can be independently re-checked. sources_reached = number of official pages that actually loaded.`;
}

// ── DB adversary (re-confirm risky changes) ─────────────────────────────────────

const ADVERSARY_SCHEMA = {
  type: 'object',
  required: ['iso3', 'reverted_count', 'verdicts'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    reverted_count: { type: 'integer' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['nationality', 'list', 'verdict'],
        properties: {
          nationality: { type: 'string' },
          list: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'reverted', 'uncertain'] },
          reason: { type: 'string' },
        },
      },
    },
  },
};

function adversaryPrompt(c, changes) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are an INDEPENDENT adversarial verifier. The immigration record for **${c.name}** (${c.iso3}) was just re-verified and the following changes were made to its by-nationality access lists. Your job is to try to REFUTE each one against the official source, because a FALSE visa-free is the worst possible error.

File: ${file}
Changes to check:
${changes.map((ch, i) => `${i + 1}. [${ch.list}] ${ch.action} - ${ch.nationality} (${ch.iso3 || '?'}) - cited: ${ch.source_url}`).join('\n')}

For EACH change:
1. Load WebFetch (ToolSearch select:WebFetch,WebSearch). Independently open the cited source_url (and, if needed, search for the official page). Firecrawl is OFFLINE - do not load it.
2. Decide: does the OFFICIAL page actually support this exact classification for this nationality on an ORDINARY passport?
   - **confirmed** - the official page clearly supports it.
   - **reverted** - the change is NOT supported (wrong level, wrong nationality, source is an aggregator/not official, or it's actually credential/passport-type conditional). You MUST then Read ${file}, fix that specific entry (remove it from the wrong list / move to conditional_access / downgrade to visa_required), and Write the file back. Default to reverting when the source does not clearly prove the grant.
   - **uncertain** - source unreachable. Leave the entry as-is (do not revert on inability to reach - that would just thrash), but mark uncertain.
3. Be surgical: only touch the specific entries you revert; preserve everything else in the file exactly.

Your FINAL message MUST be only the structured summary (verdicts[] with reason for each, and reverted_count).`;
}

// ── UX audit ────────────────────────────────────────────────────────────────────

const UX_FINDINGS_SCHEMA = {
  type: 'object',
  required: ['surface', 'elements_tested', 'findings'],
  additionalProperties: true,
  properties: {
    surface: { type: 'string' },
    elements_tested: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'element', 'issue', 'suggestion'],
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          element: { type: 'string' },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
    works_well: { type: 'array', items: { type: 'string' } },
  },
};

const UX_SURFACES = [
  { key: 'home-passport-explorer', url: '/', what: 'Home / Passport Explorer: passport search+add+remove, the per-passport ORD/DIP/SVC/OFF type dropdown, credential search+add+remove, the "Popular" and "Common" quick chips, every result tab (visa-free / on-arrival / eTA / freedom-of-movement / CBI / golden-visa / fast-track / transit), the reach search/filter box, opening and Escape-closing a destination detail, and the FAQ <details> toggles.' },
  { key: 'visit-destination-explorer', url: '/visit', what: 'Entry Check / Destination Explorer: destination search+select+clear, passport add+type+remove, credential add+remove, all three result states (drive Germany→Portugal = freedom-of-movement, India→Portugal = visa-required, and a visa-free pairing), the official "visa types available" category filter tabs, the NEW "Document checklists - via VFS Global" section incl. its category filter and expanding/collapsing each visa-type row, every source link, and the "Passport Explorer →" cross-link.' },
  { key: 'passport-detail', url: '/passport/india', what: 'Passport detail page: every section, all visa-free/VoA/CBI cards, the breadcrumb to /passport, the "View all on Passport Power →" links (must now deep-link with ?passport=), bottom CTA, and FAQ toggles. Verify clicking a deep-link actually lands pre-filled.' },
  { key: 'destination-detail', url: '/destination/portugal', what: 'Destination detail page: every section + card, breadcrumb to /destination, the "View all" links (must deep-link to /visit?dest=), bottom CTA, FAQ toggles. Verify a deep-link lands pre-filled on /visit.' },
  { key: 'index-pages', url: '/passport', what: 'Both index pages (/passport and /destination): region grouping, that a sample of country links navigate correctly to the right detail page, and the breadcrumb back to home.' },
  { key: 'navbar-404-footer', url: '/totally-missing-xyz', what: 'Global chrome: the Navbar links (Passport Power / Passport Explorer / Entry Check) from several pages incl. active-state correctness, the branded 404 page and its three CTAs, and the footer MRZ block. Confirm every nav link resolves (no 404).' },
  { key: 'mobile-responsive', url: '/', what: 'MOBILE at 390px width across / , /visit , /passport/india , /destination/portugal: nav usability, tap-target sizes, dropdowns/search usability, horizontal overflow, card stacking, and the VFS document section on mobile. Report anything that is hard to tap or overflows.' },
  { key: 'a11y-keyboard', url: '/', what: 'Accessibility & keyboard across / and /visit: tab order, visible focus rings, can you operate the comboboxes/dropdowns and tabs by keyboard, Escape closes popovers, aria-current on active nav, aria-expanded on toggles, alt/aria-hidden on icons, and obvious color-contrast problems.' },
];

function uxPrompt(s) {
  return `You are auditing the USABILITY of ONE surface of a running web app at ${APP}. The product helps people answer "what countries can my passport get me into, and what do I need". The bar: it must be DEAD SIMPLE to use, down to every single button.

SURFACE: **${s.key}** - start at ${APP}${s.url}
TEST THOROUGHLY: ${s.what}

HOW:
- Drive a real browser with Playwright. The package is installed in the repo, but ESM resolves 'playwright' relative to the SCRIPT's location, so you MUST create your script INSIDE the repo. Use a UNIQUE filename: /Users/adityapundir/Documents/Projects/project-bluewhale/scripts/_ux_${s.key}.mjs (Write it, run \`node scripts/_ux_${s.key}.mjs\` from the repo root via Bash, then DELETE it). Import: \`import { chromium } from "playwright";\`.
- Actually CLICK / type / tab through EVERY interactive element on this surface - not just look. Capture screenshots to /tmp/ux-${s.key}-*.png and Read them. Extract document.body.innerText to confirm state changes. Try keyboard (Tab/Enter/Escape) where relevant.
- For each problem, be concrete: which exact element, what's confusing/broken/awkward, and a specific fix. Judge like a first-time user who must not get stuck. Include things that are subtle: unclear labels, dead clicks, no empty/loading state, tiny tap targets, missing focus, surprising navigation, redundant steps.

Return ONLY the structured summary: surface, elements_tested (count of distinct interactive elements you exercised), findings[] (severity/element/issue/suggestion), works_well[].`;
}

const UX_REPORT_SCHEMA = {
  type: 'object',
  required: ['summary', 'top_issues'],
  additionalProperties: true,
  properties: {
    summary: { type: 'string' },
    ease_of_use_score: { type: 'integer' },   // 1-10
    top_issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'surface', 'issue', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          surface: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    quick_wins: { type: 'array', items: { type: 'string' } },
    works_well: { type: 'array', items: { type: 'string' } },
  },
};

// ── orchestration ────────────────────────────────────────────────────────────────

log(`Re-verifying ${COUNTRIES.length} countries (Sonnet, WebFetch/WebSearch - Firecrawl offline) + auditing UX of ${UX_SURFACES.length} surfaces.`);

// DB pipeline: verify each country, then adversarially re-check its risky changes.
const dbPromise = pipeline(
  COUNTRIES,
  (c) => agent(verifyPrompt(c), { label: `verify:${c.iso3}`, phase: 'DB-verify', model: 'sonnet', effort: 'high', schema: VERIFY_SCHEMA })
            .then((s) => ({ country: c, summary: s })).catch(() => ({ country: c, summary: null })),
  (res) => {
    const { country: c, summary } = res || {};
    const risky = (summary && summary.risky_changes) || [];
    if (!summary || !summary.written || risky.length === 0) return { ...res, adversary: null };
    return agent(adversaryPrompt(c, risky), { label: `adv:${c.iso3}`, phase: 'DB-adversary', effort: 'high', schema: ADVERSARY_SCHEMA })
      .then((v) => ({ ...res, adversary: v })).catch(() => ({ ...res, adversary: null }));
  }
);

// UX fleet: drive every surface in parallel, then synthesize.
const uxPromise = parallel(
  UX_SURFACES.map((s) => () =>
    agent(uxPrompt(s), { label: `ux:${s.key}`, phase: 'UX-audit', model: 'sonnet', effort: 'high', schema: UX_FINDINGS_SCHEMA }).catch(() => null)
  )
).then((findings) => {
  const valid = findings.filter(Boolean);
  return agent(
    `Synthesize an exhaustive UX audit of a passport/visa web app from these per-surface findings. The product must be dead-simple to use, down to every button. Dedupe, prioritize by user impact, and be concrete. Give an honest ease_of_use_score (1-10), the top_issues (severity/surface/issue/fix), quick_wins, and works_well.\n\nPER-SURFACE FINDINGS (JSON):\n${JSON.stringify(valid)}`,
    { label: 'ux:synthesis', phase: 'UX-synth', effort: 'high', schema: UX_REPORT_SCHEMA }
  ).then((r) => ({ report: r, surfaces: valid })).catch(() => ({ report: null, surfaces: valid }));
});

const [dbResults, ux] = await Promise.all([dbPromise, uxPromise]);

// ── summarize DB results ─────────────────────────────────────────────────────────
const dbOk = dbResults.filter((r) => r && r.summary);
const written = dbOk.filter((r) => r.summary.written);
const withCorrections = dbOk.filter((r) => (r.summary.corrections || []).length > 0);
const totalCorrections = dbOk.reduce((s, r) => s + ((r.summary.corrections || []).length), 0);
const totalRisky = dbOk.reduce((s, r) => s + ((r.summary.risky_changes || []).length), 0);
const adversaries = dbResults.filter((r) => r && r.adversary);
const totalReverted = adversaries.reduce((s, r) => s + (r.adversary.reverted_count || 0), 0);
const lowConfidence = dbOk.filter((r) => r.summary.completeness === 'low').map((r) => r.country.iso3);
const failures = COUNTRIES.filter((c) => !written.find((r) => r.country.iso3 === c.iso3)).map((c) => c.iso3);

log(`DB done: verified=${written.length}/${COUNTRIES.length}, corrections=${totalCorrections}, riskyChanges=${totalRisky}, adversaryReverts=${totalReverted}, failures=${failures.length}`);

return {
  database: {
    total: COUNTRIES.length,
    verified: written.length,
    countriesWithCorrections: withCorrections.length,
    totalCorrections,
    riskyChangesChecked: totalRisky,
    adversaryReverts: totalReverted,
    lowConfidence,
    failures,
    sampleCorrections: withCorrections.slice(0, 30).map((r) => ({ iso3: r.country.iso3, corrections: r.summary.corrections })),
    reverts: adversaries.filter((r) => r.adversary.reverted_count > 0)
      .map((r) => ({ iso3: r.country.iso3, verdicts: r.adversary.verdicts.filter((v) => v.verdict === 'reverted') })),
  },
  ux: ux.report,
};
