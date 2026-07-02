// Composite captioned product shots for the Product Hunt gallery: a benefit
// headline on the brand background + the real UI in a browser frame.
// Reuses the raw screenshots already in ./brand-assets/.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const OUT = "brand-assets";
const b64 = (f) => `data:image/png;base64,${readFileSync(`${OUT}/${f}`).toString("base64")}`;
const browser = await chromium.launch();

const FONT = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet">`;

const mark = (s) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><circle cx="24" cy="24" r="8.5" fill="#11203a"/><g transform="rotate(-26 24 24)"><ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#11203a" stroke-width="2.4"/><circle cx="40" cy="24" r="3.1" fill="#b23528"/></g></svg>`;

function frame(url, img) {
  return `<div style="border-radius:16px;overflow:hidden;box-shadow:0 34px 80px rgba(17,32,58,.24);border:1px solid #d8cfba;background:#fff">
    <div style="height:46px;background:#f2ecdf;display:flex;align-items:center;gap:9px;padding:0 20px;border-bottom:1px solid #e6ddca">
      <span style="width:12px;height:12px;border-radius:50%;background:#e06a5b"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#e6b34d"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#78b98a"></span>
      <span style="margin-left:16px;font-family:'IBM Plex Mono',monospace;font-size:16px;color:#8a7f6c">${url}</span>
    </div>
    <img src="${img}" style="display:block;width:100%"/>
  </div>`;
}

function slide({ eyebrow, headline, sub, url, img }) {
  return `${FONT}<div style="width:1270px;height:760px;background:#efe9dc;box-sizing:border-box;padding:64px 80px 0;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#11203a;overflow:hidden">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px">${mark(30)}<span style="font-size:22px;font-weight:700;letter-spacing:-.02em">Earth Visa</span></div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;letter-spacing:.18em;color:#b23528;font-weight:600;margin-bottom:12px">${eyebrow}</div>
    <div style="font-size:52px;font-weight:700;letter-spacing:-.025em;line-height:1.04;max-width:1050px">${headline}</div>
    <div style="font-size:24px;color:#41506b;margin-top:14px;max-width:940px;line-height:1.32">${sub}</div>
    <div style="margin-top:34px">${frame(url, img)}</div>
  </div>`;
}

async function render(html, file) {
  const page = await browser.newPage({ viewport: { width: 1270, height: 760 }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0">${html}</body>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}`, clip: { x: 0, y: 0, width: 1270, height: 760 } });
  await page.close();
  console.log("  ✓", file);
}

const SLIDES = [
  { file: "cap-1-passport.png", eyebrow: "WHAT CAN YOUR PASSPORT DO?", headline: "Every visa-free country, on one page.", sub: "Visa-free, visa-on-arrival, eTA and e-visa reach for all 199 passports.", url: "earthvisa.in/passport/india", img: b64("gallery-3-passport.png") },
  { file: "cap-2-corridor.png", eyebrow: "DO I NEED A VISA?", headline: "Fees, documents & the official source — per route.", sub: "The exact requirement for your nationality, with government-sourced fees and VFS charges.", url: "earthvisa.in/passport/india/thailand", img: b64("gallery-5-corridor-fees.png") },
  { file: "cap-3-proof-of-funds.png", eyebrow: "PROOF OF FUNDS", headline: "How much bank balance to actually show.", sub: "Official Schengen daily-subsistence amounts, kept separate from what applicants report.", url: "earthvisa.in/guide/proof-of-funds", img: b64("gallery-6-proof-of-funds.png") },
  { file: "cap-4-rankings.png", eyebrow: "PASSPORT INDEX 2026", headline: "All 199 passports, ranked by real access.", sub: "Official-source visa-free reach — see exactly where any passport stands.", url: "earthvisa.in/rankings", img: b64("gallery-4-rankings.png") },
];

for (const s of SLIDES) await render(slide(s), s.file);
await browser.close();
console.log("\nDone → ./brand-assets/ (cap-*.png)");
