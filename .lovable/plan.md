
# Site Map feature (v2: pins + polygons)

Add a new "Site Map" tab to project detail so organisers can plot each Area as a pin and/or polygon zone on a Google satellite map, and share it read-only with guests.

## Effort estimate
~4–6 focused days. No new vendors — reuses the existing Google Maps connector and browser key.

## User flow

**Owner (edit mode)**
1. Open project → "Site Map" tab.
2. First visit: map auto-centers on the project's `geo_lat/lng` (already stored from Places autocomplete). If missing, prompt to set the event location in Settings.
3. Toggle satellite / hybrid / roadmap.
4. Sidebar lists all Areas. Click an Area → "Add pin" or "Draw zone" (polygon/rectangle).
5. Drag pins to reposition; edit polygon vertices; recolor per Area (reuses `areas` color if we add one, else project color).
6. Autosave on change.

**Guest (share link)**
- Read-only map with all pins + zones. Click a pin/zone → scrolls the share page to that Area's photos/notes.

## Data model

One new table `area_map_features`:

```text
id              uuid pk
project_id      uuid fk projects
area_id         uuid fk areas (cascade delete)
kind            text check in ('pin','polygon','rectangle')
geometry        jsonb   -- pin: {lat,lng}; polygon: {paths:[{lat,lng}...]}
label           text nullable
color           text nullable  -- hex override
created_by      uuid
created_at, updated_at
```

Also add to `projects`:
- `map_zoom int` (default 17)
- `map_type text` (default 'hybrid')
- `map_center jsonb` nullable — falls back to `geo_lat/lng`

RLS mirrors `areas`: project members read/write; share-link viewers read via existing share-link policy pattern.

## Components / files

New:
- `src/features/projectMap/SiteMapTab.tsx` — main container, mode switch (view/edit).
- `src/features/projectMap/SiteMapCanvas.tsx` — Google Map + Drawing Manager, renders features.
- `src/features/projectMap/AreaMapSidebar.tsx` — area list, per-area feature actions.
- `src/features/projectMap/useMapFeatures.ts` — CRUD hook with optimistic updates.
- `src/features/projectMap/featureGeometry.ts` — geometry ↔ jsonb helpers.

Edited:
- `src/lib/googleMaps.ts` — add `drawing` to libraries list.
- `src/pages/ProjectDetail.tsx` — add "Site Map" tab.
- `src/pages/SharePage.tsx` — read-only map section above/below Areas list; clicking a feature scrolls to `#area-{id}`.

## Technical notes

- Use `google.maps.Map` + `google.maps.drawing.DrawingManager` (no `mapId`, per project rules — that's why we can't use `AdvancedMarkerElement`; stick with `Marker` and `Polygon`).
- Polygon editing: `polygon.setEditable(true)` + `setDraggable(true)`, persist on `mouseup` of any vertex path via `path.addListener('set_at'|'insert_at'|'remove_at')`.
- Debounce autosave (500 ms). Optimistic UI; toast on save error.
- Share-link read path: fetch features via existing share-link RPC/policy — no new edge function needed.
- Bounds: on load, `fitBounds` to include all features; fall back to project center + saved zoom.
- All colour, spacing, and typography stay on the existing semantic tokens (no hardcoded hex in components — feature colour comes from `areas.color` or project color token converted at render time).

## Out of scope for v1

- Custom icon library (tents, stages, toilets — OnePlan's "items")
- Measurements / area calc
- Layers, print-ready export, versioning
- ESRI / Mapbox alternates

We can layer any of those in later without changing the schema much (add `icon` and `metadata` cols to `area_map_features`).

## Verification

- Playwright: create project → set location → open Site Map → drop pin → reload → pin persists.
- Share link: open in incognito, confirm features render and clicking scrolls to the right Area.
