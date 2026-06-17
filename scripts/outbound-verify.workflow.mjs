export const meta = {
  name: 'outbound-origin-verify',
  description: "ORIGIN-side verification: for ~200 passports, parallel agents find each country's OWN government list of visa requirements for ITS citizens (the MEA-vffin analog — MFA/passport-office 'visa-free / VoA / e-visa countries for our nationals' page) and record it as that passport's official source-of-record in `outbound_official`. This is the second, origin-side official confirmation of the directed graph (we already verified the inbound/destination side). Official sources only; no aggregators.",
  phases: [
    { title: 'Outbound', detail: "one agent per passport finds its government's outbound visa-info page and records the official source + asserted destinations (Sonnet, WebFetch-first)" },
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

const OUTBOUND_SCHEMA = {
  type: 'object',
  required: ['iso3', 'found'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    found: { type: 'boolean' },
    source_url: { type: 'string' },
    source_official: { type: 'boolean' },
    visa_free_count: { type: 'integer' },
    voa_count: { type: 'integer' },
    evisa_count: { type: 'integer' },
    eta_count: { type: 'integer' },
    note: { type: 'string' },
  },
};

function outboundPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `Find **${c.name}**'s OWN government's authoritative list of where ${c.name} ORDINARY-passport citizens can travel without obtaining a prior consular visa, and record it as this passport's official source-of-record. India's analog is mea.gov.in/vffin ("Visa Facility for Indian Nationals (Ordinary Passport Holders)"). Many foreign ministries / passport offices publish such a page for their own citizens.

## STEP 1 — find the OFFICIAL origin-side page
Load WebSearch + WebFetch (ToolSearch select:WebSearch,WebFetch). Search for ${c.name}'s government page listing visa-free / visa-on-arrival / e-visa destinations FOR ${c.name} CITIZENS — on the Ministry of Foreign Affairs, passport office, or consular-services domain (*.gov, *.gov.<cc>, *.gob.<cc>, *.govt.<cc>, *.gouv.<cc>, official MFA). Read it with WebFetch (fall back to Firecrawl select:mcp__firecrawl-mcp__firecrawl_scrape only if blocked). Seeds: "${c.name} visa free countries for citizens official", "${c.name} ministry foreign affairs visa requirements ${c.name} nationals", "${c.name} passport visa free travel official list". Be economical (~5–10 calls).
DO NOT use aggregators (Wikipedia, Henley, IATA, airlines, visa-agencies). If only those exist, treat as NOT found.

## STEP 2 — extract what the official source asserts
List the destinations ${c.name} citizens may enter, grouped by level: visa_free, visa_on_arrival, e_visa, eta. Capture destination names (and ISO3 if known).

## STEP 3 — write it to the file as source-of-record
Read ${file}. Add/replace a top-level field \`outbound_official\` (KEEP everything else unchanged):
{"found": true/false, "source_url": "<official url>", "source_official": true, "asof": "<date on page if any>",
 "visa_free": [{"name":"","iso3":null}], "visa_on_arrival": [], "e_visa": [], "eta": [], "notes": ""}
If no official origin-side list exists, write {"found": false, "note": "no official ${c.name} government outbound visa-list page located; rely on destination-side data"}.
Write the JSON back to EXACTLY ${file} with the Write tool. visa_policy/conditional_access/etc. MUST be left untouched.

Your FINAL message must be ONLY the structured summary.`;
}

phase('Outbound');
log(`Finding each passport's OWN government outbound visa-list (origin-side source-of-record) for ${COUNTRIES.length} countries (Sonnet, WebFetch-first).`);

const results = await parallel(COUNTRIES.map((c) => () =>
  agent(outboundPrompt(c), {
    label: `outbound:${c.iso3}`,
    phase: 'Outbound',
    model: 'sonnet',
    schema: OUTBOUND_SCHEMA,
  }).then((s) => ({ country: c, summary: s })).catch(() => null),
));

const ok = results.filter(Boolean);
const found = ok.filter((r) => r.summary && r.summary.found);
const failures = COUNTRIES.filter((c) => !ok.find((r) => r.country.iso3 === c.iso3)).map((c) => c.iso3);

log(`Done. official outbound source FOUND for ${found.length}/${COUNTRIES.length}; no official list for ${ok.length - found.length}; agent failures ${failures.length}.`);

return {
  total: COUNTRIES.length,
  withOfficialOutboundSource: found.length,
  noOfficialList: ok.length - found.length,
  failures,
  sources: found.map((r) => ({ iso3: r.country.iso3, src: r.summary.source_url, vf: r.summary.visa_free_count, voa: r.summary.voa_count, evisa: r.summary.evisa_count })).slice(0, 60),
};
