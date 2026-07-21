// Pure, self-contained visa-policy negation/passport parsers, extracted from
// scripts/build-dataset.mjs so they can be unit-tested in isolation. Every export
// here depends ONLY on its arguments (no master country list, no module-scope
// state) - name->iso3 resolution (labelToGroup/resolveNatList/strip) stays in
// build-dataset.mjs. These are the exact bug classes the data audit fixed, so they
// carry a golden-corpus test suite (negation-parsers.test.mjs).

// Detect a passport-type-ONLY restriction from the nationality label AND the notes
// ("Diplomatic and service passports only", "no visa required for diplomatic/official…").
// Returns PassportType[] when the waiver is restricted to non-ordinary passports, else [].
// Crucially: if the text explicitly grants ORDINARY passports, it is NOT restricted.
export function restrictedPassportTypes(nationality, notes, level) {
  const nat = (nationality || "").toLowerCase();
  const text = `${nat} ${(notes || "").toLowerCase()}`;
  // Explicit ordinary mention => the rule speaks about ordinary travellers. Matches
  // "ordinary passport" AND "ordinary <nationality> passport" (adjective between),
  // e.g. "Ordinary Indian passport holders are not visa-exempt" (an e-visa grant to
  // ordinary Indians that was wrongly routed to diplomatic-only).
  if (/\bordinary\b[^.]{0,24}\bpassports?\b/.test(text)) {
    // Never fabricate a false VISA-FREE: at the visa_free level, an "ordinary ...
    // passport" mention that ALSO says ordinary holders still need a visa is a
    // diplomatic-only entry, keep it restricted. At every other level (e-visa /
    // VoA / eTA) the ordinary holder genuinely receives THIS document.
    const ordinaryStillNeedsVisa = /ordinary[^.]{0,60}(not\s+visa[\s-]?exempt|must\s+obtain|require|need)/.test(text);
    if (!(level === "visa_free" && ordinaryStillNeedsVisa)) return [];
  }
  const restricted =
    /(diplomatic|service|official)[^.]{0,45}passports?\s+only/.test(text) ||
    /passports?\s+only[^.]{0,30}(diplomatic|service|official)/.test(text) ||
    /\bonly[^.]{0,30}(diplomatic|service|official)[^.]{0,20}passport/.test(text) ||
    /no visa (is )?required for[^.]{0,30}(diplomatic|official|service)/.test(text) ||
    /(diplomatic|service|official)[^.]{0,45}passports? only exempt/.test(text) ||
    /\bcategory d\d?\b[^.]{0,40}(diplomatic|official|service)/.test(text) ||
    (/passport|holder/.test(nat) && /diplomatic|service|official/.test(nat));
  if (!restricted) return [];
  const out = [];
  if (/diplomatic/.test(text)) out.push("diplomatic");
  if (/\bservice\b/.test(text)) out.push("service");
  if (/official/.test(text)) out.push("official");
  return out.length ? [...new Set(out)] : ["diplomatic", "service"];
}

// Does a raw eligible_nationalities value explicitly mean "any nationality" (so a
// passport-type waiver is genuinely global) rather than a NAMED list we simply
// failed to resolve? Only the former may broadcast to all passports - treating an
// unresolved single-country list as "any" is the diplomatic false-positive class.
export function isExplicitAnyNat(raw) {
  if (raw == null) return true;
  const arr = Array.isArray(raw) ? raw : [raw];
  if (arr.length === 0) return true;
  return arr.every((x) => /^\s*(any(_except)?|all(\s+(nationalit\w+|countr\w+|passport\w*|visitors?))?|every\w*|worldwide)\s*$/i.test(String(x)));
}

