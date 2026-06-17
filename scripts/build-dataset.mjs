// Reads data/countries/*.json (crawl output) and builds src/data/dataset.json:
//  - cleans each country record
//  - resolves visa-policy nationality strings -> iso3 (alias + regional-group expansion)
//  - inverts the matrix: per passport, where can it go and at what access level
//  - flattens CBI / RBI / fast-track programs into global lists
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COUNTRIES_DIR = join(ROOT, "data", "countries");
const LIST_PATH = join(ROOT, "data", "countries.json");
const OUT_DIR = join(ROOT, "src", "data");
const OUT_PATH = join(OUT_DIR, "dataset.json");

const masterList = JSON.parse(readFileSync(LIST_PATH, "utf8"));
const byIso3 = new Map(masterList.map((c) => [c.iso3, c]));

// ---- name -> iso3 resolution -----------------------------------------------
const strip = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const nameToIso3 = new Map();
for (const c of masterList) {
  nameToIso3.set(strip(c.name), c.iso3);
  nameToIso3.set(strip(c.iso2), c.iso3);
  nameToIso3.set(strip(c.iso3), c.iso3);
}
const ALIASES = {
  "united states of america": "USA", usa: "USA", "u s a": "USA", america: "USA", "u s": "USA",
  "united kingdom": "GBR", uk: "GBR", "great britain": "GBR", britain: "GBR", "u k": "GBR",
  "republic of korea": "KOR", "korea republic of": "KOR", "south korea": "KOR", "korea south": "KOR",
  "democratic people s republic of korea": "PRK", dprk: "PRK", "north korea": "PRK", "korea north": "PRK",
  "russian federation": "RUS", "czech republic": "CZE", czechia: "CZE",
  "united arab emirates": "ARE", uae: "ARE",
  "ivory coast": "CIV", "cote d ivoire": "CIV",
  "cape verde": "CPV", "cabo verde": "CPV", burma: "MMR",
  "holy see": "VAT", vatican: "VAT", "vatican city": "VAT",
  palestinian: "PSE", "palestinian territories": "PSE", "state of palestine": "PSE",
  "hong kong sar": "HKG", "hong kong sar china": "HKG", hongkong: "HKG",
  macao: "MAC", "chinese taipei": "TWN",
  swaziland: "SWZ", "east timor": "TLS",
  "republic of the congo": "COG", "congo brazzaville": "COG", congo: "COG",
  "democratic republic of the congo": "COD", "congo kinshasa": "COD", "dr congo": "COD", drc: "COD",
  "lao pdr": "LAO", "lao people s democratic republic": "LAO",
  "syrian arab republic": "SYR", "brunei darussalam": "BRN",
  "republic of moldova": "MDA", "united republic of tanzania": "TZA",
  "plurinational state of bolivia": "BOL", "bolivarian republic of venezuela": "VEN",
  "islamic republic of iran": "IRN", "federated states of micronesia": "FSM",
  "sao tome and principe": "STP", "the gambia": "GMB", "kyrgyz republic": "KGZ",
  "slovak republic": "SVK", "republic of north macedonia": "MKD", macedonia: "MKD",
  "turkiye": "TUR", "republic of turkey": "TUR",
  israeli: "ISR", chinese: "CHN", taiwanese: "TWN",
};
for (const [k, v] of Object.entries(ALIASES)) nameToIso3.set(strip(k), v);

// ---- regional groups (iso3 lists) ------------------------------------------
const GROUPS = {
  EU: ["AUT","BEL","BGR","HRV","CYP","CZE","DNK","EST","FIN","FRA","DEU","GRC","HUN","IRL","ITA","LVA","LTU","LUX","MLT","NLD","POL","PRT","ROU","SVK","SVN","ESP","SWE"],
  EFTA: ["ISL","LIE","NOR","CHE"],
  GCC: ["BHR","KWT","OMN","QAT","SAU","ARE"],
  CARICOM: ["ATG","BHS","BRB","BLZ","DMA","GRD","GUY","HTI","JAM","KNA","LCA","VCT","SUR","TTO"],
  OECS: ["ATG","DMA","GRD","KNA","LCA","VCT"],
  ECOWAS: ["BEN","BFA","CPV","CIV","GMB","GHA","GIN","GNB","LBR","MLI","NER","NGA","SEN","SLE","TGO"],
  ASEAN: ["BRN","KHM","IDN","LAO","MYS","MMR","PHL","SGP","THA","VNM"],
  MERCOSUR: ["ARG","BRA","PRY","URY","BOL"],
  ANDEAN: ["BOL","COL","ECU","PER"],
  CIS: ["ARM","AZE","BLR","KAZ","KGZ","MDA","RUS","TJK","TKM","UZB"],
  CTA: ["GBR","IRL"],
  TRANS_TASMAN: ["AUS","NZL"],
  EAC: ["BDI","COD","KEN","RWA","SSD","TZA","UGA","SOM"],
};
GROUPS.EEA = [...GROUPS.EU, "ISL", "LIE", "NOR"];
GROUPS.SCHENGEN = [...GROUPS.EU.filter((c) => !["IRL","CYP"].includes(c)), "ISL","LIE","NOR","CHE"];
const GROUP_LABELS = {
  EU: "European Union", EEA: "European Economic Area", EFTA: "EFTA", SCHENGEN: "Schengen Area",
  GCC: "Gulf Cooperation Council", CARICOM: "CARICOM", OECS: "Org. of Eastern Caribbean States",
  ECOWAS: "ECOWAS (West Africa)", ASEAN: "ASEAN", MERCOSUR: "Mercosur", ANDEAN: "Andean Community",
  CIS: "Commonwealth of Independent States", CTA: "Common Travel Area (UK–Ireland)",
  TRANS_TASMAN: "Trans-Tasman (AU–NZ)", EAC: "East African Community",
};

