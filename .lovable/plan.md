# Build Folder v3 — Phase 0

Seven clarifications locked as recommended:

1. Objectives rollover: **lazy** (seed on first open of today's Daily Report when empty)
2. Share render + Day PDF filter photos by `photo_day_hidden`
3. `date_key` stored as **project-local `YYYY-MM-DD`** (matches existing `dayKey`)
4. "Copy yesterday's statuses" copies **statuses only**, not notes
5. Overview tab lands in **Phase 1** alongside Daily Report
6. v2 shell renders the **new 4-tab bar from Phase 0**; each tab points at its current-shell equivalent until the real screen ships
7. Phase 5 flag removal: `beta_ui = true` users just see v2, no data migration

## Phase 0 scope (this plan)

Ship the runway. Zero behaviour change for anyone with `beta_ui = false` (everyone, until we opt them in).

### 0.1 — Schema

Single migration:

- `profiles.beta_ui boolean not null default false`
- Settings toggle reads/writes this column (RLS already covers `profiles`; no new policy needed)

No other tables in Phase 0. `photo_day_hidden` lands in Phase 1 with the Hide-from-day affordance so we don't ship a dead table.

### 0.2 — v2 shell

New route tree, gated by `beta_ui`:

```text
/projects/:id            → if beta_ui then <ProjectDetailV2/> else <ProjectDetail/> (current)
  ├── ?tab=overview      → <OverviewTab/>       Phase 0: placeholder → current summary block
  ├── ?tab=daily         → <DailyReportTab/>    Phase 0: placeholder → current DayReport list
  ├── ?tab=library       → <LibraryTab/>        Phase 0: placeholder → current Gallery
  └── ?tab=map           → <MapTab/>            Phase 0: reuses <SiteMapTab/> as-is
```

- New `ProjectShellV2` component renders the 4-tab bar + tab content router
- Each placeholder tab is a thin wrapper that renders the current-shell component so nothing regresses
- URL uses `?tab=` (not path segments) so deep links, share links, and existing internal links keep working

### 0.3 — Beta opt-in

- Settings → Account: "Try the new project workspace (beta)" toggle bound to `profiles.beta_ui`
- Add a small "Beta" pill in the v2 top bar with a "Switch back" link that flips the flag
- No admin surface needed — self-serve only

### 0.4 — What Phase 0 does NOT touch

- No changes to `photos`, `day_notes`, `areas`, share pages, PDF, or edge functions
- No merge of Updates + Gallery yet (Phase 1)
- No `photo_day_hidden`, no Objectives rollover, no "Copy yesterday's statuses" (all Phase 1)
- Current `/projects/:id` stays the default for every user

### Acceptance

- Users with `beta_ui = false` see zero difference
- Toggling on in Settings reloads `/projects/:id` into `ProjectDetailV2` with the 4-tab bar
- All four tabs render current-shell content without console errors
- Toggling off returns to the current shell

### Files (est.)

- 1 migration
- `src/features/projectDetailV2/ProjectShellV2.tsx` (new)
- `src/features/projectDetailV2/tabs/{Overview,DailyReport,Library,Map}Tab.tsx` (4 new thin wrappers)
- `src/pages/ProjectDetail.tsx` (branch on `beta_ui`)
- `src/pages/Settings.tsx` or account section (toggle)
- `src/hooks/useBetaUi.ts` (new)

## After Phase 0

Phase 1 spec (Daily Report merge, Overview, `photo_day_hidden` + share/PDF filtering, lazy Objectives rollover, "Copy yesterday's statuses") will be written as its own plan once Phase 0 lands and we've clicked around the shell.
