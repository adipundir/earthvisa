#!/usr/bin/env node
// Notify IndexNow (Bing, Yandex, Seznam, Naver) of every URL in the live sitemap.
//
// IndexNow is a push protocol: instead of waiting for a crawler to re-visit,
// we tell the engines "these URLs exist / changed" and they queue them for
// crawling within hours. Google does NOT use IndexNow (submit the sitemap in
// Search Console instead), but Bing does — this is the fast path to Bing.
//
// Usage:
//   node scripts/indexnow.mjs                # submit all sitemap URLs
//   node scripts/indexnow.mjs https://earthvisa.in/passport/india   # submit one or more URLs
//
// The key file must be reachable at https://earthvisa.in/<KEY>.txt (it lives in
// public/), which is how the engines verify we own the domain.

const HOST = "earthvisa.in";
const KEY = "368ffe7c1315a150e8a31d38f016f473";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function urlsFromSitemap() {
  const res = await fetch(SITEMAP);
  if (!res.ok) throw new Error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return [...new Set(locs)];
}

async function submit(urlList) {
  // IndexNow accepts up to 10,000 URLs per request; chunk to stay well under.
  const CHUNK = 5000;
  for (let i = 0; i < urlList.length; i += CHUNK) {
    const batch = urlList.slice(i, i + CHUNK);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: batch }),
    });
    // 200 = accepted, 202 = accepted (queued). Anything else is worth surfacing.
    const body = await res.text().catch(() => "");
    console.log(`  → submitted ${batch.length} URLs: HTTP ${res.status} ${res.statusText}${body ? ` ${body}` : ""}`);
    if (res.status !== 200 && res.status !== 202) {
      throw new Error(`IndexNow rejected the batch (HTTP ${res.status}). Check the key file at ${KEY_LOCATION}.`);
    }
  }
}

const cliUrls = process.argv.slice(2).filter((a) => a.startsWith("http"));
const urls = cliUrls.length ? cliUrls : await urlsFromSitemap();
console.log(`Submitting ${urls.length} URL(s) to IndexNow (${HOST})…`);
await submit(urls);
console.log("Done. Bing/Yandex will crawl the submitted URLs within hours.");
