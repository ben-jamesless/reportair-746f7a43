# Share link v2 — agreed scope

Reference: uploaded `OnShow_ClientReport.html`. Current link is `SharePage.tsx` (~1,700 lines) fed by `resolve_share_link`.

## Non-negotiable: v1 stays live

- `/s/:token` keeps rendering today's `SharePage.tsx`, untouched. No refactors "in passing".
- v2 builds at a parallel route (`/s2/:token`) on the same tokens, so any existing link previews in v2 without reissuing.
- New code in `src/features/sharePageV2/`. Helpers copied, not extracted, until v2 settles.
- New RPCs are additive (`share_meta` / `share_day` / `share_area`); `resolve_share_link` keeps its shape.
- Schema additions are nullable and ignored by v1.
- Switchover is a per-link flag, reversible, v1 kept as fallback.

Exception: the status enum rename (below) is a single migration touching shared data. v1's display map is updated in the same change so it keeps rendering correctly — that is the only v1 file edit in this programme.

## Locked decisions

- **Map:** static Mapbox satellite with an SVG polygon overlay. Not Google JS on a public page. Photo pins off by default, per-link opt-in, centroid-snap considered so exact GPS isn't published.
- **Live:** 60s poll of the meta RPC, no anon realtime.
- **Comments:** behind a button, rate-limited, length-capped, owner moderation view.
- **Payload:** split into `_meta` / `_day` / `_area` rather than one growing blob.
- **PDF:** shares the same layout code path as the share link — not a second renderer.
- **Design system:** the share page is an editorial artifact. Formalise `--radius-app: 0` and `--radius-report: 4px` as tokens. General Sans self-hosted (Fontshare licence permits), subset 600/700/800, one preloaded file.
- **White-label:** one logo, one colour, one contact block — within existing primitives. "On Show" is a customer brand, not a platform feature.

## Status vocabulary — locked

Enum becomes `not_started / in_progress / flagged / delayed / complete`.

Single migration renaming `no_status → not_started`, `on_track → in_progress`, `requires_discussion → flagged`, `concern → delayed`, before any layout work. "No update today" is display-only, derived from last-update timestamp — never an enum value.

Touches: `area_status` enum plus `project_status`, status maps in `StatusTypographic.tsx`, `SharePage.tsx`, `DailyReportTab.tsx`, `SiteMapTab.tsx`, map tinting, the PDF function, and any RPC comparing status literals. Needs a full grep pass, not just the enum.

## Lifecycle mode

`event_phases` is the source of truth for a mode the whole share page runs on: `build / on_show / takedown / filed`. Add `event_lifecycle_mode(event_id, as_of)` as a pure function of today vs phases; the share page picks its layout template from it.

Filed mode is a bug fix, not a new feature: today's links will render "Day X of Y, LIVE" forever after teardown. Filed reuses the same data, drops live cues, switches the primary object from Day to Area, and adds a before/during/after per-Area strip from photos already stored.

## Sequencing

1. **Foundations** — build window, `event_phases`, `event_lifecycle_mode` RPC, status enum rename, payload split into `_meta` / `_day` / `_area`.
2. **Re-layout, Build mode** — masthead, status bar, stat strip, zone cards, sidebar. Existing data only.
3. **Calendar** + `worst_status_for_event_day` RPC.
4. **Map** — static Mapbox + SVG overlay, pins gated per link.
5. **Filed mode** — same components, `mode='filed'` chrome, Area-first landing, before/during/after strip. Ships before On Show because it fixes an existing bug.
6. **On Show mode** — event-day schedule, atmosphere-first photo band, incident model.
7. **Takedown mode** — reverse-progress cues, mostly styling over the Build layout.
8. **PDF parity** — same layout path, all four modes.
9. **White-label polish** within existing brand primitives.

## Remaining risks to watch

- Enum rename is the only irreversible step; it needs the grep pass and a v1 smoke check on an existing share link before anything else lands.
- Mapbox introduces a new vendor and key/billing surface — needs a token with URL restrictions and a per-link render cache.
- On Show mode's incident model is the one genuinely undefined data shape; it needs its own spec before step 6.
- `event_phases` needs an editing surface (project settings) or the calendar and lifecycle modes have no way to be populated. Currently unscoped — flag it into step 1.
