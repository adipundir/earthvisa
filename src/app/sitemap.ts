import { dataset } from "@/lib/dataset";
import type { MetadataRoute } from "next";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://passportpower.co";
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
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/visit`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/passport`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/destination`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    ...passportPages,
    ...destinationPages,
  ];
}
