import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { compute, LEVEL_LABEL } from "@/lib/compute";
import type { AccessLevel, VisaType } from "@/lib/types";
import { TOP_NATIONALITIES, TOP_DESTINATIONS, preWarmCorridorPairs, isUsefulCorridor, nameToSlug, DEMONYM } from "@/lib/corridors";
import { SHORT_NAME, CORRIDOR_TITLE_ALIAS, ALIASES, UMRAH_NATIONALITIES } from "@/lib/colloquial";
import { feesFor, relevantFees, variationFor, fmtFee } from "@/lib/fees";
import { applicationNoteFor } from "@/lib/applicationNotes";

const byIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c]));
const bySlug = new Map(dataset.allCountries.map((c) => [nameToSlug(c.name), c]));
const slugToCountry = (slug: string) => bySlug.get(slug) ?? null;

// Only the curated, genuinely-useful corridors exist; anything else 404s rather
// than rendering a thin "visa required" page (isUsefulCorridor() enforces this
// below, since dynamicParams=true no longer gates it for us at the framework
// level - see preWarmCorridorPairs()).
export const dynamicParams = true;

export function generateStaticParams() {
  return preWarmCorridorPairs().map((c) => ({ slug: c.natSlug, dest: c.destSlug }));
}

// ── Access resolution ─────────────────────────────────────────────────────────
type Status =
  | { kind: "fom"; groups: string[] }
  | { kind: AccessLevel; maxStayDays: number | null; notes: string; sourceUrl: string; sourceOfficial: boolean; via?: string | null }
  | { kind: "own" }
  | { kind: "visa_required"; notes?: string; sourceUrl?: string; sourceOfficial?: boolean };

function resolve(natIso3: string, destIso3: string): Status {
  if (natIso3 === destIso3) return { kind: "own" };
  const r = compute([natIso3], [], {});
  const fom = r.freedomOfMovement.find((e) => e.dest === destIso3);
  if (fom) return { kind: "fom", groups: fom.groups };
  const edge = r.reach.find((e) => e.dest === destIso3);
  if (edge) {
    return {
      kind: edge.level,
      maxStayDays: edge.maxStayDays,
      notes: edge.notes ?? "",
      sourceUrl: edge.sourceUrl ?? "",
      sourceOfficial: !!edge.sourceOfficial,
      via: edge.viaIso3 ? nameFor(edge.viaIso3) : null,
    };
  }
  // No positive access edge - genuinely visa-required. If this nationality's
  // process/fee/current status has been specifically researched (embassy-only
  // destinations otherwise show nothing but generic boilerplate), surface it.
  const advance = (dataset.advanceVisaNotes?.[destIso3] ?? []).find((n) => n.nationalitiesIso3.includes(natIso3));
  if (advance) {
    return { kind: "visa_required", notes: advance.notes, sourceUrl: advance.sourceUrl, sourceOfficial: advance.sourceOfficial };
  }
  return { kind: "visa_required" };
}

// SERP-facing status phrase: answers the query in the title itself (better CTR)
// and matches how people search ("thailand visa for indians free / on arrival").
function statusPhrase(s: Status): string {
  switch (s.kind) {
    case "visa_free": return "Visa-Free Entry";
    case "visa_on_arrival": return "Visa on Arrival";
    case "eta": return "eTA Required";
    case "e_visa": return "e-Visa Guide";
    case "fom": return "No Visa Needed";
    case "own": return "Home Country";
    default: return "Requirements & Cost";
  }
}

// Title for a corridor page, using the colloquial token people actually search
// (Dubai > UAE, Bali > Indonesia, UK > United Kingdom) while the page content
// stays official-jurisdiction accurate.
function corridorTitle(nIso3: string, dIso3: string, dName: string, nd: string, s: Status): string {
  const aliasLead = CORRIDOR_TITLE_ALIAS[dIso3];
  const short = SHORT_NAME[dIso3] ?? dName;
  if (aliasLead) return `${aliasLead} Visa for ${nd} Citizens 2026 - ${short} ${statusPhrase(s)}`;
  if (dIso3 === "SAU" && UMRAH_NATIONALITIES.has(nIso3)) return `Saudi Arabia Visa for ${nd} Citizens 2026 - Tourist & Umrah`;
  return `${short} Visa for ${nd} Citizens 2026: ${statusPhrase(s)}`;
}

// "a" vs "an": vowel-letter demonyms with a consonant sound ("yoo-") take "a".
const A_DESPITE_VOWEL = new Set(["Ukrainian", "European", "Ugandan", "Uruguayan", "US"]);
const article = (word: string) => (/^[aeiou]/i.test(word) && !A_DESPITE_VOWEL.has(word) ? "an" : "a");

// Freshness stamps read "2 Jul 2026" (same format as the navbar), not raw ISO.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

// VFS checklist bodies embed an insurance upsell ("Get the peace of mind you
// need on your travels, with insurance made simple…") that is marketing, not a
// document requirement. Strip it at render time - genuine insurance
// requirements ("Travel insurance is mandatory for all Schengen countries…")
// stay untouched, and the underlying data files are never mutated.
function stripVfsBoilerplate(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/peace of mind you need on your travels/i.test(line)) {
      // two-line variant: a bare "click here (…)" continuation follows
      if (!/click here/i.test(line) && /^\s*click here/i.test(lines[i + 1] ?? "")) i++;
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// VFS checklists occasionally embed advisories aimed at OTHER nationalities
// ("Nepal passport holders should provide NOC…" inside the India→Thailand
// file) plus meta-instructions about the checklist form itself ("the
// application form will not be accepted without the relevant check list").
// Both are noise on a corridor page: the former is wrong-audience, the latter
// is restated once, cleanly, under the PDF checklist links.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function cleanChecklistLines(text: string, keepNames: string[], foreignNames: string[]): string {
  const keep = keepNames.map((s) => s.toLowerCase());
  const foreign = foreignNames.map((name) => new RegExp(`\\b${esc(name.toLowerCase())}\\b`));
  return text
    .split("\n")
    .filter((raw) => {
      const line = raw.trim();
      if (/^important notes?:?$/i.test(line)) return false;
      if (/^documents? required:?$/i.test(line)) return false;
      if (/^(?:notes?|document check ?list)\s*:?$/i.test(line)) return false;
      // References to VFS's own site furniture ("go to the link 'VISA TYPES
      // column'") point at UI that does not exist here - dead weight without a URL.
      if (/visa types column|go to the link/i.test(line) && !/https?:\/\//i.test(line)) return false;
      if (/mandatory documents.*mentioned in the checklist/i.test(line)) return false;
      if (/checklist needs to be filled for each application/i.test(line)) return false;
      if (/application form will not be accepted without the relevant check ?list/i.test(line)) return false;
      // "click here" references whose hyperlink didn't survive the crawl point nowhere.
      if (/click here/i.test(line) && !/https?:\/\//i.test(line)) return false;
      if (/passport holders?/i.test(line)) {
        const l = line.toLowerCase();
        // Only drop when a foreign country name DIRECTLY modifies the audience
        // phrase ("Nepal passport holders", "Pakistan passport holders") - a
        // name merely appearing elsewhere in the line must not trigger the
        // drop (real case: "...(EEA: Norway, Iceland...) ... passport holders
        // of these countries are exempt" is FOR this page's reader).
        const prefix = (i: number) => l.slice(Math.max(0, i - 40), i);
        const idx = l.search(/passport holders?/);
        if (!keep.some((k) => l.includes(k)) && foreign.some((rx) => rx.test(prefix(idx)))) return false;
      }
      return true;
    })
    // Dead anchor text: a trailing bare "Link" with no URL on the line is the
    // residue of a hyperlink the crawl flattened - drop the token, keep the sentence.
    .map((raw) => (!/https?:\/\//i.test(raw) && /\bLink\b[\s.]*$/.test(raw.trim())
      ? raw.replace(/\s*[:,-]?\s*\bLink\b[\s.]*$/, ".")
      : raw))
    .filter((raw) => raw.trim() !== "." && raw.trim() !== "")
    .join("\n");
}

// Checklist bodies arrive as undifferentiated text. Classify each line so the
// UI can render real structure instead of a wall of prose: PDF checklist
// links ("Tourist - Single (https://…/x.pdf)"), "- " requirement bullets, and
// anything else as a plain note paragraph.
function parseDocBlocks(text: string): { pdfs: { label: string; url: string }[]; bullets: string[]; notes: string[] } {
  const pdfs: { label: string; url: string }[] = [];
  const bullets: string[] = [];
  const notes: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const pdf = /^(.{2,120}?)\s*\(\s*(https?:\/\/\S+?\.pdf[^\s)]*)\s*\)[\s.]*$/i.exec(line);
    if (pdf) {
      let label = pdf[1].replace(/[- -  - :\s]+$/, "").trim();
      // Some crawled lines are "url (url)" duplicates - a raw URL is useless
      // as a pill label, so fall back to the PDF's decoded filename.
      if (/https?:\/\//i.test(label)) {
        try {
          const fname = decodeURIComponent(new URL(pdf[2]).pathname.split("/").pop() ?? "");
          label = fname.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim() || "Checklist";
        } catch { label = "Checklist"; }
      }
      pdfs.push({ label, url: pdf[2] });
      continue;
    }
    if (/^[-•*]\s+/.test(line)) { bullets.push(line.replace(/^[-•*]\s+/, "")); continue; }
    notes.push(line);
  }
  return { pdfs, bullets, notes };
}

