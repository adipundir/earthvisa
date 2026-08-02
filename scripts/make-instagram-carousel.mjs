// Earth Visa - first Instagram post: a 6-slide portrait carousel (1080x1350, 4:5).
// Reuses the shipped v2 "Instrument" brand system (Archivo, #F6F7F9 ground,
// #0B0E14 ink, #D9251C red accent) and the Orbit mark from make-brand-assets.mjs.
// Arc: pain -> reveal -> three principles -> CTA. No em/en dashes (owner copy rule).
// Output -> ./brand-assets/instagram/first-post/slide-1..6.png
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const OUT = "brand-assets/instagram/first-post";
mkdirSync(OUT, { recursive: true });
const asset = (f) => `data:image/png;base64,${readFileSync(`brand-assets/${f}`).toString("base64")}`;

const W = 1080, H = 1350, TOTAL = 6;
const INK = "#0B0E14", GROUND = "#F6F7F9", SUB = "#525E6E", MUTED = "#8A94A2",
      RED = "#D9251C", HAIR = "#E2E6EB", LIGHT = "#F6F7F9", DARK = "#0B0E14";

const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

// Orbit mark (transparent) + app-icon tile - lifted verbatim from make-brand-assets.mjs.
const mark = (s, ink = "#11203a") =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="8.5" fill="${ink}"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="${ink}" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#D9251C"/></g></svg>`;
const tile = (s) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="11" fill="#b23528"/><circle cx="24" cy="24" r="8.5" fill="#fffdf8"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#fffdf8" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#11203a"/></g></svg>`;

// Faint oversized orbit bleeding off the bottom-right corner (cover + CTA only).
const ghost = (color, op) =>
  `<div style="position:absolute;right:-160px;bottom:-190px;opacity:${op};transform:rotate(-8deg)"><svg width="760" height="760" viewBox="0 0 48 48"><circle cx="24" cy="24" r="8.5" fill="${color}"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="${color}" stroke-width="1.3"/></g></svg></div>`;

function browserFrame(url, img) {
  return `<div style="border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(11,14,20,.16);border:1px solid ${HAIR};background:#fff">
    <div style="height:52px;background:${GROUND};display:flex;align-items:center;gap:9px;padding:0 22px;border-bottom:1px solid ${HAIR}">
      <span style="width:12px;height:12px;border-radius:50%;background:#D8DDE3"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#D8DDE3"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#D8DDE3"></span>
      <span style="margin-left:16px;font-size:19px;font-weight:500;color:${MUTED}">${url}</span>
    </div>
    <img src="${img}" style="display:block;width:100%"/>
  </div>`;
}

function shell({ bg, ink, lockInk, index, body, deco = "", footer = "earthvisa.in" }) {
  const footLeft = footer ? `<span style="font-size:23px;color:${RED};font-weight:600">${footer}</span>` : `<span></span>`;
  return `${FONT}<div style="width:${W}px;height:${H}px;background:${bg};box-sizing:border-box;font-family:'Archivo',system-ui,sans-serif;color:${ink};position:relative;overflow:hidden">
    ${deco}
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:90px 88px 122px">
      <div style="display:flex;align-items:center;gap:13px">${mark(34, lockInk)}<span style="font-size:25px;font-weight:700;letter-spacing:-.02em;color:${ink}">Earth Visa</span></div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">${body}</div>
    </div>
    <div style="position:absolute;left:88px;right:88px;bottom:66px;display:flex;justify-content:space-between;align-items:center">
      ${footLeft}
      <span style="font-size:21px;color:${MUTED};font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:.03em">${String(index).padStart(2, "0")} / 0${TOTAL}</span>
    </div>
  </div>`;
}

const eyebrow = (t) => `<div style="font-size:21px;font-weight:600;color:${RED};letter-spacing:-.01em;margin-bottom:22px">${t}</div>`;
const head = (t, size) => `<div style="font-size:${size}px;font-weight:800;line-height:1.03;letter-spacing:-.025em">${t}</div>`;
const sub = (t, color = SUB) => `<div style="font-size:31px;line-height:1.36;color:${color};margin-top:28px;max-width:900px;font-weight:400">${t}</div>`;

const SLIDES = [
  // 1 - hook: the universal pain
  { index: 1, bg: GROUND, ink: INK, lockInk: "#11203a", deco: ghost(INK, 0.05),
    body: eyebrow("A free visa checker")
      + head("Three sites.<br>Three answers.<br>Zero sources.", 84)
      + sub("You have done this. “Do I need a visa for Japan?” Every site says something different, and not one shows where its answer came from.") },

  // 2 - the reveal + real product UI
  { index: 2, bg: GROUND, ink: INK, lockInk: "#11203a",
    body: eyebrow("So I built Earth Visa")
      + head("199 passports.<br>196 destinations.", 62)
      + `<div style="font-size:26px;color:${SUB};margin-top:20px;max-width:880px;line-height:1.32;font-weight:400">One government-sourced answer for every route: visa-free, visa on arrival, eTA, e-visa or embassy.</div>`
      + `<div style="margin-top:40px">${browserFrame("earthvisa.in/passport/india", asset("gallery-3-passport.png"))}</div>` },

  // 3 - principle 1
  { index: 3, bg: GROUND, ink: INK, lockInk: "#11203a",
    body: eyebrow("Why it is different · 01")
      + head("Official sources,<br>or nothing.", 78)
      + sub("Every rule traces to a government's own publication. Not another visa site, not Wikipedia. Where there is no official source, you see the gap instead of a guess.") },

  // 4 - principle 2
  { index: 4, bg: GROUND, ink: INK, lockInk: "#11203a",
    body: eyebrow("Why it is different · 02")
      + head("The data is<br>built backwards.", 78)
      + sub("No government publishes where you can go, only who it lets in. Earth Visa reads all 199 inbound policies and inverts the matrix into what your passport can do.") },

  // 5 - principle 3 (the climax / most quotable)
  { index: 5, bg: GROUND, ink: INK, lockInk: "#11203a",
    body: eyebrow("Why it is different · 03")
      + head("An e-visa is<br>not access.", 84)
      + sub("The score counts visa-free, visa on arrival and eTA. E-visas are shown, never counted. Calling an application “access” is like calling a job application a job.") },

  // 6 - CTA (dark close)
  { index: 6, bg: DARK, ink: LIGHT, lockInk: "#F6F7F9", footer: "", deco: ghost("#FFFFFF", 0.06),
    body: `<div style="margin-bottom:34px">${tile(96)}</div>`
      + head("Check the passport<br>you actually carry.", 62)
      + `<div style="font-size:30px;line-height:1.4;color:${MUTED};margin-top:26px;max-width:860px;font-weight:400">Free. No account, no upsell. Just the answer, and the source it came from.</div>`
      + `<div style="font-size:54px;font-weight:800;color:${RED};margin-top:46px;letter-spacing:-.02em">earthvisa.in</div>` },
];

const browser = await chromium.launch();
async function render(html, file) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0">${html}</body>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${file}`, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log("  ✓", file);
}
console.log("Rendering Instagram carousel -> " + OUT);
for (const s of SLIDES) await render(shell(s), `slide-${s.index}.png`);
await browser.close();
console.log("\nDone. 6 slides at " + W + "x" + H + " (2x).");
