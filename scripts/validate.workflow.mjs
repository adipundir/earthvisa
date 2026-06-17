export const meta = {
  name: 'validate-revisit-official',
  description: 'VALIDATION re-fetch: for ~200 countries, parallel agents re-visit each country\'s OWN official immigration/MFA/e-visa/CBI sites, re-verify the existing data/countries/<ISO3>.json against the live official pages, and rewrite it correctly — ordinary nationality grants in visa_policy, all held-credential / diplomatic-service / OCI rules in conditional_access, negation visa-required lists captured, CBI/RBI amounts confirmed. Reports corrections found vs the prior data.',
  phases: [
    { title: 'Validate', detail: 'one agent per country re-visits official sites (WebFetch-first, Firecrawl fallback), verifies + corrects, and reports discrepancies (Sonnet)' },
  ],
};

const DATA_DIR = '/Users/adityapundir/Documents/Projects/project-bluewhale/data/countries';

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

const ALL_COUNTRIES = TUPLES.map(([iso2, iso3, name, region]) => ({ iso2, iso3, name, region }));

// Validate ALL countries. `args` may pass a subset of ISO3 codes to re-run.
const list = Array.isArray(args) && args.length ? args : null;
const COUNTRIES = list
  ? ALL_COUNTRIES.filter((c) => new Set(list.map((s) => String(s).toUpperCase())).has(c.iso3))
  : ALL_COUNTRIES;

const VALIDATE_SCHEMA = {
  type: 'object',
  required: ['iso3', 'written', 'visa_free_count', 'conditional_count'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    written: { type: 'boolean' },
    visa_free_count: { type: 'integer' },
    voa_count: { type: 'integer' },
    evisa_count: { type: 'integer' },
    conditional_count: { type: 'integer' },
    corrections: { type: 'array', items: { type: 'string' } },
    sources_visited: { type: 'array', items: { type: 'string' } },
    completeness: { type: 'string', enum: ['high', 'medium', 'low'] },
    gaps: { type: 'array', items: { type: 'string' } },
  },
};

function validatePrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are VALIDATING the immigration record for ONE destination — **${c.name}** (iso2=${c.iso2}, iso3=${c.iso3}). Re-visit ${c.name}'s OWN official sources, verify the existing record against the live pages, correct anything wrong, and rewrite the file with correct classification. This is a directed-graph node: it captures who ${c.name} admits and on what terms.

## STEP 1 — read current record
Read the existing file with the Read tool: ${file} (note its current visa_policy / conditional_access / cbi / rbi / fast_track and source_urls).

## STEP 2 — re-visit OFFICIAL sources (this is a re-fetch, not a memory check)
Load WebSearch + WebFetch (ToolSearch select:WebSearch,WebFetch). PREFER reading the raw official page via WebFetch directly from ${c.name}'s government / MFA / immigration / e-visa / citizenship domain (*.gov, *.gov.<cc>, *.gob.<cc>, *.govt.<cc>, *.gouv.<cc>). Fall back to Firecrawl (ToolSearch select:mcp__firecrawl-mcp__firecrawl_scrape) ONLY if WebFetch is blocked/empty. Re-open the source_urls already in the file plus search for the current official visa-policy page. Be economical (~6–14 tool calls).

## STEP 3 — verify + CORRECT, with strict classification
Record a fact ONLY from an official government/immigration domain; cite the exact source_url; never invent. Then classify EVERY entry correctly:
- **visa_policy** (visa_free / visa_on_arrival / e_visa / eta): ONLY grants available to an ORDINARY passport by NATIONALITY alone (incl. freedom-of-movement blocs, Annex II/ETIAS, plain nationality waivers). Entry: {nationality, iso3|null, max_stay_days, notes, source_url, source_official}.
- **conditional_access**: EVERYTHING that is NOT an unconditional ordinary-nationality grant — these must NOT be in visa_policy:
   · held-credential ("requires/with a valid US/Schengen/EU/UK/Canada visa, residence permit, Green Card/PR") → basis="credential", credential={issuer,type(visa|residence_permit|permanent_resident),subtype}, eligible_nationalities=[…], passport_types=["ordinary"].
   · diplomatic/service/official passport ONLY ("visa suppression agreement", "diplomatic and service passports only") → basis="passport_type", credential=null, passport_types=[…].
   · OCI / diaspora status → basis="special_status".
   Each: {basis, eligible_nationalities:[…]|"any", passport_types, credential|null, level, max_stay_days, conditions, source_url, source_official}.
- **visa_required** (only if ${c.name}'s policy is "visa-free for all EXCEPT a list"): {default_visa_free:true, nationalities_iso3:[…], source_url, source_official}.
- **cbi / rbi / fast_track**: re-verify program names + min amounts + currency against the official page; correct or null-out anything unconfirmable.

## STEP 4 — rewrite the file
Write the corrected JSON back to EXACTLY ${file} (same overall shape; keep iso2/iso3/name/region). Put a short list of what you CHANGED vs the prior record into data_quality.validation_notes, and unverifiable items into data_quality.gaps.

After writing, your FINAL message must be ONLY the structured summary (counts, corrections[], sources_visited[], completeness, gaps[]).`;
}

phase('Validate');
log(`Re-fetching & validating official immigration data for ${COUNTRIES.length} countries (Sonnet, WebFetch-first).`);

const results = await parallel(COUNTRIES.map((c) => () =>
  agent(validatePrompt(c), {
    label: `validate:${c.iso3}`,
    phase: 'Validate',
    model: 'sonnet',
    schema: VALIDATE_SCHEMA,
  }).then((s) => ({ country: c, summary: s })).catch(() => null),
));

const ok = results.filter(Boolean);
const written = ok.filter((r) => r.summary && r.summary.written);
const withCorrections = ok.filter((r) => r.summary && (r.summary.corrections || []).length > 0);
const totalCorrections = ok.reduce((s, r) => s + ((r.summary && r.summary.corrections) || []).length, 0);
const failures = COUNTRIES.filter((c) => !written.find((r) => r.country.iso3 === c.iso3)).map((c) => c.iso3);

log(`Done. validated=${written.length}/${COUNTRIES.length}, countries-with-corrections=${withCorrections.length}, total-corrections=${totalCorrections}, failures=${failures.length}`);

return {
  total: COUNTRIES.length,
  validated: written.length,
  countriesWithCorrections: withCorrections.length,
  totalCorrections,
  failures,
  corrections: withCorrections
    .map((r) => ({ iso3: r.country.iso3, corrections: r.summary.corrections }))
    .slice(0, 40),
};