function DocBlocks({ text }: { text: string }) {
  const { pdfs, bullets, notes } = parseDocBlocks(text);
  return (
    <div className="space-y-3">
      {pdfs.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-2">
            {pdfs.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="mono inline-flex min-h-[32px] items-center gap-1.5 rounded-[2px] border border-line-strong bg-card px-2.5 py-1 text-[11px] text-ink-soft transition hover:border-stamp hover:text-stamp"
              >
                <svg viewBox="0 0 12 14" aria-hidden="true" className="h-3 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 1h5l3 3v9H2z" strokeLinejoin="round" /><path d="M7 1v3h3" strokeLinejoin="round" /></svg>
                {p.label}
                <span className="text-ink-mute">PDF ↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="measure space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="text-body flex gap-2.5 text-ink-soft">
              <span aria-hidden="true" className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-mute/70" />
              <span className="min-w-0 break-words">{linkifyDocs(b)}</span>
            </li>
          ))}
        </ul>
      )}
      {notes.map((t, i) => (
        <p key={i} className="text-body measure break-words text-ink-soft">{linkifyDocs(t)}</p>
      ))}
    </div>
  );
}

// Requirement lines (each "- ..." bullet) repeated across most visa types in a
// corridor (photo spec, passport-copy clause, etc.) are boilerplate, not
// per-type content - hoist them into one shared block instead of repeating the
// same ~100-word paragraph inside every accordion. Matching uses a normalized
// key (case/whitespace/punctuation/parentheticals collapsed) so trivial
// wording variants still count as one line, and the bar is a >=60% majority
// rather than all entries - one divergent checklist (a jurisdiction variant,
// say) previously defeated the hoist on every heavy corridor. Lines carrying a
// URL (per-type PDF checklists) and short heading-ish fragments never hoist.
const VFS_COMMON_SHARE = 0.6;
const normLine = (s: string) =>
  s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const hoistable = (line: string) => !/https?:\/\//i.test(line) && normLine(line).split(" ").length >= 4;
function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
function extractCommonLines<T extends { documents_required: string }>(entries: T[]): { common: string[]; perEntry: string[][] } {
  const lineSets = entries.map((e) => splitLines(e.documents_required));
  if (entries.length < 2) return { common: [], perEntry: lineSets };
  const counts = new Map<string, number>();
  for (const lines of lineSets) for (const k of new Set(lines.filter(hoistable).map(normLine))) counts.set(k, (counts.get(k) ?? 0) + 1);
  const minCount = Math.max(2, Math.ceil(entries.length * VFS_COMMON_SHARE));
  const commonKeys = new Set([...counts].filter(([, c]) => c >= minCount).map(([k]) => k));
  // The first occurrence (original wording intact) is what displays.
  const common: string[] = [];
  const seen = new Set<string>();
  for (const lines of lineSets) {
    for (const l of lines) {
      if (!hoistable(l)) continue;
      const k = normLine(l);
      if (commonKeys.has(k) && !seen.has(k)) { seen.add(k); common.push(l); }
    }
  }
  return { common, perEntry: lineSets.map((lines) => lines.filter((l) => !(hoistable(l) && commonKeys.has(normLine(l))))) };
}

