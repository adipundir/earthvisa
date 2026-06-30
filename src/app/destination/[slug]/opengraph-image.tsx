import { dataset } from "@/lib/dataset";
import type { AccessLevel } from "@/lib/types";
import { countryOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Earth Visa destination entry requirements card";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Count, per access level, how many nationalities this destination admits.
function reverseCounts(destIso3: string): Record<AccessLevel, number> {
  const counts: Record<AccessLevel, number> = {
    visa_free: 0,
    visa_on_arrival: 0,
    eta: 0,
    e_visa: 0,
  };
  for (const edges of Object.values(dataset.passportAccess)) {
    const edge = edges.find((e) => e.dest === destIso3);
    if (edge) counts[edge.level] += 1;
  }
  return counts;
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

  const counts = reverseCounts(country.iso3);
  const vfCount = counts.visa_free;
  const voaCount = counts.visa_on_arrival;
  const etaCount = counts.eta + counts.e_visa;
  const total = vfCount + voaCount + etaCount;

  return countryOgImage({
    iso2: country.iso2,
    name: `${country.name} Visa Requirements`,
    subtitle: "Who can enter visa-free, on arrival & by eTA - 2026",
    stats: [
      { label: "Visa-free", value: vfCount },
      { label: "On arrival", value: voaCount },
      { label: "eTA / e-Visa", value: etaCount },
      { label: "Streamlined", value: total },
    ],
  });
}
