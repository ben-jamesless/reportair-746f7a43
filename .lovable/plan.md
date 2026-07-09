# Phase 1 — Map & Zones Foundation (Approved)

Scope-locked build plan. Extends the current Google Maps + JSONB stack. No PostGIS, no PDF maps, no measurement tools, no indoor mode. Existing area list workflow stays intact — the map enhances it.

---

## 1. Schema changes

Single migration, additive only, safe for live projects & share links.

```sql
-- Zone identity + color
alter table public.areas
  add column color text,
  add column boundary_source text not null default 'none'
    check (boundary_source in ('none','drawn','imported'));

-- Primary geometry per area
alter table public.area_map_features
  add column is_primary boolean not null default false;

-- Only one primary per area
create unique index area_map_features_one_primary_per_area
  on public.area_map_features (area_id)
  where is_primary;

-- Backfill: promote first polygon/rectangle (else first pin) per area to primary
with ranked as (
  select id, area_id,
    row_number() over (
      partition by area_id
      order by case kind when 'polygon' then 1 when 'rectangle' then 2 else 3 end,
               created_at asc
    ) as rn
  from public.area_map_features
)
update public.area_map_features f
   set is_primary = true
  from ranked r
 where f.id = r.id and r.rn = 1;

-- Backfill: areas.color inherits from primary feature color, else project color, else null
update public.areas a
   set color = coalesce(
     (select color from public.area_map_features f
       where f.area_id = a.id and f.is_primary limit 1),
     (select color from public.projects p where p.id = a.project_id)
   ),
   boundary_source = case
     when exists (select 1 from public.area_map_features f
                   where f.area_id = a.id and f.is_primary
                     and f.kind in ('polygon','rectangle'))
     then 'drawn' else 'none' end;
```

No changes to `projects`, share RPCs, or existing RLS. `area_map_features.color` stays as an optional per-feature override.

---

## 2. RPCs

### `create_zone_with_geometry`
One-shot area + primary feature creation for the setup flow.

```sql
create or replace function public.create_zone_with_geometry(
  _project_id uuid,
  _name text,
  _kind text,          -- 'polygon' | 'rectangle' | 'pin'
  _geometry jsonb,
  _color text default null
) returns uuid            -- returns area_id
language plpgsql security definer set search_path = public as $$
declare
  v_area_id uuid;
  v_sort int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_project_role(auth.uid(), _project_id,
       array['owner'::project_role,'editor'::project_role]) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(sort_order),0)+1 into v_sort
    from public.areas where project_id = _project_id;

  insert into public.areas (project_id, name, sort_order, color, boundary_source, created_by)
  values (_project_id, coalesce(nullif(trim(_name),''),'Zone '||v_sort),
          v_sort, _color,
          case when _kind in ('polygon','rectangle') then 'drawn' else 'none' end,
          auth.uid())
  returning id into v_area_id;

  insert into public.area_map_features
    (project_id, area_id, kind, geometry, color, is_primary, created_by)
  values (_project_id, v_area_id, _kind, _geometry, _color, true, auth.uid());

  return v_area_id;
end $$;

grant execute on function public.create_zone_with_geometry(uuid,text,text,jsonb,text) to authenticated;
```

### `set_primary_map_feature`
Promote/swap primary when users have multiple shapes on one area.

```sql
create or replace function public.set_primary_map_feature(_feature_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_area uuid; v_project uuid;
begin
  select area_id, project_id into v_area, v_project
    from public.area_map_features where id = _feature_id;
  if v_area is null then raise exception 'Feature not found'; end if;
  if not public.has_project_role(auth.uid(), v_project,
       array['owner'::project_role,'editor'::project_role]) then
    raise exception 'Not authorized';
  end if;
  update public.area_map_features set is_primary = false
    where area_id = v_area and is_primary;
  update public.area_map_features set is_primary = true where id = _feature_id;
end $$;

grant execute on function public.set_primary_map_feature(uuid) to authenticated;
```

No change to `list_share_map_features` — clients already receive `area_id` per feature and can filter locally. The share RPC output gains `is_primary` implicitly if we add it to the SELECT list (small edit).

---

## 3. Component / file changes

**New**
- `src/features/projectSetup/MapZonesStep.tsx` — wizard step; reuses `SiteMapCanvas` in draw mode + inline name input on confirm.
- `src/lib/pointInPolygon.ts` — ray-casting helper (`isPointInPolygon(lat, lng, paths)`, `isPointInRectangle(lat, lng, bounds)`), ~40 lines, unit tested.
- `src/features/projectMap/useZoneAutoAssign.ts` — takes photo GPS + areas' primary features, returns best-match `area_id`.

**Edited**
- `src/features/projectMap/useMapFeatures.ts` — add `createZone(name, kind, geometry, color)` calling the new RPC; add `setPrimary(featureId)`; surface `is_primary` in the type.
- `src/features/projectMap/SiteMapCanvas.tsx`
  - Accept `statusByArea: Record<areaId, status>` and tint the primary polygon/rectangle stroke+fill accordingly (reuse `AreaStatusPicker` color map).
  - Accept `highlightedAreaId?: string` — dim non-matching primaries to 30% opacity.
  - Feature color resolution: `feature.color ?? area.color ?? fallbackColor`.
- `src/features/projectMap/SiteMapTab.tsx` — sidebar shows a "Draw on map" CTA next to areas without a primary feature; add small "Set as primary" action in the per-feature row when an area has >1 feature.
- `src/features/projectMap/ShareSiteMap.tsx`
  - Read `?zone=` via `useSearchParams`; pass as `highlightedAreaId`.
  - On feature/legend click, update URL param (replaceState) in addition to calling `onAreaClick`.
