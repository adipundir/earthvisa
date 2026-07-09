import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { Analytics } from "@vercel/analytics/next";
import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://earthvisa.in"),
  title: {
    default: `Earth Visa - Visa-Free Countries for ${TOTAL_PASSPORTS} Passports`,
    template: "%s | Earth Visa",
  },
  description: `Compare visa-free access for all ${TOTAL_PASSPORTS} passports. Check visa on arrival, e-visa, golden visas & citizenship by investment programs worldwide. Official government sources only.`,
  keywords: [
    "passport strength", "passport index", "passport ranking", "most powerful passport",
    "strongest passport in the world", "passport strength index", "visa free countries",
    "visa on arrival countries", "how many countries can I visit without visa",
    "citizenship by investment", "golden visa", "second passport", "digital nomad visa",
    "easiest country to get citizenship", "dual citizenship", "free movement rights",
    "e-visa countries", "fast track immigration", "passport strength", "travel without visa",
    "visa free countries for indian passport", "us passport visa free countries",
    "passport rankings 2026", "best passport in the world"
  ],
  authors: [{ name: "Earth Visa" }],
  creator: "Earth Visa",
  publisher: "Earth Visa",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://earthvisa.in",
    siteName: "Earth Visa",
    title: `Earth Visa - Visa-Free Countries for ${TOTAL_PASSPORTS} Passports`,
    description: `Compare visa-free access for all ${TOTAL_PASSPORTS} passports. Check visa on arrival, e-visa, golden visas & citizenship by investment. Official sources.`,
    // OG image is supplied by app/opengraph-image.tsx (file-based Metadata API).
  },
  twitter: {
    card: "summary_large_image",
    title: `Earth Visa - Visa-Free Countries for ${TOTAL_PASSPORTS} Passports`,
    description: `Compare visa-free access for all ${TOTAL_PASSPORTS} passports. Check visa on arrival, e-visa, golden visas & citizenship by investment. Official sources.`,
    // Twitter image is supplied by app/twitter-image.tsx (file-based Metadata API).
  },
  alternates: { canonical: "https://earthvisa.in" },
  // Search-engine ownership verification. Codes are supplied via Vercel env vars
  // (GOOGLE_SITE_VERIFICATION from Google Search Console, BING_SITE_VERIFICATION
  // from Bing Webmaster Tools) so they can be added without a code change.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": "https://earthvisa.in/#website",
                "name": "Earth Visa",
                "alternateName": "Earth Visa - passport & visa tool",
                "url": "https://earthvisa.in",
                "description": `Check what your passport can do and whether you need a visa, covering ${dataset.meta.totalCountries} passports and ${dataset.meta.destinationsWithVisaPolicy} destinations with enumerated visa policies, from official government sources.`,
                "inLanguage": "en",
                "publisher": { "@id": "https://earthvisa.in/#organization" },
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "https://earthvisa.in/passport?q={search_term_string}"
                  },
                  "query-input": "required name=search_term_string"
                }
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://earthvisa.in/#organization",
                "name": "Earth Visa",
                "url": "https://earthvisa.in",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://earthvisa.in/icon.svg",
                  "width": 32,
                  "height": 32
                },
                "description": `Earth Visa tracks visa-free travel, visa on arrival, eTA, e-visa, golden visas, citizenship by investment and fast-track immigration for ${TOTAL_PASSPORTS} passports, sourced exclusively from official government publications.`
              },
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                "name": "Earth Visa",
                "description": `Earth Visa shows visa-free countries, visa on arrival, citizenship by investment, golden visas and fast-track immigration programs for ${TOTAL_PASSPORTS} passports, sourced exclusively from official government publications.`,
                "url": "https://earthvisa.in",
                "applicationCategory": "TravelApplication",
                "operatingSystem": "Any",
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                "featureList": [
                  `Visa-free country lookup for ${TOTAL_PASSPORTS} passports`,
                  "Visa on arrival destination finder",
                  "Citizenship by investment program comparison",
                  "Golden visa / residency by investment directory",
                  "Fast-track immigration program search",
                  "Freedom of movement rights by regional bloc"
                ],
                "provider": { "@id": "https://earthvisa.in/#organization" }
              }
            ])
          }}
        />
        <a href="#main" className="skip-link">Skip to main content</a>
        <Navbar lastUpdated={dataset.meta.lastUpdated} />
        <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
