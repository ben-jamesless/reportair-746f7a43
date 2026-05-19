## Goal
Make the cover info cards (TODAY'S OBJECTIVES / ACHIEVEMENTS / TOMORROW / OPEN ISSUES) on **Grid** and **Editorial** PDFs grow vertically to fit all bullet points, instead of clipping at a fixed height.

## Current behavior
Both layouts use a fixed `fieldH = 86` and `.slice(0, maxLines)` truncates content. Long bullet lists get cut off.

## Proposed change
Switch to a two-pass row-based layout:

1. **Measure**: wrap each field's text with `wrapText(...)` to get its line count. Compute per-card height:  
   `cardH = labelGap + lineCount * 11 + paddingBottom`, with a minimum (e.g. 60pt) so short/empty fields don't look cramped.
2. **Row height** = max of the two cards in that row (so left/right cards in a row stay aligned).
3. **Render** each row stacked downward from the top anchor (`fieldsTop` / `dateY - 14`), advancing by `rowH + rowGap`.
4. **Downstream elements shift**: the "PREPARED FOR" block (Grid) and "AREA SUMMARY" block (Editorial) anchor off the actual bottom of the last row instead of a fixed offset.

## Overflow guard
- Cap total fields block at the available vertical space (Grid: down to ~y=120 above bottom bar; Editorial: leave room for Area Summary + date strip).
- If content still exceeds the cap, truncate the last visible line with an ellipsis rather than silently clipping. Acceptable for extreme edge cases (20+ bullets).

## Files
- `supabase/functions/generate-pdf/new-layouts.ts` — `renderEditorialPortraitV1` (cover fields ~line 449) and `renderGridLandscapeV1` (cover fields ~line 810).

## Verification
Deploy `generate-pdf`, regenerate a report with one field containing 5+ bullets and another empty, confirm the tall card grows, the short card matches its row height, and downstream blocks reflow without overlap.
