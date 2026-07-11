// Username + email validation for Earthling claims. v1 has NO auth and no
// email verification (waitlist-style claims) - that must be added before this
// feature ships publicly, but it doesn't block building and testing the loop.

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,18}$/;

// Route names, brand terms and anything confusing/abusable as an identity.
const RESERVED = new Set([
  "admin", "administrator", "api", "earthvisa", "earthling", "earthlings",
  "leaderboard", "visa", "visas", "passport", "passports", "destination",
  "destinations", "rankings", "guide", "guides", "list", "lists", "programs",
  "visit", "about", "privacy", "terms", "support", "help", "official", "staff",
  "mod", "moderator", "root", "www", "mail", "team", "security", "null",
  "undefined", "me", "you", "settings", "profile", "login", "signup",
]);

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function usernameError(u: string): string | null {
  if (u.length < 3) return "At least 3 characters.";
  if (u.length > 19) return "19 characters max.";
  if (!USERNAME_RE.test(u)) return "Letters, numbers, - and _ only; must start with a letter or number.";
  if (RESERVED.has(u)) return "That name is reserved.";
  return null;
}

export function emailError(raw: unknown): string | null {
  const e = String(raw ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Enter a valid email.";
  if (e.length > 254) return "Email too long.";
  return null;
}
