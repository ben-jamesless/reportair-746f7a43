## Goal
Make photo grids and share links feel much faster by serving Supabase-transformed thumbnails and mid-size lightbox images instead of full originals. No schema changes, no backfill, no upload-time processing.

## Transform settings
- **Grid thumbnail**: width 400, height 400, resize `cover`, quality 70
- **Lightbox**: width 1600 (no height), resize `contain`, quality 78
- **Original**: used only for PDF export (`generate-pdf`), cover/logo management, and any explicit download action — untouched

## Files to change

### 1. `src/hooks/useSignedUrl.ts` (authenticated app)
- Accept an optional `transform` argument: `{ width, height, resize, quality }`.
- Key the cache by `path + JSON.stringify(transform)` so thumb and lightbox variants coexist.
- Pass `{ transform }` into `supabase.storage.from("photos").createSignedUrl(path, TTL, { transform })`.
- Keep single-file signing (Supabase's `createSignedUrls` bulk API does not accept transforms).
- Export two convenience hooks: `useThumbSignedUrl(path)` and `useLightboxSignedUrl(path)` that pass the standard presets. Keep raw `useSignedUrl(path)` for originals.

### 2. `src/components/PhotoThumb.tsx`
- Switch to `useThumbSignedUrl` (400×400 cover, q70).
- Keep existing IntersectionObserver + lazy `<img>` behaviour.

### 3. `src/components/PhotoLightbox.tsx`
- Switch primary `<img>` to `useLightboxSignedUrl` (1600w, q78).
- Optionally also request the thumb URL and use it as a low-quality placeholder while the full lightbox variant loads (fast perceived swap).

### 4. `src/components/FeedbackPanel.tsx`
- Its inline preview uses `useSignedUrl` at small size → switch to `useThumbSignedUrl`.

### 5. `supabase/functions/share-photo-url/index.ts` (public share)
- Accept optional `variant: "thumb" | "lightbox" | "original"` in the POST body (default `thumb`).
- Map to the same transform presets and pass `{ transform }` to `createSignedUrl`.
- Backwards-compatible: missing variant = thumb (fastest default for the grid).

### 6. `src/pages/SharePage.tsx`
- Update `useShareSignedUrl(token, photoId, variant)` to send `variant`.
- `SharePhotoThumb` and `SharePhotoMiniThumb` request `"thumb"`.
- `ShareLightbox` requests `"lightbox"`; optionally prefetch `"thumb"` first as LQIP.

### 7. Originals kept as-is (documented, not changed)
- `supabase/functions/generate-pdf/index.ts` — PDF needs full quality
- `src/components/CoverPhotoManager.tsx`, `ProjectEditForm.tsx`, `Settings.tsx` — cover/logo/profile uploads
- `share-export-url`, `share-logo-url` — non-photo assets

## Perceived-responsiveness extras (low risk, in scope)
- Reduce initial share-page grid page size from 150 → 60 in `SharePage.tsx` (matches `PhotoGallery.tsx` pattern), with a "Load more" affordance. Cuts first-paint signed-URL requests by ~60%.
- In lightbox, render the cached thumb URL underneath the loading full image so navigation feels instant.

## Constraints / notes on Supabase transforms
- **Pro plan required.** Smart CDN caches transformed variants, so repeat views are cheap; first request per (path, transform) triggers a transform (small latency + counted as an image-transformation invocation for billing).
- `createSignedUrls` (plural) does **not** accept transform options — we continue signing one-by-one, which is what the current code already does.
- Format negotiation (WebP/AVIF) is automatic when the client `Accept` header supports it.

## Verification
- Build + typecheck.
- Manual: open a share link with many photos, confirm image responses are ~20–60 KB (thumbs) instead of multi-MB, and lightbox images are ~150–300 KB.
- Confirm PDF export still uses originals (unchanged code path).

## Sensible next step (not in this pass)
If transform costs or first-hit latency become a concern, move to upload-time thumbnail generation (add `thumb_path`, generate a 400px JPEG client-side during `PhotoUploader` and store alongside the original). That eliminates transform billing entirely but requires a schema change + backfill, which you asked to defer.