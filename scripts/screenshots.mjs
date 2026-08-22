// Full-page screenshots of the site, at a phone width and a desktop width,
// for looking at a change rather than reading it.
//
//   node scripts/screenshots.mjs                       # defaults below, against :3100
//   BASE=http://localhost:3000 node scripts/screenshots.mjs / /passport/india/japan
//   OUT=/tmp/shots node scripts/screenshots.mjs
//
// Uses the Playwright that is already a devDependency. Files land in OUT
// (default .screenshots/, gitignored) as <slug>-<width>.png.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? ".screenshots";
const DEFAULT_PATHS = [
  "/",
  "/passport/india/japan",
  "/passport/india",
  "/destination/japan",
  "/list/visa-free-countries-for-indians",
  "/programs/citizenship-by-investment",
  "/rankings",
  "/guide/esta",
];
const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PATHS;
const viewports = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    deviceScaleFactor: 2,
    colorScheme: process.env.DARK ? "dark" : "light",
  });
  const page = await context.newPage();
  for (const p of paths) {
    const slug = p === "/" ? "home" : p.replace(/^\//, "").replace(/\//g, "_");
    try {
      await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForTimeout(400);
      const file = join(OUT, `${slug}-${vp.name}${process.env.DARK ? "-dark" : ""}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const words = (await page.evaluate(() => document.body.innerText))
        .split(/\s+/).filter(Boolean).length;
      console.log(`${file}  (${words} visible words)`);
    } catch (err) {
      console.error(`${p} @ ${vp.name}: ${err.message}`);
    }
  }
  await context.close();
}
await browser.close();
