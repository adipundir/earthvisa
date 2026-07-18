# Sitewide Visual/UX Revamp Spec — 2026-07-19

The single source of truth for the revamp waves. Every implementation agent reads this
FIRST and applies it exactly; taste calls not covered here follow its principles.

## Thesis

Commit to the travel-document identity the brand already owns. Today the pages read
near-white, hairline-gray, and timid; the fix is NOT new decoration — it is conviction:
a visible warm-paper ground, document-like surfaces, confident type scale, structured
info blocks, and deliberate mono chrome. Clean, not fancy. UX first: the primary action
or answer belongs in the first screenful on every page, on every viewport.

## What does NOT change (hard constraints)

- URLs, information architecture, content, data, JSON-LD/SEO metadata, and the
  corridor page's section order (visual restyle only — its IA was deliberately fixed).
- Color discipline: exactly 2 semantic accents — stamp red `--stamp` (actions/verdict/
  negative) and vfree green `--vfree` (the one positive signal). voa/eta/evisa stay
  neutral. No new hues. Dark mode parity for every change.
- IBM Plex Sans (display+body) / IBM Plex Mono (chrome only). No new fonts.
- Accessibility floors from the recent audit: AA contrast, 24px+ tap targets,
  focus-visible states, combobox ARIA. Never regress these.
- The 2-accent discipline and existing a11y/perf wins (explorer slices; no client
  dataset imports).

## Foundation tokens (wave 1 — globals.css)

1. **Ground**: the page background becomes true warm paper — `--paper` must be
   *visibly* warm (current #FBF8F2 is right; the problem is sections overriding to
   white). Full-width white section bands are ELIMINATED: the paper ground runs
   edge-to-edge behind everything; white (`--card`) is reserved for document
   surfaces (cards, inputs, tables) sitting ON the paper. Add a reusable
   `.bg-grid-paper` utility: the faint graph-grid texture (~24px cells, ink at
   4-6% opacity) for hero/section grounds — subtle, never behind long body text.
2. **Type scale** (desktop / mobile):
   - Display (page H1): 44-52px / 30-34px, weight 600, tracking -0.01em. Keep the
     italic red accent-word pattern on marketing/tool pages.
   - Section H2: 24-28px / 20-22px, weight 600.
   - Sub H3: 17-18px, weight 600.
   - Body: 16px / 15px, line-height 1.6, max-width ~68ch. (Current ~13-14px body
     reads cramped — this is the single biggest readability lift.)
   - Mono chrome: 11-12px, uppercase, tracking 0.14-0.18em, `--ink-mute`. Mono is
     for labels/eyebrows/meta ONLY, never sentences.
3. **Spacing rhythm**: section padding 64-80px desktop / 40-48px mobile; consistent
   24/16/12/8 inner steps. Kill double-spacing (hairline + padding + margin stacks).
4. **Rules & chrome**: full-width hairlines are demoted — sections open with an
   EYEBROW ROW instead: mono label + short 32px rule fragment (not edge-to-edge),
   optionally with corner registration ticks on document cards. Hairlines survive
   only inside tables/ledgers.
5. **Document card**: the signature surface — `--card` white, 1px `--line-strong`
   border, 2px corner radius (near-square, passport-like), NO shadows. Key cards
   (verdict, stat tiles) may carry a subtle top rule in ink. Everything currently
   "rounded-lg + gray border + white" migrates to this.
6. **Buttons/CTAs**: primary = stamp-filled (white text), secondary = stamp outline,
   both mono uppercase 12px tracked, min-height 44px. One primary per view.

## Component patterns (applied in waves 2)

7. **Verdict block (corridor)**: chip + verdict sentence + 3 stat tiles + policy
   note unify into ONE document card ("the entry stamp card"): status chip rendered
   stamp-like (1px border + slight rotation ≤1deg is allowed here only), verdict
   sentence at 18-20px (not body-size), stat tiles as an internal 3-col ledger row
   (mono label over 20px value, divided by internal hairlines), source line as card
   footer. Mobile: tiles become a 3-col compact row, never a tall stack.
8. **Policy/advisory notes — kill the text wall**: structured block with mono label
   ("POLICY NOTE" / "UPCOMING CHANGE"), a bold one-line lead (the actionable fact),
   then the detail prose at body size, and date/source as mono meta chips. When a
   note contains a pending change, the change gets its own labeled sub-block with a
   date chip — never buried mid-paragraph.
9. **Empty states are teaching states**: never a dead box. Home/visit empty panels
   show 4-6 tappable example chips ("🇮🇳 India → 🇹🇭 Thailand", "🇳🇬 Nigeria → 🇬🇧 UK")
   that fill the inputs on click, plus one mono line of what the user gets.
10. **Tool-first heroes**: home puts the checker IN the hero (desktop: hero copy
    left, tool card right, replacing the decorative passport illustration; mobile:
    one-line hero then the tool, above the fold). /visit: destination input becomes
    the hero element with the H1, other fields follow.
11. **Single-category sections drop per-card badges** (destination page's 96
    VISA-FREE chips): the section header carries the status once; cards show only
    flag/name/stay. Mixed-category sections keep badges.
12. **Card grids → compact ledger rows** where per-item info is thin (flag + name +
    days): 44px-high rows in a document card, 2-3 columns desktop, hairline
    dividers — denser, scannable, fewer borders than the current chunky cards.
13. **Nav (mobile)**: NEVER wraps to two rows. Single row: brand left; horizontally
    scrollable link row (or a compact sheet menu) with the meta chrome ("OFFICIAL
    SOURCES ONLY · UPDATED …") demoted to a slim mono strip below the bar or into
    the footer on mobile. Active-link treatment stays.
14. **Right rail (corridor desktop)**: TOC + CTA stay; restyle to spec (eyebrow
    label, document card, primary CTA). Mobile keeps the chip-strip jump nav.

## Self-QA gate (every wave-2 agent)

Screenshot your templates (desktop 1440 + mobile 390, Playwright against :3100)
BEFORE and AFTER. The after-shots must pass: paper ground visible; body text ≥15px;
one clear primary action in the first screenful; no dead empty states; no text-wall
notes; no two-row mobile nav (wave 1 owns nav, but verify on your pages); AA
contrast maintained. `npx tsc --noEmit` clean, `npm run lint` no new warnings,
verify pages 200 on :3100.
