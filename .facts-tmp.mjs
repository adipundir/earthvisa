import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
for (const path of ["/programs/work-visa","/programs/student-visa","/programs/digital-nomad-visa"]) {
  await p.goto("http://127.0.0.1:3111"+path,{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const main=document.querySelector("main")||document.body;
    const dest=[...main.querySelectorAll("a[href^='/destination/']")].map(a=>a.getAttribute("href"));
    const rows=main.querySelectorAll("tbody tr").length;
    const domWords=(main.textContent||"").trim().split(/\s+/).filter(Boolean).length;
    return { uniqueDestLinks:new Set(dest).size, totalDestLinks:dest.length, tableRows:rows,
      domWords, tables:main.querySelectorAll("table").length,
      details:main.querySelectorAll("details").length };
  });
  console.log(path.padEnd(32), JSON.stringify(m));
}
await b.close();
