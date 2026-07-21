// Hard boundary: importing this module pulls in the 18MB dataset.json. The
// `server-only` guard makes any accidental import from a Client Component a
// BUILD error instead of a silent 18MB client-bundle regression. Client code
// needs isoToFlag/nameToSlug -> import those from "@/lib/format" directly.
import "server-only";
import raw from "@/data/dataset.json";
import type { Dataset, VisaType } from "./types";
export type { VisaType };

export const dataset = raw as unknown as Dataset;

// isoToFlag/nameToSlug live in @/lib/format (pure, no dataset) so client
// components can use them without dragging the full dataset into their bundle;
// re-exported here for the many server-side callers.
export { isoToFlag, nameToSlug } from "./format";
import { isoToFlag } from "./format";

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


