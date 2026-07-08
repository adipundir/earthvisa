import { dataset } from "@/lib/dataset";
import type { MetadataRoute } from "next";
import { corridorPairs, TOP_NATIONALITIES } from "@/lib/corridors";
import { aliasBySlug } from "@/lib/colloquial";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Static SEO routes built outside the country/corridor graph.
const GUIDE_PAGES = ["/guide/schengen", "/guide/etias", "/guide/umrah-visa", "/guide/gcc-visa", "/guide/proof-of-funds", "/guide/visa-types", "/guide/transit-visa"];
const PROGRAM_PAGES = [
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
  "/list/visa-on-arrival-countries-for-indians",
  "/list/visa-on-arrival-countries-for-pakistanis",
  "/list/visa-on-arrival-countries-for-filipinos",
  "/list/visa-on-arrival-countries-for-nigerians",
  "/list/countries-with-us-visa-for-indians",
  "/list/countries-with-us-visa-for-pakistani-citizens",
  "/list/countries-with-us-visa-for-filipino-citizens",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://earthvisa.in";
  const passportPages = dataset.allCountries.map((c) => ({
    url: `${base}/passport/${nameToSlug(c.name)}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const destinationPages = dataset.allCountries.map((c) => ({
    url: `${base}/destination/${nameToSlug(c.name)}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const corridorPages = corridorPairs().map((c) => ({
    url: `${base}/passport/${c.natSlug}/${c.destSlug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  // Colloquial alias destinations (dubai, bali, ...) - high-volume query tokens.
  const aliasPages = [...aliasBySlug.keys()].map((slug) => ({
    url: `${base}/destination/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  // Per-nationality Schengen guides (mirrors generateStaticParams on the route).
  const schengenNationalityPages = TOP_NATIONALITIES.flatMap((iso3) => {
    const c = dataset.allCountries.find((x) => x.iso3 === iso3);
    return c ? [{
      url: `${base}/guide/schengen/${nameToSlug(c.name)}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }] : [];
  });
  const staticSeoPages = [...GUIDE_PAGES, ...PROGRAM_PAGES, ...LIST_PAGES].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/visit`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/rankings`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/passport`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/destination`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/destination/europe`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    ...staticSeoPages,
    ...schengenNationalityPages,
    ...aliasPages,
    ...passportPages,
    ...destinationPages,
    ...corridorPages,
  ];
}
