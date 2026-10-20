# Plans tab — shared build documents

Adds a fourth event tab, **Plans**, plus a "Plans and visuals" card on the client link, following the uploaded brief and the five concept screenshots. Additive only — photos, Library, Daily Report, PDF and existing links are untouched.

## Phase 0 — Audit (report before building)
- Confirm role helpers (`has_project_role`, `is_project_reader`, `is_project_crew`), company/team ownership, existing private buckets and the `share-photo-url` token pattern to reuse.
- List any legacy Folders/Albums/Reference records holding documents, with counts. Nothing is moved automatically.
- Propose a per-file limit (200 MB) for your sign-off.

## Phase 1 — Data and security
- Company-level categories, seeded with the six defaults for every existing and new company.
- Plan files (file or link), versions (revision label, "what changed", optional PDF preview for DWG), linked areas. "To sort" = no category.
- Private `plan-files` bucket, paths scoped by company/event.
- Rules enforced in the database, not just buttons: Owner/Editor edit; Viewer read and download only; Crew no access; Owner-only restore; company-owner-only category management. Soft delete with 30-day restore.
- Client access only through a new server function that checks the link (expiry, revocation), the file's Client switch and current revision, and returns a 5-minute signed URL.

## Phase 2 — Plans tab
- Tab with "New" badge (flag-controlled). Category chips with counts, amber To sort chip (hidden at 0), Area filter, Add link, Add files.
- Grouped list + detail panel (sheet on mobile): preview, inline rename, Upload new revision, Download, Category, Linked areas, "Visible on client link" switch (off by default, blocked for To sort), Version history, Delete.
- Add files dialog: drop zone, type validation, four-column review (File / Category / Area / Revision), "Set for all files", type-only prefill (DWG/DXF → CAD, images → Renders, spreadsheets → Schedule), per-file progress and retry, all added as Internal. Stacked cards on phones, no overflow at 375px.
- Add link dialog (https only) and Upload new revision dialog (label required).
- Company settings: rename, hide, reorder, add categories; hidden categories' files show under Other.

## Phase 3 — Client link
- "Plans and visuals" card under "Area status at a glance": up to 5 latest shared files, viewer with Download, "View all plans (n)" pop-up grouped by category with Area filter. Hidden when nothing is shared. Area photo strips stay photos only. No uploader names, notes or history shown.

## Phase 4 — Verify
- Run the brief's acceptance tests against real data in preview (Editor upload, To sort filing, revisions, Viewer read-only, Crew blocked, client sees only shared current revisions, visibility off stops access). Add small tests for the rules (prefill mapping, To sort, client eligibility). Report pass/fail per test. No publishing until you approve.

## Not building
CAD viewer, Gantt, Drive/Dropbox sync, filename auto-sorting, nested folders, per-event categories, approvals, file comments, separate client portal, prototype sample data or callouts.

## Technical notes
- Tables: `plan_categories` (team_id), `plan_files` (project_id, team_id, category_id nullable, kind, url, current_version_id, client_visible, crew_visible reserved, deleted_at/by), `plan_file_versions`, `plan_file_areas`. GRANTs + RLS reusing existing helpers; indexes on project_id, category_id, deleted_at.
- New edge function `share-plan-files` (list + signed URL) modelled on `share-photo-url`.
- Front end: `src/features/plans/*`, tab added in `ProjectShellV2.tsx`, card in `SharePageV2.tsx` sidebar.
