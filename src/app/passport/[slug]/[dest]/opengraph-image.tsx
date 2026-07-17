import { dataset } from "@/lib/dataset";
import { compute } from "@/lib/compute";
import { countryOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { nameToSlug, DEMONYM } from "@/lib/corridors";
import { SHORT_NAME } from "@/lib/colloquial";

export const alt = "Earth Visa corridor visa-requirement card";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const bySlug = new Map(dataset.allCountries.map((c) => [nameToSlug(c.name), c]));

// Mirrors resolve()/statusPhrase() in page.tsx at a level this share-card
// needs - kept local (not imported) so this route segment doesn't depend on
// non-exported page internals.
function statusFor(natIso3: string, destIso3: string): { label: string; maxStayDays: number | null } {
  if (natIso3 === destIso3) return { label: "Home Country", maxStayDays: null };
  const r = compute([natIso3], [], {});
  const fom = r.freedomOfMovement.find((e) => e.dest === destIso3);
  if (fom) return { label: "No Visa Needed", maxStayDays: null };
  const edge = r.reach.find((e) => e.dest === destIso3);
  if (edge) {
    const labels: Record<string, string> = {
      visa_free: "Visa-Free Entry",
      visa_on_arrival: "Visa on Arrival",
      eta: "eTA Required",
      e_visa: "e-Visa Guide",
    };
    return { label: labels[edge.level] ?? "Visa on Arrival", maxStayDays: edge.maxStayDays };
  }
  return { label: "Visa Required", maxStayDays: null };
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; dest: string }>;
}) {
  const { slug, dest } = await params;
  const nat = bySlug.get(slug) ?? null;
  const d = bySlug.get(dest) ?? null;

  if (!nat || !d) {
    return countryOgImage({
      iso2: "",
      name: "Earth Visa",
      subtitle: `Visa requirements for ${dataset.allCountries.length} passports`,
      stats: [],
    });
  }

  const nd = DEMONYM[nat.iso3] ?? nat.name;
  const short = SHORT_NAME[d.iso3] ?? d.name;
  const { label, maxStayDays } = statusFor(nat.iso3, d.iso3);

  return countryOgImage({
    iso2: d.iso2,
    name: `${short} Visa for ${nd} Citizens`,
    subtitle: `${label} - 2026`,
    stats: [
      { label: "Status", value: label },
      { label: "Max stay", value: maxStayDays ? `${maxStayDays} days` : "Varies" },
    ],
  });
}
