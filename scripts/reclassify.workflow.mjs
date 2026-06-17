export const meta = {
  name: 'reclassify-visa-policy',
  description: 'For ~200 countries, reclassify each one\'s visa_policy entries: MOVE grants that actually require a held third-country visa/residence/PR (credential-conditional) or apply only to diplomatic/service/official passports OUT of the ordinary visa_policy lists and INTO conditional_access, so an ordinary passport only ever sees grants it truly qualifies for. Keeps genuine ordinary / freedom-of-movement / nationality-waiver grants untouched.',
  phases: [
    { title: 'Reclassify', detail: 'one agent per country re-reads its file and separates conditional grants from ordinary ones (Sonnet, no web — uses the official notes already captured)' },
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

// Re-run the 16 countries that failed the first reclassification pass. Set to null to run all.
const REDO = ['LBY','MDG','NER','SSD','TZA','ZWE','BHR','KAZ','PHL','HUN','MLT','CHE','BHS','BRB','BRA','HKG'];
const list = Array.isArray(args) && args.length ? args : REDO;
const COUNTRIES = list
  ? ALL_COUNTRIES.filter((c) => new Set(list.map((s) => String(s).toUpperCase())).has(c.iso3))
  : ALL_COUNTRIES;

const RECLASS_SCHEMA = {
  type: 'object',
  required: ['iso3', 'written', 'moved_credential', 'moved_passport_type'],
  additionalProperties: true,
  properties: {
    iso3: { type: 'string' },
    written: { type: 'boolean' },
    moved_credential: { type: 'integer' },
    moved_passport_type: { type: 'integer' },
    kept_ordinary: { type: 'integer' },
    notes: { type: 'string' },
  },
};

function reclassifyPrompt(c) {
  const file = `${DATA_DIR}/${c.iso3}.json`;
  return `You are cleaning the immigration dataset for ONE destination — **${c.name}** (${c.iso3}). The goal: an ORDINARY passport must only ever see entry grants it TRULY qualifies for. Right now some \`visa_policy\` entries are actually CONDITIONAL but are stored as if they were plain nationality grants. Reclassify them. Work ONLY from the data already in the file (its notes were captured from official sources) — do NOT browse the web.

## STEP 1 — read the file
Use the Read tool on EXACTLY: ${file}

## STEP 2 — examine every entry in visa_policy.{visa_free, visa_on_arrival, e_visa, eta}
For each entry decide which bucket it belongs to, using its \`nationality\` + \`notes\`:

KEEP as ordinary (leave in visa_policy) — the grant applies to that nationality's ORDINARY passport by nationality alone:
- plain nationality waivers ("Citizens of X visa-free 90 days"), visa-on-arrival/e-visa available to that nationality,
- freedom-of-movement / blocs (EU/EEA/Schengen/GCC/CARICOM/ECOWAS/Mercosur…), "may enter with national ID card",
- EU Regulation 2018/1806 Annex II / ETIAS / general eTA that apply to ordinary passports.
DO NOT move these.

MOVE to conditional_access — the grant is NOT available to an ordinary passport by nationality alone:
- **credential-conditional**: it REQUIRES the traveller to HOLD a valid third-country visa / residence permit / permanent residence / Green Card (e.g. "requires valid multiple-entry EU/Schengen visa", "only with a valid US visa", "holders of a US Green Card").
- **passport-type-only**: it applies ONLY to diplomatic / service / official passports (e.g. "Diplomatic and service passports only", "no visa required for diplomatic/official passport holders", bilateral "visa suppression agreement").

## STEP 3 — rewrite the file
- REMOVE every moved entry from its visa_policy.{level} array.
- ADD it to the top-level \`conditional_access\` array (create if missing; keep any existing elements, avoid duplicates) in this shape:
{"basis":"credential|passport_type|special_status","eligible_nationalities":["<the entry's nationality>"],"passport_types":["diplomatic","service"]|["ordinary"]|"any","credential":{"issuer":"US|Schengen|EU|UK|Canada|Australia|Japan|GCC|India|…","type":"visa|residence_permit|permanent_resident|oci","subtype":"<verbatim if stated, else 'any valid visa'>"}|null,"level":"<same level>","max_stay_days":<number|null>,"conditions":"<copy the entry's note text>","source_url":"<entry.source_url>","source_official":<entry.source_official>}
   - credential-conditional → basis="credential", credential filled, passport_types ["ordinary"].
   - passport-type-only → basis="passport_type", credential=null, passport_types the allowed types.
   - OCI / diaspora status → basis="special_status".
- Keep ALL other fields (cbi, rbi, fast_track, agreements, official_domains, data_quality, visa_required, etc.) UNCHANGED.
- Write the corrected JSON back to EXACTLY ${file} with the Write tool. If nothing needs moving, write the file back unchanged.

Be conservative: when genuinely unsure whether a grant needs a held credential, KEEP it as ordinary. Your FINAL message must be ONLY the structured summary (how many you moved, kept).`;
}

phase('Reclassify');
log(`Reclassifying visa_policy → conditional_access for ${COUNTRIES.length} countries (Sonnet, no web).`);

const results = await parallel(COUNTRIES.map((c) => () =>
  agent(reclassifyPrompt(c), {
    label: `reclass:${c.iso3}`,
    phase: 'Reclassify',
    model: 'sonnet',
    schema: RECLASS_SCHEMA,
  }).then((s) => ({ country: c, summary: s })).catch(() => null),
));

const ok = results.filter(Boolean);
const written = ok.filter((r) => r.summary && r.summary.written);
const movedCred = ok.reduce((s, r) => s + ((r.summary && r.summary.moved_credential) || 0), 0);
const movedPt = ok.reduce((s, r) => s + ((r.summary && r.summary.moved_passport_type) || 0), 0);
const failures = COUNTRIES.filter((c) => !written.find((r) => r.country.iso3 === c.iso3)).map((c) => c.iso3);

log(`Done. written=${written.length}/${COUNTRIES.length}, moved credential=${movedCred}, moved passport-type=${movedPt}, failures=${failures.length}`);

return {
  total: COUNTRIES.length,
  written: written.length,
  movedCredential: movedCred,
  movedPassportType: movedPt,
  failures,
  topMovers: ok
    .map((r) => ({ iso3: r.country.iso3, cred: (r.summary && r.summary.moved_credential) || 0, pt: (r.summary && r.summary.moved_passport_type) || 0 }))
    .filter((x) => x.cred + x.pt > 0)
    .sort((a, b) => b.cred + b.pt - (a.cred + a.pt))
    .slice(0, 30),
};
