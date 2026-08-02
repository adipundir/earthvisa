// Earth Visa - Instagram series renderer: posts 2-11 from content-queue.md v2.
// Generalized slide types on the house cinematic system:
//   cover  - full-bleed photo (or dark typographic) + white pill + red chip headline
//   stat   - giant numeral + fact strip on near-black
//   list   - flag/name/value menu rows on near-black
//   text   - numbered rule lines on near-black
//   cta    - dark closer with app tile + earthvisa.in
// Every post renders 4:5 (feed) + 9:16 (reels/, safe-zone constrained).
// Output: brand-assets/instagram/<slug>/slide-N.png (4:5 feed slides only)
// No em or en dashes anywhere (owner copy rule). Facts: content-queue.md (verified).
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = "brand-assets/instagram";
const RED = "#D9251C", LIFT_RED = "#FF6B5E", LIFT_GREEN = "#3ED37E", LIFT_AMBER = "#E8B04B";
const INKD = "#07090F", HAIR_D = "rgba(255,255,255,.16)";
const EMOJI = `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji'`;
// Self-hosted Archivo (variable, 400-800) - base64-embedded so rendering never
// depends on the Google Fonts CDN. A network hiccup here previously caused
// Chromium to fall back past Archivo straight to an emoji font for ALL text
// (every character rendered in its own wide emoji-cell box).
const ARCHIVO_LATIN_B64 = readFileSync("brand-assets/fonts/archivo-latin.woff2").toString("base64");
const ARCHIVO_LATIN_EXT_B64 = readFileSync("brand-assets/fonts/archivo-latin-ext.woff2").toString("base64");
const FONT = `<style>
@font-face { font-family:'Archivo'; font-weight:400 800; font-style:normal; font-display:block;
  src: url(data:font/woff2;base64,${ARCHIVO_LATIN_B64}) format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215; }
@font-face { font-family:'Archivo'; font-weight:400 800; font-style:normal; font-display:block;
  src: url(data:font/woff2;base64,${ARCHIVO_LATIN_EXT_B64}) format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB; }
</style>`;
const mark = (s, ink) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="8.5" fill="${ink}"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="${ink}" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="${RED}"/></g></svg>`;
const tile = (s) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="11" fill="#b23528"/><circle cx="24" cy="24" r="8.5" fill="#fffdf8"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#fffdf8" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#11203a"/></g></svg>`;

const photo = (f) => "data:image/jpeg;base64," + readFileSync(`brand-assets/photos/${f}`).toString("base64");
const PH = {};
for (const f of ["nauru-aerial", "us-visa-sticker", "statue-liberty", "reykjavik", "stkitts-timothy-hill", "granada-nicaragua", "vegas-chapel", "vanuatu-beach", "sf-blue-hour", "hollywood-sign", "saotome-beach", "taj-mahal",
  "nauru-pinnacles", "passport-desk", "wing-over-ocean", "vegas-sign", "vegas-wedding-chapel", "dollar-bills", "sf-city-hall",
  "earth-blue-marble", "machu-picchu", "hegra-qasr-alfarid", "passport-stamps", "dominica-soufriere-bay", "cappadocia-balloons",
  "san-salvador-volcano", "valletta-skyline", "jenne-farm-vermont", "construction-sunset-pgh", "us-capitol-west",
  "railay-beach-krabi", "rio-sugarloaf-sunrise", "kirkjufell-iceland", "petronas-towers-kl", "stkitts-brimstone-hill",
  "paris-eiffel-sunrise", "caribbean-infinity-pool", "seattle-skyline", "one-wtc-looking-up", "folding-money",
  "supreme-court-dusk", "panama-city-skyline", "bocas-del-toro-beach", "milford-sound", "pantages-marquee-night",
  "arri-cinema-camera", "stage-light-beams", "beijing-birds-nest-night", "pacific-iss", "earthrise", "michigan-stadium", "milkyway-oeschinensee",
  "buenos-aires-obelisco-sunset", "perito-moreno-glacier", "buenos-aires-congreso-sunset", "casa-rosada", "iguazu-falls", "puerto-madero"]) PH[f] = photo(f + ".jpg");

