import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
for (const path of ["/passport/india/thailand","/passport/india/japan","/passport/india","/destination/japan","/list/visa-free-countries-for-indians"]) {
  await p.goto("http://127.0.0.1:3111"+path,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const w=(s)=>(s||"").trim().split(/\s+/).filter(Boolean).length;
    const ds=[...document.querySelectorAll("details")];
    const summaries=ds.map(d=>(d.querySelector("summary")?.textContent||"").trim().slice(0,42));
    return {scr:+(document.documentElement.scrollHeight/844).toFixed(1), vis:w(document.body.innerText),
      det:ds.length, summaries:summaries.slice(0,12)};
  });
  console.log(path.padEnd(42), "scr",m.scr, "vis",m.vis, "det",m.det);
  if (m.det>8) console.log("   summaries:", JSON.stringify(m.summaries));
}
await b.close();
