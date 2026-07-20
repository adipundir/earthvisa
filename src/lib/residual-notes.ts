// Structured-first policy notes (owner directive 2026-07-20: "why are we
// showing too much text?"). Edge-level notes routinely restate facts that the
// page already renders as data - fee tiers, processing speeds, stay-duration
// menus all live in the fee section, stat strip and visa-type cards. A
// sentence that only re-enumerates those facts is redundant prose and is
// dropped from the policy note. Anything that scopes, suspends or conditions
// access is a caveat, not a fact dump, and ALWAYS survives - hiding a
// suspension is the worst error class on this site.

// Caveat language - checked first, always kept.
const PROTECTED =
  /suspend|not (?:currently )?(?:possible|available|issued|permitted|accepted)|no longer|except|exempt|\bonly\b|\bmust\b|requir|cannot|closed|prohibit|banned|invitation|register|pre-?approval|extension|overstay|penalt|denied|refus|restrict|condition|minimum|at least|valid for|upcoming|from \d|starting|effective|once operational|will (?:function|require|launch|apply|replace)|not yet|planned|citizens\b|nationals\b|passport holders/i;

// Currency-amount token: "XAF 100,000", "EUR 152", "Rs 2,900", "$185", "USD 45".
const AMOUNT = /(?:\b[A-Z]{3}|\bRs|\$|€|£|USD|EUR)\s?\d[\d,.]*/g;

const PROCESSING =
  /\b(?:normal|express|urgent|rush|standard)?\s?processing\b|issued within|\bwithin \d+ ?(?:hours|days)|\b\d+\s?(?:hours?|business days?|working days?)\b/i;

// "Short-stay visa up to 6 months (180 days)" - a per-type duration menu line.
const TYPE_MENU = /\b(?:short|long)[- ]stay\b.*\bvisa\b|\bvisa\b.*\bup to \d+\s?(?:days?|months?)\b/i;

// Historical/legal provenance trivia ("Launched ... per Decree No. ...").
const PROVENANCE = /\b(?:launched|introduced|established)\b.*\b(?:decree|law|order)\b|\bper decree\b|\bimplementing law\b/i;

/**
 * True when a sentence only restates facts the page already shows as data.
 * @param feesShown   the corridor renders an official fee section
 * @param typesShown  the corridor renders visa-type cards (stay/processing/fee)
 */
export function isRedundantFactSentence(t: string, feesShown: boolean, typesShown: boolean): boolean {
  if (PROTECTED.test(t)) return false;
  const amounts = (t.match(AMOUNT) ?? []).length;
  if (feesShown && amounts >= 2) return true; // a fee-schedule line
  if (feesShown && amounts >= 1 && (PROCESSING.test(t) || TYPE_MENU.test(t))) return true;
  if (typesShown && amounts === 0 && TYPE_MENU.test(t) && PROCESSING.test(t)) return true;
  if (typesShown && PROVENANCE.test(t)) return true;
  return false;
}

/** Filter a sentence list down to the genuinely residual caveats. */
export function residualSentences(sentences: string[], feesShown: boolean, typesShown: boolean): string[] {
  return sentences.filter((t) => !isRedundantFactSentence(t, feesShown, typesShown));
}