// Extra regional blocs used ONLY to expand visa-policy nationality labels (not shipped as
// "freedom of movement", since most are trade blocs without settlement rights).
const EXPANSION_ONLY = {
  COMESA: ["BDI","COM","COD","DJI","EGY","ERI","SWZ","ETH","KEN","LBY","MDG","MWI","MUS","RWA","SYC","SOM","SDN","TUN","UGA","ZMB","ZWE"],
  SADC: ["AGO","BWA","COD","SWZ","LSO","MWI","MOZ","MUS","NAM","ZAF","SYC","TZA","ZMB","ZWE","MDG","COM"],
  ECCAS: ["AGO","BDI","CMR","CAF","TCD","COD","COG","GNQ","GAB","RWA","STP"],
  CEMAC: ["CMR","CAF","TCD","COG","GNQ","GAB"],
  WAEMU: ["BEN","BFA","CIV","GNB","MLI","NER","SEN","TGO"],
  SACU: ["BWA","SWZ","LSO","NAM","ZAF"],
};
const ALL_ISO3 = masterList.map((c) => c.iso3);

// match a free-text nationality label to a regional group, returns iso3[] or null
function labelToGroup(label) {
  const s = strip(label);
  const has = (...words) => words.some((w) => s.includes(w));
  // "all nationalities / all countries / any nationality / all visitors" -> every passport
  if (
    /\ball (nationalit|countr|passport|visitor|foreign national|traveler|traveller)/.test(s) ||
    /\b(any|every|each) (nationalit|countr|passport)/.test(s) ||
    s === "all" || s === "worldwide" || s.includes("all other nationalit")
  ) {
    return ALL_ISO3;
  }
  if (has("european union", "eu citizen", "eu national", "eu member", "schengen")) {
    if (has("schengen")) return GROUPS.SCHENGEN;
    if (has("eea", "european economic")) return GROUPS.EEA;
    return GROUPS.EU;
  }
  if (has("eea", "european economic")) return GROUPS.EEA;
  if (has("efta")) return GROUPS.EFTA;
  if (has("gcc", "gulf cooperation", "gulf countries")) return GROUPS.GCC;
  if (has("caricom")) return GROUPS.CARICOM;
  if (has("oecs", "eastern caribbean")) return GROUPS.OECS;
  if (has("ecowas")) return GROUPS.ECOWAS;
  if (has("asean")) return GROUPS.ASEAN;
  if (has("mercosur")) return GROUPS.MERCOSUR;
  if (has("andean")) return GROUPS.ANDEAN;
  if (has("cis countries", "commonwealth of independent")) return GROUPS.CIS;
  if (has("east african community", "eac member", "eac partner")) return GROUPS.EAC;
  if (has("comesa")) return EXPANSION_ONLY.COMESA;
  if (has("sadc", "southern african development")) return EXPANSION_ONLY.SADC;
  if (has("cemac")) return EXPANSION_ONLY.CEMAC;
  if (has("eccas", "central african states")) return EXPANSION_ONLY.ECCAS;
  if (has("waemu", "uemoa", "west african economic")) return EXPANSION_ONLY.WAEMU;
  if (has("sacu", "southern african customs")) return EXPANSION_ONLY.SACU;
  return null;
}

// ---- conditional access: held third-country credentials, special status, passport-type waivers ---
// The credential catalog is DATA-DRIVEN: every (issuer, kind) pair found in the official rules
// becomes a selectable credential. kind ∈ visa | tr (residence permit) | pr (permanent residence).
// US-visa rules almost always say "any valid US visa", so visa classes are NOT split into chips —
// the exact accepted classes / exclusions are surfaced in each destination's note instead.
const GROUP_ORDER = ["United States", "Canada", "United Kingdom", "Schengen / Europe", "Australia / NZ", "Japan / Asia", "Gulf (GCC)", "India", "Other"];

