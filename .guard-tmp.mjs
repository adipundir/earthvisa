import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git status --porcelain -- src/app | awk '{print $2}'", { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

const at = (rev, f) => {
  try { return execSync(`git show ${rev}:${f}`, { encoding: "utf8", maxBuffer: 40e6 }); }
  catch { return ""; }
};

const countAnchors = (s) =>
  (s.match(/<Link\s/g) || []).length + (s.match(/<a\s[^>]*href=["']\/[^"']/g) || []).length;

// FAQ entries: count objects with a `q:`/`question:` key inside a FAQS-ish array.
const countFaq = (s) => (s.match(/^\s*\{\s*q:/gm) || []).length ||
                        (s.match(/question:\s*["'`]/g) || []).length;

const hasMainEntity = (s) => /mainEntity/.test(s);
const mainEntityFromArray = (s) => /mainEntity:\s*FAQ|mainEntity:\s*\w*FAQ\w*\.map|FAQS\.map|FAQ\.map/i.test(s);
const mainEntityEmpty = (s) => /mainEntity:\s*\[\s*\]/.test(s);

console.log("file".padEnd(50), "anchors".padStart(12), "faq".padStart(9), "JSON-LD");
let problems = [];
for (const f of files) {
  const before = at("HEAD", f), after = readFileSync(f, "utf8");
  if (!before) continue;
  const ab = countAnchors(before), aa = countAnchors(after);
  const fb = countFaq(before), fa = countFaq(after);
  const me = hasMainEntity(after);
  const linked = mainEntityFromArray(after);
  const empty = mainEntityEmpty(after);

  const anchorFlag = aa < ab ? " LOST" : "";
  const faqFlag = me && fa < 4 ? " <4!" : (fa < fb ? " cut" : "");
  const ldFlag = empty ? "EMPTY!" : me ? (linked ? "from array" : "INLINE?") : "-";

  if (aa < ab) problems.push(`${f}: anchors ${ab} -> ${aa}`);
  if (me && fa < 4) problems.push(`${f}: FAQ entries ${fa} (<4)`);
  if (empty) problems.push(`${f}: mainEntity is EMPTY`);
  if (me && !linked) problems.push(`${f}: mainEntity may not derive from the FAQ array - check by hand`);

  console.log(f.replace("src/app/", "").padEnd(50),
    `${ab}->${aa}${anchorFlag}`.padStart(12),
    `${fb}->${fa}${faqFlag}`.padStart(9), ldFlag);
}
console.log("\n" + (problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "no guardrail violations detected"));
