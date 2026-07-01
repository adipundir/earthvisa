import type { RegionGroup } from "@/components/CountryIndex";
import { dataset } from "./dataset";

const REGION_ORDER = ["Europe", "Asia", "Americas", "Africa", "Oceania", "Pacific"];

/**
 * Region-grouped, alphabetically-sorted country list for the index pages.
 * `stat` supplies a small per-country figure so /passport (outbound visa-free
 * reach) and /destination (inbound nationalities admitted) are genuinely
 * different, not the same list rendered twice.
 */
export function buildRegions(stat?: (iso3: string) => string | undefined): RegionGroup[] {
  const byRegion = new Map<string, typeof dataset.allCountries>();
  for (const c of dataset.allCountries) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, []);
    byRegion.get(c.region)!.push(c);
  }
  return [...byRegion.keys()]
    .sort((a, b) => (REGION_ORDER.indexOf(a) + 1 || 99) - (REGION_ORDER.indexOf(b) + 1 || 99))
    .map((region) => ({
      region,
      countries: byRegion
        .get(region)!
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ iso2: c.iso2, iso3: c.iso3, name: c.name, stat: stat?.(c.iso3) })),
    }));
}
