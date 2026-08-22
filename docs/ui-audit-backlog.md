# UI audit: what is done, and what is left

Four audits were run on 2026-08-22 against the site and the iOS app: the
corridor and passport pages, the destination/programs/rankings group, the
home/shell/guides group, and the iOS app. This file is the part that has not
been implemented yet, so the findings outlive the session that produced them.

Measurements are visible words at 390px, via `node scripts/screenshots.mjs`
(which prints a count per page and writes a full-page PNG). Run the dev server
on 3100 first: `npx next dev -p 3100`.

## Done

| page | before | after |
|---|---:|---:|
| /programs/work-visa | ~31,000 | 819 |
| /programs/student-visa | ~25,000 | folded the same way |
| /guide/proof-of-funds | 4,718 | 2,497 |
| /guide/schengen | 3,075 | 1,501 |
| /rankings/visa-fees | 2,982 | 1,800 |
| /passport/india | 1,235 | 967 |
| /passport/india/united-arab-emirates | 1,141 | 927 |
| /passport/india/japan | 934 | 689 |

Plus: `.mono-chrome` and `.eyebrow` are sentence case sitewide (they set the
label style for roughly 800 elements across the unmigrated templates); the
corridor visa-type list opens on Common rather than on all 44 types, with every
row still in the HTML; the home screen's post-selection viewport is the number
and one action rather than five asks.

## Left, website

Ranked. File paths were accurate on 2026-08-22; line numbers have moved.

1. **`/destination/[slug]` (200+ pages, 897 words each).** Delete the
   openness-judgment intro and the four section ledes ("Passport holders from
   these countries can enter..." - the heading and its count say it). Transit
   lede becomes chips. There is no action above the fold: the only CTA is after
   ~1,900 words. Put `PassportDestinationSearch` under the H1.
2. **`/list/[slug]` (772 words).** Intro restates the H1 number; lede restates
   the h2; two cross-sell paragraphs become a chip row ("+17 with a US visa
   ->"); CTA paragraph becomes the button alone.
3. **`/programs/citizenship-by-investment` (1,934).** 22 cards repeat the table
   directly above them - make them a per-row `<details>`.
4. **`/rankings` (1,859).** The same data three times: a Top 10 ledger, the
   full table, a Bottom 10 ledger. Keep the table, make Top 10 / Bottom 10 chip
   filters on it.
5. **`/destination/europe`.** Three boxed zone paragraphs become three rows
   (Schengen 29 · 90/180 -> guide; UK own policy ->; Ireland own policy ->).
   ETIAS is explained twice.
6. **Guides not yet converted**: etias, gcc-visa, transit-visa, umrah-visa,
   japan-visa-fee-increase-2026, thailand-visa-changes-2026,
   argentina-citizenship, mexico-citizenship,
   applying-from-your-country-of-residence, schengen/[nationality]. The
   treatment is the one already applied to esta/schengen/proof-of-funds:
   paragraphs become bullets or label/value rows, intros and repeated
   disclaimers go, statutes and long lists move to a Sources section or a fold.
7. **`SiteFooter`.** 29 links in four columns on every page, and it breaks to
   one word per line at 390px. Four evergreen guides plus "All guides". Any
   guide dropped from the footer must stay linked from `/guide` - the footer is
   the anti-orphan path.
8. **`Navbar`.** At 390px the last item scrolls off the rail. "Entry check" is
   opaque; "Do I need a visa?" is what it does.
9. **`RankingsTable`.** On mobile it hides the VoA/eTA/e-Visa columns, so
   "Score" is unexplained, and it nests a 75vh scroll. Stack "93 · 30 · 6"
   under the name, as `LedgerList` already does.
10. **Tables with `min-w-[36rem]`** on cbi/easiest/visa-fees, captioned "Scroll
    sideways ->". Ledger rows below `sm`.
11. **`SearchableLedger`** renders a search box per section - five on a
    destination page. One page-level filter.
12. **`.sf-gold`** gradient on the footer credit is a fourth hue. Plain ink.

## Left, iOS

From the app audit, in the order it ranked them. Numbers 1, 13, 15 and part of
6 are done (see `git log`).

2. The VFS checklist is folded by default on the apply screen; it is why people
   open that screen. Render it expanded when loaded, above the other folds.
3. `DocumentField` offers "Take or choose a photo" through PhotosPicker, which
   cannot take a photo. Add a real camera path (`UIImagePickerController`,
   `.camera`, hidden when unavailable so the simulator does not show a dead
   button) and make the pickers 48pt bordered buttons rather than bare red text.
4. `BrowseScreen` calls `dismiss()` before pushing, so Back from a destination
   lands on Home with the search and filter lost.
5. The FactStrip numbers on the home screen are not tappable; a tap should set
   the grid filter and push Browse.
7. No haptics anywhere. `.sensoryFeedback(.selection)` on passport change, chip,
   checklist tick, step advance; `.success` on submit and send.
8. No focus chaining in either form: `.submitLabel(.next)` and a `@FocusState`
   keyed by field so Return moves down the step.
9. A picker with more than four options falls back to a `Menu` - including the
   199-entry nationality list, which cannot be searched or scrolled usefully.
11. Navigation-bar titles and the whole Settings list render in San Francisco,
    not Archivo.
12. `EVSkeleton` exists and is never used; two screens still show a bare
    `ProgressView`.
14. The enquiry thread opens at the top, so the newest reply is below the fold.

## How to check a change

```
npx next dev -p 3100
node scripts/screenshots.mjs /passport/india/japan       # words + PNG
npx tsc --noEmit && npx eslint src
npm run build                                            # prerenders ~3,000 pages
```

The build is the real gate: it renders every corridor page, so a cut that
breaks one of them fails there rather than in production.
