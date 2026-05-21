## Three fixes for the share-link page

### 1. Show the project logo (replaces the project name when uploaded)

The project already supports uploading a logo (stored at `projects.logo_path` in the private `export-assets` bucket, used by PDF export). The share-link RPC currently doesn't expose it, and the share page only renders the project name.

**Changes:**

- **DB migration — extend `resolve_share_link`** to add `logo_path` to the project allowlist returned in the payload.
- **New RPC `get_share_logo_url(_token uuid)`** (SECURITY DEFINER, anon executable) that mirrors the existing `get_share_brand_colour` pattern: validates the token, looks up `projects.logo_path`, and returns a 1-hour signed URL via `storage.objects` / `extensions.crypto`. Returning a signed URL keeps the bucket private. *(Alt: if we don't want a new RPC, we can call an edge function — but matching the existing `get_share_brand_colour` RPC is the least new code.)*
- **`src/pages/SharePage.tsx` header (lines 488–497):** after the brand-colour fetch, also call `get_share_logo_url`; store `logoUrl` in state.
  - If `logoUrl` is set → render `<img src={logoUrl} alt={project.name} className="h-10 md:h-12 w-auto max-w-[280px] object-contain" />` **in place of** the `<h1>{project.name}</h1>`. Keep the subtitle line (`HKGC · Hong Kong Golf Club`) below the logo. Keep `document.title` driven by `project.name`.
  - If no logo → unchanged (show the H1 text).

### 2. Status colours — align with the app

The app's canonical palette (`src/lib/projectStatus.ts`, `src/components/AreaStatusPicker.tsx`):

| Status | Colour |
|---|---|
| On track | `#3A6EA5` (blue) |
| Discuss / Requires discussion | `#D94F2A` (orange) |
| Delayed (concern / behind_schedule) | `#C7382A` (red) |
| Complete | `#3A7D44` (green) |
| No status | `#9C9A93` (grey) |

SharePage's `STATUS_META` (lines 71–80) is wrong — `on_track` is `#D94F2A` (orange) and `at_risk`/`requires_discussion` use `#FF8C00`. **Fix:** replace `STATUS_META` with the values above. Update labels to "On track" / "Discuss" / "Delayed" / "Complete" / "No status" to match the rest of the app.

This fixes the orange "On Track" pill in your screenshot (it'll become blue), and the day-row status pill on "Tuesday 19 May 2026".

### 3. Fonts

Confirmed correct. The whole app — including `SharePage.tsx` — inherits `font-sans` = **Geist** (Tailwind config + `index.css`), self-hosted via `@font-face` in `index.html`. SharePage sets no font overrides, so headings, body, and pills all render in Geist. No change needed.

## Out of scope

- Team-level logo (Settings → branding). Per-project `logo_path` is what the user uploaded for this project and what PDF export already uses; sharing the same value gives one consistent brand.
- Dark-mode tweaks on the share page (it forces a white background).

## Verification

- Upload a project logo via Project Settings → reload share link → logo appears in header instead of "Hong Kong Open"; remove logo → name returns.
- On a project with overall status = On track, share link shows a blue pill matching the app.
- PDF export still works (it reads `logo_path` independently).
