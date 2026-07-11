import { dataset } from "@/lib/dataset";
const TOTAL_PASSPORTS = dataset.allCountries.length;
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Earth Visa - Visa-Free Travel & Entry Rules for ${TOTAL_PASSPORTS} Passports`,
    short_name: "Earth Visa",
    description:
      `Check what your passport can do and whether you need a visa - visa-free travel, visa on arrival, eTA, golden visas and citizenship by investment for ${TOTAL_PASSPORTS} passports, from official government sources.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#b23528",
    lang: "en",
    categories: ["travel", "reference", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
