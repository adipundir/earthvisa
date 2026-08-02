// Earth Visa - "Did you know?" Instagram carousel: India, no-prior-visa edition.
// Cinematic set: every slide is a full-bleed landmark photo + gradient scrim,
// white type, AA-lifted verdict colors. Facts from data/countries/IND.json.
//
// Two formats per slide:
//   4:5  1080x1350 -> india-no-prior-visa/slide-*.png        (feed carousel)
//   9:16 1080x1920 -> india-no-prior-visa/reels/slide-*.png  (stories / reels)
//
// 9:16 text sits inside the researched Reels safe zone: top >=290px clear,
// bottom >=530px clear (caption/audio/profile UI), right >=150px clear (action
// rail), left >=84px. This also keeps everything inside the center 1080x1350
// band that IG uses when previewing a reel in the home feed.
//
// Photos: Wikimedia Commons, saved in brand-assets/photos/ (credits in CAPTION.md).
// No em/en dashes anywhere (owner copy rule).
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = "brand-assets/instagram/p01-india-no-prior-visa";
mkdirSync(`${OUT}/reels`, { recursive: true });

const RED = "#D9251C", LIFT_RED = "#FF6B5E", LIFT_GREEN = "#3ED37E", LIFT_AMBER = "#E8B04B";
const EMOJI = `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji'`;
// Self-hosted Archivo (variable, 400-800) - base64-embedded so rendering never
// depends on the Google Fonts CDN (a network hiccup previously caused Chromium
// to fall back past Archivo straight to an emoji font for ALL text).
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

// Local photos (in-repo, offline-stable).
const photo = (f) => "data:image/jpeg;base64," + readFileSync(`brand-assets/photos/${f}`).toString("base64");
const PHOTOS = {
  gate: photo("india-gate.jpg"), taj: photo("taj-mahal.jpg"),
  np: photo("nepal-ama-dablam.jpg"), bt: photo("bhutan-tigers-nest.jpg"),
  mv: photo("maldives-island.jpg"), jp: photo("japan-fuji-pagoda.jpg"), kr: photo("korea-gyeongbokgung.jpg"),
};

// Real flags (small, beside the country name).
const FLAGS = {};
for (const cc of ["in", "np", "bt", "mv", "jp", "kr"]) {
  try {
    const r = await fetch(`https://flagcdn.com/w320/${cc}.png`);
    FLAGS[cc] = "data:image/png;base64," + Buffer.from(await r.arrayBuffer()).toString("base64");
  } catch { FLAGS[cc] = null; }
}
const flagImg = (cc, h) => FLAGS[cc]
  ? `<img src="${FLAGS[cc]}" style="height:${h}px;width:auto;align-self:flex-start;display:block;${cc === "np" ? "" : "border-radius:8px;border:1px solid rgba(255,255,255,.35);"}"/>`
  : "";

const COUNTRIES = [
  { cc: "np", flag: "🇳🇵", name: "Nepal", color: LIFT_GREEN, verdict: "Visa-free",
    img: PHOTOS.np, pos45: "56% 42%", pos916: "60% 42%",
    cells: [["No limit", "max stay"], ["Free", "entry cost"], ["Photo ID", "all you need"]],
    caveat: "Travelling directly from Nepal by land or air. A passport is needed only when arriving via China, Hong Kong, Macau or Pakistan." },
  { cc: "bt", flag: "🇧🇹", name: "Bhutan", color: LIFT_GREEN, verdict: "Visa-free",
    img: PHOTOS.bt, pos45: "34% 40%", pos916: "36% 40%",
    cells: [["No limit", "max stay"], ["Free", "entry cost"], ["Photo ID", "all you need"]],
    caveat: "Travelling directly from Bhutan by land or air. A passport is needed only when arriving via China, Hong Kong, Macau or Pakistan." },
  { cc: "mv", flag: "🇲🇻", name: "Maldives", color: LIFT_GREEN, verdict: "Visa-free",
    img: PHOTOS.mv, pos45: "54% 45%", pos916: "56% 45%",
    cells: [["90 days", "max stay"], ["Free", "entry cost"], ["Passport", "all you need"]],
    caveat: "For tourism, business or medical visits with a valid passport." },
  { cc: "jp", flag: "🇯🇵", name: "Japan", color: LIFT_AMBER, verdict: "Visa on arrival",
    img: PHOTOS.jp, pos45: "66% 32%", pos916: "74% 32%",
    cells: [["60 days", "max stay"], ["₹2,000", "visa fee"], ["6", "entry airports"]],
    caveat: "Double entry, non-extendable. At Bengaluru, Chennai, Delhi, Hyderabad, Kolkata and Mumbai airports." },
  { cc: "kr", flag: "🇰🇷", name: "South Korea", color: LIFT_AMBER, verdict: "Visa on arrival",
    img: PHOTOS.kr, pos45: "50% 55%", pos916: "50% 55%",
    cells: [["60 days", "max stay"], ["₹2,000", "visa fee"], ["6", "entry airports"]],
    caveat: "Same scheme as Japan: double entry, non-extendable, at the same six airports." },
];