// pb 260: a 4:5 centered on a 9:16 reel canvas gets its bottom ~250px covered by IG UI.
// Locator-map slide: the site's dot-matrix world with a highlighted marker.
const WORLD_DOTS = JSON.parse(readFileSync("src/data/world-dots.json", "utf8"));
const worldMap = (mx, my, label) => {
  // Hero locator: cropped to the Asia-Pacific so the region fills the frame.
  const dots = WORLD_DOTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="rgba(255,255,255,.48)"/>`).join("");
  return `<svg viewBox="0 0 1000 480" style="width:100%;display:block">
    ${dots}
    <line x1="${mx - 8}" y1="${my + 8}" x2="884" y2="386" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="7 7"/>
    <text x="852" y="472" text-anchor="middle" font-family="Archivo" font-size="21" font-weight="700" fill="rgba(255,255,255,.8)">Australia · 3,300 km</text>
    <circle cx="${mx}" cy="${my}" r="30" fill="none" stroke="${LIFT_RED}" stroke-width="2.5" opacity=".35"/>
    <circle cx="${mx}" cy="${my}" r="17" fill="none" stroke="${LIFT_RED}" stroke-width="3" opacity=".7"/>
    <circle cx="${mx}" cy="${my}" r="8" fill="${RED}"/>
    <line x1="${mx - 32}" y1="${my}" x2="${mx - 120}" y2="${my}" stroke="rgba(255,255,255,.65)" stroke-width="2.5"/>
    <text x="${mx - 134}" y="${my + 13}" text-anchor="end" font-family="Archivo" font-size="42" font-weight="800" fill="#fff">${label}</text>
  </svg>`;
};

// Real flags for cover badges (subject country, top-right like post 1).
const FLAGS = {};
for (const cc of ["nr", "us", "kn", "ar"]) {
  try {
    const r = await fetch(`https://flagcdn.com/w320/${cc}.png`);
    FLAGS[cc] = "data:image/png;base64," + Buffer.from(await r.arrayBuffer()).toString("base64");
  } catch { FLAGS[cc] = null; }
}
const flagBadge = (cc) => FLAGS[cc]
  ? `<img src="${FLAGS[cc]}" style="height:78px;width:auto;display:block;border-radius:8px;border:1px solid rgba(255,255,255,.35)"/>`
  : "";

const FMT45 = { key: "45", W: 1080, H: 1350, pt: 76, pb: 260, pl: 84, pr: 84, cue: "Swipe" };
const FMT916 = { key: "916", W: 1080, H: 1920, pt: 290, pb: 530, pl: 84, pr: 150, cue: "Tap through" };

const hl = (t) => `<span style="background:${RED};color:#fff;padding:1px 18px 5px;border-radius:12px">${t}</span>`;
const masthead = `<div style="display:flex;align-items:center;gap:15px">${mark(54, "#FFFFFF")}<span style="font-size:37px;font-weight:800;letter-spacing:-.02em;color:#fff">Earth Visa</span></div>`;
// Header row on every slide: masthead left, subject-country flag right, vertically centered.
const headerRow = (post) => `<div style="display:flex;align-items:center;justify-content:space-between">${masthead}${post.flag ? flagBadge(post.flag) : ""}</div>`;
const footer = (src) => `
  <div style="height:1px;background:rgba(255,255,255,.28);margin:26px 0 20px"></div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:19px;color:rgba(255,255,255,.62);font-weight:500">${src}</span>
    <span style="font-size:24px;color:#fff;font-weight:800;letter-spacing:-.01em">earthvisa.in</span>
  </div>`;
const arrow = (c) => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const photoScrims = (f) => f.key === "45"
  ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,.55) 0%,rgba(6,9,15,.12) 20%,rgba(6,9,15,0) 32%)"></div>
     <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,0) 26%,rgba(6,9,15,.4) 48%,rgba(6,9,15,.82) 74%,rgba(6,9,15,.88) 100%)"></div>`
  : `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,.6) 0%,rgba(6,9,15,.2) 17%,rgba(6,9,15,0) 30%)"></div>
     <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,0) 28%,rgba(6,9,15,.44) 46%,rgba(6,9,15,.82) 70%,rgba(6,9,15,.9) 100%)"></div>`;
const darkGlow = `<div style="position:absolute;inset:0;background:radial-gradient(1100px 800px at 88% -8%,rgba(217,37,28,.16),transparent 60%)"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(900px 700px at -10% 108%,rgba(32,54,232,.10),transparent 55%)"></div>`;
// Dimmed photo behind dark data slides: keeps the sense of place, text stays king.
const dimBg = (key, pos = "center") => `
  <img src="${PH[key]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pos};filter:saturate(.85)"/>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,15,.5) 0%,rgba(7,9,15,.78) 48%,rgba(7,9,15,.9) 100%)"></div>
  ${darkGlow}`;
const bgOf = (s, post) => { const k = s.bg ?? post?.bg; return k ? dimBg(k, s.bgPos ?? post?.bgPos) : darkGlow; };

const frame = (f, bgHtml, inner) => `${FONT}
  <div style="width:${f.W}px;height:${f.H}px;position:relative;font-family:'Archivo',-apple-system,'Segoe UI',Roboto,sans-serif,${EMOJI};overflow:hidden;background:${INKD}">
    ${bgHtml}
    <div style="position:absolute;left:${f.pl}px;right:${f.pr}px;top:${f.pt}px;bottom:${f.pb}px;display:flex;flex-direction:column">${inner}</div>
  </div>`;

