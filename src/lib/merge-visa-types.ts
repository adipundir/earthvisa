/**
 * Join a destination's visa-type catalogue with the VFS document checklists for
 * one corridor, so a corridor page renders ONE list instead of two parallel ones.
 *
 * The two sources describe the same real-world visas along different axes and
 * neither is a superset of the other:
 *
 *   catalogue (data/countries/<DEST>.json -> visa_types)
 *     per DESTINATION, same for every nationality.
 *     carries the facts: stay, validity, entries, fee, processing, official URL.
 *
 *   VFS (data/vfs/<nat>-<dest>.json -> visa_types)
 *     per CORRIDOR, specific to this nationality.
 *     carries the paperwork: document checklist, PDF forms.
 *
 * Rendering them as two lists of visa-type names reads as duplication even when
 * the entries differ, so they are joined here on name, then on category.
 *
 * Matching is deliberately conservative: a wrong join would show one visa's
 * documents under another visa's name, which is worse than showing two entries.
 * Anything not confidently matched stays as its own entry.
 */

export interface CatalogVisaType {
  category: string;
  name: string;
  purpose?: string | null;
  max_stay_days?: number | null;
  validity_days?: number | null;
  entries?: string | null;
  fee_usd?: number | null;
  processing_days_min?: number | null;
  processing_days_max?: number | null;
  online?: boolean | null;
  on_arrival?: boolean | null;
  official_url?: string | null;
  notes?: string | null;
}

export interface VfsVisaType {
  name: string;
  category: string;
  documents_required: string;
}

export interface MergedVisaType {
  /** Stable key for React and for #anchors. */
  key: string;
  /** Catalogue name wins when both exist: it is the government's own wording. */
  name: string;
  category: string;
  facts: CatalogVisaType | null;
  docs: VfsVisaType | null;
  /** Which sources contributed - lets the UI explain what it does and doesn't have. */
  origin: "both" | "catalog" | "vfs";
  /**
   * True when the checklist was matched on category rather than a recognisable
   * name ("Short-Term Business Visa" taking the checklist filed as "Non Profit
   * Business Affairs, Cultural and Sports Exchange"). The join is still the best
   * available, but the UI must show the checklist's own title so the reader can
   * see which document set they are actually looking at.
   */
  docsNameDiffers: boolean;
}

/** Words that carry no distinguishing signal between visa-type names. */
const STOP = new Set([
  "visa", "visas", "for", "the", "of", "and", "or", "a", "an", "to", "in",
  "with", "stay", "type", "entry", "permit", "application",
]);

function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

function normalized(name: string): string {
  return [...tokens(name)].sort().join(" ");
}

/** Jaccard overlap of the distinguishing tokens of two names. */
function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / (A.size + B.size - shared);
}

// Tuned against real corridors: "Temporary Visitor Visa For Tourism
// (Sightseeing or Transit)" vs "Temporary Visitor Visa (Tourist)" must join,
// while "Medical Stay Visa" vs "Business Manager Visa" must not.
const NAME_MATCH = 0.5;

export function mergeVisaTypes(
  catalog: CatalogVisaType[],
  vfs: VfsVisaType[],
): MergedVisaType[] {
  const usedVfs = new Set<number>();
  const merged: MergedVisaType[] = [];

  const claim = (c: CatalogVisaType, i: number | null) => {
    if (i !== null) usedVfs.add(i);
    merged.push({
      key: `${c.category}:${normalized(c.name) || c.name}`,
      name: c.name,
      category: c.category,
      facts: c,
      docs: i !== null ? vfs[i] : null,
      origin: i !== null ? "both" : "catalog",
      docsNameDiffers: i !== null && similarity(vfs[i].name, c.name) < NAME_MATCH,
    });
  };

  // Pass 1 - identical names after normalisation. Highest confidence.
  const pending: CatalogVisaType[] = [];
  for (const c of catalog) {
    const i = vfs.findIndex(
      (v, idx) => !usedVfs.has(idx) && normalized(v.name) === normalized(c.name),
    );
    if (i >= 0) claim(c, i);
    else pending.push(c);
  }

  // Pass 2 - best token overlap above threshold, within the same category. Each
  // catalogue entry takes its single best candidate, so two similar names cannot
  // both claim the same checklist.
  const stillPending: CatalogVisaType[] = [];
  for (const c of pending) {
    let best = -1;
    let bestScore = NAME_MATCH;
    vfs.forEach((v, idx) => {
      if (usedVfs.has(idx) || v.category !== c.category) return;
      const score = similarity(v.name, c.name);
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    });
    if (best >= 0) claim(c, best);
    else stillPending.push(c);
  }

  // Pass 3 - category fallback, ONLY where it is unambiguous on both sides: one
  // unmatched catalogue entry and one unmatched checklist sharing a category.
  // With 4 family visas and 1 family checklist we cannot tell which it belongs
  // to, so nothing is joined and both are listed separately.
  for (const c of stillPending) {
    const cSame = stillPending.filter((x) => x.category === c.category);
    const vSame = vfs
      .map((v, idx) => ({ v, idx }))
      .filter(({ v, idx }) => !usedVfs.has(idx) && v.category === c.category);
    if (cSame.length === 1 && vSame.length === 1) claim(c, vSame[0].idx);
    else claim(c, null);
  }

  // Checklists with no catalogue counterpart still carry real paperwork for this
  // corridor, so they are listed on their own rather than dropped.
  vfs.forEach((v, idx) => {
    if (usedVfs.has(idx)) return;
    merged.push({
      key: `${v.category}:${normalized(v.name) || v.name}`,
      name: v.name,
      category: v.category,
      facts: null,
      docs: v,
      origin: "vfs",
      docsNameDiffers: false,
    });
  });

  // Traveller-facing categories first, then by how much we can actually tell the
  // reader: an entry with both facts and documents outranks one with neither.
  const CATEGORY_RANK = ["tourist", "business", "transit", "medical", "family", "student", "work"];
  const rank = (c: string) => {
    const i = CATEGORY_RANK.indexOf(c);
    return i < 0 ? CATEGORY_RANK.length : i;
  };
  const depth = (m: MergedVisaType) => (m.docs ? 2 : 0) + (m.facts ? 1 : 0);
  return merged.sort(
    (a, b) => rank(a.category) - rank(b.category) || depth(b) - depth(a) || a.name.localeCompare(b.name),
  );
}
