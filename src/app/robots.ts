import type { MetadataRoute } from "next";

/** The one host whose pages may be indexed. */
const CANONICAL_HOST = "earthvisa.in";

export default function robots(): MetadataRoute.Robots {
  // Preview/branch deployments share this same route - without this check they'd
  // serve the identical "allow everything" robots.txt as production, risking
  // Google indexing throwaway preview URLs as duplicate content.
  //
  // Decided from the CANONICAL URL, not from a host's own environment
  // variable. This used to read VERCEL_ENV, which only Vercel ever sets, so
  // off Vercel the check read undefined and the site served "Disallow: /",
  // asking Google to drop every page it has. Organic search is how people find
  // this product, so that failure is close to switching the product off - and
  // it would have looked completely healthy.
  //
  // Deriving it from the canonical URL means a staging deployment excludes
  // itself simply by not claiming to be earthvisa.in, with nothing extra to
  // remember to set.
  const host = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();

  if (host !== CANONICAL_HOST && host !== `www.${CANONICAL_HOST}`) {
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
