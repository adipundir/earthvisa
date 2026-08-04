// Shared parser for crawled VFS "documents_required" text: turns a raw
// newline-delimited blob into PDF links, bullet items, short section labels
// ("Document Checklist", "Important Note:") and genuine note paragraphs, so
// every surface that renders this data (the corridor page, the /visit
// explorer) gets the same structure instead of drifting apart. Pure string
// parsing, no JSX and no server-only APIs, so it's safe to import from a
// "use client" component too.

export type DocBlocks = {
  pdfs: { label: string; url: string }[];
  bullets: string[];
  labels: string[];
  notes: string[];
};

// A short, unpunctuated, title-ish line ("Document Checklist", "Important
// Note:") is a section heading the crawl flattened into plain text, not a
// sentence - rendering it identically to a real explanatory paragraph is
// what made checklists read as an undifferentiated wall of text. Heuristic:
// short, doesn't end a sentence, and is either title-cased or ends with a
// colon (a real sentence this short would almost never do both).
export function isLabelLine(line: string): boolean {
  if (line.length > 40 || /[.!?]$/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  const endsWithColon = /:$/.test(line);
  const titleCased = words.length > 0 && words.every((w) => /^[A-Z0-9]/.test(w) || w.length <= 3);
  return endsWithColon || titleCased;
}

export function parseDocBlocks(text: string): DocBlocks {
  const pdfs: { label: string; url: string }[] = [];
  const bullets: string[] = [];
  const labels: string[] = [];
  const notes: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const pdf = /^(.{2,120}?)\s*\(\s*(https?:\/\/\S+?\.pdf[^\s)]*)\s*\)[\s.]*$/i.exec(line);
    if (pdf) {
      let label = pdf[1].replace(/[-:\s]+$/, "").trim();
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
    if (isLabelLine(line)) { labels.push(line); continue; }
    notes.push(line);
  }
  return { pdfs, bullets, labels, notes };
}
