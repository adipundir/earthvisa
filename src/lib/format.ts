// Shared display formatting helpers for site chrome.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO date (2026-07-03) in the site's stamp voice: "3 Jul 2026". */
export function fmtDate(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso || "";
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}