// canonical issuer -> { code, name, group }
function normIssuer(raw) {
  const s = String(raw || "").toLowerCase().trim();
  const table = [
    [/united states|u\.?s\.?\b|america/, { code: "US", name: "United States", group: "United States" }],
    [/canada/, { code: "CA", name: "Canada", group: "Canada" }],
    [/united kingdom|britain|\buk\b/, { code: "UK", name: "United Kingdom", group: "United Kingdom" }],
    [/schengen/, { code: "SCHENGEN", name: "Schengen", group: "Schengen / Europe" }],
    [/european union|\beu\b|eea/, { code: "EU", name: "EU", group: "Schengen / Europe" }],
    [/ireland/, { code: "IE", name: "Ireland", group: "Schengen / Europe" }],
    [/switzerland|swiss/, { code: "CH", name: "Switzerland", group: "Schengen / Europe" }],
    [/cyprus/, { code: "CY", name: "Cyprus", group: "Schengen / Europe" }],
    [/romania/, { code: "RO", name: "Romania", group: "Schengen / Europe" }],
    [/bulgaria/, { code: "BG", name: "Bulgaria", group: "Schengen / Europe" }],
    [/germany/, { code: "DE", name: "Germany", group: "Schengen / Europe" }],
    [/croatia/, { code: "HR", name: "Croatia", group: "Schengen / Europe" }],
    [/australia/, { code: "AU", name: "Australia", group: "Australia / NZ" }],
    [/new zealand/, { code: "NZ", name: "New Zealand", group: "Australia / NZ" }],
    [/japan/, { code: "JP", name: "Japan", group: "Japan / Asia" }],
    [/korea/, { code: "KR", name: "South Korea", group: "Japan / Asia" }],
    [/gcc|gulf cooperation/, { code: "GCC", name: "GCC", group: "Gulf (GCC)" }],
    [/uae|united arab emirates/, { code: "UAE", name: "UAE", group: "Gulf (GCC)" }],
    [/saudi/, { code: "SA", name: "Saudi Arabia", group: "Gulf (GCC)" }],
    [/qatar/, { code: "QA", name: "Qatar", group: "Gulf (GCC)" }],
    [/\bapec\b/, { code: "APEC", name: "APEC", group: "Other" }],
    [/india/, { code: "IN", name: "India", group: "India" }],
  ];
  for (const [re, meta] of table) if (re.test(s)) return meta;
  const name = (String(raw || "Other").trim() || "Other").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 22);
  return { code: (s.replace(/[^a-z0-9]+/g, "_").toUpperCase().slice(0, 14)) || "OTHER", name, group: "Other" };
}

// classify a credential into a kind bucket
function kindOf(type, subtype) {
  const t = String(type || "").toLowerCase();
  const sub = String(subtype || "").toLowerCase();
  // respect the explicit type first — a "visa (incl. Green Card)" rule is still a visa
  if (t === "oci") return "oci";
  if (t === "permanent_resident") return "pr";
  if (t === "residence_permit") return "tr";
  if (t === "visa") return "visa";
  if (t === "other") return "other";
  // no/ambiguous type → fall back to subtype wording
  if (/\boci\b|overseas citizen of india/.test(sub)) return "oci";
  if (/green card|permanent resident|long-term resident|\bilr\b|settle/.test(sub)) return "pr";
  if (/residence permit|residence card|residency/.test(sub)) return "tr";
  return "visa";
}

// Consolidated, COMPLETE credential catalog — one clean chip per common held credential.
// (EU member-state visas/permits all roll up to Schengen/EU; institutional permits roll to "other".)
const CRED_CATALOG = [
  { id: "US_VISA", group: "United States", short: "US visa", label: "US visa (any valid type)" },
  { id: "US_GREEN_CARD", group: "United States", short: "US Green Card", label: "US Green Card / permanent resident" },
  { id: "CA_VISA", group: "Canada", short: "Canada visa", label: "Canada visa" },
  { id: "CA_PR", group: "Canada", short: "Canada PR", label: "Canada permanent resident" },
  { id: "UK_VISA", group: "United Kingdom", short: "UK visa", label: "UK visa" },
  { id: "UK_PR", group: "United Kingdom", short: "UK PR", label: "UK ILR / settled status" },
  { id: "SCHENGEN_VISA", group: "Schengen / EU", short: "Schengen visa", label: "Schengen visa (any member state)" },
  { id: "EU_RESIDENCE", group: "Schengen / EU", short: "EU residence", label: "EU / Schengen residence permit or PR" },
  { id: "AU_VISA", group: "Australia", short: "Australia visa", label: "Australia visa" },
  { id: "AU_PR", group: "Australia", short: "Australia PR", label: "Australia permanent resident" },
  { id: "NZ_VISA", group: "New Zealand", short: "NZ visa", label: "New Zealand visa or residence" },
  { id: "JP_VISA", group: "Japan", short: "Japan visa", label: "Japan visa or residence" },
  { id: "KR_VISA", group: "South Korea", short: "Korea visa", label: "South Korea visa or residence permit" },
  { id: "SGP_VISA", group: "Singapore", short: "Singapore visa", label: "Singapore visa or residence permit" },
  { id: "GCC_RESIDENCE", group: "Gulf (GCC)", short: "GCC residence", label: "GCC / UAE residence permit" },
  { id: "OCI", group: "India", short: "OCI card", label: "OCI card (Overseas Citizen of India)" },
  // Pacific Alliance member PRs unlock reciprocal visa-free entry between Pacific Alliance states.
  // Sources: Pacific Alliance Framework Agreement art. 10; DS N° 061-2016-RE (Peru);
  // Guatemalan IGM Acuerdo 015-2025 (Mexico visa/PR -> Guatemala entry).
  { id: "MX_VISA", group: "Mexico", short: "Mexico visa", label: "Mexico visa (any valid type)" },
  { id: "MX_PR", group: "Mexico", short: "Mexico PR", label: "Mexico permanent resident" },
  { id: "CHL_PR", group: "Chile", short: "Chile PR", label: "Chile permanent resident (Pacific Alliance)" },
  { id: "COL_PR", group: "Colombia", short: "Colombia PR", label: "Colombia permanent resident (Pacific Alliance)" },
  { id: "PER_PR", group: "Peru", short: "Peru PR", label: "Peru permanent resident (Pacific Alliance)" },
  { id: "BRA_PR", group: "Brazil", short: "Brazil PR/residence", label: "Brazil legal residence permit" },
];