const S = (post, f) => ({
  cover(s) {
    const bg = s.photo
      ? `<img src="${PH[s.photo]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${s.pos || "center"};filter:saturate(1.06) contrast(1.02)"/>${photoScrims(f)}`
      : darkGlow;
    return frame(f, bg, `
      ${headerRow(post)}
      <div style="flex:1"></div>
      ${s.inset ? `<div style="margin-bottom:34px"><img src="${PH[s.inset]}" style="width:${f.key === "45" ? 560 : 500}px;border-radius:14px;box-shadow:0 30px 70px rgba(0,0,0,.55);transform:rotate(-3deg);border:1px solid rgba(255,255,255,.14)"/></div>` : ""}
      <div style="display:inline-flex;align-self:flex-start;background:#fff;color:#0B0E14;font-size:28px;font-weight:800;letter-spacing:-.01em;padding:11px 24px;border-radius:12px;margin-bottom:26px">Did you know?</div>
      <div style="font-size:${s.size || 64}px;font-weight:800;line-height:1.14;letter-spacing:-.025em;color:#fff">${s.headline}</div>
      ${s.sub ? `<div style="font-size:31px;color:rgba(255,255,255,.9);line-height:1.4;margin-top:24px;max-width:860px">${s.sub}</div>` : ""}
      <div style="display:flex;justify-content:flex-end;margin-top:34px">
        <div style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:700;color:#fff">${f.cue}${arrow("#fff")}</div>
      </div>
      ${footer(post.source)}`);
  },
  stat(s) {
    const vsize = s.value.length > 10 ? 96 : s.value.length > 6 ? 120 : 150;
    return frame(f, bgOf(s, post), `
      ${headerRow(post)}
      <div style="flex:1"></div>
      ${s.eyebrow ? `<div style="font-size:27px;font-weight:700;color:${LIFT_RED};margin-bottom:18px">${s.eyebrow}</div>` : ""}
      <div style="font-size:${vsize}px;font-weight:800;line-height:.95;letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:${s.color || "#fff"}">${s.value}</div>
      <div style="font-size:37px;font-weight:700;line-height:1.25;letter-spacing:-.015em;color:#fff;margin-top:22px;max-width:860px">${s.title}</div>
      ${s.rows ? `<div style="display:flex;margin-top:44px">${s.rows.map(([v, l], i) => `<div style="${i ? `border-left:1px solid ${HAIR_D};padding-left:34px;` : ""}${i < s.rows.length - 1 ? "padding-right:34px;" : ""}">
        <div style="font-size:40px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;color:#fff">${v}</div>
        <div style="font-size:20px;color:rgba(255,255,255,.62);font-weight:500;margin-top:7px">${l}</div></div>`).join("")}</div>` : ""}
      ${s.note ? `<div style="font-size:23px;color:rgba(255,255,255,.72);line-height:1.5;margin-top:34px;max-width:840px">${s.note}</div>` : ""}
      ${footer(post.source)}`);
  },
  list(s) {
    return frame(f, bgOf(s, post), `
      ${headerRow(post)}
      <div style="flex:1"></div>
      <div style="font-size:27px;font-weight:700;color:${LIFT_RED};margin-bottom:8px">${s.eyebrow || post.series || ""}</div>
      <div style="font-size:46px;font-weight:800;letter-spacing:-.02em;color:#fff;margin-bottom:26px">${s.heading}</div>
      <div>${s.rows.map((r, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:19px 0;${i ? `border-top:1px solid rgba(255,255,255,.12);` : ""}">
          <div style="display:flex;align-items:center;gap:18px;min-width:0">
            ${r.flag ? `<span style="font-size:38px;line-height:1;font-family:${EMOJI}">${r.flag}</span>` : ""}
            <div>
              <div style="font-size:30px;font-weight:700;color:#fff;letter-spacing:-.01em">${r.name}</div>
              ${r.sub ? `<div style="font-size:20px;color:rgba(255,255,255,.6);font-weight:500;margin-top:4px">${r.sub}</div>` : ""}
            </div>
          </div>
          <div style="font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;color:${r.color || "#fff"};padding-left:24px">${r.value || ""}</div>
        </div>`).join("")}</div>
      ${s.note ? `<div style="font-size:22px;color:rgba(255,255,255,.68);line-height:1.45;margin-top:26px">${s.note}</div>` : ""}
      ${footer(post.source)}`);
  },
  text(s) {
    return frame(f, bgOf(s, post), `
      ${headerRow(post)}
      <div style="flex:1"></div>
      <div style="font-size:27px;font-weight:700;color:${LIFT_RED};margin-bottom:8px">${s.eyebrow || ""}</div>
      <div style="font-size:50px;font-weight:800;letter-spacing:-.02em;color:#fff;margin-bottom:34px">${s.heading}</div>
      <div>${s.lines.map((t, i) => `
        <div style="display:flex;gap:22px;align-items:flex-start;padding:17px 0;${i ? `border-top:1px solid rgba(255,255,255,.10);` : ""}">
          <span style="font-size:28px;font-weight:800;color:${LIFT_RED};font-variant-numeric:tabular-nums;min-width:44px">${String(i + 1).padStart(2, "0")}</span>
          <span style="font-size:30px;color:rgba(255,255,255,.94);line-height:1.4;font-weight:500">${t}</span>
        </div>`).join("")}</div>
      ${s.note ? `<div style="font-size:22px;color:rgba(255,255,255,.68);line-height:1.45;margin-top:26px">${s.note}</div>` : ""}
      ${footer(post.source)}`);
  },
  map(s) {
    return frame(f, bgOf(s, post), `
      ${headerRow(post)}
      <div style="flex:1"></div>
      <div style="font-size:27px;font-weight:700;color:${LIFT_RED};margin-bottom:10px">${s.eyebrow || ""}</div>
      <div style="font-size:48px;font-weight:800;letter-spacing:-.02em;color:#fff;margin-bottom:30px">${s.heading}</div>
      <div style="margin:0 0 30px">${worldMap(s.mx, s.my, s.label)}</div>
      ${s.rows ? `<div style="display:flex">${s.rows.map(([v, l], i) => `<div style="${i ? `border-left:1px solid ${HAIR_D};padding-left:34px;` : ""}${i < s.rows.length - 1 ? "padding-right:34px;" : ""}">
        <div style="font-size:42px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;color:#fff">${v}</div>
        <div style="font-size:20px;color:rgba(255,255,255,.62);font-weight:500;margin-top:7px">${l}</div></div>`).join("")}</div>` : ""}
      ${s.note ? `<div style="font-size:23px;color:rgba(255,255,255,.72);line-height:1.5;margin-top:30px">${s.note}</div>` : ""}
      ${footer(post.source)}`);
  },
  cta() {
    // Minimal brand end-card: bright full-Earth photo, centered logo + wordmark, nothing else.
    return `${FONT}
      <div style="width:${f.W}px;height:${f.H}px;position:relative;font-family:'Archivo',-apple-system,'Segoe UI',Roboto,sans-serif,${EMOJI};overflow:hidden;background:#0b1e3a">
        <img src="${PH["milkyway-oeschinensee"]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 32%;filter:saturate(1.1) brightness(1.02)"/>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 50% 55%, rgba(6,10,24,.4), transparent 60%)"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px">
          <div style="filter:drop-shadow(0 6px 26px rgba(0,0,0,.55))">${mark(200, "#FFFFFF")}</div>
          <span style="font-size:78px;font-weight:800;color:#fff;letter-spacing:-.02em;text-shadow:0 4px 26px rgba(0,0,0,.5)">Earth Visa</span>
        </div>
      </div>`;
  },
});

// ---------------- The 10 posts (figures verified 2026-07-30) ----------------
const POSTS = [
  {
    slug: "p02-nauru", flag: "nr", source: "Source: official program portal, ecrcp.gov.nr, July 2026",
    slides: [
      { type: "cover", photo: "nauru-aerial", pos: "48% 68%",  headline: `The cheapest passport<br>on Earth is ${hl("on sale")}.`, sub: "Nauru sells citizenship. You never even have to visit." },
      { bg: "pacific-iss", bgPos: "center 45%", type: "map", eyebrow: "First things first", heading: "Where even is Nauru?", mx: 964, my: 308, label: "Nauru",
        rows: [["21 km²", "total area"], ["#3", "smallest country on Earth"], ["Pacific", "just south of the equator"]] },
      { bg: "nauru-pinnacles", bgPos: "center 40%", type: "stat", eyebrow: "Nauru · citizenship by investment", value: "$65,000", title: "the promotional rate, down from $90,000, running since 3 Feb 2026", rows: [["$77,700", "all-in, single applicant"], ["3-4 mo", "processing"], ["0", "visits required"]], note: "The citizenship oath can be taken by video link. You keep your current citizenship too." },
      { bg: "passport-desk", bgPos: "center 45%", type: "text", eyebrow: "How it actually works", heading: "Four steps, zero flights.", lines: ["Apply through a licensed agent, who checks your background ($11,000 in fees)", "You pay the rest only after you are approved", "Take the citizenship oath over a video call", "Your passport is couriered to you, 3 to 4 months total"] },
      { bg: "wing-over-ocean", bgPos: "center 65%", type: "stat", eyebrow: "The catch", value: "76", title: "destinations the Nauru passport reaches without a pre-arranged visa", rows: [["50", "visa-free"], ["21", "on arrival"], ["5", "eTA"]], note: "Our honest score, e-visas never counted. For contrast: a St Kitts passport (also buyable, $250,000) reaches 115. In passports, you get what you pay for." },
      { type: "stat", bg: "saotome-beach", bgPos: "center 55%", eyebrow: "The family deal next door", value: "$95,000", title: "buys Sao Tome and Principe citizenship for a family of up to 4", rows: [["$90,000", "single applicant"], ["$23,750", "per person, family of 4"], ["Aug 2025", "program live since"]], note: "One country, two islands, off the coast of Central Africa." },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Every program,<br>priced and verified.", sub: "13 citizenship-by-investment programs will actually take your money in 2026. See what each passport really reaches." },
    ],
  },
  {
    slug: "p03-k1-fiance", flag: "us", source: "Source: US State Dept + USCIS fees, July 2026",
    slides: [
      { type: "cover", photo: "vegas-chapel", pos: "center 45%",  headline: `The 90 days in 90 Day<br>Fiance is a ${hl("real deadline")}.`, sub: "And the clock starts the moment you land." },
      { bg: "vegas-sign", bgPos: "center 40%", type: "text", eyebrow: "The K-1 fiance visa", heading: "How it works.", lines: ["Your US citizen partner files the petition - $675", "You get the K-1 visa - $265 + $250 integrity fee", "The visa gives you 180 days to enter the US", "On entry, a 90-day clock starts", "Marry the petitioner within 90 days, or leave"] },
      { bg: "vegas-wedding-chapel", bgPos: "center 60%", type: "stat", eyebrow: "The rule", value: "90", title: "days to get married. No extensions. No exceptions.", note: "And only to the person who petitioned for you - marrying someone else does not count." },
      { bg: "dollar-bills", bgPos: "center 30%", type: "stat", eyebrow: "The bill", value: "$1,190", title: "in government fees before the wedding", rows: [["$675", "petition (I-129F)"], ["$265", "K-1 visa"], ["$250", "integrity fee"]] },
      { bg: "sf-city-hall", bgPos: "center 45%", type: "text", eyebrow: "After the wedding", heading: "Marriage is the halfway point.", lines: ["Permanent residence is a separate application after you marry", "Until then, your US status hangs on that one 90-day window"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Every US visa,<br>decoded.", sub: "Fees, timelines and the fine print, from official sources only." },
    ],
  },
  {
    slug: "p04-us-visa-unlocks", flag: "us", source: "Source: each country's official entry rules, July 2026",
    slides: [
      { type: "cover", photo: "passport-desk", pos: "center 40%", inset: "us-visa-sticker",  headline: `Your US visa is secretly<br>a ${hl("second passport")}.`, sub: "It unlocks 38 countries. Most people use zero of them." },
      { bg: "earth-blue-marble", bgPos: "center 30%", type: "stat", eyebrow: "Verified in our data", value: "38", title: "countries key their entry rules on a US visa", rows: [["26", "visa-free entry"], ["6", "visa on arrival"], ["6", "e-visa + eTA"]] },
      { bg: "machu-picchu", bgPos: "center 40%", type: "list", eyebrow: "Group 1", heading: "Visa-free entry.", rows: [
        { flag: "🇵🇪", name: "Peru", sub: "Indian nationals", value: "180 days" },
        { flag: "🇦🇷", name: "Argentina", sub: "even H-1B counts", value: "90 days" },
        { flag: "🇲🇽", name: "Mexico", sub: "multiple-entry US visa", value: "180 days" },
        { flag: "🇷🇸", name: "Serbia · Montenegro · Bosnia", sub: "the Balkans run", value: "90 days" },
        { flag: "🇨🇷", name: "Costa Rica · Panama + 18 more", value: "" },
      ] },
      { bg: "hegra-qasr-alfarid", bgPos: "center 40%", type: "list", eyebrow: "Group 2", heading: "On arrival and online.", rows: [
        { flag: "🇸🇦", name: "Saudi Arabia", sub: "US visa must be used once", value: "1-yr VoA", color: LIFT_GREEN },
        { flag: "🇦🇪", name: "UAE", sub: "Indian nationals", value: "14-day VoA", color: LIFT_GREEN },
        { flag: "🇪🇬", name: "Egypt", sub: "visa must be used once", value: "30-day VoA", color: LIFT_GREEN },
        { flag: "🇹🇷", name: "Turkey · Kuwait · Morocco", value: "e-visa", color: LIFT_AMBER },
        { flag: "🇨🇦", name: "Canada · Qatar", value: "easier eTA", color: LIFT_AMBER },
      ] },
      { bg: "passport-stamps", bgPos: "center 30%", type: "text", eyebrow: "The fine print", heading: "Read before you fly.", lines: ["Some countries require the US visa to be multiple-entry", "Saudi, Egypt and Albania require it already used at least once", "Every rule is per nationality - always check your exact corridor"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Check your passport<br>+ US visa combo.", sub: "All 38 unlocks, per nationality, with the official source for each." },
    ],
  },
  {
    slug: "p05-cbi-menu", source: "Source: each program's official portal, July 2026",
    slides: [
      { type: "cover", photo: "vanuatu-beach", pos: "center 55%", headline: `Every passport you can<br>${hl("legally buy")} in 2026.`, sub: "22 programs are on the books. 13 will actually take your money. The menu:" },
      { bg: "dominica-soufriere-bay", bgPos: "center 40%", type: "list", eyebrow: "The menu · part 1", heading: "Under $250K.", rows: [
        { flag: "🇳🇷", name: "Nauru", sub: "$65K promo running", value: "$90K" },
        { flag: "🇸🇹", name: "Sao Tome", sub: "$95K for a family of 4", value: "$90K" },
        { flag: "🇻🇺", name: "Vanuatu", value: "$130K" },
        { flag: "🇩🇲", name: "Dominica", value: "$200K" },
        { flag: "🇦🇬", name: "Antigua", value: "$230K" },
        { flag: "🇬🇩", name: "Grenada", value: "$235K" },
        { flag: "🇱🇨", name: "St Lucia", value: "$240K" },
      ] },
      { bg: "cappadocia-balloons", bgPos: "center 35%", type: "list", eyebrow: "The menu · part 2", heading: "$250K and up.", rows: [
        { flag: "🇪🇬", name: "Egypt", value: "$250K" },
        { flag: "🇰🇳", name: "St Kitts", sub: "the oldest program, since 1984", value: "$250K" },
        { flag: "🇬🇪", name: "Georgia", value: "EUR 300K" },
        { flag: "🇹🇷", name: "Turkey", sub: "real estate route", value: "$400K" },
        { flag: "🇯🇴", name: "Jordan", sub: "job-creating investment", value: "~$494K" },
      ] },
      { bg: "san-salvador-volcano", bgPos: "center 45%", type: "stat", eyebrow: "The crypto one", value: "$1M", title: "El Salvador citizenship, payable in Bitcoin or USDt", rows: [["$999", "to apply"], ["$999,001", "on approval"], ["~6 weeks", "processing"]] },
      { bg: "valletta-skyline", bgPos: "center 35%", type: "text", eyebrow: "Closed or not real", heading: "Doors that do not open.", lines: ["Malta - struck down by the EU Court of Justice, April 2025", "North Macedonia - legislated, never operational", "Botswana - announced, not yet law", "Samoa - zero investors have ever completed it"], note: "All prices are minimums before mandatory fees." },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Check what each<br>passport really reaches.", sub: "Every program, priced, with honest access scores. E-visas never counted." },
    ],
  },
  {
    slug: "p06-eb5-greencard", flag: "us", source: "Source: USCIS, EB-5 Reform and Integrity Act, July 2026",
    slides: [
      { type: "cover", photo: "statue-liberty", pos: "center 25%",  headline: `The US ${hl("sells green cards")}.<br>The price rises Jan 1, 2027.`, sub: "EB-5, the investor route, in numbers." },
      { bg: "jenne-farm-vermont", bgPos: "center 40%", type: "stat", eyebrow: "EB-5 investor program", value: "$800,000", title: "invested in a Targeted Employment Area - rural or high-unemployment", rows: [["$1,050,000", "anywhere else"], ["$3,675", "petition fee"], ["$1,000", "integrity fund"]] },
      { bg: "construction-sunset-pgh", bgPos: "center 35%", type: "stat", eyebrow: "The obligation", value: "10", title: "full-time American jobs your investment must create" },
      { bg: "us-capitol-west", bgPos: "center 55%", type: "text", eyebrow: "The deadline", heading: "Today's price is the floor.", lines: ["Thresholds get a CPI-based increase on 1 January 2027", "Then again every 5 years", "The investment must actually create the jobs - the green card is not guaranteed"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "The full US visa<br>catalog, plain English.", sub: "From B-1 to EB-5, with official fees and the fine print." },
    ],
  },
  {
    slug: "p07-nomad-ladder", source: "Source: each country's official immigration portal, July 2026",
    slides: [
      { type: "cover", photo: "reykjavik", pos: "center 55%", headline: `Nomad visas: from ${hl("$0")} to<br>${hl("$8,000")} a month required.`, sub: "Same laptop. Same beach. Wildly different price of admission." },
      { bg: "railay-beach-krabi", bgPos: "center 40%", type: "list", eyebrow: "Tier 1", heading: "No income minimum.", rows: [
        { flag: "🇹🇭", name: "Thailand DTV", sub: "5 years · THB 500K in the bank", value: "$0/mo", color: LIFT_GREEN },
        { flag: "🇺🇾", name: "Uruguay", value: "$0/mo", color: LIFT_GREEN },
        { flag: "🇱🇨", name: "St Lucia", value: "$0/mo", color: LIFT_GREEN },
        { flag: "🇨🇻", name: "Cabo Verde", value: "$0/mo", color: LIFT_GREEN },
      ] },
      { bg: "rio-sugarloaf-sunrise", bgPos: "center 35%", type: "list", eyebrow: "Tier 2", heading: "The budget tier.", rows: [
        { flag: "🇨🇴", name: "Colombia", sub: "wage-indexed", value: "~$1,400/mo" },
        { flag: "🇧🇷", name: "Brazil", value: "$1,500/mo" },
        { flag: "🇦🇪", name: "UAE", sub: "48h approval · ~$57 base fee", value: "$3,500/mo" },
      ] },
      { bg: "kirkjufell-iceland", bgPos: "center 30%", type: "list", eyebrow: "Tier 3", heading: "The expensive tier.", rows: [
        { flag: "🇯🇵", name: "Japan", sub: "6 months only, then 6-month cooloff", value: "~$5,000/mo" },
        { flag: "🇪🇪", name: "Estonia", value: "EUR 4,500/mo" },
        { flag: "🇧🇿", name: "Belize", value: "$75K/yr" },
        { flag: "🇮🇸", name: "Iceland", sub: "the world's highest floor · 180-day visa", value: "~$8,000/mo", color: LIFT_RED },
      ] },
      { bg: "petronas-towers-kl", bgPos: "center 30%", type: "text", eyebrow: "The quirks", heading: "Fine print worth knowing.", lines: ["Malaysia: $24K a year for tech workers, $60K for everyone else", "Japan makes you leave for 6 months before you can reapply", "Singapore has NO nomad visa - that $22.5K figure online is a tech work pass"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Every nomad visa,<br>floors and fees.", sub: "Income requirements, durations and costs, from official sources." },
    ],
  },
  {
    slug: "p08-stkitts-vs-india", flag: "kn", source: "Source: every destination's official inbound policy, July 2026",
    slides: [
      { type: "cover", photo: "stkitts-timothy-hill", pos: "center 55%",  headline: `A passport you can buy<br>does ${hl("double")} an Indian one.`, sub: "St Kitts and Nevis: 115 destinations. India: 52." },
      { bg: "stkitts-brimstone-hill", bgPos: "center 40%", type: "stat", eyebrow: "St Kitts and Nevis", value: "115", title: "destinations without a pre-arranged visa", rows: [["88", "visa-free"], ["22", "on arrival"], ["5", "eTA"]], color: LIFT_GREEN },
      { type: "stat", bg: "taj-mahal", bgPos: "center 30%", eyebrow: "India", value: "52", title: "destinations on the same honest score", rows: [["23", "visa-free"], ["23", "on arrival"], ["6", "eTA"]], note: "Both scored identically: visa-free + on arrival + eTA. E-visas never counted." },
      { bg: "paris-eiffel-sunrise", bgPos: "center 35%", type: "text", eyebrow: "What St Kitts unlocks", heading: "The world's oldest CBI.", lines: ["All of Schengen, visa-free", "The UK, with a GBP 20 eTA", "Selling citizenship since 1984 - the first program ever"] },
      { bg: "caribbean-infinity-pool", bgPos: "center 45%", type: "stat", eyebrow: "The price", value: "$250,000", title: "minimum donation, plus roughly $20K in fees", rows: [["160-180", "days to approval"], ["115", "destinations unlocked"]] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Compare any two<br>passports side by side.", sub: "Same methodology, every passport on Earth.", url: "earthvisa.in/compare" },
    ],
  },
  {
    slug: "p09-h1b-weighted", flag: "us", source: "Source: DHS final rule Dec 2025 + State Dept fees, July 2026",
    slides: [
      { type: "cover", photo: "sf-blue-hour", pos: "center 40%",  headline: `The H-1B lottery<br>is ${hl("dead")}.`, sub: "Since March 2026, your salary level buys your odds." },
      { bg: "seattle-skyline", bgPos: "center 35%", type: "stat", eyebrow: "The cap stays", value: "85,000", title: "visas a year. Always oversubscribed.", rows: [["65,000", "regular cap"], ["20,000", "US master's grads"]] },
      { bg: "one-wtc-looking-up", bgPos: "center 30%", type: "list", eyebrow: "The new rule · wage-weighted selection", heading: "Your pay = your tickets.", rows: [
        { name: "Wage Level I", value: "1 entry" },
        { name: "Wage Level II", value: "2 entries" },
        { name: "Wage Level III", value: "3 entries" },
        { name: "Wage Level IV", value: "4 entries", color: LIFT_GREEN },
      ], note: "Same job title, four times the odds, depending on what your employer pays." },
      { bg: "folding-money", bgPos: "center 40%", type: "stat", eyebrow: "The fee stack", value: "$670", title: "from registration to stamping, per selected worker", rows: [["$215", "registration (employer)"], ["$205", "visa fee"], ["$250", "integrity fee"]] },
      { bg: "supreme-court-dusk", bgPos: "center 35%", type: "text", eyebrow: "And the $100,000 fee?", heading: "Struck down. For now.", lines: ["Ordered by presidential proclamation, September 2025", "Struck down in federal court, June 2026", "Not currently collected - the government is appealing"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "The US work-visa<br>system, mapped.", sub: "H-1B, O-1, L-1 and the rest, with real fees and rules." },
    ],
  },
  {
    slug: "p10-retire-abroad", source: "Source: each country's immigration law, July 2026",
    slides: [
      { type: "cover", photo: "granada-nicaragua", pos: "center 60%", headline: `You can retire abroad<br>on ${hl("$349 a month")}.`, sub: "The official income ladder, from Tonga to New Zealand." },
      { bg: "panama-city-skyline", bgPos: "center 60%", type: "list", eyebrow: "The official ladder", heading: "Monthly income required.", rows: [
        { flag: "🇹🇴", name: "Tonga", sub: "2-year renewable visa", value: "~$349" },
        { flag: "🇳🇮", name: "Nicaragua", sub: "PERMANENT residency", value: "$600", color: LIFT_GREEN },
        { flag: "🇨🇾", name: "Cyprus", sub: "unlimited-validity permit", value: "~EUR 797" },
        { flag: "🇵🇦", name: "Panama", sub: "immediate permanent residency", value: "$1,000", color: LIFT_GREEN },
        { flag: "🇵🇪", name: "Peru", sub: "passive income", value: "$1,000" },
      ], note: "The average US Social Security check clears every rung on this list." },
      { bg: "bocas-del-toro-beach", bgPos: "center 40%", type: "stat", eyebrow: "The Panama discount", value: "$750", title: "a month, if you buy a $100,000 property", rows: [["$1,000", "standard pension floor"], ["$750", "with property"], ["Day 1", "permanent residency"]] },
      { bg: "milford-sound", bgPos: "center 45%", type: "text", eyebrow: "The other end of the ladder", heading: "New Zealand, age 66+.", lines: ["NZD 750,000 invested for two years", "NZD 500,000 in living funds on top", "NZD 60,000 a year in income", "All for a TEMPORARY 2-year visitor visa"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "Full requirements<br>for every program.", sub: "Income floors, age rules and what each actually grants." },
    ],
  },
  {
    slug: "p11-o1-genius", flag: "us", source: "Source: USCIS + US State Dept, July 2026",
    slides: [
      { type: "cover", photo: "hollywood-sign", pos: "center 42%",  headline: `The US has a visa for<br>being ${hl("extraordinary")}.`, sub: "No cap. No lottery. The O-1." },
      { bg: "pantages-marquee-night", bgPos: "center 30%", type: "stat", eyebrow: "The O-1, extraordinary ability", value: "0", title: "annual cap. The US issues as many O-1s as qualify.", rows: [["85,000", "H-1B cap"], ["None", "O-1 cap"], ["None", "lottery"]] },
      { bg: "arri-cinema-camera", bgPos: "center 40%", type: "text", eyebrow: "Who qualifies", heading: "Two doors.", lines: ["O-1A: sciences, education, business, athletics", "O-1B: arts, film and television", "The bar: documented, sustained national or international acclaim - awards, major press, judging others' work"] },
      { bg: "stage-light-beams", bgPos: "center 30%", type: "stat", eyebrow: "The numbers", value: "$455", title: "in visa fees, plus your employer or agent's petition", rows: [["$205", "visa fee"], ["$250", "integrity fee"], ["3 years", "initial stay"]], note: "Extendable in 1-year increments. The classic stepping stone to the EB-1A green card." },
      { bg: "michigan-stadium", bgPos: "center 40%", type: "text", eyebrow: "Who actually uses it", heading: "Not just Nobel winners.", lines: ["Researchers and founders", "Athletes and coaches", "Designers, chefs, film crews", "If your field has a top, and you can document being near it"] },
      { bg: "earthrise", bgPos: "center 35%", type: "cta", headline: "The full US visa<br>alphabet, decoded.", sub: "O-1, H-1B, K-1, EB-5 and the rest, with sources." },
    ],
  },
  {
    slug: "p12-argentina", flag: "ar", source: "Source: Constitution Art. 20 + Ley 346, official Argentine govt, 2026",
    slides: [
      { type: "cover", photo: "buenos-aires-obelisco-sunset", pos: "center 42%", 
        headline: `The best passport deal<br>is not for ${hl("sale")}.`,
        sub: "Argentina gives you citizenship after 2 years of living there. No investment. No language test." },
      { bg: "perito-moreno-glacier", bgPos: "center 45%", type: "stat", eyebrow: "The deal",
        value: "2", title: "years of residence is all Argentina's constitution asks for citizenship",
        rows: [["$0", "investment"], ["None", "language test"], ["Yes", "keep your passport"]],
        note: "Written into the Constitution since 1853, and reaffirmed by the courts in 2026. One of the lowest residency bars anywhere." },
      { bg: "buenos-aires-congreso-sunset", bgPos: "center 40%", type: "text", eyebrow: "What it actually takes",
        heading: "Five things.",
        lines: ["Be 18 or older", "Live in Argentina for 2 continuous years", "Show lawful income: a job, pension or remote work", "A clean criminal record", "No language exam, and you keep your current citizenship"] },
      { bg: "iguazu-falls", bgPos: "center 42%", type: "stat", eyebrow: "Why it is worth it",
        value: "135", title: "destinations the Argentine passport reaches without a prior visa",
        rows: [["Schengen", "visa-free"], ["Japan", "visa-free"], ["UK", "eTA"]],
        note: "One of the strongest passports in Latin America. Once granted, citizenship can be revoked only by a judge, for fraud." },
      { bg: "casa-rosada", bgPos: "center 42%", type: "text", eyebrow: "The one to ignore",
        heading: "Not the “investment” one.",
        lines: ["In 2025 Argentina announced 30-day citizenship for investors", "In 2026 the courts struck down its legal basis", "The tender was suspended. No price was ever set", "We show what is real. That shortcut is not, yet."] },
      { bg: "puerto-madero", bgPos: "center 55%", type: "cta", headline: "Real paths to<br>real passports.", sub: "Official sources, honest scores, no hype. That is the whole idea." },
    ],
  },
];

// ---------------- Render ----------------
const browser = await chromium.launch();
async function render(html, path, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0">${html}</body>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready); // block until Archivo is actually painted, never guess with a timer
  await page.waitForTimeout(150); // settle layout shift from images decoding
  await page.screenshot({ path, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
}

const only = process.argv[2]; // optional slug filter
for (const post of POSTS) {
  if (only && post.slug !== only) continue;
  mkdirSync(`${OUT}/${post.slug}`, { recursive: true });
  for (const f of [FMT916]) { // 9:16 reel-safe canvas - the format the account actually posts
    const dir = `${OUT}/${post.slug}`;
    const r = S(post, f);
    for (let i = 0; i < post.slides.length; i++) {
      const s = post.slides[i];
      await render(r[s.type](s), `${dir}/slide-${i + 1}.png`, f.W, f.H);
    }
  }
  console.log("  ✓", post.slug, `(${post.slides.length} slides)`);
}
await browser.close();
console.log("\nDone -> " + OUT);
