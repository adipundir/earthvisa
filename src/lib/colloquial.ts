// Colloquial search phrasing: what people actually type vs the official country
// name. "Dubai visa" massively outsearches "UAE visa"; "Bali visa" outsearches
// "Indonesia visa". Titles/H1s win the query token, but the page body must
// always resolve to and cite the OFFICIAL jurisdiction's rules - a colloquial
// alias never changes visa policy content, only how it is phrased.

/** Short display forms for long official names, used in titles. */
export const SHORT_NAME: Record<string, string> = {
  GBR: "UK",
  ARE: "UAE",
  USA: "USA",
};

export interface ColloquialAlias {
  /** the place people search for, e.g. "Dubai" */
  alias: string;
  /** ISO3 of the country whose visa policy actually applies */
  iso3: string;
  /** URL slug for the alias destination page */
  slug: string;
  /** one-line accuracy note rendered on alias-phrased pages */
  note: string;
}

/** Popular sub-national places whose visa queries dwarf the official country name. */
export const ALIASES: ColloquialAlias[] = [
  {
    alias: "Dubai",
    iso3: "ARE",
    slug: "dubai",
    note: "Dubai is one of the seven emirates of the United Arab Emirates. All emirates - Dubai, Abu Dhabi, Sharjah and the rest - share a single federal UAE visa policy, so the rules below apply to Dubai.",
  },
  {
    alias: "Abu Dhabi",
    iso3: "ARE",
    slug: "abu-dhabi",
    note: "Abu Dhabi is the capital of the United Arab Emirates. All emirates share a single federal UAE visa policy, so the rules below apply to Abu Dhabi.",
  },
  {
    alias: "Bali",
    iso3: "IDN",
    slug: "bali",
    note: "Bali is an Indonesian province. It follows Indonesia's national visa policy - the same rules apply in Bali, Jakarta, Lombok and the rest of Indonesia.",
  },
  {
    alias: "Zanzibar",
    iso3: "TZA",
    slug: "zanzibar",
    note: "Zanzibar is a semi-autonomous region of Tanzania and follows Tanzania's national visa policy. Note: Zanzibar additionally requires mandatory local travel insurance for visitors.",
  },
  {
    alias: "Phuket",
    iso3: "THA",
    slug: "phuket",
    note: "Phuket is a Thai province. It follows Thailand's national visa policy - the same rules apply in Phuket, Bangkok, Pattaya and the rest of Thailand.",
  },
];

export const aliasBySlug = new Map(ALIASES.map((a) => [a.slug, a]));

/** Colloquial lead token per destination for corridor page titles (ARE → "Dubai"). */
export const CORRIDOR_TITLE_ALIAS: Record<string, string> = {
  ARE: "Dubai",
  IDN: "Bali",
};

/** Nationalities for which Saudi corridors should surface Umrah phrasing. */
export const UMRAH_NATIONALITIES = new Set(["IND", "PAK", "BGD", "IDN", "EGY", "NGA", "MYS", "TUR"]);
