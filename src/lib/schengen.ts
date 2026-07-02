import { dataset } from "./dataset";
import { DEMONYM } from "./corridors";

// Schengen membership comes straight from the dataset groups (29 members),
// so the guide pages can never drift from the data the rest of the site uses.
export const SCHENGEN_MEMBERS: string[] = dataset.groups.SCHENGEN ?? [];
export const schengenSet = new Set(SCHENGEN_MEMBERS);

/**
 * Representative Schengen destination for visa-exemption checks. The EU
 * short-stay visa-exemption list is harmonised across all Schengen members
 * (Regulation 2018/1806), so one member's published policy answers the
 * "do I need a Schengen visa?" question for the whole area. We use France.
 */
export const SCHENGEN_REPRESENTATIVE = "FRA";

export type SchengenStatus = "member" | "exempt" | "visa_required";

/**
 * Data-derived Schengen status for a passport:
 * - "member": citizen of a Schengen state (freedom of movement, never a visa)
 * - "exempt": visa-free short stays per France's published visa policy
 * - "visa_required": needs a Schengen short-stay (Type C) visa
 */
export function schengenStatus(iso3: string): SchengenStatus {
  if (schengenSet.has(iso3)) return "member";
  const edge = (dataset.passportAccess[iso3] ?? []).find(
    (e) => e.dest === SCHENGEN_REPRESENTATIVE,
  );
  if (edge && (edge.level === "visa_free" || edge.level === "eta")) return "exempt";
  return "visa_required";
}

/** Exempt vs visa-required split across all 199 tracked passports. */
export function schengenCounts() {
  const exemptIso3: string[] = [];
  const requiredIso3: string[] = [];
  for (const c of dataset.allCountries) {
    if (schengenStatus(c.iso3) === "visa_required") requiredIso3.push(c.iso3);
    else exemptIso3.push(c.iso3);
  }
  return {
    exempt: exemptIso3.length,
    required: requiredIso3.length,
    exemptIso3,
    requiredIso3,
  };
}

/**
 * Plural demonym for title phrasing ("Schengen Visa for Indians"). Falls back
 * to "{Demonym} citizens" where the bare plural is awkward (British, French,
 * Dutch, Chinese, Vietnamese, Turkish).
 */
const PLURAL_DEMONYM: Record<string, string> = {
  IND: "Indians", PAK: "Pakistanis", BGD: "Bangladeshis", NPL: "Nepalis", LKA: "Sri Lankans",
  PHL: "Filipinos", IDN: "Indonesians", MYS: "Malaysians", THA: "Thais", NGA: "Nigerians",
  EGY: "Egyptians", KEN: "Kenyans", GHA: "Ghanaians", ZAF: "South Africans", MAR: "Moroccans",
  DZA: "Algerians", ETH: "Ethiopians", USA: "Americans", CAN: "Canadians", MEX: "Mexicans",
  BRA: "Brazilians", DEU: "Germans", ITA: "Italians", ESP: "Spaniards", RUS: "Russians",
  UKR: "Ukrainians", POL: "Poles", SAU: "Saudis", ARE: "Emiratis", QAT: "Qataris",
  IRN: "Iranians", JOR: "Jordanians", AUS: "Australians", KAZ: "Kazakhs",
};

export function pluralDemonym(iso3: string, countryName: string): string {
  return PLURAL_DEMONYM[iso3] ?? `${DEMONYM[iso3] ?? countryName} citizens`;
}
