import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
  metadataBase: new URL("https://passportpower.co"),
  title: {
    default: "Passport Power - Visa-Free Countries for 199 Passports",
    template: "%s | Passport Power",
  },
  description: "Compare visa-free access for all 199 passports. Check visa on arrival, e-visa, golden visas & citizenship by investment programs worldwide. Official government sources only.",
  keywords: [
    "passport power", "passport index", "passport ranking", "most powerful passport",
    "strongest passport in the world", "passport power index", "visa free countries",
    "visa on arrival countries", "how many countries can I visit without visa",
    "citizenship by investment", "golden visa", "second passport", "digital nomad visa",
    "easiest country to get citizenship", "dual citizenship", "free movement rights",
    "e-visa countries", "fast track immigration", "passport strength", "travel without visa",
    "visa free countries for indian passport", "us passport visa free countries",
    "passport rankings 2026", "best passport in the world"
  ],
  authors: [{ name: "Passport Power" }],
  creator: "Passport Power",
  publisher: "Passport Power",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://passportpower.co",
    siteName: "Passport Power",
    title: "Passport Power - Visa-Free Countries for 199 Passports",
    description: "Compare visa-free access for all 199 passports. Check visa on arrival, e-visa, golden visas & citizenship by investment. Official sources.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Passport Power - World Passport Rankings & Visa-Free Countries 2026" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Passport Power - Visa-Free Countries for 199 Passports",
    description: "Compare visa-free access for all 199 passports. Check visa on arrival, e-visa, golden visas & citizenship by investment. Official sources.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://passportpower.co" },
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
                "@type": "WebApplication",
                "name": "Passport Power",
                "description": "Passport Power shows visa-free countries, visa on arrival, citizenship by investment, golden visas and fast-track immigration programs for 199 passports, sourced exclusively from official government publications.",
                "url": "https://passportpower.co",
                "applicationCategory": "TravelApplication",
                "operatingSystem": "Any",
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                "featureList": [
                  "Visa-free country lookup for 199 passports",
                  "Visa on arrival destination finder",
                  "Citizenship by investment program comparison",
                  "Golden visa / residency by investment directory",
                  "Fast-track immigration program search",
                  "Freedom of movement rights by regional bloc"
                ],
                "provider": {
                  "@type": "Organization",
                  "name": "Passport Power",
                  "url": "https://passportpower.co"
                }
              },
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "Which passport has the most visa-free countries in 2026?",
                    "acceptedAnswer": { "@type": "Answer", "text": "As of 2026, Singapore, Japan, and several European passports (France, Germany, Italy, Spain) consistently rank among the most powerful, offering visa-free or visa-on-arrival access to 190+ destinations. Passport Power tracks live rankings for all 199 passports based on official government data." }
                  },
                  {
                    "@type": "Question",
                    "name": "How many countries can I visit without a visa?",
                    "acceptedAnswer": { "@type": "Answer", "text": "It depends on your passport. Top-ranked passports access 190+ countries visa-free or on arrival. Search your nationality on Passport Power to see the exact list of visa-free countries, visa-on-arrival destinations, and e-visa options for your specific passport." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is the difference between visa on arrival and e-visa?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Visa on arrival (VoA) means you obtain your visa at the airport or border upon arrival - no advance application required. An e-visa (electronic visa) requires you to apply and receive approval online before you travel. Both allow entry but e-visas must be secured in advance." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is citizenship by investment?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Citizenship by investment (CBI) allows foreign nationals to obtain a second passport by making a qualifying investment - typically a donation to a national development fund or real estate purchase. Popular programs include those in the Caribbean (St Kitts, Grenada, Dominica) and Europe (Malta, Vanuatu). Costs typically range from $100,000 to $1,000,000+." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is a golden visa?",
                    "acceptedAnswer": { "@type": "Answer", "text": "A golden visa is a residency-by-investment program that grants long-term residency (and sometimes a path to citizenship) in exchange for a qualifying investment such as real estate, business creation, or government bonds. Popular golden visa countries include Portugal, Spain, Greece, UAE, and Malta." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is a passport power index?",
                    "acceptedAnswer": { "@type": "Answer", "text": "A passport power index ranks passports by the number of countries their holders can visit without obtaining a visa in advance. Passport Power ranks all 199 passports using official government data, covering visa-free, visa on arrival, eTA, and e-visa access across 227 destinations." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is an eTA (Electronic Travel Authorization)?",
                    "acceptedAnswer": { "@type": "Answer", "text": "An eTA (Electronic Travel Authorization) is a lightweight pre-travel permission required by some countries - such as Canada, Australia (ETA), and the UK (ETA) - for nationalities that are otherwise visa-exempt. It is applied for online, costs a small fee, and is typically approved within minutes to hours. An eTA does not require a visa appointment." }
                  }
                ]
              }
            ])
          }}
        />
        <a href="#main" className="skip-link">Skip to main content</a>
        <Navbar />
        <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
