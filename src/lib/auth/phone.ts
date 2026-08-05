// Phone number normalisation to E.164.
//
// Mirrors PhoneNumber.normalise in EarthVisaKit/Sources/EarthVisaKit/Auth.swift.
// Both sides must agree, because the client normalises before sending and the
// server normalises again before looking anything up. If they disagreed, a
// number could be issued a code under one form and verified under another, and
// the code would never match.
//
// India is the default country because that is the audience: most people type
// ten bare digits, and rejecting that would make the commonest input look like
// an error. An explicit leading "+" is always honoured, so an international
// number is never silently rewritten into an Indian one.

export function normalisePhone(input: string, defaultCountryCode = "91"): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) {
    // 8 to 15 digits is the practical E.164 range.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  // "919876543210" typed without the plus.
  if (digits.length > 10 && digits.startsWith(defaultCountryCode)) return `+${digits}`;
  // A leading zero is a domestic trunk prefix and is not part of the number.
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+${defaultCountryCode}${digits.slice(1)}`;
  }
  return null;
}
