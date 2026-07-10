# Build Folder v3 — Canonical Plan

Source of truth: `buildslides-backend-ux-plan-4.md` (10 Jul 2026 PM). This file syncs §6 locked decisions, §7 build sequence + build log, §8 screen set. Rationale lives in the source doc.

---

## §6 Locked decisions (1–20)

### Locked 9 July 2026
1. Merge Updates + Gallery into a single **Daily Report**.
2. **No publish step** — shared link updates live as the day is edited. Client-preview toggle retained.
3. **Area status resets daily** — every day starts at "No status" so delays/issues are visible per build day.
4. **Map geometry**: collapsed to a single area object, polygon tool only. No Pin/Box.
5. **Client link two-axis model**: Day view (default, latest day) + Area story (tap polygon → area's full history, before/after slider).

### Locked 10 July 2026
6. **Rebrand to Build Folder** across all surfaces, URLs, and client link.
7. **No event-type templates** in the wizard — areas drawn on the real site.
8. **Overview: Client Link card removed** — Today card extends into that space; view stats fold into Activity feed + compact card in Share/Deliver panel. Per-area pills dropped from the Today card (thin Overview).
9. **Mobile: one role-scoped app, web-first** — crew opens straight into camera; managers get a check-and-nudge pocket view; deep curation stays on desktop. Ship as responsive web, wrap with Capacitor when validated. Client link stays responsive web.

### Locked 10 July 2026 PM (post Lovable engineering review)
10. **Daily status reset stands** — honest per-day record is the positioning. Revisit only on real pill fatigue.
11. **Delete semantics: hide from day** in the Daily Report; destructive delete lives only in the Library, with confirm.
12. **Share / Deliver gets a designed screen** (hi-fi 11): live link + copy/QR, password + named invites (existing share-links infra, no new schema), compact view stats, daily digest email at 18:00, Day PDF + full-record exports, revoke-and-reissue.
13. **Global Reports page deprecated** — retire at Phase 5 with the old shell. Projects list unchanged in this pass.
14. **Terminology: "Area" everywhere** — one user-facing word. "Zone"/"Box" survive only as history. Component names can stay until Phase 0's rename pass.

### Locked 10 July 2026 — pre-build spec gaps
15. **Hide-from-day data model**: `photo_day_hidden(photo_id, project_id, date_key)` junction table.
16. **Daily-reset click cost**: **"Copy yesterday's statuses"** button — one deliberate act per day. Bulk "Set all to On track" rejected. Shortcuts parked.
17. **Objectives rollover: yes** — today's Objectives pre-fill from yesterday's "Tomorrow's objectives", editable.
18. **Role-scoped UI lands in Phase 4** — minimal: crew sees upload/capture only. Mobile app (Phase 5) must not land role-blind.
19. **Beta flag: `profiles.beta_ui` boolean** (not `?ux=v2`) — survives refresh + URL sharing.
20. **Responsive mid-state (Phases 1–4)**: Overview + Daily Report usable at 375px; Library/Map soft-banners below 768px, never a lock-out. Map-skipped events get a "Draw now →" coach on Overview mini-map and Map tab.

Review pushbacks retained: dark days stay visible-but-dimmed on client timeline; Objectives ≠ Achievements (plan vs actual); no carry-forward status.

---

## §7 Build sequence + build log

Guiding principle: current routes keep working until each new surface has been used in anger. Responsive rule Phases 1–4: Overview + Daily Report at 375px; deep curation soft-banners below 768px.

| Phase | Scope | Est. |
|---|---|---|
| **0 — Foundations behind a flag** | `profiles.beta_ui` + `ProjectDetailV2` shell; extract DayReport / PhotoGallery / SiteMapTab / ActivityFeed; "Area" terminology pass | 3–4 days |
| **1 — Daily Report merge** | DailyReportTab (notes + day-scoped photos, one picker); Edit / Client-preview toggle; Copy-yesterday-statuses; Objectives rollover; `photo_day_hidden`; old tabs stay mounted. Gate: two consecutive build days exclusively in v2 | 1 week |
| **2 — Library as first-class tab** | Promote Event Gallery; filters, search, unassigned tray | 3–4 days |
| **3 — Upload flow visible** | Modal streams GPS-sorted results from existing `zoneAssign.ts`; fallback for desktop drops without EXIF | 1 week |
| **4 — Map consolidation + wizard + roles** | Single "+ Add area"; wizard at `/projects/new?wizard=1`; minimal role-scoping (crew → upload/capture) | 1–2 weeks |
| **5 — Retire the old shell** | Remove flag, delete old tab shells, retire global Reports page | — |

### Build log

- **Phase 0 landed 10 July PM** — flag-gated V2 shell (4 tabs + classic escape hatch), shared-module extraction. Punch-list: Map tab terminology missed, fixed with Phase 1 fixes.
- **Phase 1 landed 10 July PM** — Daily Report merge, day picker, copy-yesterday (today only), lazy Objectives rollover (`day_notes.objectives_seeded_at`), `photo_day_hidden` respected by share page + PDF, thin-spec Overview with "Open today's report →".
- **Post-review fixes landed same day** — (1) area-only terminology sweep across v2 + share page; area-only grep added to DoD for every new v2 surface; (2) per-area status chip row removed from Overview; (3) day-level status: `day_notes.day_status` (defaults `no_status`) with picker in Daily Report header, read-only in Overview header.

### Open follow-ups

- **Share-page day chip must read `day_status`** — MUST land before any real client link goes out. Currently orphaned: `day_notes.day_status` is written from the Daily Report header but not surfaced on `SharePage`. Blocker for external delivery in the gate window.
- **Capture-time badges on Daily Report thumbnails** — deferred to Phase 2.
- **Advisory (no action)**: Overview's Objectives + Open Issues cards duplicate the Daily Report — held; first candidates to trim if Overview weight grows.

### Gate in progress

Ben runs two consecutive build days exclusively in v2 before Phase 2.

---

## §8 Screen set (branded hi-fi v3, 10 Jul PM)

1. Event Overview — thin Today card, no Client Link card, no per-area pills
2. Daily Report — edit (merged Updates + Gallery, hide-from-day, one live signal)
3. Client link — day view
   - 3b. Client link — day timeline (dark days dimmed, not hidden)
   - 3c. Client link — area story (before/after slider, full history)
4. Library — grid with filters + Unassigned tray
5. Upload flow — GPS sorter
6. Map — Edit mode (polygon areas only)
7. Map — Live mode with photo counts
8. New event wizard — 4 steps, no templates
9. Mobile capture screen (crew, camera-first)
10. Mobile app — manager overview · daily report · client link on the phone
11. Share / Deliver panel — link · access · view stats · email digest · exports

---

*Build Folder — Every build, filed.*
