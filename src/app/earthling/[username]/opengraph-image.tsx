import { dataset } from "@/lib/dataset";
import { earthlingRank, getEarthling } from "@/lib/earthling/store";
import { countryOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Earthling reach card";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The share card: username + the number. Shows the primary passport flag
// (user-initiated sharing) but never the credential list.
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const e = await getEarthling(username);

  if (!e) {
    return countryOgImage({
      iso2: "",
      name: "Earth Visa",
      subtitle: "How far can you go? Claim your Earthling ID",
      stats: [],
    });
  }

  const primary = dataset.allCountries.find((c) => c.iso3 === e.passports[0]);
  const rank = await earthlingRank(e.seq);
  return countryOgImage({
    iso2: primary?.iso2 ?? "",
    name: `@${e.username}`,
    subtitle: `reaches ${e.reach} destinations without an embassy visa`,
    stats: [
      { label: "Destinations", value: e.reach },
      { label: "Beats", value: `${e.percentile}% of passports` },
      { label: "Earthling", value: `#${rank}` },
    ],
  });
}