// Map a structured credential {issuer,type,subtype} to ONE consolidated catalog id.
function credId(cr) {
  if (!cr) return "OTHER_CRED";
  const iss = String(cr.issuer || "").toLowerCase();
  const type = String(cr.type || "").toLowerCase();
  const sub = String(cr.subtype || "").toLowerCase();
  const isPR = type === "permanent_resident" || type === "residence_permit" ||
    /green card|permanent resident|residence permit|residence card|long-term resident|\bilr\b|settle|residency|\bpr\b/.test(sub);
  if (type === "oci" || /\boci\b|overseas citizen of india/.test(iss + " " + sub)) return "OCI";
  if (/united states|u\.?s\.?\b|america/.test(iss)) return isPR ? "US_GREEN_CARD" : "US_VISA";
  if (/canada/.test(iss)) return isPR ? "CA_PR" : "CA_VISA";
  if (/united kingdom|britain|\buk\b/.test(iss)) return isPR ? "UK_PR" : "UK_VISA";
  if (/australia/.test(iss)) return isPR ? "AU_PR" : "AU_VISA";
  if (/new zealand/.test(iss)) return "NZ_VISA";
  if (/japan/.test(iss)) return "JP_VISA";
  if (/gcc|gulf|uae|united arab emirates|saudi|qatar|bahrain|kuwait|\boman\b/.test(iss)) return "GCC_RESIDENCE";
  if (/south korea|republic of korea|\bkorea\b|\bkor\b/.test(iss)) return "KR_VISA";
  if (/singapore|\bsgp\b/.test(iss)) return "SGP_VISA";
  if (/schengen|european union|\beu\b|eea|efta|ireland|switzerland|swiss|cyprus|romania|bulgaria|germany|croatia|france|spain|italy|portugal|netherland|belgium|austria|sweden|denmark|finland|norway|iceland|liechtenstein|poland|czech|hungary|greece|slovak|sloven|estonia|latvia|lithuania|luxembourg|malta|andorra|san marino|monaco/.test(iss)) return isPR ? "EU_RESIDENCE" : "SCHENGEN_VISA";
  // Pacific Alliance member credentials
  if (/\bmexico\b|\bmex\b/.test(iss)) return isPR ? "MX_PR" : "MX_VISA";
  if (/\bchile\b|\bchl\b/.test(iss)) return "CHL_PR";
  if (/\bcolombia\b|\bcol\b|pacific alliance/.test(iss)) return "COL_PR";
  if (/\bperu\b|\bper\b/.test(iss)) return "PER_PR";
  if (/\bbrazil\b|\bbra\b/.test(iss)) return "BRA_PR";
  return "OTHER_CRED";
}

// Safety net for entries NOT yet reclassified: detect a held-foreign-credential REQUIREMENT
// stated in the NOTES (e.g. "requires valid multiple-entry EU/Schengen visa"). Conservative —
// must have a requirement marker AND a foreign visa/residence phrase, and must not be a plain
// nationality/freedom-of-movement grant. Returns credential objects or [].
function notesHeldCredential(notes) {
  const s = (notes || "").toLowerCase();
  if (!/\b(requir|must (hold|have|possess)|only (with|valid with)|provided[^.]{0,15}(hold|have)|conditional on|holders? of (a )?valid)\b/.test(s)) return [];
  const foreignCred =
    /\b(us|u\.s|united states|schengen|eu|european|uk|united kingdom|british|canad|australia|japan|gcc|gulf)\b[^.]{0,30}\b(visa|residence|permit|green card|permanent resident)\b/.test(s) ||
    /\bvalid[^.]{0,30}\b(visa|residence permit|green card|permanent resident)\b/.test(s);
  if (!foreignCred) return [];
  if (/freedom of movement|national identity card|annex ii|\betias\b|may enter with/.test(s)) return [];
  return credObjsFromLabel(s);
}

// fallback: synthesize credential objects from a free-text visa-policy nationality label
function credObjsFromLabel(natRaw) {
  const s = (natRaw || "").toLowerCase();
  if (!/holder|valid|residence permit|green card|permanent resident|\boci\b/.test(s)) return [];
  const out = [];
  if (/\boci\b|overseas citizen of india/.test(s)) out.push({ issuer: "India", type: "oci", subtype: "OCI card" });
  if (/green card|permanent resident|lawful permanent resident/.test(s)) out.push({ issuer: "US", type: "permanent_resident", subtype: "Green Card" });
  else if (/\b(u\.?s\.?|united states|american)\b[^.]{0,24}\bvisa\b|\bus visa\b/.test(s)) out.push({ issuer: "US", type: "visa", subtype: "" });
  if (/schengen/.test(s)) out.push({ issuer: "Schengen", type: "visa", subtype: /type d|long-?stay|national/.test(s) ? "Type D" : "Type C" });
  if (/\b(uk|united kingdom|british)\b[^.]{0,18}\b(visa|residence)\b/.test(s)) out.push({ issuer: "UK", type: /ilr|settle|permanent/.test(s) ? "permanent_resident" : "visa", subtype: "" });
  if (/canad/.test(s)) out.push({ issuer: "Canada", type: /permanent|pr card/.test(s) ? "permanent_resident" : "visa", subtype: "" });
  if (/\beu\b|european union|\beea\b|european economic/.test(s)) out.push({ issuer: "EU", type: "residence_permit", subtype: "" });
  if (/\buae\b|united arab emirates|\bgcc\b|gulf cooperation/.test(s)) out.push({ issuer: "GCC", type: "residence_permit", subtype: "" });
  return out;
}