// Formats. 9:16 paddings ARE the safe zone: top 290 / bottom 530 / right 150.
const FMT45 = { key: "45", W: 1080, H: 1350, pt: 76, pb: 64, pl: 84, pr: 84, cue: "Swipe to see the 5" };
const FMT916 = { key: "916", W: 1080, H: 1920, pt: 290, pb: 530, pl: 84, pr: 150, cue: "Tap to see the 5" };

const scrims = (f) => f.key === "45"
  ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,.55) 0%,rgba(6,9,15,.12) 20%,rgba(6,9,15,0) 32%)"></div>
     <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,0) 26%,rgba(6,9,15,.46) 48%,rgba(6,9,15,.93) 74%,rgba(6,9,15,.96) 100%)"></div>`
  : `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,.6) 0%,rgba(6,9,15,.2) 17%,rgba(6,9,15,0) 30%)"></div>
     <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,15,0) 28%,rgba(6,9,15,.52) 46%,rgba(6,9,15,.94) 70%,rgba(6,9,15,.96) 100%)"></div>`;

const frame = (f, img, pos, inner) => `${FONT}
  <div style="width:${f.W}px;height:${f.H}px;position:relative;font-family:'Archivo',-apple-system,'Segoe UI',Roboto,sans-serif,${EMOJI};overflow:hidden;background:#06090F">
    <img src="${img}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pos};filter:saturate(1.06) contrast(1.02)"/>
    ${scrims(f)}
    <div style="position:absolute;left:${f.pl}px;right:${f.pr}px;top:${f.pt}px;bottom:${f.pb}px;display:flex;flex-direction:column">${inner}</div>
  </div>`;

const masthead = `<div style="display:flex;align-items:center;gap:15px">${mark(54, "#FFFFFF")}<span style="font-size:37px;font-weight:800;letter-spacing:-.02em;color:#fff">Earth Visa</span></div>`;
// Text sits straight on the photo; the strengthened bottom scrim is the backdrop
// (no box, no blur - owner rejected the frosted-panel UI).
const panel = (inner) => `<div style="max-width:100%">${inner}</div>`;
// Key phrase as white-on-brand-red highlight: far more visible than red glyphs on photo.
const hl = (t) => `<span style="background:${RED};color:#fff;padding:1px 18px 5px;border-radius:12px">${t}</span>`;
const footer = `
  <div style="height:1px;background:rgba(255,255,255,.28);margin:32px 0 24px"></div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:19px;color:rgba(255,255,255,.65);font-weight:500">Source: Bureau of Immigration, Govt of India</span>
    <span style="font-size:24px;color:#fff;font-weight:800;letter-spacing:-.01em">earthvisa.in</span>
  </div>`;
