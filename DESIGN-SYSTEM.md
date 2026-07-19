# Earth Visa Design System — v2 "Instrument" (2026-07-20)

From-scratch reimagining. The prior warm-paper/document identity is dead and must not
leak back in (no cream grounds, no graph-paper texture, no mono-uppercase chrome, no
corner ticks, no faux-stamp rotation). This file is the single source of truth.

## Product thesis

Earth Visa is an instrument that answers one question: **where can you go?**
The interface shows data, not prose. If a sentence can be a number, a chip, or
nothing, it must be. The verdict hits in under one second; supporting facts scan in
five. One obvious action per view; everything else whispers or waits.

## Tokens

- Ground: `#F6F7F9` (cool near-white) · Surfaces: `#FFFFFF` · Hairlines: `#E2E6EB`
- Ink: `#0B0E14` · Secondary: `#525E6E` (AA on all grounds) · Muted: `#8A94A2` (large/meta only)
- **Action accent**: `#2036E8` electric blue — buttons, links, focus, interactive states. Nothing else is blue.
- **Verdict green**: `#0E7F41` — visa-free/positive signals ONLY. Nothing else is green.
- **Change red**: `#D9251C` — pending-change/negative data moments ONLY (the `60→30` cell). Not a UI chrome color.
- Dark mode: **absolute black** ground `#000000` (owner directive); surfaces barely
  lift (`#0A0A0C`-`#141417`), hairlines just-visible, accents use the AA-lifted
  dark variants. Light-first remains the default.
- **Copy rule: no em or en dashes anywhere** (owner directive). Use " - ", a comma,
  a period, or "·". Digit ranges use a plain hyphen (90-180).
- **Accent scarcity rule** (owner directive): the red accent is for interactive
  elements (buttons, links, focus, active states) and change-data moments ONLY.
  Never on decorative chrome: no red borders, rules, dividers, or section edges.
  Roughly one filled red element per viewport; if two compete, demote one.
- Type: **Archivo** (variable, via next/font/google). Display/numerals: weight 800-850,
  width ~115% where supported, tracking -0.02em, tabular figures. UI/body: 400-650.
  NO second family, NO mono anywhere (URLs/timestamps may use 13px Archivo at 500).
  Body 16px/1.6. Sentence case everywhere; uppercase only inside verdict/status chips.
- Radius: 8px inputs/buttons, 12px cards. Shadows: none on static surfaces; a single
  soft shadow allowed on floating elements (dropdowns/dialogs).
- Rules over boxes: prefer hairlines + alignment; cards only when grouping is real.

## Signature patterns

1. **Verdict display**: the answer as display type (green "Visa-free" / ink "Visa required")
   at 96-150px, followed by a giant-numeral fact strip (60 / ₹0 / 1 / 0 style — number
   at 56-72px, label 14px below). Never a paragraph.
2. **Change-as-data**: a pending policy change is a stat cell — `60→30` with the new
   value in change-red and a "Change pending" label — plus labeled readout cells for
   detail (New max stay / Takes effect / Status). Never buried in prose.
3. **Destination grid**: 199 destinations as a dense, scannable grid of compact tiles
   (flag + name + stay), fill-coded: solid green tint = visa-free, green outline =
   on arrival, blue-tinted = eTA/e-visa (online), neutral gray = visa required.
   Every tile links to its corridor page.
4. **The one input**: country inputs are large (56-64px), white, hairline border,
   blue focus ring, concrete placeholder. Never surrounded by helper-text stacks.

## Landing page (the flagship reimagining)

The landing IS the product, not a brochure about it:
- **First viewport, empty state**: slim nav; centered "Where can you go?" (display
  scale) + the passport input directly beneath + one muted "Try: 🇮🇳 India · 🇩🇪 Germany ·
  🇺🇸 US" line. NOTHING else in the viewport. Google-homepage energy.
- **On selection (no navigation, same page transforms)**: the question collapses to a
  compact context row (flag + name + rank chip + change link); the viewport fills with
  the answer: headline stat ("**93**/199 · no embassy visit" with count-up), then the
  destination grid (pattern 3) with level filter chips (All / Visa-free / On arrival /
  Online / Visa required). Tiles click through to corridors. Credentials ("+ add a visa
  you hold") appear only post-selection, quiet.
- **Below the fold** (scrollers + SEO): most-checked routes as compact chips, three
  feature links, FAQ — all minimal, all restyled to this system. All existing links,
  FAQ content, and JSON-LD stay intact.

## Hard constraints

- URLs, routes, SEO metadata, JSON-LD, crawlable content: unchanged.
- Explorer slices architecture: client components must NOT import @/lib/dataset.
- A11y: AA contrast, 24px+ targets, focus-visible, combobox ARIA, keyboard paths.
- Text economy is a gate: measure words before/after; corridor-class pages target
  >85% reduction of visible prose vs the 2026-07-19 versions (data + links remain).
