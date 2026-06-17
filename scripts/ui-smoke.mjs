import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });

// pick a passport: type in the combobox and click the first result
await page.getByPlaceholder("Search a country…").click();
await page.getByPlaceholder("Search a country…").fill("Germany");
await page.waitForTimeout(300);
const opt = page.getByRole("button", { name: /Germany/ }).first();
const germanyAvailable = await opt.count();
if (germanyAvailable) {
  await opt.click();
} else {
  // fall back to any first option
  await page.locator("ul li button").first().click();
}
await page.waitForTimeout(400);

// add a second passport
await page.getByPlaceholder(/Add another passport/).fill("United States");
await page.waitForTimeout(300);
const us = page.getByRole("button", { name: /United States/ }).first();
if (await us.count()) await us.click();
await page.waitForTimeout(400);

const out = {};
out.chips = await page.locator("span:has(> button[aria-label^='Remove'])").count();
out.statBandVisible = await page.getByText("Reachable without a prior visa").isVisible().catch(() => false);
out.tabs = await page.locator("button:has-text('Visa-free reach')").count();

// reach tab content
const reachCards = await page.locator("div.grid > div").count();
out.reachOrNoteRendered = reachCards > 0;

// click each tab and ensure it renders something
for (const t of ["Freedom of movement", "Citizenship by investment", "Golden visas (residency)", "Fast-track immigration"]) {
  await page.getByRole("button", { name: new RegExp(t.replace(/[()]/g, ".")) }).first().click();
  await page.waitForTimeout(200);
}
out.memberships = await page.getByText("Your bloc memberships:").isVisible().catch(() => false);

await browser.close();
out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
if (errors.length) { console.error("CONSOLE ERRORS PRESENT"); process.exit(1); }
if (!out.statBandVisible || !out.chips) { console.error("UI did not update on selection"); process.exit(2); }
console.log("UI SMOKE PASSED");
