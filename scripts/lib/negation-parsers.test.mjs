// Golden-corpus tests for the visa-policy negation/passport parsers. Each case here
// is a real bug class the data audit caught: false visa-free from "all except X"
// expansion, diplomatic-only rules leaking to ordinary travellers, geo-limited
// resort waivers read as country-wide reach, and non-operational schemes feeding
// live data. Run: node --test scripts/lib/negation-parsers.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  negationInfo,
  isExplicitAnyNat,
  restrictedPassportTypes,
  GEO_RESTRICTED_RE,
  NON_OPERATIONAL_RE,
} from "./negation-parsers.mjs";

test("negationInfo: 'all nationalities except Iran, Israel' -> excepts iran & israel, isAll", () => {
  const info = negationInfo("all nationalities except Iran, Israel");
  assert.ok(info, "expected a negation object, not null");
  assert.equal(info.isAll, true);
  assert.ok(info.excepts.includes("iran"), `excepts=${JSON.stringify(info.excepts)}`);
  assert.ok(info.excepts.includes("israel"), `excepts=${JSON.stringify(info.excepts)}`);
});

test("negationInfo: 'EU member states (except Ireland)' -> excepts ireland (no all/any word)", () => {
  const info = negationInfo("EU member states (except Ireland)");
  assert.ok(info, "named-group exclusion must not be null");
  // parenthetical close-paren is stripped by the length/filler filter
  assert.ok(
    info.excepts.some((x) => x.startsWith("ireland")),
    `excepts=${JSON.stringify(info.excepts)}`,
  );
});

test("negationInfo: 'SADC member countries except Comoros' -> excepts comoros", () => {
  const info = negationInfo("SADC member countries except Comoros");
  assert.ok(info);
  assert.ok(info.excepts.includes("comoros"), `excepts=${JSON.stringify(info.excepts)}`);
});

test("negationInfo: plain label with no negation cue -> null", () => {
  assert.equal(negationInfo("Schengen Area nationals"), null);
  assert.equal(negationInfo(""), null);
  assert.equal(negationInfo(null), null);
});

test("restrictedPassportTypes: 'Diplomatic and service passports only' -> [diplomatic, service]", () => {
  assert.deepEqual(
    restrictedPassportTypes("Diplomatic and service passports only", "", "visa_free"),
    ["diplomatic", "service"],
  );
});

test("restrictedPassportTypes: ordinary e_visa grant is NOT restricted (level-aware guard)", () => {
  const notes =
    "Ordinary Indian passport holders are not visa-exempt (only diplomatic/official passports are visa-free)";
  assert.deepEqual(restrictedPassportTypes("India", notes, "e_visa"), []);
});

test("restrictedPassportTypes: same ordinary text at visa_free level stays restricted (no false visa-free)", () => {
  const notes =
    "Ordinary Indian passport holders are not visa-exempt (only diplomatic/official passports are visa-free)";
  const out = restrictedPassportTypes("India", notes, "visa_free");
  assert.ok(out.length > 0, "must NOT fabricate ordinary visa-free at visa_free level");
  assert.ok(out.includes("diplomatic"), `out=${JSON.stringify(out)}`);
});

test("isExplicitAnyNat: recognises genuine 'any'/'all' tokens", () => {
  assert.equal(isExplicitAnyNat("any"), true);
  assert.equal(isExplicitAnyNat(["all nationalities"]), true);
  assert.equal(isExplicitAnyNat(null), true);
  assert.equal(isExplicitAnyNat([]), true);
});

test("isExplicitAnyNat: a named single-country list is NOT 'any' (false-positive guard)", () => {
  assert.equal(isExplicitAnyNat(["Congo, Republic of the"]), false);
});

test("GEO_RESTRICTED_RE: matches a resort-only Sinai waiver", () => {
  assert.ok(
    GEO_RESTRICTED_RE.test("EU member state nationals visiting Sinai Peninsula resorts only"),
  );
});

test("NON_OPERATIONAL_RE: matches a not-yet-operational scheme", () => {
  assert.ok(NON_OPERATIONAL_RE.test("All nationalities (not yet operational) except Iran"));
});
