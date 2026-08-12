# Live Google map on the v2 share page

Replace the static satellite image + SVG overlay with a real, interactive Google map (drag, scroll zoom, satellite/hybrid imagery), keeping the current look: coloured area polygons, dark chip labels, clickable areas, and the legend strip underneath.

## What changes for the viewer

- The map pans and zooms like Google Maps, with Google's own tiles at every zoom level (no more blurry upscaling past the static image's resolution).
- Areas stay as coloured polygons using the colour set in the ops app, with the same white halo outline and a highlight when selected.
- Labels keep the current v1-style dark chip, constant size at any zoom.
- Clicking a polygon still filters the photos below to that individual area feature; the legend chips still work.
- Map opens fitted to all areas, same as now; zoom controls stay top-right (Google's own controls, styled minimal — no Street View, no map-type switcher clutter).

## Important caveat: custom domains

The Google browser key Lovable manages is restricted to `*.lovable.app` / `*.lovableproject.com`. Share links served from `buildfolder.com` (or `reportair.co`) would show Google's "this page didn't load Google Maps correctly" error. Because of that, this build includes an automatic fallback: if the Google script fails to load or the key is rejected, the map silently reverts to today's static satellite + SVG version. Nothing breaks for clients.

To get the live map on the custom domains, a Google Cloud API key of your own is needed, with `https://buildfolder.com/*`, `https://*.buildfolder.com/*` (and the same for reportair.co) in its referrer allowlist. I can walk you through that afterwards.

## Technical notes

- `ShareMapV2.tsx` splits into `ShareMapV2` (loader + fallback switch), `ShareMapLive` (Google JS API), and `ShareMapStatic` (the current implementation, moved as-is).
- `ShareMapLive` uses the existing `loadGoogleMaps()` helper, `mapTypeId: 'hybrid'`, no `mapId`, `google.maps.Polygon` per feature, `fitBounds` on the combined feature bounds, and a small `OverlayView` subclass for the chip labels so they stay in DOM and keep constant size.
- Pins render as `google.maps.Marker` (per project convention — not AdvancedMarkerElement).
- Selection state, `onAreaClick(areaId, featureLabel)`, legend, colour resolution, and the `share_link_map_opened` analytics event are unchanged and shared by both renderers.
- Static-map edge function and `list_share_map_features` RPC stay as they are (still used by the fallback and elsewhere).
- No schema or backend changes.
