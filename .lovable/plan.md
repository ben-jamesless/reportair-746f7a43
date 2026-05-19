# Editorial + Grid roundness; Portrait logo/wordmark fix

## 1. Editorial Portrait — round the boxes
In `supabase/functions/generate-pdf/new-layouts.ts` `renderEditorialPortraitV1`:

- Cover info cards (TODAY'S OBJECTIVES / ACHIEVEMENTS / TOMORROW / OPEN ISSUES): replace the square `fillRect(..., C.COVER_CELL_BG, C.COVER_CELL_BD, 0.5)` at line 429 with a rounded-corner rectangle (radius ≈ 8pt). Use pdf-lib `drawRectangle({ borderRadius })` or a small `drawRoundedFilledRect` helper.
- Area-page photo tiles: wrap `photoPlaceholder` calls (lines 545, 567) so the underlying tile rectangle gets `borderRadius: 8`. If `photoPlaceholder` paints a background, round it too; clip image inset slightly so it sits inside the rounded frame.

## 2. Grid Landscape — same roundness
In the same file, `renderGridLandscapeV1`:

- Cover info cards (line 786): add `borderRadius: 8` to the `drawRectangle` call.
- Photo-column tiles drawn via `photoPlaceholder` (lines 686, 694): round to radius 6.

(Status pills are already fully rounded — no change.)

## 3. Portrait (portrait_v1) — logo + wordmark
In `supabase/functions/generate-pdf/index.ts`:

- Replace `drawLogomark` (the outlined-square stacked rectangles, lines 205-223) with the favicon-tile mark used in new-layouts: paper tile + ink rear card + orange front card. Easiest path — import `drawFaviconTile` from `./new-layouts.ts` and thread the already-loaded `brandMarkImage` PNG through to `drawWordmark` / `drawBrandHeader` (lines 581-591 + 766).
- Update `drawWordmark` (lines 225-236) so the label reads `BuildSlides` (mixed case) instead of `BUILDSLIDES` all-caps with per-char tracking, matching the login-page lockup. Keep PlusJakartaSans-Bold; drop the manual tracking loop.
- Both cover-page and area-page meta-strip calls (`drawBrandHeader` at lines 605 and 766) pick up the new mark + wordmark automatically.

## 4. Verification
- Deploy `generate-pdf`.
- Generate a fresh test report for each template (portrait / editorial / grid).
- Convert page 1 + an area page of each to images and visually confirm: rounded cards, rounded photo frames, favicon-style mark + "BuildSlides" wordmark on Portrait.

## Technical notes
- pdf-lib's `drawRectangle` supports `borderRadius` directly — no custom path needed for cards.
- `photoPlaceholder` lives in new-layouts.ts; if it doesn't already accept a radius, add an optional `radius` param defaulting to 0 so existing call sites are unaffected.
- `brandMarkImage` is already embedded in `index.ts` (line ~485) and passed to the new-layouts renderers — reuse it for portrait_v1 too.

## Open question
"More rounded" on Editorial/Grid — I'm interpreting this as the **info-field cards and photo tiles** (the status pills are already fully pill-shaped). If you actually meant the status pills or something else, say the word and I'll retarget before implementing.