const arrow = (c) => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Slide 1 - the hook (Taj Mahal).
const cover = (f) => frame(f, PHOTOS.taj, "50% 40%", `
  <div style="display:flex;align-items:center;justify-content:space-between">${masthead}
    <div style="display:flex;flex-direction:column;align-items:center;gap:9px">${flagImg("in", 78)}<span style="font-size:21px;font-weight:700;color:#fff">India</span></div>
  </div>
  <div style="flex:1"></div>
  ${panel(`
    <div style="display:inline-flex;align-self:flex-start;background:#fff;color:#0B0E14;font-size:28px;font-weight:800;letter-spacing:-.01em;padding:11px 24px;border-radius:12px;margin-bottom:26px">Did you know?</div>
    <div style="font-size:72px;font-weight:800;line-height:1.16;letter-spacing:-.025em;color:#fff">Only ${hl("5 countries")}<br>can enter India<br>without a visa<br>arranged in advance.</div>
    <div style="font-size:33px;color:rgba(255,255,255,.92);line-height:1.4;margin-top:26px">Two of them do not even need a passport.</div>
  `)}
  <div style="display:flex;justify-content:flex-end;margin-top:30px">
    <div style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:700;color:#fff">${f.cue}${arrow("#fff")}</div>
  </div>
  ${footer}`);

// Slides 2-6 - one cinematic poster per country.
const country = (c, f) => frame(f, c.img, f.key === "45" ? c.pos45 : c.pos916, `
  <div style="display:flex;align-items:center;justify-content:space-between">${masthead}
    <span style="display:inline-flex;align-items:center;gap:14px;font-size:44px;font-family:${EMOJI};color:#fff">${c.flag}${arrow("rgba(255,255,255,.85)")}🇮🇳</span>
  </div>
  <div style="flex:1"></div>
  ${panel(`
    ${flagImg(c.cc, 58)}
    <div style="font-size:104px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#fff;margin-top:24px">${c.name}</div>
    <div style="font-size:60px;font-weight:800;letter-spacing:-.02em;color:${c.color};margin-top:14px">${c.verdict}</div>
    <div style="display:flex;margin-top:42px">
      ${c.cells.map(([v, l], i) => `<div style="${i ? "border-left:1px solid rgba(255,255,255,.3);padding-left:32px;" : ""}${i < c.cells.length - 1 ? "padding-right:32px;" : ""}">
        <div style="font-size:49px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;color:#fff">${v}</div>
        <div style="font-size:21px;color:rgba(255,255,255,.7);font-weight:500;margin-top:7px">${l}</div>
      </div>`).join("")}
    </div>
    <div style="font-size:24px;color:rgba(255,255,255,.82);line-height:1.5;margin-top:32px;max-width:780px">${c.caveat}</div>
  `)}
  ${footer}`);

// Safe-zone proof overlay (9:16): shades the zones Instagram UI covers.
// Appended at canvas level (position:fixed) so the bands align to the frame, not the padded content box.
const safecheck = (html, f) => html + `
  <div style="position:fixed;left:0;right:0;top:0;height:${f.pt}px;background:rgba(217,37,28,.32);border-bottom:2px dashed rgba(255,255,255,.65);box-sizing:border-box"></div>
  <div style="position:fixed;left:0;right:0;bottom:0;height:${f.pb}px;background:rgba(217,37,28,.32);border-top:2px dashed rgba(255,255,255,.65);box-sizing:border-box"></div>
  <div style="position:fixed;right:0;top:${f.pt}px;bottom:${f.pb}px;width:${f.pr}px;background:rgba(217,37,28,.26);border-left:2px dashed rgba(255,255,255,.5);box-sizing:border-box"></div>`;

const browser = await chromium.launch();
async function render(html, file, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0">${html}</body>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready); // block until Archivo is actually painted, never guess with a timer
  await page.waitForTimeout(150); // settle layout shift from images decoding
  await page.screenshot({ path: `${OUT}/${file}`, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log("  ✓", file);
}

console.log("Rendering cinematic carousel -> " + OUT);
await render(cover(FMT45), "slide-1.png", 1080, 1350);
for (let i = 0; i < COUNTRIES.length; i++) await render(country(COUNTRIES[i], FMT45), `slide-${i + 2}.png`, 1080, 1350);
console.log("Reel/story 9:16 set (safe-zone constrained) ->");
await render(cover(FMT916), "reels/slide-1.png", 1080, 1920);
for (let i = 0; i < COUNTRIES.length; i++) await render(country(COUNTRIES[i], FMT916), `reels/slide-${i + 2}.png`, 1080, 1920);
await render(safecheck(cover(FMT916), FMT916), "reels/safe-zone-check.png", 1080, 1920);
await browser.close();
console.log("\nDone. 6x 4:5 + 6x 9:16 + safe-zone proof.");