// Detect "all nationalities EXCEPT …" style entries. Expanding these to ALL passports is the
// classic false-positive (e.g. India shown visa-free to Chile though India is on Chile's
// visa-REQUIRED list). Returns { excepts: string[], externalList: bool } or null.
// The negation cue and the start of the excluded-set clause share one pattern so
// "not on/in/from … the X list" phrasings are caught the same way as "except …".
export const NEG_CUE_RE = /(not listed|not included|not enumerated|no listad|not (?:on|in|from|among|part of)\b|except|excluding|excepto|other than|salvo|unless)/;
export const NEG_CLAUSE_RE = /(?:except|excluding|excepto|other than|salvo|unless|not\s+(?:listed|included|enumerated|on|in|from|among|part of))\s*:?\s*(.+)$/;
export function negationInfo(label) {
  const s = (label || "").toLowerCase();
  // Gate on the negation cue alone. Requiring an all/any/every token too used to
  // miss named-group exclusions like "SADC member countries except Comoros" or
  // "EU member states (except Ireland)" - no all/any/every word, but still a real
  // exclusion that plain expansion (labelToGroup substring match) would ignore,
  // silently granting the excluded country false visa-free access. isAll is still
  // returned below - the call site only falls back to ALL_ISO3 when the label
  // truly says all/any/every; an unrecognized named group ("Commonwealth countries
  // except ...", no group defined for it) must NOT silently expand to everyone.
  if (!NEG_CUE_RE.test(s)) return null;
  const isAll = /\b(all|any|every|todos|todas)\b/.test(s);
  let excepts = [];
  const m = s.match(NEG_CLAUSE_RE);
  if (m) {
    // split into candidate names FIRST ("Burundi and Palestine" must yield two items),
    // then strip filler words from each
    excepts = m[1]
      .split(/[,;/&]|\band\b|\by\b/)
      .map((x) => x.replace(/\b(passport holders?|nationals?|citizens?|countries|nationalities)\b/g, " ").trim())
      .filter((x) => x && x.length > 2);
  }
  // references an external list/decree/annex with no inline names we can resolve
  const externalList = excepts.length === 0 && /\b(list|listad|decreto|decree|annex|regulation|ica|restricted|visa-required)\b/.test(s);
  return { excepts, externalList, isAll };
}

// Structured visa-required list for a country file, in either recorded shape:
// visa_required.nationalities_iso3 (string[]) or visa_required.advance_visa_required ({iso3}[]).
export function visaRequiredIso3(d) {
  const vr = d && d.visa_required;
  if (!vr || typeof vr !== "object") return [];
  if (Array.isArray(vr.nationalities_iso3)) return vr.nationalities_iso3.map((c) => String(c).toUpperCase());
  if (Array.isArray(vr.advance_visa_required)) {
    return vr.advance_visa_required.map((e) => (e && e.iso3 ? String(e.iso3).toUpperCase() : null)).filter(Boolean);
  }
  return [];
}

// A geographically/purpose-limited entry permit ("... Sinai resorts only", "free
// zone only", "border region only") is NOT country-wide visa-free reach. Inverting
// it as full visa-free tells a traveller they can enter anywhere when the waiver
// covers a few resort towns (Egypt granted all 27 EU passports false visa-free from
// a "Sinai Peninsula resorts only" label). Only applied to unstructured (no iso3)
// broad-expansion labels; each nationality's real level still comes from the
// destination's other entries (Egypt's per-EU-state e-visa).
export const GEO_RESTRICTED_RE = /\b(?:resorts?|sinai|red sea|special economic zone|free[\s-]?zone|border (?:region|area|zone|district)|specified (?:area|region|zone|governorate)|designated (?:area|zone))\b[^.]{0,25}\bonly\b|\bonly\b[^.]{0,25}\b(?:resorts?|sinai|free[\s-]?zone)\b/i;
// A platform/scheme the data itself flags as not (yet) operational must not feed
// live reach (Syria's evisa.sy: "All nationalities (not yet operational) ...").
export const NON_OPERATIONAL_RE = /\bnot (?:yet )?operational\b|\bno longer operational\b|\bnon[\s-]?operational\b|\bnot (?:yet )?(?:functional|live|active)\b/i;
