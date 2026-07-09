# Phase 2 · Item 1 — Assignment transparency & recovery

Goal: make it obvious, per photo, **how** a photo landed in its zone (GPS auto vs manual), and give a fast recovery path when auto-assignment is wrong or missing. Small, additive UI — no rework of the gallery.

## Scope (in)
- Record assignment provenance on each photo: `gps_auto`, `manual`, or null (unassigned/legacy).
- Subtle "Auto" indicator on thumbnails and in the lightbox when a photo was GPS-assigned.
- One-click "Change zone" in the lightbox that flips provenance to `manual`; ensure the existing bulk move path also stamps `manual`.
- New gallery filter chip **"Unassigned · has GPS"** so users can quickly triage photos that didn't match any primary zone.

## Scope (out — deferred)
- Server-side re-parse auto-assign (that's item 2).
- Backfill of historical `area_id` values.
- Confidence scores, multi-zone suggestions, map-picker reassignment UI.

## Proposed UX
1. **Thumbnail badge**: small map-pin icon in one corner when `assignment_source = 'gps_auto'`. Tooltip: "Auto-assigned by GPS". Nothing shown for manual (default assumption) or null.
2. **Lightbox**: existing zone chip gains a "· Auto" suffix when GPS-assigned. Inline "Change zone" dropdown (zones + Unassigned) writes `area_id` and sets `assignment_source = 'manual'`.
3. **Gallery filter row**: new "Unassigned · has GPS" chip appears only when the project has ≥1 primary zone AND ≥1 photo matches. Clicking filters to those photos for triage.
4. **Upload toast**: unchanged — keep the loop quiet.

## Data changes
Single schema migration:
- Add `photos.assignment_source text` (nullable). Allowed values: `'gps_auto' | 'manual' | null`.
- No new index needed — filtering is scoped within a project's already-fetched photo list.
- No RLS changes (photos already project-scoped).

Uploader writes:
- `'gps_auto'` when the client-side zone match fires.
- `'manual'` when the user explicitly picked an area at upload.
- `null` when Unassigned and no match.

## Files / components affected
- New migration adding the column.
- `src/components/PhotoUploader.tsx` — stamp `assignment_source` on insert.
- `src/lib/projectDetailTypes.ts` + `src/features/projectDetail/useProjectDetail.ts` — include column in the Photo type and select list.
- `src/components/PhotoThumb.tsx` — corner GPS badge.
- `src/components/PhotoLightbox.tsx` — "· Auto" suffix + inline "Change zone" dropdown that stamps `manual`.
- `src/features/projectDetail/SelectionToolbar.tsx` — confirm the bulk reassignment path also writes `'manual'`.
- `src/features/projectDetail/PhotoGallery.tsx` — add the "Unassigned · has GPS" filter chip.
- Share page: no changes (read-only surface ignores provenance).

## Edge cases
- Legacy photos: `assignment_source = null` → treated as manual for display, no badge, no backfill.
- Auto-assigned photo dragged/reassigned → becomes `manual`, badge disappears.
- User reassigns to the same zone the auto pick chose → still recorded as `manual` (intent preserved).
- Photo has GPS but no primary zones exist yet → stays unassigned/null; filter chip hidden until a primary zone exists.
- iOS-stripped uploads (no GPS) → null source, never appears in the new filter chip.
- Server re-parse (item 2, later) can reuse the same `gps_auto` value without any schema change.

## Delivery order
1. Migration: add `assignment_source` column.
2. Uploader: stamp `gps_auto` / `manual` on insert.
3. Type + fetch query: include the new column.
4. Read-only surfaces first: thumb badge + lightbox "· Auto" suffix.
5. Write surfaces: lightbox "Change zone" dropdown; verify bulk toolbar path stamps `manual`.
6. Gallery "Unassigned · has GPS" filter chip.
7. Manual pass: upload inside/outside a zone, reassign, confirm badge disappears, confirm filter chip behavior.
