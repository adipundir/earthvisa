import raw from "@/data/dataset.json";
import type { Dataset, VisaType } from "./types";
export type { VisaType };

export const dataset = raw as unknown as Dataset;

/** ISO-3166 alpha-2 -> flag emoji */
export function isoToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

const iso3ToCountry = new Map(dataset.allCountries.map((c) => [c.iso3, c]));
export function country(iso3: string) {
  return iso3ToCountry.get(iso3);
}
export function flagFor(iso3: string): string {
  const c = iso3ToCountry.get(iso3);
  return c ? isoToFlag(c.iso2) : "🏳️";
}
export function nameFor(iso3: string): string {
  return iso3ToCountry.get(iso3)?.name ?? iso3;
}