// Detect a passport-type-ONLY restriction from the nationality label AND the notes
// ("Diplomatic and service passports only", "no visa required for diplomatic/official…").
// Returns PassportType[] when the waiver is restricted to non-ordinary passports, else [].
// Crucially: if the text explicitly grants ORDINARY passports, it is NOT restricted.
function restrictedPassportTypes(nationality, notes) {
  const nat = (nationality || "").toLowerCase();
  const text = `${nat} ${(notes || "").toLowerCase()}`;
  // explicit ordinary grant => the rule covers ordinary travellers, do not restrict
  if (/ordinary passport/.test(text)) return [];
  const restricted =
    /(diplomatic|service|official)[^.]{0,45}passports?\s+only/.test(text) ||
    /passports?\s+only[^.]{0,30}(diplomatic|service|official)/.test(text) ||
    /\bonly[^.]{0,30}(diplomatic|service|official)[^.]{0,20}passport/.test(text) ||
    /no visa (is )?required for[^.]{0,30}(diplomatic|official|service)/.test(text) ||
    /(diplomatic|service|official)[^.]{0,45}passports? only exempt/.test(text) ||
    /\bcategory d\d?\b[^.]{0,40}(diplomatic|official|service)/.test(text) ||
    (/passport|holder/.test(nat) && /diplomatic|service|official/.test(nat));
  if (!restricted) return [];
  const out = [];
  if (/diplomatic/.test(text)) out.push("diplomatic");
  if (/\bservice\b/.test(text)) out.push("service");
  if (/official/.test(text)) out.push("official");
  return out.length ? [...new Set(out)] : ["diplomatic", "service"];
}

// Resolve a free-text nationality (or list) to iso3[]; null/"any" => any nationality.
function resolveNatList(val) {
  if (val == null || (typeof val === "string" && /^any$/i.test(val.trim()))) return null;
  const items = Array.isArray(val) ? val : [val];
  const out = new Set();
  for (const it of items) {
    const grp = labelToGroup(it);
    if (grp) { grp.forEach((x) => out.add(x)); continue; }
    const direct = nameToIso3.get(strip(it));
    if (direct) { out.add(direct); continue; }
    const trimmed = strip(it).replace(/\b(citizens?|nationals?|passport holders?|residents?)\b/g, "").trim();
    if (trimmed && nameToIso3.get(trimmed)) out.add(nameToIso3.get(trimmed));
  }
  return out.size ? [...out] : null;
}

// Which nationalities does a credential-conditional LABEL apply to? iso3[] or null = any.
function nationalityScope(natRaw) {
  const noParens = (natRaw || "").replace(/\([^)]*\)/g, "").trim();
  const direct = nameToIso3.get(strip(noParens));
  if (direct) return [direct];
  const trimmed = strip(noParens).replace(/\b(citizens?|nationals?|passport holders?|residents?)\b/g, "").trim();
  if (trimmed && nameToIso3.get(trimmed)) return [nameToIso3.get(trimmed)];
  const grp = labelToGroup(noParens);
  if (grp && !/holder|valid/.test(noParens.toLowerCase())) return grp;
  return null;
}

// Detect "all nationalities EXCEPT …" style entries. Expanding these to ALL passports is the
// classic false-positive (e.g. India shown visa-free to Chile though India is on Chile's
// visa-REQUIRED list). Returns { excepts: string[], externalList: bool } or null.
function negationInfo(label) {
  const s = (label || "").toLowerCase();
  const isAll = /\b(all|any|every|todos|todas)\b/.test(s);
  const isNeg = /(not listed|not included|not enumerated|no listad|except|excluding|excepto|other than|salvo)/.test(s);
  if (!isAll || !isNeg) return null;
  let excepts = [];
  const m = s.match(/(?:except|excluding|excepto|other than|salvo)\s*:?\s*(.+)$/);
  if (m) {
    excepts = m[1]
      .replace(/\b(passport holders?|nationals?|citizens?|countries|nationalities|and|y)\b/g, " ")
      .split(/[,;/&]|\band\b/)
      .map((x) => x.trim())
      .filter((x) => x && x.length > 2);
  }
  // references an external list/decree/annex with no inline names we can resolve
  const externalList = excepts.length === 0 && /\b(list|listad|decreto|decree|annex|regulation|ica|restricted|visa-required)\b/.test(s);
  return { excepts, externalList };
}

const unresolved = new Map(); // label -> count
const negationGaps = []; // entries we could not safely expand

function resolveOrigins(entry) {
  // returns array of iso3
  if (entry.iso3 && byIso3.has(String(entry.iso3).toUpperCase())) return [String(entry.iso3).toUpperCase()];
  const label = entry.nationality || "";
  const grp = labelToGroup(label);
  if (grp) return grp;
  const direct = nameToIso3.get(strip(label));
  if (direct) return [direct];
  // try trimming trailing words like "citizens", "nationals", "passport holders"
  const trimmed = strip(label).replace(/\b(citizens?|nationals?|passport holders?|residents?)\b/g, "").trim();
  if (trimmed && nameToIso3.get(trimmed)) return [nameToIso3.get(trimmed)];
  if (label.trim()) unresolved.set(label.trim(), (unresolved.get(label.trim()) || 0) + 1);
  return [];
}

