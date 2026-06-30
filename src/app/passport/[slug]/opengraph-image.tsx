import { dataset } from "@/lib/dataset";
import { compute } from "@/lib/compute";
import { countryOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Earth Visa passport visa-free access card";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country =
    dataset.allCountries.find((c) => nameToSlug(c.name) === slug) ?? null;

  if (!country) {
    return countryOgImage({
      iso2: "",
      name: "Earth Visa",
      subtitle: "Visa-free travel and entry rules for 199 passports",
      stats: [],
    });
  }

  const result = compute([country.iso3], [], {});
  const vfCount = result.reachByLevel.visa_free.length;
  const voaCount = result.reachByLevel.visa_on_arrival.length;
  const etaCount =
    result.reachByLevel.eta.length + result.reachByLevel.e_visa.length;
  const total = result.reach.length;

  return countryOgImage({
    iso2: country.iso2,
    name: `${country.name} Passport`,
    subtitle: "Visa-free countries & travel freedom 2026",
    stats: [
      { label: "Visa-free", value: vfCount },
      { label: "On arrival", value: voaCount },
      { label: "eTA / e-Visa", value: etaCount },
      { label: "Total reach", value: total },
    ],
  });
}
