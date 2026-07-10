# Build Folder v3 — Phase 1

Scope: merge Updates + Gallery into a single Daily Report, ship the Overview tab, add `photo_day_hidden`, wire lazy Objectives rollover, and add the "Copy yesterday's statuses" button. All work stays behind `profiles.beta_ui`; classic shell is untouched.

Gate to close phase: Ben runs two consecutive build days exclusively in v2 without falling back.

## 1.1 — Schema (one migration)

New junction table:

```text
photo_day_hidden(
  photo_id uuid,
  project_id uuid,
  date_key text,          -- project-local YYYY-MM-DD
  hidden_by uuid,
  hidden_at timestamptz,
  primary key (photo_id, date_key)
)
```

- Grants: `authenticated` (SELECT/INSERT/DELETE), `service_role` all
- RLS: user must be a project member of `project_id` (matches `photos` policy pattern)
- Index on `(project_id, date_key)` for day-view filters
- No other schema changes — Objectives already live in `day_notes.objectives` / `day_notes.tomorrow_objectives`; area statuses already live in `area_day_status`

## 1.2 — Daily Report tab (the merge)

Replaces the Phase 0 placeholder with the real screen. Single day picker at the top; below it, one scroll:

```text
┌ Day header ─────────────────────────────┐
│ Objectives · Achievements · Open issues │  ← from day_notes
├ Area section (one card per area) ───────┤
│ Status pill · notes · today's photos    │
└─────────────────────────────────────────┘
```

- One `?day=YYYY-MM-DD` param drives the whole tab (removes the two sidebar day pickers)
- Edit / Client-preview toggle: preview renders the same component tree the share page uses so "what you edit is what they get"
- Per-photo "Hide from day" action writes to `photo_day_hidden` — photo stays in Library and area story
- Destructive delete is removed from the Daily Report; it now lives only in Library (Phase 2)
- No separate "day note" concept — Objectives / Achievements / Issues fields on the day header are the note

## 1.3 — Overview tab

Thin dashboard, no per-area pills, no Client Link card:

- Today card: date, weather, one-line status roll-up (`X of Y areas updated today`)
- Recent activity (existing `activity_events` feed, trimmed to last 10)
- Quick actions: Upload · Jump to today's report · Open share link
- Empty-map coach mark when the project has no `areas`: "Draw your site →" links to Map tab

## 1.4 — Lazy Objectives rollover

On first open of today's Daily Report where `day_notes.objectives` is empty:

1. Look up yesterday's `day_notes.tomorrow_objectives` for the same project
2. If present, seed today's `objectives` with those values (editable, one-time seed)
3. Mark the row so we don't reseed if the user clears it

Implementation: a `seed_todays_objectives(project_id, date_key)` RPC called on tab mount when the today row is empty. Idempotent via a `objectives_seeded_at` timestamp on `day_notes`.

## 1.5 — "Copy yesterday's statuses" button

- Button lives on the Daily Report day header, only visible when viewing today
- One click: copies `area_day_status.status` values from the most recent prior day that has any statuses into today, for every area that has no status set today
- Notes are NOT copied (locked decision 4)
- Toast confirms count copied; single undo via a follow-up toast action

RPC: `copy_prior_day_statuses(project_id, date_key)` returns count.

## 1.6 — Share page + Day PDF filtering

- Share page day view filters photos by `photo_day_hidden` for the requested `date_key`
- Day PDF export applies the same filter
- Area story / Library views ignore the table (photo still visible everywhere else)

## 1.7 — Beta shell polish

- v2 top bar keeps the "Beta · Switch back" pill from Phase 0
- Old Updates + Gallery tabs stay mounted in the classic shell — no removal until Phase 5
- Responsive: Daily Report usable at 375px; below 768px show the "best on a bigger screen" banner on Library/Map only (not on Daily Report)

## Files (est.)

- 1 migration (table + grants + RLS + two RPCs)
- `src/features/projectDetailV2/tabs/DailyReportTab.tsx` (real screen)
- `src/features/projectDetailV2/tabs/OverviewTab.tsx` (real screen)
- `src/features/projectDetailV2/dailyReport/` — DayHeader, AreaCard, EditPreviewToggle, CopyYesterdayButton, HidePhotoAction
- `src/hooks/useDayHiddenPhotos.ts`, `src/hooks/useSeedObjectives.ts`
- `src/pages/SharePage.tsx` + PDF export path — apply hidden-photo filter
- Small edits to existing photo components to add the "Hide from day" affordance in the v2 context only

## Out of scope (later phases)

- Library as its own tab with filters/search/unassigned tray → Phase 2
- Upload flow modal with visible GPS sorting → Phase 3
- Map Edit/Live modes + single "+ Add area" + wizard → Phase 4
- Retiring classic shell → Phase 5

## Acceptance

- `beta_ui = true` users can run a full build day inside Daily Report + Overview without opening a classic tab
- Hiding a photo from a day removes it from the share day view + Day PDF and nowhere else
- Today's Objectives seed from yesterday's Tomorrow objectives exactly once, editable after
- "Copy yesterday's statuses" fills only empty statuses, never overwrites, notes untouched
- Zero regression for `beta_ui = false` users
