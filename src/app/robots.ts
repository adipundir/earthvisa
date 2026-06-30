import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The /api routes are data endpoints, not indexable pages.
      disallow: "/api/",
    },
    sitemap: "https://earthvisa.in/sitemap.xml",
    host: "https://earthvisa.in",
  };
}