- `src/pages/SharePage.tsx`
  - Sync `?zone=` ↔ existing area filter state.
  - Show a "Viewing: <Zone name> · Clear" chip above the photo feed when active.
- `src/components/PhotoUploader.tsx` (or wherever upload calls happen) — after EXIF extract, if `gps_lat/lng` present and no `area_id` chosen, call `useZoneAutoAssign` and pre-select the matched area (user can override).
- `src/components/EventSetup.tsx` (or the current new-project flow) — insert Map & Zones step after venue selection; skippable.
- `src/lib/projectColors.ts` — export the same palette used elsewhere for the zone color picker in setup.

**Not touched**
- `list_share_map_features`, `get_share_project_center`, share auth, RLS policies (aside from function grants), `AreasManager` list UI, `generate-pdf`, `photo-exif-extract`.

---

## 4. User flow changes

**Project setup**
1. Venue (unchanged Places autocomplete).
2. **New: Map & Zones step**
   - Map centers on venue.
   - "Add zone" → pick shape (Zone / Box / Pin) → draw → name inline → confirm.
   - Confirm calls `create_zone_with_geometry`; area appears in right-hand list immediately.
   - "Skip / add later" link → proceeds without zones. Existing text-only area creation still works from Settings.
3. Rest of setup unchanged.

**Project view (Site Map tab)**
- Same layout as today.
- Primary polygons tint by today's `area_day_status` (uses existing color map).
- Clicking a primary zone selects it in the sidebar (existing behaviour) — no layout change in Phase 1.
- Areas without a primary get a "Draw on map" button in the sidebar row.

**Share link**
- Legend chip / map click sets `?zone=<area_id>`.
- Map dims other primaries; photo feed filters to that area; chip "Viewing: <name> · Clear" appears.
- URL is shareable — opening it lands directly in the filtered state.

---

## 5. Acceptance criteria

**Schema & RPCs**
- After migration, every area with ≥1 feature has exactly one `is_primary = true` row.
- `areas.color` is non-null wherever the area or its project had a color previously.
- `create_zone_with_geometry` rejects non-editor callers with `Not authorized`.
- `set_primary_map_feature` guarantees only one primary per area (no race — enforced by unique index).

**Setup flow**
- Drawing + confirming a zone in the wizard creates one `areas` row and one `area_map_features` row with `is_primary=true` in a single network round-trip.
- Skipping the step creates no rows and does not block project creation.
- Existing projects opening Settings → Map & Zones see the same wizard UI, prefilled with existing areas.

**Zone tinting**
- On the Site Map tab, changing an area's status in `AreaStatusPicker` updates the polygon tint within 1s (optimistic).
- Areas without a primary geometry are unaffected (no tint, no error).

**Share filter**
- Opening `/s/<token>?zone=<area_id>` renders the map with that zone highlighted and the photo feed filtered to it, without a second click.
- Clicking a different zone updates the URL (replaceState — no history spam) and re-filters.
- "Clear" chip restores unfiltered state and removes the query param.
- Invalid `zone` param is ignored gracefully (no error, unfiltered view).

**EXIF auto-assign**
- Uploading a photo with GPS inside a primary polygon pre-selects that area.
- User can override before upload completes.
- Photos without GPS, or GPS outside all primaries, behave exactly as today.

**Regression**
- Existing share links continue to render map features unchanged.
- `AreasManager`, area day status, area notes, comments, exports, and PDF generation are byte-identical in output for projects that don't use zones.

---

## 6. Feature flag & rollout

Single client-side flag `mapZonesV1` (env var `VITE_FEATURE_MAP_ZONES_V1`, default `on` in preview, gated in prod):

- **Migration & RPCs:** ship immediately, unflagged. Additive and safe.
- **Setup step, sidebar "Draw on map", status tinting, share `?zone=` filter:** behind the flag.
- **EXIF auto-assign:** behind the flag (falls back to today's manual picker when off).

Rollout:
1. Ship migration; verify backfill counts (`select count(*) from areas where color is null` + `is_primary` uniqueness).
2. Enable flag in preview; internal smoke test on 2–3 live projects (yours).
3. Enable for one pilot customer; watch for 3 days.
4. Enable globally; remove flag one release later.

Rollback: flip flag off — schema stays (additive, no data loss).

---

## 7. Implementation order

Sequenced to minimise risk. Each step ends in a shippable state.

1. **Migration + RPC grants** (`create_zone_with_geometry`, `set_primary_map_feature`, `is_primary`, `areas.color`, `boundary_source`, backfill). No UI change yet. Verify counts.
2. **`useMapFeatures` extensions** — `createZone`, `setPrimary`, `is_primary` in type. Types regen after migration.
3. **`SiteMapCanvas` color resolution** — feature.color ?? area.color ?? fallback. Add `highlightedAreaId` dimming. Add `statusByArea` tinting (no consumer yet).
4. **`SiteMapTab` sidebar** — "Draw on map" CTA + "Set as primary" per-feature action. Wire status tinting from existing `area_day_status` query.
5. **`MapZonesStep`** + insertion into `EventSetup` / project settings. Flagged.
6. **`pointInPolygon` + `useZoneAutoAssign`** + `PhotoUploader` pre-select. Flagged.
7. **Share `?zone=` filter** — `ShareSiteMap` + `SharePage` chip + URL sync. Flagged.
8. **Playwright pass** — setup → draw zone → reload → upload GPS photo → auto-assigned → open share `?zone=` → filtered.
9. Enable flag in preview → pilot → global. Remove flag next release.

Estimated effort: 3–4 focused days for steps 1–7, half a day for verification.
