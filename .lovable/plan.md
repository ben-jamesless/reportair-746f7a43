# Quick wins from the architecture audit

After exploring the codebase, only one of the two "quick wins" is still real work.

## ARCH-004 (annotations table) — nothing to do

The audit was generated against the migration list and assumed `annotations` was still alive. It isn't: migration `20260429092455_…sql` already runs `DROP TABLE IF EXISTS public.annotations CASCADE;`. Confirmed there are no references to `annotations` in `src/`, in `supabase/functions/`, or in `types.ts`. **No change needed.**

## ARCH-003 (duplicate HEIC libraries) — consolidate on `heic-to`

Today three components handle HEIC and they disagree:

- `src/components/PhotoUploader.tsx` — uses `heic2any` only
- `src/components/EventSetup.tsx` — uses `heic2any` only
- `src/components/HeicBackfillButton.tsx` — tries `heic-to`, falls back to `heic2any`

`heic-to` (libheif-js) is more reliable on modern iPhone HEVC files, which is exactly the workflow ReportAir is built for. The fallback pattern in `HeicBackfillButton` was added because the older capture paths still use `heic2any` — once we standardise, the fallback isn't needed.

### Changes

1. **Add a shared helper** `src/lib/heicToJpeg.ts`
   - Single function `convertHeicToJpeg(file: File | Blob, opts?: { quality?: number; fileName?: string })`
   - Dynamic `import("heic-to")` so it stays out of the initial bundle (mirrors the current `heic2any` dynamic import pattern)
   - Returns `{ jpegBlob: Blob, newName: string }`
   - Centralises the `.heic|.heif → .jpg` rename and the `File`-wrapping required by `heic-to`

2. **Switch all three consumers to the helper**
   - `PhotoUploader.tsx` — replace the inline `heic2any` block with `convertHeicToJpeg`
   - `EventSetup.tsx` — same replacement
   - `HeicBackfillButton.tsx` — drop the try/catch fallback, call the helper directly; preserve the existing per-photo error handling so a single failed file still doesn't abort the batch

3. **Remove the dependency**
   - `bun remove heic2any` (also drops it from `package.json` + lockfile)

4. **Verify**
   - `rg "heic2any"` returns no hits anywhere under `src/` or `supabase/`
   - Build passes (typecheck runs automatically)
   - Manual smoke in preview: upload a `.heic` via PhotoUploader, run the HEIC backfill button on a project that has legacy HEIC photos

### Out of scope

- ARCH-001 (ProjectDetail split), ARCH-002 (TanStack Query decision), ARCH-005/006 (auth + profile caching), ARCH-008 (test coverage). These are tracked separately and we agreed to tackle them after the quick wins.

### Risk

Low. `heic-to` is already in production via the backfill button; this just makes it the only path. Bundle size goes down, not up. Worst case is a HEIC file that `heic-to` can't decode — the existing per-file try/catch in each consumer will surface a toast rather than crashing, same as today's `heic2any` failures.
