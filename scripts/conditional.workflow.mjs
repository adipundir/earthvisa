export const meta = {
  name: 'conditional-access-crawl',
  description: 'For ~200 countries, scrape each one\'s OWN official sources for CONDITIONAL entry rules — exemptions granted for holding a third-country visa/residence/PR (US/Canada/UK/Schengen/EU/Australia/Japan/GCC), special statuses (India OCI), and passport-type-only waivers (diplomatic/service/official). Augments data/countries/<ISO3>.json with a structured conditional_access array.',
  phases: [
    { title: 'Conditional', detail: 'one agent per country reads its file and adds official conditional-access rules (Sonnet, WebFetch-first)' },
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

// Default to the 32 countries that failed the first conditional run (session limit + sockets).
// `args` does not reliably plumb through the Workflow tool, so the set is hardcoded; set
// FULL=true to run all ~199.
const FULL = false;
const REDO = ['IRN','LUX','MNE','HND','NIC','PER','KNA','LCA','VCT','TTO','USA','URY','AUS','FJI','KIR','MHL','FSM','NRU','NZL','PLW','PNG','WSM','SLB','TON','TUV','VUT','XKX','TWN','VAT','PSE','HKG','MAC'];
const list = Array.isArray(args) && args.length ? args : (FULL ? null : REDO);
const COUNTRIES = list
  ? ALL_COUNTRIES.filter((c) => new Set(list.map((s) => String(s).toUpperCase())).has(c.iso3))
  : ALL_COUNTRIES;

const COND_SCHEMA = {
  type: 'object',
  required: ['iso3', 'written', 'conditional_count'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    written: { type: 'boolean' },
    conditional_count: { type: 'integer' },
    credential_count: { type: 'integer' },
    passport_type_count: { type: 'integer' },
    oci_found: { type: 'boolean' },
    issuers: { type: 'array', items: { type: 'string' } },
    completeness: { type: 'string', enum: ['high', 'medium', 'low'] },
    gaps: { type: 'array', items: { type: 'string' } },
  },
};

function conditionalPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are a meticulous immigration researcher. For ONE destination — **${c.name}** (iso2=${c.iso2}, iso3=${c.iso3}) — collect every OFFICIAL **conditional entry rule**: a rule that lets a traveller enter ${c.name} based on something OTHER than (or in addition to) their nationality. Three kinds:

A) **Held third-country credential** — visa-free / VoA / e-visa / eTA granted because the traveller HOLDS a valid foreign visa, residence permit, or permanent residence. Capture the EXACT credential, because conditions differ by type:
   - issuer: US | Canada | UK | Schengen | EU | Australia | Japan | GCC | UAE | other (name it)
   - credential.type: visa | residence_permit | permanent_resident | other
   - credential.subtype: the SPECIFIC class verbatim if stated — e.g. "B1/B2", "B2 tourist", "F-1 student", "H-1B", "C transit", "any valid visa", "Type C (short-stay)", "Type D (national/long-stay)", "Green Card", "ILR / settlement", "PR card". If the page says "any valid US visa", subtype="any valid visa".
B) **Special status** — e.g. India **OCI** (Overseas Citizen of India) cardholders, or similar diaspora/heritage statuses. Capture issuer="India", credential.type="oci".
C) **Passport-type-only waiver** — visa exemption that applies ONLY to **diplomatic / service / official** passports (often via a named bilateral "visa suppression / visa waiver agreement" with a date). These must NOT be counted for ordinary passport holders.

## HARD RULES (official-source-first)
- Record a rule ONLY from an OFFICIAL government / immigration / MFA / e-visa domain (*.gov, *.gov.<cc>, *.gob.<cc>, *.govt.<cc>, *.gouv.<cc>, official ministry/agency). Capture exact source_url; source_official=true only for genuine official domains. If only an aggregator (Wikipedia/Henley/IATA/news/law-firm) has it, DO NOT record — note it under gaps. NEVER invent.
- Capture conditions verbatim-ish (e.g. "visa must have been used at least once", "passport/visa valid ≥6 months", "single entry, 30 days, fee US$100", "agreement dated 29 July 2019").

## TOOLS
PREFER raw official pages via WebFetch. Load WebSearch + WebFetch (ToolSearch select:WebSearch,WebFetch); WebSearch to find the official URL, WebFetch to read it. Fall back to Firecrawl (ToolSearch select:mcp__firecrawl-mcp__firecrawl_scrape) ONLY when WebFetch is blocked/empty. Be economical (~6–12 calls). Search seeds: "${c.name} visa exemption holders of US visa official", "${c.name} visa free Schengen visa holders immigration", "${c.name} diplomatic service passport visa waiver agreement", "${c.name} OCI cardholder entry", "${c.name} visa policy official residence permit".

## OUTPUT — MERGE INTO THE FILE
1. Read the existing file with the Read tool: ${file}
2. Keep ALL existing fields unchanged. ADD a top-level "conditional_access" array (replace it if already present). Each element:
{"basis":"credential|special_status|passport_type","eligible_nationalities":["India"] or "any","passport_types":["diplomatic","service"] or ["ordinary"] or "any","credential":{"issuer":"US","type":"visa","subtype":"B1/B2"} or null,"level":"visa_free|visa_on_arrival|e_visa|eta","max_stay_days":number|null,"conditions":"","source_url":"","source_official":true}
   - For passport-type-only waivers: basis="passport_type", credential=null, passport_types=["diplomatic"] and/or ["service"]/["official"].
   - For OCI etc.: basis="special_status", credential={"issuer":"India","type":"oci","subtype":"OCI card"}.
3. Write the merged JSON back to EXACTLY ${file} with the Write tool. If you find NO official conditional rules, set "conditional_access":[] and add a short note to data_quality.gaps.

After writing, your FINAL message must be ONLY the structured summary (counts + issuers + gaps).`;
}

phase('Conditional');
log(`Gathering official CONDITIONAL entry rules (held-visa / PR / OCI / diplomatic-service) for ${COUNTRIES.length} countries (Sonnet, WebFetch-first).`);

const results = await parallel(COUNTRIES.map((c) => () =>
  agent(conditionalPrompt(c), {
    label: `cond:${c.iso3}`,
    phase: 'Conditional',
    model: 'sonnet',
    schema: COND_SCHEMA,
  }).then((s) => ({ country: c, summary: s })).catch(() => null),
));

const ok = results.filter(Boolean);
const written = ok.filter((r) => r.summary && r.summary.written);
const withRules = ok.filter((r) => r.summary && (r.summary.conditional_count || 0) > 0);
const ociFound = ok.filter((r) => r.summary && r.summary.oci_found).map((r) => r.country.iso3);
const failures = COUNTRIES.filter((c) => !written.find((r) => r.country.iso3 === c.iso3)).map((c) => c.iso3);

log(`Done. written=${written.length}/${COUNTRIES.length}, with conditional rules=${withRules.length}, OCI=${ociFound.length}, failures=${failures.length}`);

return {
  total: COUNTRIES.length,
  written: written.length,
  withConditionalRules: withRules.length,
  totalConditionalRules: ok.reduce((s, r) => s + ((r.summary && r.summary.conditional_count) || 0), 0),
  ociFound,
  failures,
  summaries: ok.map((r) => ({
    iso3: r.country.iso3,
    conditional: r.summary && r.summary.conditional_count,
    credentials: r.summary && r.summary.credential_count,
    passport_type: r.summary && r.summary.passport_type_count,
    oci: r.summary && r.summary.oci_found,
    issuers: r.summary && r.summary.issuers,
  })),
};