// Crawl residue: a one-line body that merely echoes the entry's own name or
// category ("Employment IB" under "Category IB (Working With Company Under
// Boi)") carries zero requirement content. VFS labels work visas "Employment",
// hence the synonym.
const CATEGORY_SYNONYM: Record<string, string> = { work: "employment" };
function isLabelEcho(v: { name: string; category: string; documents_required: string }): boolean {
  const lines = splitLines(v.documents_required);
  if (lines.length !== 1 || /https?:\/\//i.test(lines[0])) return false;
  const words = normLine(lines[0]).split(" ");
  if (words.length === 0 || words.length > 5) return false;
  const label = ` ${normLine(`${v.name} ${v.category} ${CATEGORY_SYNONYM[v.category] ?? ""}`)} `;
  return words.every((w) => label.includes(` ${w} `));
}

// Visa-type notes arrive as flowing prose - split into sentences so 3+
// discrete facts render as scannable bullets. Splitting guards abbreviations
// ("approx.", "e.g.") and unbalanced parentheses so prose is never cut
// mid-thought.
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const chunk of text.split(/(?<=[.!?])\s+/)) {
    buf = buf ? `${buf} ${chunk}` : chunk;
    depth += (chunk.match(/\(/g)?.length ?? 0) - (chunk.match(/\)/g)?.length ?? 0);
    if (depth > 0 || /(?:\b[A-Z]|\b(?:approx|etc|e\.g|i\.e|vs|incl|excl|min|max|no|sec|st))\.$/i.test(chunk)) continue;
    parts.push(buf);
    buf = "";
    depth = 0;
  }
  if (buf) parts.push(buf);
  return parts;
}
// Bare URLs in checklist text (100+ character asset links) become real anchors
// with a short label - otherwise they are unclickable and, being unbreakable
// strings, force horizontal overflow on mobile.
const URL_RE = /https?:\/\/[^\s)\]>]+/g;
function linkifyDocs(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:]+$/, "");
    if (m.index > last) nodes.push(text.slice(last, m.index));
    let label = "official link";
    try { label = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
    nodes.push(
      <a key={key++} href={url} target="_blank" rel="noreferrer" className="text-stamp underline underline-offset-2 transition hover:text-ink">
        {/\.pdf(\?|#|$)/i.test(url) ? "PDF checklist" : label} ↗
      </a>,
    );
    last = m.index + url.length;
  }
  nodes.push(text.slice(last));
  return nodes;
}

// Advisory / citation URLs (travel.state.gov country pages, travel.gc.ca
// destination advisories, MOFA's visa-EXEMPTION list) document a policy - they
// are not application portals, and must never render behind an "Apply" action.
const ADVISORY_URL_RE = /travel\.state\.gov|travel\.gc\.ca|smartraveller\.gov\.au|advisor|\bnovisa\b|exemption/i;
const isAdvisoryUrl = (url: string | null | undefined): url is string => !!url && ADVISORY_URL_RE.test(url);

// An advance note stating that travel/visa issuance is banned or suspended for
// this nationality (US→North Korea passport-validity ban, Burkina Faso/Niger
// issuance suspensions, …) means there is nothing to apply for - the page must
// link the official advisory instead of an apply CTA.
const TRAVEL_BAN_RE = /passports? (?:are|is) not valid for travel|no route for ordinary tourism|suspended[^.]{0,40}visa issuance|visa issuance[^.]{0,40}suspended|not (?:routinely|currently) issuing[^.]{0,40}visas/i;
const isTravelBanned = (s: Status): boolean => s.kind === "visa_required" && !!s.notes && TRAVEL_BAN_RE.test(s.notes);

function answerSentence(nat: string, dest: string, s: Status): string {
  switch (s.kind) {
    case "own": return `${nat} citizens do not need a visa for ${dest} - it is their own country.`;
    case "fom": return `${nat} citizens have freedom of movement in ${dest} - they can live, work and travel there with no visa.`;
    case "visa_free": return `No - ${nat} passport holders do not need a visa for ${dest}. Entry is visa-free${s.maxStayDays ? ` for up to ${s.maxStayDays} days` : ""} as of 2026.`;
    case "visa_on_arrival": return `${nat} passport holders can get a visa on arrival for ${dest}${s.maxStayDays ? ` (up to ${s.maxStayDays} days)` : ""}, so no visa is needed before travelling.`;
    case "eta": return `${nat} passport holders need an approved eTA (electronic travel authorisation) before travelling to ${dest} - a quick online pre-screening completed before departure, not a full visa.`;
    case "e_visa": return `${nat} passport holders can apply online for a ${dest} e-Visa before travel. Unlike an eTA, this is an actual visa - just issued digitally - so no embassy visit is needed for eligible short-term visits. Eligibility and covered purposes vary, so check the conditions below.`;
    default:
      // "Apply at the embassy" is wrong advice when the advance note says
      // issuance/travel is banned or suspended for this nationality.
      return isTravelBanned(s)
        ? `${nat} passport holders currently cannot travel to ${dest} for ordinary tourism - see the policy note for the official restriction and current status.`
        : `${nat} passport holders need a visa to enter ${dest}. Apply at a ${dest} embassy or consulate, or the official visa portal, before travelling.`;
  }
}

// Shorter, differently-framed answer for the FAQ - the hero paragraph above
// already gives the full sentence, so the FAQ leads with a direct yes/no
// instead of repeating it verbatim.
function faqAnswerSentence(nat: string, dest: string, s: Status): string {
  switch (s.kind) {
    case "own": return `No - ${dest} is ${nat}'s own country.`;
    case "fom": return `No - ${nat} citizens have freedom of movement in ${dest} under their bloc membership, which includes the right to live and work there, not just visit.`;
    case "visa_free": return `No visa is required${s.maxStayDays ? ` for stays of up to ${s.maxStayDays} days` : ""}.`;
    case "visa_on_arrival": return `No advance visa is required - ${nat} citizens get a visa on arrival at the border${s.maxStayDays ? ` for stays of up to ${s.maxStayDays} days` : ""}.`;
    case "eta": return `Not a visa, but yes - an approved eTA (a quick online pre-screening) is required before travelling.`;
    case "e_visa": return `Yes, but it can be completed entirely online - no embassy visit is required for eligible short-term visits.`;
    default:
      return isTravelBanned(s)
        ? `Yes, but ordinary tourist travel is currently suspended or restricted for ${nat} citizens - see the policy note on this page for the official status.`
        : `Yes - ${nat} citizens must apply for a visa in advance at a ${dest} embassy, consulate, or official visa portal before travelling.`;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; dest: string }> }): Promise<Metadata> {
  const { slug, dest } = await params;
  const n = slugToCountry(slug);
  const d = slugToCountry(dest);
  if (!n || !d) return { title: "Not Found" };
  if (!isUsefulCorridor(n.iso3, d.iso3)) return { title: "Not Found" };
  const s = resolve(n.iso3, d.iso3);
  const nd = DEMONYM[n.iso3] ?? n.name;
  const title = corridorTitle(n.iso3, d.iso3, d.name, nd, s);
  const answer = answerSentence(nd, d.name, s);
  // The full suffix only fits Google's ~155-160 char SERP window when the
  // base answer is short (own/fom/visa_free/voa); eta/e_visa/visa_required
  // sentences are already long, so appending it there just pushes past the
  // truncation point instead of adding value.
  const description = answer.length <= 110 ? `${answer} See fees, stay length & required documents.` : answer;
  const canonical = `https://earthvisa.in/passport/${slug}/${dest}`;
  const aliasLead = CORRIDOR_TITLE_ALIAS[d.iso3];
  const short = SHORT_NAME[d.iso3] ?? d.name;
  return {
    title: { absolute: `${title} | Earth Visa` },
    description,
    keywords: [
      `${d.name.toLowerCase()} visa for ${nd.toLowerCase()}`,
      `${d.name.toLowerCase()} visa for ${nd.toLowerCase()} citizens`,
      `do ${nd.toLowerCase()} citizens need visa for ${d.name.toLowerCase()}`,
      `${n.name.toLowerCase()} passport ${d.name.toLowerCase()} visa`,
      `${d.name.toLowerCase()} visa requirements for ${nd.toLowerCase()}`,
      `${n.name.toLowerCase()} to ${d.name.toLowerCase()} visa`,
      ...(aliasLead ? [
        `${aliasLead.toLowerCase()} visa for ${nd.toLowerCase()}`,
        `${aliasLead.toLowerCase()} visa for ${nd.toLowerCase()} citizens`,
        `${aliasLead.toLowerCase()} visa requirements for ${nd.toLowerCase()}`,
      ] : []),
      ...(short !== d.name ? [`${short.toLowerCase()} visa for ${nd.toLowerCase()}`] : []),
      ...(d.iso3 === "SAU" && UMRAH_NATIONALITIES.has(n.iso3) ? [
        `umrah visa for ${nd.toLowerCase()}`,
        `umrah visa requirements for ${nd.toLowerCase()}`,
      ] : []),
    ],
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 border-vfree/40",
  visa_on_arrival: "text-voa bg-voa/10 border-voa/40",
  eta: "text-eta bg-eta/10 border-eta/40",
  e_visa: "text-evisa bg-evisa/10 border-evisa/40",
};

// Anchors on the /guide/visa-types glossary - lets a reader who lands on any
// corridor page click through to what the access level generically means,
// instead of only ever seeing a corridor-specific sentence.
const GLOSSARY_ANCHOR: Record<string, string> = {
  visa_free: "visa-free",
  visa_on_arrival: "visa-on-arrival",
  eta: "eta",
  e_visa: "e-visa",
  visa_required: "visa-required",
  fom: "freedom-of-movement",
};

function StatusBadge({ s }: { s: Status }) {
  if (s.kind === "own") return <Badge cls="text-bloc bg-bloc/10 border-bloc/40">Home country</Badge>;
  if (s.kind === "fom") return <Badge cls="text-bloc bg-bloc/10 border-bloc/40" href={`/guide/visa-types#${GLOSSARY_ANCHOR.fom}`}>Freedom of movement</Badge>;
  if (s.kind === "visa_required") return <Badge cls="text-ink-soft bg-paper-3 border-line-strong" href={`/guide/visa-types#${GLOSSARY_ANCHOR.visa_required}`}>Visa required</Badge>;
  return <Badge cls={LEVEL_COLORS[s.kind]} href={`/guide/visa-types#${GLOSSARY_ANCHOR[s.kind]}`}>{LEVEL_LABEL[s.kind]}</Badge>;
}
// Stamp-like status chip: 1px border, near-square radius, and the spec's one
// allowed ≤1° rotation (verdict chip only - nowhere else on the site).
function Badge({ cls, href, children }: { cls: string; href?: string; children: React.ReactNode }) {
  const className = `mono inline-flex -rotate-1 items-center rounded-[2px] border px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] ${cls}`;
  if (href) return <Link href={href} className={`${className} transition hover:opacity-80`} title="What does this mean?">{children}</Link>;
  return <span className={className}>{children}</span>;
}

// A real link to the actual application portal, not just a citation - this is
// the "go do the thing" action, distinct from the small source-citation links
// shown elsewhere on the page.
function ApplyLink({ href, label = "Apply here" }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-stamp underline-offset-2 hover:underline">
      {label} ↗
    </a>
  );
}

// First "14 July 2026"-style date inside a pending-change note becomes the
// sub-block's mono date chip - derived from the note text, never invented.
const NOTE_DATE_RE = /\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/;

