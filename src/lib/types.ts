// Shared types for the immigration dataset produced by scripts/build-dataset.mjs.

export type AccessLevel = "visa_free" | "visa_on_arrival" | "eta" | "e_visa";

/** which passport type a rule applies to */
export type PassportType = "ordinary" | "diplomatic" | "service" | "official";

export interface AccessEdge {
  /** destination country iso3 */
  dest: string;
  level: AccessLevel;
  maxStayDays: number | null;
  sourceUrl: string;
  sourceOfficial: boolean;
  notes: string;
  /** passport types this access applies to; absent/empty = ordinary (and all) */
  passportTypes?: PassportType[];
}

/** a credential a traveller may hold (e.g. a valid US visa) that unlocks entry */
export interface Credential {
  id: string;
  label: string;
  short: string;
  /** UI grouping, e.g. "United States", "Schengen / EU", "India" */
  group: string;
}

/** entry unlocked by holding a credential; nationalityScope null = any nationality */
export interface CredentialEdge extends AccessEdge {
  nationalityScope: string[] | null;
  /** verbatim-ish conditions, e.g. "visa must have been used at least once" */
  conditions?: string;
  /** true when access is airside/landside transit only — NOT regular tourist entry */
  transit?: boolean;
}

export interface CbiOption {
  type: string; // donation | real_estate | bonds | business | fund | other
  min_amount: number | null;
  currency: string;
  notes: string;
}

export interface CbiProgram {
  iso3: string;
  name: string;
  region: string;
  program_name: string;
  official_url: string;
  source_official: boolean;
  options: CbiOption[];
  processing_time: string;
  dual_citizenship_allowed: boolean | null;
  residency_required: boolean | null;
  notes: string;
  verified: boolean;
}

export interface RbiProgram {
  iso3: string;
  name: string;
  region: string;
  program_name: string;
  type: string;
  min_amount: number | null;
  currency: string;
  path_to_pr_years: number | null;
  path_to_citizenship_years: number | null;
  official_url: string;
  source_official: boolean;
  notes: string;
}

export interface FastTrackProgram {
  iso3: string;
  name: string;
  region: string;
  program_name: string;
  category: string;
  eligibility: string;
  processing_time: string;
  official_url: string;
  source_official: boolean;
  notes: string;
}

export interface CountrySummary {
  iso2: string;
  iso3: string;
  name: string;
  region: string;
  agreements: string[];
  officialDomains: string[];
  hasCbi: boolean;
  rbiCount: number;
  fastTrackCount: number;
  /** counts of nationalities this country admits, by access level */
  visaPolicyCounts: Record<AccessLevel, number>;
  completeness: "high" | "medium" | "low" | "unknown";
  gaps: string[];
}

export interface VisaType {
  category: "tourist" | "business" | "student" | "work" | "transit" | "medical" | "retirement" | "working_holiday" | "digital_nomad" | "family" | "investment";
  name: string;
  purpose: string;
  max_stay_days: number | null;
  validity_days: number | null;
  entries: "single" | "double" | "multiple";
  fee_usd: number | null;
  processing_days_min: number | null;
  processing_days_max: number | null;
  online: boolean;
  on_arrival: boolean;
  official_url: string;
  notes: string | null;
}

export interface Dataset {
  meta: {
    note: string;
    totalCountries: number;
    countriesWithData: number;
    destinationsWithVisaPolicy: number;
    unresolvedNationalityLabels: string[];
  };
  groups: Record<string, string[]>; // group key -> iso3[]
  groupLabels: Record<string, string>;
  allCountries: { iso2: string; iso3: string; name: string; region: string }[];
  countries: CountrySummary[];
  /** origin passport iso3 -> reachable destinations (best access level kept) */
  passportAccess: Record<string, AccessEdge[]>;
  /** credentials that unlock entry independent of nationality */
  credentials: Credential[];
  /** credential id -> destinations it unlocks (per-nationality scope retained) */
  credentialAccess: Record<string, CredentialEdge[]>;
  /** origin passport iso3 -> destinations waived for that nationality's diplomatic/service passport */
  diplomaticAccess: Record<string, AccessEdge[]>;
  /** destinations that waive ANY nationality's diplomatic/service/official passport */
  diplomaticAny: AccessEdge[];
  cbi: CbiProgram[];
  rbi: RbiProgram[];
  fastTrack: FastTrackProgram[];
  destinationVisaTypes: Record<string, VisaType[]>;
}
