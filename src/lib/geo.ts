import { useEffect, useState } from "react";
import { loadCore, type ExplorerCore } from "./explorer-data";

/**
 * Detects the visitor's country from the edge geo header (via /api/geo) and
 * resolves it to a passport ISO-3 that exists in our dataset. Returns null until
 * resolved, on failure, or when the country is unknown / not one of the 199
 * passports. Fires once on mount. Country resolution uses the explorer core
 * slice (not @/lib/dataset) so this hook stays safe for client bundles.
 */
export function useDetectedPassport(): string | null {
  const [iso3, setIso3] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/geo").then((r) => (r.ok ? r.json() : null)),
      loadCore(),
    ])
      .then(([d, core]: [{ country?: string | null } | null, ExplorerCore]) => {
        if (cancelled || !d?.country) return;
        const resolved = core.allCountries.find((c) => c.iso2 === d.country)?.iso3;
        if (resolved && core.passportsWithPolicy.includes(resolved)) setIso3(resolved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return iso3;
}
