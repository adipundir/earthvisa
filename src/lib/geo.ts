import { useEffect, useState } from "react";
import { dataset } from "./dataset";

const iso2ToIso3 = new Map(dataset.allCountries.map((c) => [c.iso2, c.iso3]));

/**
 * Detects the visitor's country from the edge geo header (via /api/geo) and
 * resolves it to a passport ISO-3 that exists in our dataset. Returns null until
 * resolved, on failure, or when the country is unknown / not one of the 199
 * passports. Fires once on mount.
 */
export function useDetectedPassport(): string | null {
  const [iso3, setIso3] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { country?: string | null } | null) => {
        if (cancelled || !d?.country) return;
        const resolved = iso2ToIso3.get(d.country);
        if (resolved && dataset.passportAccess[resolved]) setIso3(resolved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return iso3;
}
