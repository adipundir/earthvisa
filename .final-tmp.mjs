import { chromium } from "playwright";
const PAGES = ["/guide/proof-of-funds","/programs/digital-nomad-visa","/programs/work-visa",
"/programs/student-visa","/rankings/visa-fees","/programs/citizenship-by-investment","/rankings",
"/guide/esta","/guide/visa-types","/guide/schengen","/guide/transit-visa","/programs/golden-visa",
"/guide/etias","/guide/umrah-visa","/guide/gcc-visa","/programs/easiest-citizenship","/programs","/visit"];
const BASE = { "/guide/proof-of-funds":[26.4,4443,5,81], "/programs/digital-nomad-visa":[25.3,4143,6,130],
"/programs/work-visa":[30.7,3499,143,1312], "/programs/student-visa":[24.5,2752,307,619],
"/rankings/visa-fees":[11.6,2120,6,24], "/programs/citizenship-by-investment":[17,2015,6,119],
"/rankings":[8.2,2006,6,1], "/guide/esta":[13.7,1900,8,19], "/guide/visa-types":[9.7,1753,4,24],
"/guide/schengen":[13.8,1702,11,18], "/guide/transit-visa":[8.9,1142,8,13],
"/programs/golden-visa":[9.6,1080,12,63], "/guide/etias":[9.4,1032,6,29],
"/guide/umrah-visa":[8.5,1022,6,28], "/guide/gcc-visa":[7.8,868,6,60],
"/programs/easiest-citizenship":[9.5,1045,7,32], "/programs":[3.3,310,0,4], "/visit":[2.3,181,0,1] };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
console.log("page".padEnd(38),"screens".padStart(14),"visWords".padStart(16),"det".padStart(11),"UPPER".padStart(13),"anchors");
let tw=0, bw=0;
for (const path of PAGES) {
  await p.goto("http://127.0.0.1:3111"+path,{waitUntil:"domcontentloaded",timeout:30000});
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const w=(s)=>(s||"").trim().split(/\s+/).filter(Boolean).length;
    const up=[...document.querySelectorAll("*")].filter(e=>{const t=(e.textContent||"").trim();
      if(!t||t.length<2||e.children.length)return false;
      return getComputedStyle(e).textTransform==="uppercase"||(t===t.toUpperCase()&&/[A-Z]{2}/.test(t));}).length;
    const main=document.querySelector("main")||document.body;
    return {h:document.documentElement.scrollHeight, vis:w(document.body.innerText),
      det:document.querySelectorAll("details").length, up,
      anchors:main.querySelectorAll("a[href^='/']").length,
      ovf:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
  });
  const [bs,bv,bd,bu]=BASE[path]||[0,0,0,0];
  const scr=+(m.h/844).toFixed(1);
  const d=(a,b0)=>{const x=a-b0;return x===0?"=":(x>0?"+":"")+x;};
  console.log(path.padEnd(38), `${bs}->${scr} (${d(scr,bs)})`.padStart(14),
    `${bv}->${m.vis} (${d(m.vis,bv)})`.padStart(16),
    `${bd}->${m.det} (${d(m.det,bd)})`.padStart(11),
    `${bu}->${m.up} (${d(m.up,bu)})`.padStart(13), String(m.anchors).padStart(5), m.ovf?" OVERFLOW":"");
  tw+=m.vis; bw+=bv;
}
console.log(`\nvisible words across these pages: ${bw} -> ${tw}  (${(((tw-bw)/bw)*100).toFixed(1)}%)`);
await b.close();
