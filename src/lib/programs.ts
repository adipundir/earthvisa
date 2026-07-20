// Shared helpers for the /programs/* guide pages.
// Everything here is derived strictly from the dataset - no invented figures.
import { dataset } from "./dataset";
import type { CbiProgram, FastTrackProgram, RbiProgram } from "./types";

/** "what the passport you'd get is worth": visa-free count + global rank by total reach */
export interface PassportWorth {
  iso3: string;
  /** destinations with full visa-free entry */
  visaFree: number;
  /** total destinations reachable without a pre-arranged embassy visa */
  total: number;
  /** canonical passport-index score: visa-free + visa on arrival + eTA (e-visa excluded) */
  score: number;
  /** rank among all ranked passports, by canonical score - identical to /rankings and /passport */
  rank: number;
}

// Rank MUST match rankings/page.tsx buildRows, passport/[slug] rankOf, and
// build-explorer-slices.mjs: same collection (Object.entries(dataset.passportAccess)),
// same score (visa-free + VoA + eTA, e-visa NEVER counted - an e-visa is still a visa
// application), same stable descending sort. Ranking by edges.length instead silently
// let e-visa reach reorder 183/199 passports vs the canonical index.
const ranked = Object.entries(dataset.passportAccess)
  .map(([iso3, edges]) => {
    const counts = { visa_free: 0, visa_on_arrival: 0, eta: 0, e_visa: 0 };
    for (const e of edges) counts[e.level]++;
    return {
      iso3,
      total: edges.length,
      visaFree: counts.visa_free,
      score: counts.visa_free + counts.visa_on_arrival + counts.eta,
    };
  })
  .sort((a, b) => b.score - a.score);

export const TOTAL_RANKED_PASSPORTS = ranked.length;

const worthByIso3 = new Map<string, PassportWorth>(
  ranked.map((r, i) => [r.iso3, { iso3: r.iso3, visaFree: r.visaFree, total: r.total, score: r.score, rank: i + 1 }]),
);

export function passportWorth(iso3: string): PassportWorth | null {
  return worthByIso3.get(iso3) ?? null;
}

/** lowest USD-denominated published minimum across a CBI program's options (null when none) */
export function cbiMinUsd(p: CbiProgram): number | null {
  const usd = p.options
    .filter((o) => o.currency === "USD" && o.min_amount != null)
    .map((o) => o.min_amount as number);
  return usd.length ? Math.min(...usd) : null;
}

/** the USD option that carries the program's lowest published minimum */
export function cheapestUsdOption(p: CbiProgram) {
  return (
    p.options
      .filter((o) => o.currency === "USD" && o.min_amount != null)
      .sort((a, b) => (a.min_amount as number) - (b.min_amount as number))[0] ?? null
  );
}

/** true when the dataset itself marks a residency program as closed or abolished */
export function isClosedProgram(p: { program_name: string; notes?: string }): boolean {
  return /\b(closed|abolished)\b/i.test(p.program_name) || /CLOSED to new applications/.test(p.notes ?? "");
}

/** true when the program's source notes say it is announced but not yet formally enacted */
export function isAnnouncedOnly(p: { notes?: string }): boolean {
  return /no official [a-z0-9.]+ source confirms|not been formally gazetted|has not been signed into law/i.test(
    p.notes ?? "",
  );
}

// --- golden-visa style residency: investment-linked routes only ---
// Keep routes whose type is investment-flavoured, and drop routes that are really
// employment / family / retirement / nomad permits even if a keyword overlaps.
const INVEST_TYPE =
  /invest|real_estate|golden|passive|bond|fund|donation|deposit|economic|solvency|financially_independent|self_funded|capital|wealth|business/i;
const NON_INVEST_TYPE =
  /nomad|remote|freelanc|skilled|employment|family|ancestry|retire|pension|working_holiday|youth|talent|study|regional|work\/|\/work|residence_to_pr|general|social|long_stay|long-stay|self_?employ/i;
// Business-flavoured types mix true investor routes with plain self-employment / start-up /
// entrepreneur work permits. Only the investor routes belong on a golden-visa page, so drop
// business-type rows whose own program name says work permit - unless the name itself says
// golden or investor/investment.
const BUSINESS_TYPE = /business|entrepreneur|start_?up/i;
const WORK_PERMIT_NAME = /self.?employ|sole proprietor|professional card|start.?up|entrepreneur/i;
const INVESTOR_NAME = /golden|invest/i;

export function goldenVisaPrograms(): RbiProgram[] {
  return dataset.rbi.filter((r) => {
    if (!INVEST_TYPE.test(r.type) || NON_INVEST_TYPE.test(r.type)) return false;
    if (BUSINESS_TYPE.test(r.type) && WORK_PERMIT_NAME.test(r.program_name) && !INVESTOR_NAME.test(r.program_name)) {
      return false;
    }
    return true;
  });
}

// --- digital nomad / remote-work routes ---
const NOMAD_RE = /nomad|remote|freelanc/i;

export function nomadFastTrack(): FastTrackProgram[] {
  return dataset.fastTrack.filter((f) => NOMAD_RE.test(f.category) || NOMAD_RE.test(f.program_name));
}

/** rbi remote-work residence routes for countries without a fastTrack nomad entry */
export function nomadRbiExtras(): RbiProgram[] {
  const covered = new Set(nomadFastTrack().map((f) => f.iso3));
  return dataset.rbi.filter(
    (r) => (NOMAD_RE.test(r.type) || NOMAD_RE.test(r.program_name)) && !covered.has(r.iso3),
  );
}

/** status a program's own dataset text assigns to itself */
export function programStatus(text: string): "closed" | "announced" | "open" {
  if (/discontinued|closed to new applications/i.test(text)) return "closed";
  if (/not yet (officially )?(launched|implemented|specified)|announced, not yet/i.test(text)) return "announced";
  return "open";
}

export const REGION_ORDER = ["Europe", "Asia", "Americas", "Africa", "Oceania"];

/** human label for machine type/category strings, e.g. "real_estate" -> "real estate" */
export function typeLabel(t: string): string {
  return t.replace(/[_-]+/g, " ").replace(/\s*\/\s*/g, " / ").trim();
}
