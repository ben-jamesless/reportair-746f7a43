# "Show on map" from the share-page lightbox

Add a button in the client share-link photo viewer that drops a pulsing pin on the site map at the spot the photo was taken. Small, frontend-only change — the photo coordinates are already sent to the share page.

## How it behaves

- In the lightbox, a small **Show on map** button sits next to the photo counter, shown only when that photo has coordinates.
- Pressing it closes the lightbox, opens the "Site map" section if collapsed, scrolls the map into view, centres on the photo and drops a pulsing dot there.
- The dot carries a small chip with the photo time/caption; clicking it re-opens that photo. Clicking elsewhere on the map, or opening another photo, clears it.
- Same behaviour on the Filed (event record) view.

## Two caveats

1. **GPS must be shared.** Each share link has a "show photo pins" setting; when it's off the server strips photo coordinates, so the button won't appear on those links.
2. **Photos without GPS** (screenshots, edited exports, location off) can optionally fall back to centring on the photo's area polygon, labelled approximate. Recommended — say if you want it.

Fallback map (static satellite, used when Google Maps can't load on custom domains) gets the same pulsing dot, so the feature keeps working there.

## Technical notes

- `SharePageV2.tsx` holds `focusPoint` state (`{ lat, lng, photoId }`) passed to `ShareMapV2`, set by a new `onShowOnMap` callback from `ShareLightboxV2`; setting it forces `mapOpen` true and scrolls the map container into view.
- `ShareLightboxV2` gains optional `onShowOnMap?(photo)`; button renders only when `gps_lat`/`gps_lng` are non-null.
- `ShareMapLive` gains `focusPoint`: pans, applies a minimum zoom, and renders a pulsing marker as a small `OverlayView` div with a CSS ring animation (constant screen size, same pattern as the existing label overlay). Clicking it calls back to re-open the lightbox.
- `ShareMapStatic` renders the same dot via its existing lat/lng → pixel projection.
- Pulse keyframes added once in `src/index.css` using existing tokens; no hardcoded colours in components.
- Optional analytics event `share_link_photo_located`, alongside the existing `share_link_map_opened`.

## Effort

Small-to-medium: 4 files, no migrations, no edge function changes.
