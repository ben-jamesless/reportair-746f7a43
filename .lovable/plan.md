
## Why this is happening (root cause)

All 20 of the affected photos in the database are named `tempImageXXXXXX.jpg` — the temp filename pattern iOS Safari uses when a user picks a photo from the Photos library on iPhone. In that path iOS:

1. Decodes the HEIC (or original JPEG),
2. Re-encodes a fresh JPEG for upload, and
3. **Strips most EXIF metadata** (including `DateTimeOriginal`) before handing the file to Safari.

Our client-side `parseExif()` then finds no date and falls back to `file.lastModified`, which for an iOS-generated temp file is "now" (the moment Safari created the temp). That's why every `captured_at` matches `created_at` to the millisecond.

The existing "Fix photo capture dates" button doesn't help because it re-runs the same browser EXIF parser on the *uploaded* bytes — and those bytes already have no EXIF. So it always reports "unchanged".

Crucially: photos uploaded from **desktop drag-drop** (where EXIF survives) do work correctly — the issue is specific to the iOS Photos picker path.

## The fix

Two parts: (1) make capture-date detection automatic and as robust as possible, and (2) give users a clean recovery path when iOS has destroyed the date before we ever see it.

### 1. Automatic server-side EXIF re-parse on insert

Add a Postgres trigger on `photos` that enqueues a background job (or directly invokes an edge function via `pg_net`) whenever a row is inserted. The edge function:

- Downloads the stored object from the `photos` bucket.
- Parses EXIF server-side using a Deno-compatible EXIF lib (e.g. `https://esm.sh/exifr`).
- If it finds a real `DateTimeOriginal` / `CreateDate`, updates `captured_at` and the rest of the camera fields.
- If it finds nothing, leaves `captured_at` alone (so we don't keep overwriting good data with `now()`).

This means the existing manual "Run" button goes away — capture date is recovered automatically in the background within seconds of upload, with no user action. For desktop-uploaded photos this will work end-to-end. For iOS-stripped uploads it will (correctly) be a no-op.

We will also remove the client-side `lastModified` fallback when the file looks like an iOS temp file (`/^tempImage/`), so that `captured_at` is left `NULL` rather than wrongly set to "now". This makes the "needs a date" state explicit instead of silently lying.

### 2. iOS recovery UX (because EXIF is genuinely gone)

In the upload dialog, when we detect any selected file is an iOS temp-named file *and* EXIF parsing returns no date, show one extra field:

- "Photo date" date picker, defaulting to today, applied to the whole batch.
- Helper text: "Your phone removed the original capture date from these photos. Choose the day they were taken."

That date is written straight into `captured_at` at insert time. No more "everything lands in Today" surprise.

For photos already in the database with the bug (the ~20 the user just uploaded), the existing settings panel grows a new control:

- "Bulk-set capture date for photos missing a real date" → date picker + "Apply to N photos in this project".
- Only targets rows where `captured_at = created_at` (within ~5 seconds) **and** `file_name LIKE 'tempImage%'`, so we don't clobber legitimate same-day uploads.

### 3. Remove the now-redundant manual button

Delete "Fix photo capture dates" from Project settings. The server trigger replaces it, and the bulk-date control above handles the iOS case the old button could never fix anyway.

## Out of scope

- Building a native iOS app to bypass Safari's metadata stripping.
- Forcing HEIC uploads from iOS (would let us read EXIF, but breaks the in-browser HEIC→JPEG flow on desktop Chrome/Firefox and exceeds the scope of "fix the dates").
- Changing how `captured_at` is grouped in the timeline.

## Technical notes

- New edge function `photo-exif-extract` (verify_jwt = false, called by trigger via `pg_net.http_post` with a shared-secret header).
- Migration: trigger on `photos` AFTER INSERT → `pg_net` call; secret stored in Vault. Also adds an index on `(project_id, captured_at)` if not already present.
- `src/lib/photoUtils.ts` `parseExif`: drop the `lastModified` fallback when `file.name` matches `/^tempImage/i`.
- `src/components/PhotoUploader.tsx`: detect "EXIF-less iOS batch" in the confirm dialog; render date picker; pass chosen date into the insert.
- `src/components/ProjectSettingsDialog.tsx` (Details tab): replace "Fix photo capture dates" card with "Set date for photos missing capture date" card.
- Remove `src/components/PhotoDateBackfillButton.tsx` and its mount point.
