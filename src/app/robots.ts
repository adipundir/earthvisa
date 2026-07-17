import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Preview/branch deployments share this same route - without this check they'd
  // serve the identical "allow everything" robots.txt as production, risking
  // Google indexing throwaway preview URLs as duplicate content.
  const isProduction = process.env.VERCEL_ENV === "production";
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
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
