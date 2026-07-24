
## Goal

Make the v2 project workspace usable on a phone (393 px). Three problems today:

1. Header action row (`Upload photos` / `Share` / `Members`) overflows past the right edge.
2. Daily Report control row wraps awkwardly — "Client preview" drops to its own line, "Copy yesterday's statuses" is a long pill, and the day-picker Select is a fixed 280 px.
3. There's no obvious, thumb-friendly way to capture photos on mobile. The existing `Upload photos` button opens a file picker but doesn't feel like a capture mode.

Scope: presentation + a small capture affordance. No schema changes, no changes to upload logic beyond wiring `capture="environment"` on an input.

---

## 1. Project header on mobile (`ProjectShellV2.tsx`)

Today the action cluster is `Upload photos` + `Share` + `Members`, all `size="sm"` with label text. On mobile that busts the viewport.

Change on `< sm` only:
- Title row: keep title on its own row.
- Action row: full-width row **below** the title, three equal columns.
  - `Upload photos` → primary, keeps label ("Upload").
  - `Share` → icon-only (`Share2`), `aria-label="Share"`.
  - `Members` → icon-only (`Users`), `aria-label="Members"`.
- Desktop (`sm+`) keeps the current inline layout with labels — no regression.

Implementation: swap the outer `flex flex-wrap` for a `flex-col sm:flex-row` and add `sm:inline hidden` around the button label spans, matching the pattern already used elsewhere in the app.

## 2. Daily Report toolbar (`DailyReportTab.tsx`, lines 164–208)

Current row: `Day picker (280px)` · `Day status` · `Copy yesterday's statuses` · `Client preview toggle (ml-auto)`.

Mobile redesign:
- Row 1 (full width): Day picker — drop the fixed `w-[280px]`, use `w-full sm:w-[280px]`.
- Row 2: `Day status` label + `AreaStatusPicker` on the left; `Client preview` toggle on the right (`ml-auto`). This is the "hide or move to the yesterday's-status line" ask — we move it here so it always shares a row.
- Row 3 (only when today + can edit): `Copy yesterday's statuses` — full-width button on mobile, inline on desktop. Shorten the label to `Copy yesterday` on `< sm`.
- The "Edit / Client preview" caption text next to the toggle: hide on `< sm` (it duplicates the button label).

No behavior changes to any of the controls.

## 3. Mobile capture entry point

Two-part answer.

### 3a. Non-crew users (Owner / Editor)
`GlobalUploadModal` already accepts files from the OS picker, which on iOS/Android includes "Take Photo". That works but is buried behind a modal. Add a **second, mobile-only affordance** that goes straight to the camera:

- In `ProjectShellV2` header, on `< sm` only, add a `Camera` icon button next to `Upload`.
- It renders a hidden `<input type="file" accept="image/*" capture="environment" multiple />` and clicks it. The resulting files are handed to the same `useUploadModal().open(files)` path the modal uses today (need to confirm the modal accepts pre-selected files; if not, we just open the modal with the picked files staged in local state — a small addition to `UploadModalContext`).
- The button is `size="icon"` so it fits alongside `Upload / Share / Members` without pushing the row over.

### 3b. Crew role
`CrewLanding` (in the same file) is already the mobile capture surface — it auto-opens the upload modal. We keep the auto-open, but:
- Replace the current `Upload photos` primary button with **two stacked buttons**:
  - Primary: **`Take photo`** — the same camera-capture input as 3a. Big, thumb-height (`h-14`), full-width.
  - Secondary: **`Choose from library`** — opens the existing upload modal.
- Copy update: "Point, shoot, done. GPS sorts the photo into the right area automatically."

This turns the crew landing into a real capture mode without changing the underlying upload / EXIF / auto-assign pipeline.

## 4. `MobileProjectToolbar.tsx`

Noting for completeness: this file is unused by v2 (it was for the classic UI). Leaving it alone in this change — happy to delete in a follow-up if you want.

---

## Files touched

- `src/features/projectDetailV2/ProjectShellV2.tsx` — responsive header, mobile camera button, updated `CrewLanding`.
- `src/features/projectDetailV2/tabs/DailyReportTab.tsx` — toolbar reflow for mobile.
- `src/features/upload/UploadModalContext.tsx` — small addition to accept pre-selected files from a capture input (only if the current API doesn't already support it; will confirm on read before editing).

## Out of scope (call out if you want them next)

- Bottom-nav / FAB pattern for the whole app on mobile.
- Rewriting the tab bar (`grid-cols-4`) into a scrollable segmented control.
- Deleting the unused `MobileProjectToolbar.tsx`.