// ---- read country files ----------------------------------------------------
let files = [];
try {
  files = readdirSync(COUNTRIES_DIR).filter((f) => f.endsWith(".json"));
} catch {
  files = [];
}

const LEVEL_RANK = { visa_free: 4, visa_on_arrival: 3, eta: 2, e_visa: 1 };
const LEVEL_KEYS = { visa_free: "visa_free", visa_on_arrival: "visa_on_arrival", eta: "eta", e_visa: "e_visa" };

const countries = [];
const cbi = [];
const rbi = [];
const fastTrack = [];
// passportAccess[origin] = Map(dest -> bestEdge)  — ORDINARY-passport nationality reach only
const access = new Map();
// credAccess[credentialId] = [ edges ]  — held-credential exemptions
const credAccess = new Map();
// diploAccess[origin] = [ edges {..., passportTypes} ]  — nationality-specific diplomatic waivers
const diploAccess = new Map();
// diploAny = [ edges {..., passportTypes} ]  — waivers for ANY nationality's diplomatic/service passport
// (stored once instead of duplicated across all 199 passports)
const diploAny = [];
let destinationsWithVisaPolicy = 0;

function addEdge(origin, dest, level, edge) {
  if (origin === dest) return;
  if (!access.has(origin)) access.set(origin, new Map());
  const m = access.get(origin);
  const prev = m.get(dest);
  if (!prev || LEVEL_RANK[level] > LEVEL_RANK[prev.level]) {
    m.set(dest, { dest, level, maxStayDays: edge.maxStayDays, sourceUrl: edge.sourceUrl, sourceOfficial: edge.sourceOfficial, notes: edge.notes });
  }
}

function isTransitOnly(conditions) {
  const s = (conditions || "").toLowerCase();
  return /\btransit[\s-]?only\b|airport\s+transit\s+visa[\s-]?exempt|airside\s+transit\s+only|landside\s+transit\s+only|\btwov\b|transit\s+without\s+visa\s+\(twov\)|type\s+[ab]\s+transit\s+visa\s+exempt/.test(s);
}

function addCredEdge(credId, dest, level, scope, edge) {
  // Keep every edge (scope + level differ by nationality, e.g. India gets visa-free to
  // Argentina with a US visa while others get only the e-visa AVE). compute resolves the
  // best QUALIFYING level per destination against the user's actual passport. Dedupe only
  // exact (dest, level, scope) repeats.
  if (!credAccess.has(credId)) credAccess.set(credId, []);
  const list = credAccess.get(credId);
  const scopeKey = scope ? [...scope].sort().join(",") : "*";
  if (list.some((e) => e.dest === dest && e.level === level && (e.nationalityScope ? [...e.nationalityScope].sort().join(",") : "*") === scopeKey)) return;
  const transit = isTransitOnly(edge.conditions);
  list.push({ dest, level, maxStayDays: edge.maxStayDays, sourceUrl: edge.sourceUrl, sourceOfficial: edge.sourceOfficial, notes: edge.notes, nationalityScope: scope, conditions: edge.conditions || "", transit });
}

function addDiploEdge(origin, dest, level, passportTypes, edge) {
  if (origin === dest || !passportTypes.length) return;
  if (!diploAccess.has(origin)) diploAccess.set(origin, []);
  const list = diploAccess.get(origin);
  const ptKey = [...passportTypes].sort().join(",");
  if (list.some((e) => e.dest === dest && e.level === level && [...e.passportTypes].sort().join(",") === ptKey)) return;
  list.push({ dest, level, maxStayDays: edge.maxStayDays, sourceUrl: edge.sourceUrl, sourceOfficial: edge.sourceOfficial, notes: edge.notes, passportTypes });
}

function addDiploAny(dest, level, passportTypes, edge) {
  if (!passportTypes.length) return;
  const ptKey = [...passportTypes].sort().join(",");
  if (diploAny.some((e) => e.dest === dest && e.level === level && [...e.passportTypes].sort().join(",") === ptKey)) return;
  diploAny.push({ dest, level, maxStayDays: edge.maxStayDays, sourceUrl: edge.sourceUrl, sourceOfficial: edge.sourceOfficial, notes: edge.notes, passportTypes });
}

