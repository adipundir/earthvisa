import { dataset } from "@/lib/dataset";
import type { MetadataRoute } from "next";
import { corridorPairs, TOP_NATIONALITIES } from "@/lib/corridors";
import { aliasBySlug } from "@/lib/colloquial";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Static SEO routes built outside the country/corridor graph.
const GUIDE_PAGES = ["/guide", "/guide/schengen", "/guide/etias", "/guide/umrah-visa", "/guide/gcc-visa", "/guide/proof-of-funds", "/guide/visa-types", "/guide/transit-visa", "/guide/japan-visa-fee-increase-2026"];
const PROGRAM_PAGES = [
  "/programs",
  "/programs/citizenship-by-investment",
  "/programs/golden-visa",
  "/programs/digital-nomad-visa",
  "/programs/easiest-citizenship",
  "/programs/work-visa",
  "/programs/student-visa",
];
// Must mirror LISTS in src/app/list/[slug]/page.tsx.
const LIST_PAGES = [
  "/list/visa-free-countries-for-indians",
  "/list/visa-free-countries-for-pakistanis",
  "/list/visa-free-countries-for-filipinos",
  "/list/visa-free-countries-for-nigerians",
  "/list/visa-free-countries-for-indonesians",
  "/list/visa-free-countries-for-vietnamese-citizens",
  "/list/visa-free-countries-for-brazilians",
  "/list/visa-free-countries-for-mexicans",
  "/list/visa-free-countries-for-egyptians",
  "/list/visa-free-countries-for-bangladeshis",
  "/list/e-visa-countries-for-indians",
  "/list/visa-on-arrival-countries-for-indians",
  "/list/visa-on-arrival-countries-for-pakistanis",
  "/list/visa-on-arrival-countries-for-filipinos",
  "/list/visa-on-arrival-countries-for-nigerians",
  "/list/visa-on-arrival-countries-for-indonesians",
  "/list/visa-on-arrival-countries-for-vietnamese-citizens",
  "/list/visa-on-arrival-countries-for-brazilians",
  "/list/visa-on-arrival-countries-for-mexicans",
  "/list/visa-on-arrival-countries-for-egyptians",
  "/list/visa-on-arrival-countries-for-bangladeshis",
  "/list/countries-with-us-visa-for-indians",
  "/list/countries-with-us-visa-for-pakistani-citizens",
  "/list/countries-with-us-visa-for-filipino-citizens",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://earthvisa.in";
  // Fallback for static/aggregate pages and anything missing from
  // countryLastUpdated (e.g. a country file that's never been committed yet).
  const lastModified = new Date(dataset.meta.lastUpdated);
  // Per-country dates (from that country's own git history - see
  // countryLastUpdated in build-dataset.mjs) so updating one country's data
  // doesn't bump every URL's timestamp and trigger a full-site recrawl wave.
  const dateFor = (iso3: string): Date => {
    const d = dataset.countryLastUpdated?.[iso3];
    return d ? new Date(d) : lastModified;
  };
  const passportPages = dataset.allCountries.map((c) => ({
    url: `${base}/passport/${nameToSlug(c.name)}`,
    lastModified: dateFor(c.iso3),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const destinationPages = dataset.allCountries.map((c) => ({
    url: `${base}/destination/${nameToSlug(c.name)}`,
    lastModified: dateFor(c.iso3),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const corridorPages = corridorPairs().map((c) => {
    const natDate = dateFor(c.nat);
    const destDate = dateFor(c.dest);
    return {
      url: `${base}/passport/${c.natSlug}/${c.destSlug}`,
      // a corridor page's content depends on BOTH countries' data, so use
      // whichever changed more recently.
      lastModified: natDate > destDate ? natDate : destDate,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    };
  });
  // Colloquial alias destinations (dubai, bali, ...) - high-volume query tokens.
  const aliasPages = [...aliasBySlug.values()].map((a) => ({
    url: `${base}/destination/${a.slug}`,
    lastModified: dateFor(a.iso3),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  // Per-nationality Schengen guides (mirrors generateStaticParams on the route).
  const schengenNationalityPages = TOP_NATIONALITIES.flatMap((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    return c ? [{
      url: `${base}/guide/schengen/${nameToSlug(c.name)}`,
      lastModified: dateFor(iso3),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }] : [];
  });
  const staticSeoPages = [...GUIDE_PAGES, ...PROGRAM_PAGES, ...LIST_PAGES].map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/visit`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/rankings`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/rankings/visa-fees`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/passport`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/destination`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/destination/europe`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    // Earthling hub + leaderboard (individual profiles stay out: user-generated,
    // unbounded, and each page carries its own canonical).
    { url: `${base}/earthling`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/earthling/leaderboard`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    ...staticSeoPages,
    ...schengenNationalityPages,
    ...aliasPages,
    ...passportPages,
    ...destinationPages,
    ...corridorPages,
  ];
}