// Policy note, structured (spec §8 - no text walls): mono label, bold one-line
// lead (the actionable fact), detail at body size, and any "Upcoming change:"
// content in its own labeled sub-block with a date chip instead of buried
// mid-paragraph. Structured notes (newline "- " bullets with an optional short
// "Label:" line) keep their scannable bullet list.
function PolicyNote({ notes }: { notes: string }) {
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
  const leadLines: string[] = [];
  const bullets: string[] = [];
  let listLabel: string | null = null;
  for (const line of lines) {
    if (/^[-•]\s+/.test(line)) bullets.push(line.replace(/^[-•]\s+/, ""));
    else if (/:$/.test(line) && line.length <= 40) listLabel = line.replace(/:$/, "");
    else leadLines.push(line);
  }
  const sentences = splitSentences(leadLines.join(" "));
  const changeIdx = sentences.findIndex((t) => /^upcoming change[:\s]/i.test(t));
  const leadSentences = changeIdx === -1 ? sentences : sentences.slice(0, changeIdx);
  const changeSentences = (changeIdx === -1 ? [] : sentences.slice(changeIdx)).map((t, i) => {
    const stripped = i === 0 ? t.replace(/^upcoming change:\s*/i, "") : t;
    return i === 0 ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : stripped;
  });
  const changeDate = changeSentences.length > 0 ? NOTE_DATE_RE.exec(changeSentences.join(" "))?.[0] ?? null : null;
  return (
    <div className="border-t border-line px-5 py-4 sm:px-6">
      <p className="eyebrow">Policy note</p>
      {leadSentences.length > 0 && (
        <p className="text-body measure mt-2 font-semibold text-ink">{leadSentences[0]}</p>
      )}
      {leadSentences.length > 1 && (
        <p className="text-body measure mt-1.5 text-ink-soft">{leadSentences.slice(1).join(" ")}</p>
      )}
      {bullets.length > 0 && (
        <>
          {listLabel && <p className="mono-chrome mt-3">{listLabel}</p>}
          <ul className={`${listLabel ? "mt-1.5" : "mt-3"} measure space-y-1`}>
            {bullets.map((b, i) => (
              <li key={i} className="text-body flex gap-2.5 text-ink-soft">
                <span aria-hidden="true" className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-mute/70" />
                <span className="min-w-0 break-words">{b}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {changeSentences.length > 0 && (
        <div className="mt-3.5 max-w-3xl rounded-[2px] border border-line bg-paper-2/70 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mono text-[11px] font-semibold uppercase tracking-[0.16em] text-stamp">Upcoming change</p>
            {changeDate && (
              <span className="mono rounded-[2px] border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-soft">{changeDate}</span>
            )}
          </div>
          <p className="text-body measure mt-2 text-ink-soft">{changeSentences.join(" ")}</p>
        </div>
      )}
    </div>
  );
}

// One destination visa-type card - shows processing time and entry count
// (already collected per visa type, previously never rendered) plus any notes
// the source publishes (insurance/minors/entry-point clauses etc.), alongside
// the existing name/purpose/stay/fee/apply-link fields.
function VisaTypeCard({ v, suppressFee }: { v: VisaType; suppressFee: boolean }) {
  // A 0-day minimum means sub-24h turnaround - never print "0d processing".
  // Types that publish only a max still get "up to Nd processing".
  const pMin = v.processing_days_min, pMax = v.processing_days_max;
  const processing = pMin == null && pMax == null
    ? null
    : pMin == null || pMin === 0
      ? (pMax != null && pMax > 0 ? `up to ${pMax}d processing` : pMin === 0 ? "under 24h processing" : null)
      : `${pMin}${pMax != null && pMax !== pMin ? `-${pMax}` : ""}d processing`;
  return (
    <div className="card-doc px-4 py-3.5">
      <p className="font-display text-[15px] font-semibold text-ink">{v.name}</p>
      {v.purpose && <p className="text-body mt-1 text-ink-soft">{v.purpose}</p>}
      <div className="mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
        {v.max_stay_days != null && <span>{v.max_stay_days} days</span>}
        {v.entries && <span>{v.entries} entry</span>}
        {processing && <span>{processing}</span>}
        {/* Suppress the rough USD figure when the official fee section above
            already quotes the same fee - two conversions of one fee reads as an error. */}
        {v.fee_usd != null && !suppressFee && (v.fee_usd === 0 ? <span className="text-vfree">free</span> : <span>~${v.fee_usd}</span>)}
        {v.online && <span className="text-vfree">online</span>}
      </div>
      {/* Notes holding 3+ discrete facts render as scannable bullets, not a
          run-on paragraph; one- or two-sentence notes stay as prose. */}
      {v.notes && (() => {
        const sentences = splitSentences(v.notes);
        return sentences.length >= 3 ? (
          <ul className="mt-2 space-y-1">
            {sentences.map((t, i) => (
              <li key={i} className="text-body flex gap-2 text-ink-soft">
                <span aria-hidden="true" className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-ink-mute/70" />
                <span className="min-w-0 break-words">{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body mt-2 text-ink-soft">{v.notes}</p>
        );
      })()}
      {v.official_url && (
        <a href={v.official_url} target="_blank" rel="noreferrer" className="mono mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-stamp underline-offset-2 hover:underline">
          {isAdvisoryUrl(v.official_url) ? "Official advisory" : "Apply here"} ↗
        </a>
      )}
    </div>
  );
}

export default async function CorridorPage({ params }: { params: Promise<{ slug: string; dest: string }> }) {
  const { slug, dest } = await params;
  const n = slugToCountry(slug);
  const d = slugToCountry(dest);
  if (!n || !d) notFound();
  if (!isUsefulCorridor(n.iso3, d.iso3)) notFound();

  const s = resolve(n.iso3, d.iso3);
  const nd = DEMONYM[n.iso3] ?? n.name;
  const need = s.kind === "visa_required" || s.kind === "e_visa" || s.kind === "eta";
  // No visa (and no visa fee) is needed for a short stay - every fee/document
  // mention must carry that context or the page contradicts its own headline.
  const noVisaShortStay = s.kind === "visa_free" || s.kind === "fom" || s.kind === "own";
  // Colloquial phrasing (Dubai/Bali/Umrah) - content stays official-jurisdiction accurate.
  const aliasLead = CORRIDOR_TITLE_ALIAS[d.iso3];
  const aliasNote = aliasLead ? ALIASES.find((a) => a.alias === aliasLead)?.note : undefined;
  const umrah = d.iso3 === "SAU" && UMRAH_NATIONALITIES.has(n.iso3);
  const visaTypes = dataset.destinationVisaTypes?.[d.iso3] ?? [];
  // A destination can have several VFS corridor files for one nationality
  // (e.g. Malta: "mlt" short-stay Schengen visas + "mes" employment/study
  // national services) - merge them all rather than picking whichever file
  // sorts first, so the tourist checklist is never hidden by a sibling file.
  const vfsCorrs = (dataset.vfsCorridors?.[d.iso3] ?? []).filter((c) => c.sourceIso3 === n.iso3);
  const vfsCorr = vfsCorrs[0];
  const hasVfs = vfsCorrs.length > 0;
  // hasVfs = a corridor file exists; hasVfsDocs (set below) = documents actually render.
  // Inline the real corridor document checklist (unique per nationality→destination)
  // instead of a destination-generic visa-types block. Read at build time.
  let vfsDocs: { name: string; category: string; documents_required: string }[] = [];
  let vfsCommonLines: string[] = [];
  const VFS_PREVIEW = 6;
  if (vfsCorrs.length > 0) {
    try {
      const merged = vfsCorrs.flatMap((c) => {
        try {
          const data = JSON.parse(readFileSync(join(process.cwd(), "data", c.detailFile), "utf8"));
          return data.visa_types ?? [];
        } catch { return []; }
      });
      // Names this page's audience answers to (nationality country + demonym;
      // NOT the destination - "for applying Thailand Visa" appears in nearly
      // every advisory). "Passport holder" advisories naming a different
      // country are wrong-audience noise and get dropped by cleanChecklistLines.
      const keepNames = [n.name, nd];
      const foreignNames = dataset.allCountries.filter((c) => c.iso3 !== n.iso3 && c.iso3 !== d.iso3).map((c) => c.name);
      const all = merged
        .filter((v: { documents_required?: string | null }) => v.documents_required)
        .map((v: { name: string; category: string; documents_required: string }) => ({
          ...v,
          documents_required: cleanChecklistLines(stripVfsBoilerplate(v.documents_required), keepNames, foreignNames),
        }))
        .filter((v: { documents_required: string }) => v.documents_required)
        .filter((v: { name: string; category: string; documents_required: string }) => !isLabelEcho(v))
        // Tourist first: it's what the vast majority of readers actually need,
        // and a hard positional cutoff below must not bury it under niche types.
        .sort((a: { category: string }, b: { category: string }) => (a.category === "tourist" ? -1 : b.category === "tourist" ? 1 : 0));
      const { common, perEntry } = extractCommonLines(all);
      vfsCommonLines = common;
      vfsDocs = all.map((v: { name: string; category: string; documents_required: string }, i: number) => ({
        ...v,
        documents_required: perEntry[i].join("\n"),
      }));
    } catch { /* fall back to the interactive link */ }
  }

  // Official visa fees for this corridor (crawled from government sources).
  const destFees = feesFor(d.iso3);
  const feeList = relevantFees(d.iso3, s.kind);
  const feeVariation = variationFor(d.iso3, n.iso3);
  const headlineFee = feeVariation?.amount != null ? feeVariation : feeList.find((f) => f.amount != null) ?? null;

  // Held-credential unlocks: destinations like the UAE admit otherwise
  // visa-required nationals on arrival when they hold a major third-country
  // visa or residence permit. These officially published rules already live in
  // dataset.credentialAccess - without this section the hero says only "visa
  // required", hiding the most-searched fact on corridors like India -> UAE.
  // Transit-only and refugee-document edges are excluded (not tourist entry).
  const credLabelById = new Map(dataset.credentials.map((c) => [c.id, c.label]));
  const credUnlocks = s.kind === "visa_required"
    ? Object.entries(dataset.credentialAccess ?? {}).flatMap(([cred, edges]) =>
        edges
          .filter((e) =>
            e.dest === d.iso3 &&
            !e.transit &&
            (e.nationalityScope == null || e.nationalityScope.includes(n.iso3)) &&
            !/refugee|airport transit/i.test(`${e.notes ?? ""} ${e.conditions ?? ""}`))
          .map((e) => ({
            cred,
            label: credLabelById.get(cred) ?? cred,
            level: e.level,
            maxStayDays: e.maxStayDays,
            conditions: (e.conditions || e.notes || "").split(". ")[0],
            sourceUrl: e.sourceUrl,
          })))
    : [];
  // Group identical outcomes ("visa on arrival, 14 days") so ten credentials
  // render as one row with chips, not ten near-identical cards.
  const credGroups = [...credUnlocks.reduce((m, u) => {
    const key = `${u.level}|${u.maxStayDays ?? ""}`;
    (m.get(key) ?? m.set(key, []).get(key)!).push(u);
    return m;
  }, new Map<string, typeof credUnlocks>()).values()];

  // Related corridors for internal linking (crawl mesh).
  const sameNat = TOP_DESTINATIONS.filter((x) => x !== d.iso3 && x !== n.iso3 && isUsefulCorridor(n.iso3, x)).slice(0, 8).map((x) => byIso3.get(x)).filter(Boolean);
  const sameDest = TOP_NATIONALITIES.filter((x) => x !== n.iso3 && x !== d.iso3 && isUsefulCorridor(x, d.iso3)).slice(0, 8).map((x) => byIso3.get(x)).filter(Boolean);

  // ── Verdict-card facts: the numbers a traveler actually came for, pulled out
  // of the prose and into one scannable strip at the top of the page. ─────────
  const stayFact = s.kind === "fom" ? "Unlimited" : "maxStayDays" in s && s.maxStayDays ? `${s.maxStayDays} days` : "Varies";
  const costFact =
    s.kind === "own" ? null
    : noVisaShortStay ? "Free"
    : headlineFee
      ? (headlineFee.amount === 0 ? "Free" : headlineFee.amount != null ? `${headlineFee.currency ?? ""} ${headlineFee.amount.toLocaleString()}`.trim() : "See source")
      : "Not published";
  const applyFact =
    s.kind === "own" ? "Home country"
    : s.kind === "fom" || s.kind === "visa_free" ? "Nothing to arrange"
    : s.kind === "visa_on_arrival" ? "At the border"
    : s.kind === "eta" || s.kind === "e_visa" ? "Online, before travel"
    : "Embassy / visa centre";
  const hasProcessing = (v: VisaType) => v.processing_days_min != null || v.processing_days_max != null;
  const processingType = need
    ? visaTypes.find((v) => v.category === "tourist" && hasProcessing(v)) ?? visaTypes.find(hasProcessing)
    : undefined;
  // min of 0 days = sub-24-hour turnaround (e.g. Seychelles TA standard
  // processing) - "0 days" reads as broken data, so speak human instead.
  // 124 visa types publish only a max - "Up to N days" covers those too.
  const processingFact = (() => {
    const min = processingType?.processing_days_min;
    const max = processingType?.processing_days_max;
    if (min == null && max == null) return null;
    if (min == null || min === 0) return max != null && max > 0 ? `Up to ${max} day${max === 1 ? "" : "s"}` : min === 0 ? "Under 24 hours" : null;
    if (max != null && max !== min) return `${min}-${max} days`;
    return `${min} day${min === 1 ? "" : "s"}`;
  })();
  const facts = [
    { k: "Max stay", v: stayFact },
    costFact ? { k: "Visa cost", v: costFact } : null,
    { k: "How to apply", v: applyFact },
    processingFact ? { k: "Processing", v: processingFact } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  // Rail plumbing: which sections exist (jump links) + the primary apply URL.
  const TRAVELER_CATS = new Set(["tourist", "business", "transit"]);
  const hasTypesSection =
    visaTypes.length > 0 &&
    ((!hasVfs && need && visaTypes.some((v) => TRAVELER_CATS.has(v.category))) ||
      visaTypes.some((v) => !TRAVELER_CATS.has(v.category)));
  // The status source can be a citation (a travel.state.gov country page on a
  // US corridor), not a portal - only a non-advisory URL may become the "Apply"
  // action. An advance note can also rule out whole channels: a stated e-visa
  // ineligibility ("not on Russia's approved e-visa nationality list") makes
  // the destination's e-visa portal the wrong door, and a ban/suspension means
  // there is nothing to apply for at all.
  const statusUrl = "sourceUrl" in s && s.sourceUrl ? s.sourceUrl : null;
  const travelBanned = isTravelBanned(s);
  const eVisaIneligible = s.kind === "visa_required" && !!s.notes && /\bnot (?:on|in|eligible(?: for)?)\b[^.]{0,60}\be-?visa/i.test(s.notes);
  const portalUrl = visaTypes
    .map((v) => v.official_url)
    .filter((u): u is string => !!u && !isAdvisoryUrl(u) && !(eVisaIneligible && /e-?visa/i.test(u)))[0] ?? null;
  const applyUrl = need && !travelBanned
    ? ((statusUrl && !isAdvisoryUrl(statusUrl) ? statusUrl : null) ?? portalUrl)
    : null;
  const advisoryUrl = travelBanned ? statusUrl : null;
  // A fee-variation note sometimes carries the lodging channel itself ("all
  // applications must be lodged through VFS Global Dhaka; the Embassy … no
  // longer accepts direct applications") - that is an apply step, not just a
  // fee fact, so surface the sentence in the apply section too.
  const lodgingFact = s.kind === "visa_required" && feeVariation?.note
    ? splitSentences(feeVariation.note).find((t) => /must be lodged|no longer accepts direct applications/i.test(t)) ?? null
    : null;
  const jumpLinks = [
    { href: "#apply", label: travelBanned ? "Current status" : need ? "How to apply" : "How to enter" },
    credGroups.length > 0 ? { href: "#no-advance-visa", label: "No-visa exceptions" } : null,
    feeList.length > 0 ? { href: "#fees", label: "Fees" } : null,
    vfsDocs.length > 0 ? { href: "#documents", label: "Documents" } : null,
    hasTypesSection ? { href: "#visa-types", label: "Visa types" } : null,
    { href: "#faq", label: "FAQ" },
  ].filter(Boolean) as { href: string; label: string }[];

  // Cost FAQ: never assert a visa fee for a corridor where no visa is needed  - 
  // on visa-free / freedom-of-movement corridors the answer leads with "no
  // fee" and frames any published fee as the longer-stay visa option. This
  // text is also emitted into FAQPage JSON-LD, so it must stand alone. Skipped
  // entirely when the fee table below already shows this exact figure -
  // reformatting the same number as a sentence adds nothing.
  let costFaq: { q: string; a: string } | null = null;
  if (headlineFee && s.kind !== "own" && feeList.length === 0) {
    const feeName = "name" in headlineFee && headlineFee.name ? headlineFee.name.toLowerCase() : "visa";
    const schedule = feeVariation?.amount != null ? ` for ${nd} citizens under ${d.name}'s nationality-based fee schedule` : "";
    const feeClause = headlineFee.amount === 0
      ? `the ${d.name} ${feeName} is free of charge${schedule}`
      : `the ${d.name} ${feeName} fee is ${fmtFee(headlineFee)}${schedule}`;
    // Never assert a specific VFS service-fee amount/currency here: the crawled
    // figure is whichever source-country VAC schedule happened to be available
    // (often India's, sometimes Nigeria's/Iraq's/USA's/etc.) and there is no
    // reliable signal for which nationality it actually belongs to - showing it
    // as if universal is wrong for every other nationality. Same nationality-
    // agnostic wording as the destination page.
    const vfsNote = destFees?.vfs.used ? ` Applications through ${destFees.vfs.operator} carry an additional service fee that varies by country and application centre.` : "";
    costFaq = {
      q: `How much does the ${d.name} visa cost for ${nd} citizens?`,
      a: noVisaShortStay
        ? `Nothing for a short visit - ${nd} citizens ${s.kind === "fom" ? `have freedom of movement in ${d.name}` : `enter ${d.name} visa-free${"maxStayDays" in s && s.maxStayDays ? ` for up to ${s.maxStayDays} days` : ""}`}, so there is no visa fee. If you need a visa for a longer stay, ${feeClause}.${vfsNote}`
        : `${feeClause.charAt(0).toUpperCase()}${feeClause.slice(1)}.${vfsNote}`,
    };
  }

  const faq = [
    { q: `Do ${nd} citizens need a visa for ${d.name}?`, a: faqAnswerSentence(nd, d.name, s) },
    (s.kind === "visa_free" || s.kind === "visa_on_arrival") && "maxStayDays" in s && s.maxStayDays
      ? { q: `How long can ${nd} citizens stay in ${d.name}?`, a: `${nd} passport holders can stay in ${d.name} for up to ${s.maxStayDays} days per entry under the current ${LEVEL_LABEL[s.kind].toLowerCase()} arrangement.` }
      : null,
    {
      q: `What documents do ${nd} citizens need for ${d.name}?`,
      a: noVisaShortStay
        ? `A valid passport is all ${nd} citizens need for a short ${s.kind === "fom" ? "stay" : "visa-free visit"}${"maxStayDays" in s && s.maxStayDays ? ` (up to ${s.maxStayDays} days)` : ""}.${vfsDocs.length > 0 ? ` If you apply for a longer-stay visa, Earth Visa lists the full required documents per visa category from the official visa application centre.` : ""}`
        : vfsDocs.length > 0
          ? `A valid passport plus the ${d.name} document checklist for your visa type - Earth Visa lists the full required documents per visa category from the official visa application centre.`
          : `A passport valid well beyond your planned stay (commonly three to six months, depending on the destination), proof of onward travel and funds, and any documents required for the specific ${d.name} visa category - check the official portal for the exact passport-validity rule.`,
    },
    aliasLead
      ? { q: `Is the ${aliasLead} visa different from the ${SHORT_NAME[d.iso3] ?? d.name} visa?`, a: `No. ${aliasNote ?? `${aliasLead} follows ${d.name}'s national visa policy.`} There is no separate ${aliasLead} visa - the ${d.name} rules on this page are what apply.` }
      : null,
    umrah
      ? { q: `Can ${nd} citizens perform Umrah - do they need a separate Umrah visa?`, a: `Saudi Arabia permits Umrah (not Hajj) on a tourist visa, and also issues dedicated Umrah visas processed through the official Nusuk platform. ${nd} pilgrims should apply via Nusuk or an authorised Umrah operator.` }
      : null,
    costFaq,
  ].filter(Boolean) as { q: string; a: string }[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Passports", item: "https://earthvisa.in/passport" },
        { "@type": "ListItem", position: 3, name: `${n.name} passport`, item: `https://earthvisa.in/passport/${slug}` },
        { "@type": "ListItem", position: 4, name: `${d.name} visa`, item: `https://earthvisa.in/passport/${slug}/${dest}` },
      ] },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen">
        <header className="bg-grid-paper">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-10 sm:px-8">
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="mono mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-mute">
                <ol className="flex flex-wrap items-center gap-x-2">
                  <li><Link href="/passport" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Passports</Link></li>
                  <li aria-hidden="true">/</li>
                  <li><Link href={`/passport/${slug}`} className="inline-flex min-h-[44px] items-center transition hover:text-ink">{n.name}</Link></li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-ink-soft">{d.name}</li>
                </ol>
              </nav>
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none" aria-hidden="true">{flagFor(d.iso3)}</span>
                {aliasLead ? `${aliasLead} & ${SHORT_NAME[d.iso3] ?? d.name}` : d.name} Visa for {nd} Citizens
                <span className="mt-1 block font-display text-lg font-normal italic leading-snug tracking-normal text-ink-soft sm:text-xl">
                  {umrah ? "Tourist & Umrah - 2026 Requirements" : "2026 Requirements, Fees & Documents"}
                </span>
              </h1>
              {aliasNote && (
                <p className="text-body mt-3 max-w-2xl rounded-[2px] border border-line bg-paper-2/70 px-3.5 py-2.5 text-ink-soft">
                  {aliasNote}
                </p>
              )}
              {/* Entry stamp card (spec §7): status chip + verdict sentence +
                  stat-tile ledger + policy note + source footer unified in ONE
                  document card - the whole answer, scannable in one glance. */}
              <div className="card-doc card-doc-rule card-doc-ticks mt-6">
                <div className="flex flex-col items-start gap-3 px-5 pt-5 pb-4 sm:flex-row sm:gap-4 sm:px-6">
                  <span className="pt-0.5"><StatusBadge s={s} /></span>
                  <p className="min-w-0 flex-1 text-[17px] leading-normal text-ink sm:text-[19px]">{answerSentence(nd, d.name, s)}</p>
                </div>
                {/* Stat tiles: internal 3-col ledger row divided by hairlines -
                    a compact row on mobile too, never a tall stack. */}
                <dl className={`grid gap-px border-t border-line bg-line ${facts.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : facts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {facts.map((f) => (
                    <div key={f.k} className="bg-card px-3 py-3 sm:px-5">
                      <dt className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-mute">{f.k}</dt>
                      <dd className="mt-1 font-display text-[15px] font-semibold leading-snug text-ink sm:text-[18px]">{f.v}</dd>
                    </div>
                  ))}
                </dl>
                {"notes" in s && s.notes ? <PolicyNote notes={s.notes} /> : null}
                {/* Source line: card footer. */}
                <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-paper-2/60 px-5 py-3 text-[11px] text-ink-mute sm:px-6">
                  {"sourceUrl" in s && s.sourceUrl ? (
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-ink">
                      <span className={`inline-block h-2 w-2 rounded-full ${s.sourceOfficial ? "bg-vfree" : "bg-eta"}`} />
                      {(() => { try { return new URL(s.sourceUrl).hostname.replace(/^www\./, ""); } catch { return "official source"; } })()} ↗
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-vfree" />official government sources</span>
                  )}
                  <Link href={`/guide/visa-types#${GLOSSARY_ANCHOR[s.kind] ?? "visa-required"}`} className="transition hover:text-ink">
                    What does &ldquo;{s.kind === "own" ? "home country" : s.kind === "fom" ? "freedom of movement" : s.kind === "visa_required" ? "visa required" : LEVEL_LABEL[s.kind].toLowerCase()}&rdquo; mean? →
                  </Link>
                </div>
              </div>
              {(() => {
                const appNote = need ? applicationNoteFor(d.iso3) : null;
                if (!appNote) return null;
                // Same no-text-wall structure as the policy note: label, bold
                // one-line lead, detail at body size.
                const sentences = splitSentences(appNote);
                return (
                  <div className="card-doc mt-4 max-w-3xl px-5 py-4">
                    <p className="eyebrow">How it works</p>
                    <p className="text-body measure mt-2 font-semibold text-ink">{sentences[0]}</p>
                    {sentences.length > 1 && (
                      <p className="text-body measure mt-1.5 text-ink-soft">{sentences.slice(1).join(" ")}</p>
                    )}
                  </div>
                );
              })()}
              {/* Mobile jump nav: below lg the rail (jump links + apply button)
                  stacks after the FAQ - thousands of words down - so both get a
                  second, scrollable home right under the verdict card. */}
              <nav aria-label="Jump to section" className="-mx-5 mt-5 px-5 sm:-mx-8 sm:px-8 lg:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {applyUrl && (
                    <a href={applyUrl} target="_blank" rel="noreferrer" className="mono inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-stamp bg-stamp px-3.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white dark:border-stamp-deep dark:bg-stamp-deep">
                      Apply ↗
                    </a>
                  )}
                  {advisoryUrl && (
                    <a href={advisoryUrl} target="_blank" rel="noreferrer" className="mono inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-line-strong bg-card px-3.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                      Official advisory ↗
                    </a>
                  )}
                  {jumpLinks.map((j) => (
                    <a key={j.href} href={j.href} className="mono inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-line bg-card px-3.5 text-[11px] uppercase tracking-[0.12em] text-ink-soft transition hover:border-stamp hover:text-ink">
                      {j.label}
                    </a>
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start lg:gap-12">
          <div className="min-w-0">
          {/* What you need to do */}
          <section id="apply" className="mb-12 scroll-mt-24">
            <p className="eyebrow">{travelBanned ? "Current status" : need ? "How to apply" : "How to enter"}</p>
            <h2 className="text-section mt-2 text-ink">
              {travelBanned ? `${d.name} travel status for ${nd} citizens` : need ? `How ${nd} citizens apply for a ${d.name} visa` : `Entering ${d.name} on ${article(nd)} ${nd} passport`}
            </h2>
            <ul className="text-body measure mt-4 space-y-2 text-ink-soft">
              {s.kind === "visa_free" && <li>→ Travel with just your valid {nd} passport. No visa or prior application needed.</li>}
              {s.kind === "visa_on_arrival" && (
                <li>
                  → Obtain your visa at the {d.name} border/airport on arrival; carry the required fee and documents.
                  {"sourceUrl" in s && s.sourceUrl && <>{" "}<ApplyLink href={s.sourceUrl} /></>}
                </li>
              )}
              {s.kind === "eta" && (
                <li>
                  → Apply online for the eTA before you travel; approval is usually quick.
                  {"sourceUrl" in s && s.sourceUrl && <>{" "}<ApplyLink href={s.sourceUrl} /></>}
                </li>
              )}
              {s.kind === "e_visa" && (
                <li>
                  → Apply for the e-Visa online before travel and carry the approval.
                  {"sourceUrl" in s && s.sourceUrl && <>{" "}<ApplyLink href={s.sourceUrl} /></>}
                </li>
              )}
              {/* The hero already states THAT a visa is needed - these steps
                  carry the operational facts instead of restating the verdict. */}
              {s.kind === "visa_required" && travelBanned && (
                <li>
                  → Ordinary travel to {d.name} is currently not possible on {article(nd)} {nd} passport - see the policy note above for the official restriction.
                  {advisoryUrl && <>{" "}<ApplyLink href={advisoryUrl} label="Read the official advisory" /></>}
                </li>
              )}
              {s.kind === "visa_required" && !travelBanned && (
                <li>
                  → Lodge your application {destFees?.vfs.used && destFees.vfs.operator ? `at ${article(destFees.vfs.operator)} ${destFees.vfs.operator} visa application centre` : `at the ${d.name} embassy or consulate that serves your region`}, with the completed form and required documents.
                  {applyUrl && <>{" "}<ApplyLink href={applyUrl} /></>}
                </li>
              )}
              {s.kind === "visa_required" && !travelBanned && lodgingFact && <li>→ {lodgingFact}</li>}
              {s.kind === "visa_required" && !travelBanned && processingFact && (
                <li>→ Allow {processingFact.charAt(0).toLowerCase()}{processingFact.slice(1)} for processing once lodged - apply well before your travel date.</li>
              )}
              {vfsDocs.length > 0 && (
                <li>→ <Link href={`/visit?dest=${d.iso3}&passport=${n.iso3}`} className="font-medium text-stamp underline-offset-2 hover:underline">See the exact document checklist</Link> for {nd} applicants{noVisaShortStay ? " - only needed if you apply for a longer-stay visa" : ", by visa type"}.</li>
              )}
            </ul>
          </section>

          {/* Held-credential exceptions - officially published no-advance-visa routes */}
          {credGroups.length > 0 && (
            <section id="no-advance-visa" className="mb-12 scroll-mt-24">
              <p className="eyebrow">No-visa exceptions</p>
              <h2 className="text-section mt-2 text-ink">
                No advance visa with these documents
              </h2>
              <p className="text-body measure mt-2 text-ink-soft">
                {d.name} officially admits {nd} citizens without a pre-arranged visa when they hold certain third-country visas or residence permits.
              </p>
              <div className="mt-4 space-y-3">
                {credGroups.map((group, gi) => (
                  <div key={gi} className="rounded-[2px] border border-vfree/40 bg-vfree/[0.05] px-4 py-3.5">
                    <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-vfree">
                      {LEVEL_LABEL[group[0].level]}{group[0].maxStayDays ? ` · up to ${group[0].maxStayDays} days` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.map((u) => (
                        <span key={u.cred} className="mono rounded-[2px] border border-line-strong bg-card px-2 py-0.5 text-[11px] text-ink">{u.label}</span>
                      ))}
                    </div>
                    {group[0].conditions && (
                      <p className="text-body measure mt-2 text-ink-soft">{group[0].conditions}. Conditions vary slightly per document - check each rule via the official source{group[0].sourceUrl ? "" : ""}.</p>
                    )}
                    {group[0].sourceUrl && (
                      <a href={group[0].sourceUrl} target="_blank" rel="noreferrer" className="mono mt-1.5 inline-block text-[11px] text-ink-mute underline-offset-2 transition hover:text-ink hover:underline">
                        {(() => { try { return new URL(group[0].sourceUrl).hostname.replace(/^www\./, ""); } catch { return "official source"; } })()} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-body mt-3 text-ink-soft">
                <Link href={`/visit?dest=${d.iso3}&passport=${n.iso3}`} className="font-medium text-stamp underline-offset-2 hover:underline">
                  Check what all your documents unlock at once →
                </Link>
              </p>
            </section>
          )}

          {/* Official visa fees (crawled from government sources) */}
          {feeList.length > 0 && (
            <section id="fees" className="mb-12 scroll-mt-24">
              <p className="eyebrow">Fees</p>
              <h2 className="text-section mt-2 text-ink">
                {d.name} visa cost for {nd} citizens
              </h2>

              {/* Nationality-specific fee (reciprocity) - highlighted, since it's the
                  single most useful number for this corridor. */}
              {feeVariation?.amount != null && (
                <div className="mt-4 flex flex-col gap-2 rounded-[2px] border border-stamp/40 bg-stamp/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="shrink-0">
                    <p className="mono text-[10px] font-medium uppercase tracking-[0.16em] text-stamp">Fee for {nd} citizens</p>
                    <p className="mono mt-0.5 text-2xl font-bold tabular-nums text-stamp">{fmtFee(feeVariation)}</p>
                  </div>
                  {feeVariation.note && (
                    <p className="text-body text-ink-soft">{feeVariation.note}</p>
                  )}
                </div>
              )}

              {/* Fee ledger: compact hairline-divided rows in one document
                  card (spec §12) instead of chunky per-fee boxes. */}
              <div className="card-doc mt-4">
                <ul className="divide-y divide-line">
                {(() => {
                  // The nationality-specific variation overrides ONE row - the first
                  // of its kind (the primary product). Overriding every same-kind row
                  // clobbered e.g. Maldives' MVR 750 extension fee with India's free
                  // VoA, mislabelling a real fee as "Free".
                  const variationRowIdx = feeVariation?.amount != null
                    ? feeList.slice(0, 4).findIndex((f) => f.kind === feeVariation.kind)
                    : -1;
                  return feeList.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-medium text-ink">{f.name}</p>
                      <div className="mono flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-mute">
                        {f.validity && <span>{f.validity}</span>}
                        {f.official && <span className="text-vfree">official source</span>}
                        {f.source_url && (
                          <a href={f.source_url} target="_blank" rel="noreferrer" className="underline-offset-2 transition hover:text-ink hover:underline">
                            {(() => { try { return new URL(f.source_url).hostname.replace(/^www\./, ""); } catch { return "source"; } })()} ↗
                          </a>
                        )}
                      </div>
                    </div>
                    {feeVariation?.amount != null && i === variationRowIdx ? (
                      <p className="mono shrink-0 text-[15px] font-semibold tabular-nums text-ink">{fmtFee(feeVariation)}</p>
                    ) : f.amount != null ? (
                      <p className="mono shrink-0 text-[15px] font-semibold tabular-nums text-ink">{fmtFee(f)}</p>
                    ) : (
                      <p className="shrink-0 text-[13px] text-ink-mute">Fee not published by {d.name}</p>
                    )}
                  </li>
                  ));
                })()}
                </ul>
              </div>
              {/* Only visa_required corridors route through a VFS/VAC centre -
                  on VoA/eTA/e-visa corridors the application never touches VFS,
                  so the note would contradict the page's own apply steps. */}
              {destFees?.vfs.used && s.kind === "visa_required" && (() => {
                // The crawled service fee is a source-country figure (usually one
                // centre's schedule). Show the amount ONLY when its source URL is
                // attributable to this corridor's nationality (e.g. .../ind/en/...
                // on an India corridor); for everyone else keep the
                // nationality-agnostic wording - same rule as the destination page.
                const src = (destFees.vfs.source_url ?? "").toLowerCase();
                const natSlugLower = nameToSlug(n.name);
                const natMatch = !!destFees.vfs.service_fee &&
                  (src.includes(`/${n.iso3.toLowerCase()}/`) || src.includes(`/${natSlugLower}/`) || src.includes(`/${n.name.toLowerCase()}/`));
                return (
                  <p className="text-body mt-3 max-w-2xl rounded-[2px] border border-line bg-paper-2/70 px-3.5 py-2.5 text-ink-soft">
                    Applications are handled via {destFees.vfs.operator} - {natMatch
                      ? `the service fee for ${nd} applicants is about ${destFees.vfs.currency ?? ""} ${destFees.vfs.service_fee} on top of the visa fee (varies by centre).`
                      : `a service fee applies on top of the visa fee and varies by country and centre.`}
                  </p>
                );
              })()}
              {/* Provenance lives on each fee row's source link - the stamp
                  only needs to carry freshness. */}
              <p className="mono-chrome mt-3">
                Fees checked {fmtDay(destFees?.updated) ?? "recently"}
              </p>
            </section>
          )}

          {/* VFS document checklist - genuinely per-corridor content */}
          {vfsDocs.length > 0 && (() => {
            const visible = vfsDocs.slice(0, VFS_PREVIEW);
            const hidden = vfsDocs.slice(VFS_PREVIEW);
            // Raw VFS names are often ALL CAPS ("TOURIST") and the category chip
            // duplicated them ("TOURIST TOURIST") - title-case shouty names and
            // only show the chip when it adds information.
            const prettyName = (raw: string) => {
              const t = raw.trim();
              return t === t.toUpperCase() && /[A-Z]{3}/.test(t)
                ? t.toLowerCase().replace(/(^|[\s(/:-])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase())
                : t;
            };
            const renderDoc = (v: typeof vfsDocs[number], i: number) => (
              <details key={i} className="group">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[15px] font-medium text-ink transition group-open:text-stamp">{prettyName(v.name)}</span>
                  {v.category.toLowerCase() !== v.name.trim().toLowerCase() && (
                    <span className="mono shrink-0 rounded-[3px] bg-paper-3 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-mute">{v.category}</span>
                  )}
                  <svg viewBox="0 0 12 8" aria-hidden="true" className="ml-auto h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <div className="pb-5 pr-6 pt-1">
                  {v.documents_required ? (
                    <DocBlocks text={v.documents_required} />
                  ) : (
                    <p className="text-body italic text-ink-mute">Same requirements as above, plus this visa type&apos;s stated stay/fee terms.</p>
                  )}
                </div>
              </details>
            );
            return (
            <section id="documents" className="mb-12 scroll-mt-24">
              <p className="eyebrow">Documents</p>
              <h2 className="text-section mt-2 text-ink">
                {noVisaShortStay ? `${d.name} visa documents for ${nd} applicants` : `Documents required for ${nd} applicants`}
              </h2>
              <p className="text-body measure mt-2 text-ink-soft">
                {noVisaShortStay
                  ? `No visa documents are needed for a short visit - ${nd} citizens enter ${d.name} with just a valid passport. If you apply for a longer-stay visa, these are the exact documents required, by visa type, from the official visa application centre.`
                  : `The exact documents ${nd} citizens must submit for ${d.name}, by visa type, from the official visa application centre.`}
                {/* One caption for the whole section - previously repeated
                    under the PDF pills inside every accordion. */}
                {/\.pdf/i.test([vfsCommonLines.join("\n"), ...vfsDocs.map((v) => v.documents_required)].join("\n")) &&
                  " Where a visa type links an official PDF checklist, fill in that checklist and submit it with the application form."}
              </p>
              {vfsCommonLines.length > 0 && (
                <div className="card-doc mt-4 px-4 py-3.5 sm:px-5">
                  <p className="mono-chrome mb-2">Required for most visa types below</p>
                  <DocBlocks text={vfsCommonLines.join("\n")} />
                </div>
              )}
              <div className="card-doc mt-4 divide-y divide-line px-4 sm:px-5">
                {visible.map(renderDoc)}
              </div>
              {hidden.length > 0 && (
                <details className="group mt-2.5">
                  <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-[2px] border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show all {vfsDocs.length} visa-type document checklists</span>
                    <span className="hidden group-open:inline">Hide the rest</span>
                    <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <div className="card-doc mt-3 divide-y divide-line px-4 sm:px-5">{hidden.map((v, i) => renderDoc(v, VFS_PREVIEW + i))}</div>
                </details>
              )}
              {vfsCorr?.sourceUrl && (
                <a href={vfsCorr.sourceUrl} target="_blank" rel="noreferrer" className="mono mt-3 inline-flex items-center gap-1 text-[11px] text-ink-mute transition hover:text-ink">via VFS Global ↗</a>
              )}
            </section>
            );
          })()}

          {/* Destination visa types: tourist/business/transit shown directly when
              relevant to the resolved status; every other category (work, student,
              digital nomad, retirement, investment, family, medical) surfaces
              regardless, since e.g. a destination's work or retirement visa is
              useful to know about even on an easy tourist-entry corridor. */}
          {visaTypes.length > 0 && (() => {
            const TRAVELER_CATEGORIES = new Set(["tourist", "business", "transit"]);
            // An e-visa product this nationality is excluded from (per the
            // advance note) must not render an open card with an apply link.
            const touristTypes = visaTypes.filter((v) =>
              TRAVELER_CATEGORIES.has(v.category) &&
              !(eVisaIneligible && /e-?visa|electronic/i.test(`${v.official_url ?? ""} ${v.name}`)));
            const otherTypes = visaTypes.filter((v) => !TRAVELER_CATEGORIES.has(v.category));
            const showTourist = !hasVfs && need && touristTypes.length > 0;
            if (!showTourist && otherTypes.length === 0) return null;
            return (
              <section id="visa-types" className="mb-12 scroll-mt-24">
                {/* The h2 renders whenever the section exists - otherwise the
                    rail's "Visa types" jump link lands on an unlabeled button. */}
                <p className="eyebrow">Visa types</p>
                <h2 className="text-section mt-2 text-ink">{d.name} visa types</h2>
                {showTourist && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {touristTypes.map((v, i) => <VisaTypeCard key={i} v={v} suppressFee={feeList.length > 0} />)}
                  </div>
                )}
                {otherTypes.length > 0 && (
                  <details className={`group ${showTourist ? "mt-8" : "mt-4"}`}>
                    <summary className="mono inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-[2px] border border-line bg-paper-2/70 px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-ink-soft transition hover:border-line-strong hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Other {d.name} visa categories ({otherTypes.length})</span>
                      <span className="hidden group-open:inline">Hide other visa categories</span>
                      <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </summary>
                    <p className="text-body measure mt-3 text-ink-soft">
                      These don&apos;t apply to a typical short visit, but cover other reasons people travel to {d.name}. Eligibility varies by visa type - some are limited to specific nationalities, so check each one&apos;s conditions on the official page.
                    </p>
                    {/* Compact index, not full cards: this catalog is
                        destination-generic and identical on every corridor into
                        {dest} - one ledger line per type keeps the categories
                        discoverable without shipping the same multi-thousand-word
                        blob on dozens of pages. */}
                    <ul className="card-doc mt-4 divide-y divide-line px-4">
                      {otherTypes.map((v, i) => (
                        <li key={i} className="flex min-h-[44px] flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                          <span className="font-display text-[14px] font-medium text-ink">{v.name}</span>
                          <span className="mono flex flex-wrap gap-x-3 text-[11px] text-ink-mute">
                            <span className="uppercase tracking-[0.08em]">{v.category.replace(/_/g, " ")}</span>
                            {v.max_stay_days != null && <span>{v.max_stay_days} days</span>}
                            {v.fee_usd != null && (v.fee_usd === 0 ? <span className="text-vfree">free</span> : <span>~${v.fee_usd}</span>)}
                            {v.online && <span className="text-vfree">online</span>}
                          </span>
                          {v.official_url && (
                            <a href={v.official_url} target="_blank" rel="noreferrer" className="mono ml-auto text-[11px] font-medium text-stamp underline-offset-2 hover:underline">
                              {isAdvisoryUrl(v.official_url) ? "advisory" : "official"} ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-body mt-3 text-ink-soft">
                      <Link href={`/destination/${dest}`} className="font-medium text-stamp underline-offset-2 hover:underline">
                        {d.name} visa policy, fees & entry rules in full →
                      </Link>
                    </p>
                  </details>
                )}
              </section>
            );
          })()}

          {/* FAQ */}
          <section id="faq" className="scroll-mt-24">
            <p className="eyebrow">FAQ</p>
            <h2 className="text-section mt-2 text-ink">
              {d.name} visa for {nd} citizens - FAQ
            </h2>
            <div className="card-doc mt-4 divide-y divide-line px-4 sm:px-5">
              {faq.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                    {q}
                    <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <p className="text-body measure mt-1 mb-3 text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          </div>

          {/* Sticky rail: orientation + action + the related-corridor mesh
              (which previously sat as a full-width farm at the page bottom).
              On mobile this stacks after the FAQ, same reading order as before. */}
          <aside className="mt-14 lg:sticky lg:top-24 lg:mt-0">
            {/* TOC + primary CTA share one document card (spec §14). */}
            <div className="card-doc px-5 py-5">
              {/* Jump nav - desktop only; pointless when the rail is at the bottom */}
              <nav aria-label="On this page" className="hidden lg:block">
                <p className="eyebrow">On this page</p>
                <ul className="mt-3 space-y-0.5 border-l border-line">
                  {jumpLinks.map((j) => (
                    <li key={j.href}>
                      <a href={j.href} className="block border-l-2 border-transparent py-1 pl-3 text-[13px] text-ink-soft transition hover:border-stamp hover:text-ink">
                        {j.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Primary action */}
              {applyUrl ? (
                <a href={applyUrl} target="_blank" rel="noreferrer" className="btn-stamp w-full lg:mt-5">
                  Apply on the official portal ↗
                </a>
              ) : advisoryUrl ? (
                <a href={advisoryUrl} target="_blank" rel="noreferrer" className="btn-stamp-outline w-full lg:mt-5">
                  Read the official advisory ↗
                </a>
              ) : (
                <Link href={`/visit?dest=${d.iso3}&passport=${n.iso3}`} className="btn-stamp w-full lg:mt-5">
                  Check your full options →
                </Link>
              )}
            </div>

            {/* Related corridors */}
            <div className="mt-8">
              <p className="eyebrow">For {nd} citizens</p>
              <ul className="mt-2 space-y-0.5">
                {sameNat.slice(0, 6).map((c) => (
                  <li key={c!.iso3}>
                    <Link href={`/passport/${slug}/${nameToSlug(c!.name)}`} className="flex min-h-[36px] items-center gap-2.5 text-[13.5px] text-ink-soft transition hover:text-ink">
                      <img src={`https://flagcdn.com/w40/${c!.iso2.toLowerCase()}.png`} alt="" loading="lazy" className="h-3 w-[18px] shrink-0 rounded-[2px] border border-line object-cover" /> {c!.name} visa
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <p className="eyebrow">{d.name} visa for</p>
              <ul className="mt-2 space-y-0.5">
                {sameDest.slice(0, 6).map((c) => (
                  <li key={c!.iso3}>
                    <Link href={`/passport/${nameToSlug(c!.name)}/${dest}`} className="flex min-h-[36px] items-center gap-2.5 text-[13.5px] text-ink-soft transition hover:text-ink">
                      <img src={`https://flagcdn.com/w40/${c!.iso2.toLowerCase()}.png`} alt="" loading="lazy" className="h-3 w-[18px] shrink-0 rounded-[2px] border border-line object-cover" /> {DEMONYM[c!.iso3] ?? c!.name} citizens
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
