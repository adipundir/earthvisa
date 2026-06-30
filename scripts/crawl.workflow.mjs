export const meta = {
  name: 'immigration-data-crawl',
  description: 'For ~200 countries, scrape each one\'s OWN official visa-policy / CBI / golden-visa / fast-track pages and write data/countries/<ISO3>.json. Then adversarially verify investment amounts for CBI/RBI countries.',
  phases: [
    { title: 'Crawl', detail: 'one agent per country scrapes official gov/immigration sites (Sonnet)' },
    { title: 'Verify', detail: 're-verify investment amounts for CBI/RBI countries against the official page (Opus)' },
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

// Re-crawl only the countries that still lack good official-source data:
// 7 empty (no official domains / no entries) + 5 with a majority of non-official sources.
// A real array passed as `args` overrides this list; otherwise this hardcoded set is used
// (workflow scripts can't read the filesystem, so the set is computed externally and embedded).
const REWORK = ['CAF', 'ERI', 'NRU', 'PRK', 'SDN', 'SYR', 'YEM', 'GNQ', 'JOR', 'KAZ', 'KOR', 'VNM'];
const list = Array.isArray(args) && args.length ? args : REWORK;
const FILTER = new Set(list.map((s) => String(s).toUpperCase()));
const COUNTRIES = ALL_COUNTRIES.filter((c) => FILTER.has(c.iso3));

const SUMMARY_SCHEMA = {
  type: 'object',
  required: ['iso3', 'written', 'has_cbi'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    written: { type: 'boolean' },
    visa_free_count: { type: 'integer' },
    voa_count: { type: 'integer' },
    evisa_count: { type: 'integer' },
    eta_count: { type: 'integer' },
    has_cbi: { type: 'boolean' },
    rbi_count: { type: 'integer' },
    fast_track_count: { type: 'integer' },
    completeness: { type: 'string', enum: ['high', 'medium', 'low'] },
    official_domains: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['iso3', 'verified'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    verified: { type: 'boolean' },
    cbi_confirmed: { type: 'boolean' },
    corrections: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

function gatherPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are a meticulous immigration-data researcher. Collect OFFICIAL-SOURCE immigration/visa/investment data for ONE country: **${c.name}** (iso2=${c.iso2}, iso3=${c.iso3}, region=${c.region}).

## HARD RULES
- Record a fact ONLY if you find it on an OFFICIAL government / immigration / foreign-ministry / official-program website. Official = government domains such as *.gov, *.gov.<cc>, *.gob.<cc>, *.govt.<cc>, *.gouv.<cc>, official ministry/agency/e-visa/citizenship-unit domains.
- For EVERY datum capture the exact source_url. Set source_official=true ONLY for genuine government/official domains. If the ONLY source you can find for a value is an aggregator (Wikipedia, Henley, VisaGuide, IATA mirror, news, law-firm marketing), DO NOT record the value - omit it and note it under data_quality.gaps. NEVER invent, estimate, or round. Numbers/amounts must appear verbatim on the official page.
- Prefer English-language official pages. If the country has no usable official English page, record what you can and mark completeness "low".

## TOOLS
PREFER fetching raw pages DIRECTLY from official government/immigration sites - do NOT lean on Firecrawl. First load WebSearch + WebFetch via ToolSearch query: select:WebSearch,WebFetch. Use WebSearch to locate the official URL, then use WebFetch to read the raw page content directly from the government / MFA / e-visa / immigration / citizenship-unit domain. Only fall back to Firecrawl when WebFetch is blocked (403/anti-bot), returns no usable content, or the page is JS-rendered/empty - in that case load Firecrawl with ToolSearch query select:mcp__firecrawl-mcp__firecrawl_search,mcp__firecrawl-mcp__firecrawl_scrape and use firecrawl_scrape. Be economical: ~6–12 tool calls total, targeting official domains. Good search seeds: "${c.name} immigration department visa policy", "${c.name} e-visa official", "${c.name} citizenship by investment official", "${c.name} golden visa residence by investment official", "${c.name} ministry of foreign affairs visa exemption".

## DATA TO COLLECT
1. visa_policy - ${c.name}'s OWN entry rules for foreign visitors. From the official immigration/MFA/e-visa site, list nationalities granted: visa_free, visa_on_arrival, e_visa, eta. Each entry: {nationality, iso3 (if known else null), max_stay_days (number|null), notes, source_url, source_official}. If the official source only states a category (e.g. "all EU citizens", "ECOWAS nationals", "GCC nationals") rather than enumerating, record ONE entry with nationality set to that group label and explain in notes. Capture ALL listed nationalities/groups you can find - this is the most valuable field.
2. cbi - Citizenship-by-Investment program offered by ${c.name} (if any). {has_program(bool), program_name, official_url, source_official, options:[{type: donation|real_estate|bonds|business|fund|other, min_amount(number), currency, notes}], processing_time, dual_citizenship_allowed(bool|null), residency_required(bool|null), notes}. If none exists officially, has_program=false and options=[].
3. rbi - residency/golden-visa/investor-residence programs: programs:[{name, type, min_amount(number|null), currency, path_to_pr_years(number|null), path_to_citizenship_years(number|null), official_url, source_official, notes}].
4. fast_track - skilled/talent/startup/digital-nomad/highly-skilled/fast-track schemes: programs:[{name, category, eligibility, processing_time, official_url, source_official, notes}].
5. agreements - freedom-of-movement / common-travel-area memberships (e.g. "EU/EEA freedom of movement","Schengen","CARICOM","OECS","ECOWAS","GCC","ASEAN","Mercosur","Common Travel Area","Trans-Tasman","Andean Community"). Array of strings (only those officially applicable to ${c.name}).
6. official_domains - array of official domains you actually used.

## OUTPUT - WRITE A FILE
Write your result with the Write tool to EXACTLY: ${file}
Valid JSON in EXACTLY this shape (use [] when nothing official found):
{
  "iso2":"${c.iso2}","iso3":"${c.iso3}","name":"${c.name}","region":"${c.region}",
  "visa_policy":{"visa_free":[{"nationality":"","iso3":null,"max_stay_days":null,"notes":"","source_url":"","source_official":true}],"visa_on_arrival":[],"e_visa":[],"eta":[],"source_urls":[],"notes":""},
  "cbi":{"has_program":false,"program_name":"","official_url":"","source_official":false,"options":[],"processing_time":"","dual_citizenship_allowed":null,"residency_required":null,"notes":""},
  "rbi":{"programs":[]},
  "fast_track":{"programs":[]},
  "agreements":[],
  "official_domains":[],
  "data_quality":{"completeness":"high","gaps":[]},
  "sources_checked":[]
}

After writing the file, your FINAL message must be ONLY the structured summary.`;
}

function verifyPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `Adversarially verify the investment-migration figures for **${c.name}** (${c.iso3}).
1. Read the existing file: ${file} (use the Read tool).
2. For each cbi.options[].min_amount and each rbi.programs[].min_amount, OPEN the cited official_url - PREFER WebFetch to read the raw official page directly (load via ToolSearch select:WebSearch,WebFetch); fall back to Firecrawl (select:mcp__firecrawl-mcp__firecrawl_scrape) only if WebFetch is blocked - and confirm the amount + currency appear VERBATIM on the official government page.
3. If a figure is wrong, correct it to what the official page actually states. If a figure cannot be confirmed on an official page, set it to null and add a note to data_quality.gaps explaining it was unverifiable. Do NOT invent. Do not touch the visa_policy section.
4. Write the corrected JSON back to ${file} (same shape).
Be economical (~3–8 tool calls). Your FINAL message must be ONLY the structured verdict.`;
}

phase('Crawl');
log(`Crawling official immigration data for ${COUNTRIES.length} countries (Sonnet gather → Opus verify for CBI/RBI).`);

const results = await pipeline(
  COUNTRIES,
  (c) => agent(gatherPrompt(c), {
    label: `gather:${c.iso3}`,
    phase: 'Crawl',
    model: 'sonnet',
    schema: SUMMARY_SCHEMA,
  }).then((s) => ({ country: c, summary: s })),
  ({ country, summary }) => {
    const needsVerify = summary && (summary.has_cbi === true || (summary.rbi_count || 0) > 0);
    if (!needsVerify) return { country, summary, verify: null };
    return agent(verifyPrompt(country), {
      label: `verify:${country.iso3}`,
      phase: 'Verify',
      model: 'opus',
      schema: VERIFY_SCHEMA,
    }).then((v) => ({ country, summary, verify: v }));
  },
);

const ok = results.filter(Boolean);
const failures = COUNTRIES
  .filter((c) => !ok.find((r) => r.country.iso3 === c.iso3 && r.summary && r.summary.written))
  .map((c) => c.iso3);
const cbiCountries = ok.filter((r) => r.summary && r.summary.has_cbi).map((r) => r.country.iso3);
const verified = ok.filter((r) => r.verify && r.verify.verified).map((r) => r.country.iso3);

log(`Done. written=${ok.length - failures.length}/${COUNTRIES.length}, cbi=${cbiCountries.length}, verified=${verified.length}, failures=${failures.length}`);

return {
  total: COUNTRIES.length,
  written: ok.filter((r) => r.summary && r.summary.written).length,
  failures,
  cbiCountries,
  verified,
  summaries: ok.map((r) => ({
    iso3: r.country.iso3,
    completeness: r.summary && r.summary.completeness,
    visa_free: r.summary && r.summary.visa_free_count,
    voa: r.summary && r.summary.voa_count,
    evisa: r.summary && r.summary.evisa_count,
    eta: r.summary && r.summary.eta_count,
    cbi: r.summary && r.summary.has_cbi,
    rbi: r.summary && r.summary.rbi_count,
    fast_track: r.summary && r.summary.fast_track_count,
    verify: r.verify ? (r.verify.verified ? 'verified' : 'unverified') : null,
  })),
};