for (const f of files) {
  let d;
  try {
    d = JSON.parse(readFileSync(join(COUNTRIES_DIR, f), "utf8"));
  } catch {
    continue;
  }
  if (!d || !d.iso3) continue;
  const iso3 = d.iso3;
  const meta = byIso3.get(iso3) || { name: d.name, region: d.region, iso2: d.iso2 };
  const vp = d.visa_policy || {};
  const counts = { visa_free: 0, visa_on_arrival: 0, eta: 0, e_visa: 0 };
  let anyVp = false;
  // If the conditional-access crawl has run for this country (field present, even if []),
  // the structured conditional_access is authoritative for credential / passport-type rules,
  // so we don't also derive them heuristically from the visa_policy labels.
  const hasStructured = Array.isArray(d.conditional_access);

  for (const level of ["visa_free", "visa_on_arrival", "eta", "e_visa"]) {
    const arr = Array.isArray(vp[level]) ? vp[level] : [];
    for (const entry of arr) {
      counts[level] += 1;
      anyVp = true;
      const edge = {
        maxStayDays: typeof entry.max_stay_days === "number" ? entry.max_stay_days : null,
        sourceUrl: entry.source_url || (vp.source_urls && vp.source_urls[0]) || "",
        sourceOfficial: entry.source_official !== false,
        notes: entry.notes || "",
      };
      // Conditional entries (held-credential or diplomatic/service-only) must NOT be inverted
      // as ordinary nationality reach — that mis-maps "valid Schengen visa" onto Schengen
      // passports and counts diplomatic-only waivers for ordinary travellers.
      const credObjs = credObjsFromLabel(entry.nationality);
      const ptypes = restrictedPassportTypes(entry.nationality, entry.notes);
      if (credObjs.length) {
        if (!hasStructured) {
          const scope = nationalityScope(entry.nationality);
          for (const obj of credObjs) addCredEdge(credId(obj), iso3, level, scope, edge);
        }
        continue;
      }
      // passport-type-ONLY waiver — never count for an ordinary passport; route to the
      // diplomatic/service dimension (always, even if structured data exists; addDiploEdge dedupes).
      if (ptypes.length) {
        const origins = resolveOrigins(entry);
        if (origins.length >= ALL_ISO3.length - 5) addDiploAny(iso3, level, ptypes, edge);
        else for (const o of origins) addDiploEdge(o, iso3, level, ptypes, edge);
        continue;
      }
      // safety net: a grant whose NOTES require a held foreign visa/permit must not count for
      // an ordinary passport — route it to the credential dimension instead.
      const noteCreds = notesHeldCredential(entry.notes);
      if (noteCreds.length) {
        const scope = resolveOrigins(entry);
        for (const obj of noteCreds) addCredEdge(credId(obj), iso3, level, scope.length ? scope : null, edge);
        continue;
      }
      // "all nationalities EXCEPT …" — expand only when the excluded set is KNOWN, otherwise
      // we'd wrongly grant entry to the very nationalities that actually need a visa.
      const neg = negationInfo(entry.nationality);
      if (neg) {
        const exclude = new Set([iso3]);
        (resolveNatList(neg.excepts) || []).forEach((c) => exclude.add(c));
        const vr = d.visa_required && Array.isArray(d.visa_required.nationalities_iso3) ? d.visa_required.nationalities_iso3 : null;
        if (vr) vr.forEach((c) => exclude.add(String(c).toUpperCase()));
        if (neg.externalList && !vr) {
          // references an external visa-required list we don't have structured → cannot expand
          negationGaps.push(`${iso3} [${level}] "${(entry.nationality || "").slice(0, 50)}" — needs structured visa_required list`);
          continue;
        }
        for (const o of ALL_ISO3) if (!exclude.has(o)) addEdge(o, iso3, level, edge);
        continue;
      }
      for (const o of resolveOrigins(entry)) addEdge(o, iso3, level, edge);
    }
  }
  if (anyVp) destinationsWithVisaPolicy += 1;

  // ---- structured conditional_access (authoritative when present) ----
  for (const ca of (Array.isArray(d.conditional_access) ? d.conditional_access : [])) {
    const level = ca.level;
    if (!LEVEL_RANK[level]) continue;
    const conditions = ca.conditions || "";
    const scope = resolveNatList(ca.eligible_nationalities);
    if (ca.basis === "passport_type") {
      const types = (Array.isArray(ca.passport_types) ? ca.passport_types : []).filter((t) => t !== "ordinary" && t !== "any");
      const pts = types.length ? types : ["diplomatic", "service"];
      const edge = { maxStayDays: typeof ca.max_stay_days === "number" ? ca.max_stay_days : null, sourceUrl: ca.source_url || "", sourceOfficial: ca.source_official !== false, notes: conditions };
      if (scope === null) addDiploAny(iso3, level, pts, edge); // any nationality -> store once
      else for (const o of scope) addDiploEdge(o, iso3, level, pts, edge);
    } else {
      const cid = credId(ca.credential);
      // surface the exact issuer + accepted classes so granularity stays visible per destination
      const subtype = ca.credential && ca.credential.subtype ? String(ca.credential.subtype) : "";
      const issuer = ca.credential && ca.credential.issuer ? String(ca.credential.issuer) : "";
      const accepts = [issuer && subtype ? `${issuer}: ${subtype}` : issuer || subtype, conditions].filter(Boolean).join(" — ");
      const edge = { maxStayDays: typeof ca.max_stay_days === "number" ? ca.max_stay_days : null, sourceUrl: ca.source_url || "", sourceOfficial: ca.source_official !== false, notes: accepts, conditions };
      addCredEdge(cid, iso3, level, scope, edge);
    }
  }

  // CBI
  const c = d.cbi || {};
  if (c.has_program) {
    cbi.push({
      iso3, name: meta.name, region: meta.region,
      program_name: c.program_name || "Citizenship by Investment",
      official_url: c.official_url || "", source_official: c.source_official !== false,
      options: Array.isArray(c.options) ? c.options.map((o) => ({ type: o.type || "other", min_amount: typeof o.min_amount === "number" ? o.min_amount : null, currency: o.currency || "", notes: o.notes || "" })) : [],
      processing_time: c.processing_time || "", dual_citizenship_allowed: c.dual_citizenship_allowed ?? null,
      residency_required: c.residency_required ?? null, notes: c.notes || "",
      verified: c._verified === true,
    });
  }
  // RBI
  for (const p of (d.rbi && Array.isArray(d.rbi.programs) ? d.rbi.programs : [])) {
    rbi.push({
      iso3, name: meta.name, region: meta.region,
      program_name: p.name || "Residence by Investment", type: p.type || "",
      min_amount: typeof p.min_amount === "number" ? p.min_amount : null, currency: p.currency || "",
      path_to_pr_years: p.path_to_pr_years ?? null, path_to_citizenship_years: p.path_to_citizenship_years ?? null,
      official_url: p.official_url || "", source_official: p.source_official !== false, notes: p.notes || "",
    });
  }
  // fast track
  for (const p of (d.fast_track && Array.isArray(d.fast_track.programs) ? d.fast_track.programs : [])) {
    fastTrack.push({
      iso3, name: meta.name, region: meta.region,
      program_name: p.name || "Program", category: p.category || "", eligibility: p.eligibility || "",
      processing_time: p.processing_time || "", official_url: p.official_url || "",
      source_official: p.source_official !== false, notes: p.notes || "",
    });
  }

  countries.push({
    iso2: meta.iso2, iso3, name: meta.name, region: meta.region,
    agreements: Array.isArray(d.agreements) ? d.agreements : [],
    officialDomains: Array.isArray(d.official_domains) ? d.official_domains : [],
    hasCbi: !!c.has_program,
    rbiCount: d.rbi && Array.isArray(d.rbi.programs) ? d.rbi.programs.length : 0,
    fastTrackCount: d.fast_track && Array.isArray(d.fast_track.programs) ? d.fast_track.programs.length : 0,
    visaPolicyCounts: counts,
    completeness: (d.data_quality && d.data_quality.completeness) || "unknown",
    gaps: (d.data_quality && d.data_quality.gaps) || [],
  });
}

