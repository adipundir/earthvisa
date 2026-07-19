import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;

// The single sitewide family (design system v2): Archivo variable, with the
// width axis so display type can run wide (font-stretch up to 125%).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
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
      suppressHydrationWarning
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Theme init BEFORE paint: .dark from localStorage, else system. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Single object root with @graph - never an array root. Array-root
            // JSON-LD is technically legal but breaks naive consumers that do
            // JSON.parse(text)["@context"] (Safari extensions etc.), and the
            // @graph form is what Google's own examples use for multiple nodes.
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
              {
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
              ]
            })
          }}
        />
        <a href="#main" className="skip-link">Skip to main content</a>
        <Navbar />
        <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <SiteFooter />
        <Analytics />
        {/* Microsoft Clarity (heatmaps / scroll maps / session recordings).
            Loads only when NEXT_PUBLIC_CLARITY_ID is set (Vercel env var), and
            lazily after the page is interactive so it never touches CWV. */}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="ms-clarity" strategy="lazyOnload">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
