// Generates data/countries.json - the canonical input list for the crawl.
// 193 UN member states + 6 key others (Kosovo, Taiwan, Holy See, Palestine, Hong Kong, Macau).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// [iso2, iso3, name, region, unMember]
const ROWS = [
  // Africa
  ["DZ","DZA","Algeria","Africa",1],["AO","AGO","Angola","Africa",1],["BJ","BEN","Benin","Africa",1],
  ["BW","BWA","Botswana","Africa",1],["BF","BFA","Burkina Faso","Africa",1],["BI","BDI","Burundi","Africa",1],
  ["CV","CPV","Cabo Verde","Africa",1],["CM","CMR","Cameroon","Africa",1],["CF","CAF","Central African Republic","Africa",1],
  ["TD","TCD","Chad","Africa",1],["KM","COM","Comoros","Africa",1],["CG","COG","Republic of the Congo","Africa",1],
  ["CD","COD","Democratic Republic of the Congo","Africa",1],["CI","CIV","Côte d'Ivoire","Africa",1],["DJ","DJI","Djibouti","Africa",1],
  ["EG","EGY","Egypt","Africa",1],["GQ","GNQ","Equatorial Guinea","Africa",1],["ER","ERI","Eritrea","Africa",1],
  ["SZ","SWZ","Eswatini","Africa",1],["ET","ETH","Ethiopia","Africa",1],["GA","GAB","Gabon","Africa",1],
  ["GM","GMB","Gambia","Africa",1],["GH","GHA","Ghana","Africa",1],["GN","GIN","Guinea","Africa",1],
  ["GW","GNB","Guinea-Bissau","Africa",1],["KE","KEN","Kenya","Africa",1],["LS","LSO","Lesotho","Africa",1],
  ["LR","LBR","Liberia","Africa",1],["LY","LBY","Libya","Africa",1],["MG","MDG","Madagascar","Africa",1],
  ["MW","MWI","Malawi","Africa",1],["ML","MLI","Mali","Africa",1],["MR","MRT","Mauritania","Africa",1],
  ["MU","MUS","Mauritius","Africa",1],["MA","MAR","Morocco","Africa",1],["MZ","MOZ","Mozambique","Africa",1],
  ["NA","NAM","Namibia","Africa",1],["NE","NER","Niger","Africa",1],["NG","NGA","Nigeria","Africa",1],
  ["RW","RWA","Rwanda","Africa",1],["ST","STP","São Tomé and Príncipe","Africa",1],["SN","SEN","Senegal","Africa",1],
  ["SC","SYC","Seychelles","Africa",1],["SL","SLE","Sierra Leone","Africa",1],["SO","SOM","Somalia","Africa",1],
  ["ZA","ZAF","South Africa","Africa",1],["SS","SSD","South Sudan","Africa",1],["SD","SDN","Sudan","Africa",1],
  ["TZ","TZA","Tanzania","Africa",1],["TG","TGO","Togo","Africa",1],["TN","TUN","Tunisia","Africa",1],
  ["UG","UGA","Uganda","Africa",1],["ZM","ZMB","Zambia","Africa",1],["ZW","ZWE","Zimbabwe","Africa",1],
  // Asia
  ["AF","AFG","Afghanistan","Asia",1],["AM","ARM","Armenia","Asia",1],["AZ","AZE","Azerbaijan","Asia",1],
  ["BH","BHR","Bahrain","Asia",1],["BD","BGD","Bangladesh","Asia",1],["BT","BTN","Bhutan","Asia",1],
  ["BN","BRN","Brunei","Asia",1],["KH","KHM","Cambodia","Asia",1],["CN","CHN","China","Asia",1],
  ["CY","CYP","Cyprus","Asia",1],["GE","GEO","Georgia","Asia",1],["IN","IND","India","Asia",1],
  ["ID","IDN","Indonesia","Asia",1],["IR","IRN","Iran","Asia",1],["IQ","IRQ","Iraq","Asia",1],
  ["IL","ISR","Israel","Asia",1],["JP","JPN","Japan","Asia",1],["JO","JOR","Jordan","Asia",1],
  ["KZ","KAZ","Kazakhstan","Asia",1],["KW","KWT","Kuwait","Asia",1],["KG","KGZ","Kyrgyzstan","Asia",1],
  ["LA","LAO","Laos","Asia",1],["LB","LBN","Lebanon","Asia",1],["MY","MYS","Malaysia","Asia",1],
  ["MV","MDV","Maldives","Asia",1],["MN","MNG","Mongolia","Asia",1],["MM","MMR","Myanmar","Asia",1],
  ["NP","NPL","Nepal","Asia",1],["KP","PRK","North Korea","Asia",1],["OM","OMN","Oman","Asia",1],
  ["PK","PAK","Pakistan","Asia",1],["PH","PHL","Philippines","Asia",1],["QA","QAT","Qatar","Asia",1],
  ["SA","SAU","Saudi Arabia","Asia",1],["SG","SGP","Singapore","Asia",1],["KR","KOR","South Korea","Asia",1],
  ["LK","LKA","Sri Lanka","Asia",1],["SY","SYR","Syria","Asia",1],["TJ","TJK","Tajikistan","Asia",1],
  ["TH","THA","Thailand","Asia",1],["TL","TLS","Timor-Leste","Asia",1],["TR","TUR","Turkey","Asia",1],
  ["TM","TKM","Turkmenistan","Asia",1],["AE","ARE","United Arab Emirates","Asia",1],["UZ","UZB","Uzbekistan","Asia",1],
  ["VN","VNM","Vietnam","Asia",1],["YE","YEM","Yemen","Asia",1],
  // Europe
  ["AL","ALB","Albania","Europe",1],["AD","AND","Andorra","Europe",1],["AT","AUT","Austria","Europe",1],
  ["BY","BLR","Belarus","Europe",1],["BE","BEL","Belgium","Europe",1],["BA","BIH","Bosnia and Herzegovina","Europe",1],
  ["BG","BGR","Bulgaria","Europe",1],["HR","HRV","Croatia","Europe",1],["CZ","CZE","Czechia","Europe",1],
  ["DK","DNK","Denmark","Europe",1],["EE","EST","Estonia","Europe",1],["FI","FIN","Finland","Europe",1],
  ["FR","FRA","France","Europe",1],["DE","DEU","Germany","Europe",1],["GR","GRC","Greece","Europe",1],
  ["HU","HUN","Hungary","Europe",1],["IS","ISL","Iceland","Europe",1],["IE","IRL","Ireland","Europe",1],
  ["IT","ITA","Italy","Europe",1],["LV","LVA","Latvia","Europe",1],["LI","LIE","Liechtenstein","Europe",1],
  ["LT","LTU","Lithuania","Europe",1],["LU","LUX","Luxembourg","Europe",1],["MT","MLT","Malta","Europe",1],
  ["MD","MDA","Moldova","Europe",1],["MC","MCO","Monaco","Europe",1],["ME","MNE","Montenegro","Europe",1],
  ["NL","NLD","Netherlands","Europe",1],["MK","MKD","North Macedonia","Europe",1],["NO","NOR","Norway","Europe",1],
  ["PL","POL","Poland","Europe",1],["PT","PRT","Portugal","Europe",1],["RO","ROU","Romania","Europe",1],
  ["RU","RUS","Russia","Europe",1],["SM","SMR","San Marino","Europe",1],["RS","SRB","Serbia","Europe",1],
  ["SK","SVK","Slovakia","Europe",1],["SI","SVN","Slovenia","Europe",1],["ES","ESP","Spain","Europe",1],
  ["SE","SWE","Sweden","Europe",1],["CH","CHE","Switzerland","Europe",1],["UA","UKR","Ukraine","Europe",1],
  ["GB","GBR","United Kingdom","Europe",1],
  // Americas
  ["AG","ATG","Antigua and Barbuda","Americas",1],["AR","ARG","Argentina","Americas",1],["BS","BHS","Bahamas","Americas",1],
  ["BB","BRB","Barbados","Americas",1],["BZ","BLZ","Belize","Americas",1],["BO","BOL","Bolivia","Americas",1],
  ["BR","BRA","Brazil","Americas",1],["CA","CAN","Canada","Americas",1],["CL","CHL","Chile","Americas",1],
  ["CO","COL","Colombia","Americas",1],["CR","CRI","Costa Rica","Americas",1],["CU","CUB","Cuba","Americas",1],
  ["DM","DMA","Dominica","Americas",1],["DO","DOM","Dominican Republic","Americas",1],["EC","ECU","Ecuador","Americas",1],
  ["SV","SLV","El Salvador","Americas",1],["GD","GRD","Grenada","Americas",1],["GT","GTM","Guatemala","Americas",1],
  ["GY","GUY","Guyana","Americas",1],["HT","HTI","Haiti","Americas",1],["HN","HND","Honduras","Americas",1],
  ["JM","JAM","Jamaica","Americas",1],["MX","MEX","Mexico","Americas",1],["NI","NIC","Nicaragua","Americas",1],
  ["PA","PAN","Panama","Americas",1],["PY","PRY","Paraguay","Americas",1],["PE","PER","Peru","Americas",1],
  ["KN","KNA","Saint Kitts and Nevis","Americas",1],["LC","LCA","Saint Lucia","Americas",1],
  ["VC","VCT","Saint Vincent and the Grenadines","Americas",1],["SR","SUR","Suriname","Americas",1],
  ["TT","TTO","Trinidad and Tobago","Americas",1],["US","USA","United States","Americas",1],
  ["UY","URY","Uruguay","Americas",1],["VE","VEN","Venezuela","Americas",1],
  // Oceania
  ["AU","AUS","Australia","Oceania",1],["FJ","FJI","Fiji","Oceania",1],["KI","KIR","Kiribati","Oceania",1],
  ["MH","MHL","Marshall Islands","Oceania",1],["FM","FSM","Micronesia","Oceania",1],["NR","NRU","Nauru","Oceania",1],
  ["NZ","NZL","New Zealand","Oceania",1],["PW","PLW","Palau","Oceania",1],["PG","PNG","Papua New Guinea","Oceania",1],
  ["WS","WSM","Samoa","Oceania",1],["SB","SLB","Solomon Islands","Oceania",1],["TO","TON","Tonga","Oceania",1],
  ["TV","TUV","Tuvalu","Oceania",1],["VU","VUT","Vanuatu","Oceania",1],
  // Key non-UN-member territories / states
  ["XK","XKX","Kosovo","Europe",0],["TW","TWN","Taiwan","Asia",0],["VA","VAT","Holy See (Vatican City)","Europe",0],
  ["PS","PSE","Palestine","Asia",0],["HK","HKG","Hong Kong","Asia",0],["MO","MAC","Macau","Asia",0],
];

const countries = ROWS.map(([iso2, iso3, name, region, un]) => ({
  iso2, iso3, name, region, unMember: !!un,
}));

mkdirSync(resolve(ROOT, "data/countries"), { recursive: true });
writeFileSync(
  resolve(ROOT, "data/countries.json"),
  JSON.stringify(countries, null, 2) + "\n",
);
console.log(`Wrote ${countries.length} countries to data/countries.json`);
console.log("By region:", countries.reduce((a, c) => ((a[c.region] = (a[c.region] || 0) + 1), a), {}));
