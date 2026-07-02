// Generate Product Hunt / marketing assets: fresh logo PNGs (new Orbit mark)
// + branded cards + real UI screenshots. Output goes to ./brand-assets/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "brand-assets";
mkdirSync(OUT, { recursive: true });
const SITE = process.env.SITE || "https://earthvisa.in";
const browser = await chromium.launch();

// ---- Orbit mark SVG (two color modes) ----
const tile = (s) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="11" fill="#b23528"/><circle cx="24" cy="24" r="8.5" fill="#fffdf8"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#fffdf8" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#11203a"/></g></svg>`;
const mark = (s, ink = "#11203a") =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="8.5" fill="${ink}"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="${ink}" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#b23528"/></g></svg>`;

async function renderHTML(html, w, h, file, { transparent = false, scale = 2 } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(`<body style="margin:0;padding:0">${html}</body>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log("  ✓", file);
}

async function shot(path, file, wait = 1600) {
  const page = await browser.newPage({
    viewport: { width: 1270, height: 760 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  await page.goto(`${SITE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
  console.log("  ✓", file, `(${path})`);
}

// Shared card shell (IBM Plex via Google Fonts - Playwright can fetch it).
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet">`;
const card = (inner, bg = "#efe9dc") =>
  `${FONT}<div style="width:1270px;height:760px;background:${bg};box-sizing:border-box;padding:96px 100px;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#11203a;position:relative;display:flex;flex-direction:column;justify-content:center">${inner}<div style="position:absolute;bottom:70px;left:100px;font-family:'IBM Plex Mono',monospace;font-size:24px;letter-spacing:.16em;color:#b23528;font-weight:600">EARTHVISA.IN</div></div>`;

console.log("Logos…");
await renderHTML(tile(1024), 1024, 1024, "logo-tile-1024.png");
await renderHTML(tile(512), 512, 512, "logo-tile-512.png");
await renderHTML(tile(240), 240, 240, "logo-tile-240.png");
await renderHTML(mark(1024), 1024, 1024, "logo-mark-transparent-1024.png", { transparent: true });

console.log("Branded cards…");
await renderHTML(
  card(
    `<div style="display:flex;align-items:center;gap:20px;margin-bottom:44px">${mark(66)}<span style="font-size:44px;font-weight:700;letter-spacing:-.02em">Earth Visa</span></div>
     <div style="font-size:82px;font-weight:700;line-height:1.03;letter-spacing:-.03em;max-width:1000px">What can your passport do?</div>
     <div style="font-size:33px;color:#41506b;margin-top:30px;max-width:930px;line-height:1.32">Visa-free travel, entry rules, official fees and document checklists for all 199 passports — from government sources only.</div>`
  ),
  1270, 760, "gallery-1-hero.png"
);
await renderHTML(
  card(
    `<div style="display:flex;align-items:center;gap:16px;margin-bottom:52px">${mark(48)}<span style="font-size:30px;font-weight:700;letter-spacing:-.02em">Earth Visa</span></div>
     <div style="font-size:60px;font-weight:700;letter-spacing:-.02em;line-height:1.05;margin-bottom:44px">Built on one rule</div>
     <div style="display:flex;flex-direction:column;gap:26px;font-size:34px;color:#26344d">
       <div style="display:flex;align-items:center;gap:20px"><span style="color:#b23528;font-weight:700">✓</span> Official government sources only — never aggregators</div>
       <div style="display:flex;align-items:center;gap:20px"><span style="color:#b23528;font-weight:700">✓</span> Visa fees, VFS charges & document checklists</div>
       <div style="display:flex;align-items:center;gap:20px"><span style="color:#b23528;font-weight:700">✓</span> Passport rankings & proof-of-funds guides</div>
       <div style="display:flex;align-items:center;gap:20px"><span style="color:#b23528;font-weight:700">✓</span> Free — no login, no ads, no tracking</div>
     </div>`
  ),
  1270, 760, "gallery-2-trust.png"
);

console.log("UI screenshots (live)…");
await shot("/passport/india", "gallery-3-passport.png");
await shot("/rankings", "gallery-4-rankings.png");
await shot("/passport/india/thailand", "gallery-5-corridor-fees.png");
await shot("/guide/proof-of-funds", "gallery-6-proof-of-funds.png");

await browser.close();
console.log("\nDone → ./brand-assets/");