const passportAccess = {};
for (const [origin, m] of access) passportAccess[origin] = [...m.values()].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.dest.localeCompare(b.dest));

const credentialAccess = {};
for (const [cred, list] of credAccess) credentialAccess[cred] = list.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.dest.localeCompare(b.dest));
const diplomaticAccess = {};
for (const [origin, list] of diploAccess) diplomaticAccess[origin] = list.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.dest.localeCompare(b.dest));
const diplomaticAny = diploAny.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.dest.localeCompare(b.dest));
// Index the catalog by ID so we can filter to entries that actually unlock something
const CRED_REGISTRY = Object.fromEntries(CRED_CATALOG.map((c) => [c.id, c]));
// ship only credentials that actually unlock something, grouped by issuer region then name
const credentials = Object.values(CRED_REGISTRY)
  .filter((c) => (credentialAccess[c.id] || []).length > 0)
  .sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group), gb = GROUP_ORDER.indexOf(b.group);
    return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb) || a.label.localeCompare(b.label);
  });

const topUnresolved = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k} (${v})`);

// Build destinationVisaTypes index
const destinationVisaTypes = {};
for (const file of files) {
  let d2;
  try { d2 = JSON.parse(readFileSync(join(COUNTRIES_DIR, file), "utf8")); } catch { continue; }
  if (!d2 || !d2.iso3) continue;
  if (d2.visa_types && d2.visa_types.length > 0) {
    destinationVisaTypes[d2.iso3] = d2.visa_types;
  }
}

const dataset = {
  meta: {
    note: "Official-source-first dataset. Visa-free reach is derived by inverting each country's own official visa-policy pages; gaps remain where governments don't publish enumerated lists.",
    totalCountries: masterList.length,
    countriesWithData: countries.length,
    destinationsWithVisaPolicy,
    unresolvedNationalityLabels: topUnresolved,
  },
  groups: GROUPS,
  groupLabels: GROUP_LABELS,
  allCountries: masterList.map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name, region: c.region })).sort((a, b) => a.name.localeCompare(b.name)),
  countries: countries.sort((a, b) => a.name.localeCompare(b.name)),
  passportAccess,
  credentials,
  credentialAccess,
  diplomaticAccess,
  diplomaticAny,
  cbi: cbi.sort((a, b) => a.name.localeCompare(b.name)),
  rbi: rbi.sort((a, b) => a.name.localeCompare(b.name)),
  fastTrack: fastTrack.sort((a, b) => a.name.localeCompare(b.name)),
  destinationVisaTypes,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(dataset) + "\n");
console.log(`Built dataset.json from ${files.length} country files (${countries.length} with data).`);
console.log(`  destinations with official visa policy: ${destinationsWithVisaPolicy}`);
console.log(`  passports with derived reach: ${Object.keys(passportAccess).length}`);
console.log(`  CBI programs: ${cbi.length} | RBI: ${rbi.length} | fast-track: ${fastTrack.length}`);
console.log(`  credential exemptions: ${credentials.map((c) => `${c.id}=${credentialAccess[c.id].length}`).join(", ") || "none"}`);
console.log(`  diplomatic/service waivers: ${Object.values(diplomaticAccess).reduce((s, l) => s + l.length, 0)} nationality-specific edges + ${diplomaticAny.length} any-nationality`);
if (negationGaps.length) {
  console.log(`  ⚠ unresolved "all-except" negations (${negationGaps.length}) — NOT expanded to avoid false-positives:`);
  negationGaps.forEach((g) => console.log(`      ${g}`));
}
console.log(`  top unresolved nationality labels: ${topUnresolved.slice(0, 8).join(", ") || "none"}`);
