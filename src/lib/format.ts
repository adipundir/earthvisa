// Shared display formatting helpers for site chrome.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO date (2026-07-03) in the site's stamp voice: "3 Jul 2026". */
export function fmtDate(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso || "";
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** ISO-3166 alpha-2 -> flag emoji. Pure - safe for client components (unlike
 * @/lib/dataset, which eagerly evaluates the full ~18MB dataset on import). */
export function isoToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "\u{1F3F3}\u{FE0F}";
  const A = 0x1f1e6;
  const cc = iso2.toUpperCase();
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

/** country name -> URL slug (must match the route generators in app/) */
export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
