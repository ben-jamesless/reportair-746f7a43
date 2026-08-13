# "Show on map" from the share-page lightbox

Add a button in the client share-link photo viewer that drops a pulsing pin on the site map at the spot the photo was taken.

This is a small, frontend-only change — no database or backend work. The photo GPS coordinates are already sent to the share page.

## How it behaves

- In the lightbox (v2 share link), a small **Show on map** button appears next to the photo counter — only when that photo has GPS coordinates.
- Pressing it closes the lightbox, opens the "Site map" section if collapsed, scrolls the map into view, and drops a pulsing dot at the photo's location, centring the map on it (zoomed in a little, keeping the site in view).
- The pin shows a small chip with the photo time and caption; clicking it re-opens that photo in the lightbox. Clicking elsewhere on the map, or opening another photo, clears the pin.
- On the Filed (event record) view the same behaviour applies to reference/area photos.

## Two important caveats

1. **GPS must be shared.** Each share link has a "show photo pins" setting; when it's off the server deliberately strips photo coordinates. The button simply won't appear on those links. If you want it always available, that setting needs turning on per link (or we make it the default).
2. **Photos without GPS.** Many photos (screenshots, edited exports, phones with location off) have no coordinates. Option: fall back to centring on the photo's *area* polygon instead of an exact dot, labelled as approximate. Recommended — say the word and I'll include it.
3. **Static map fallback.** If Google Maps fails to load (custom domains without an own API key), the map falls back to the static satellite image. The pin will still render there as an SVG dot, so the feature keeps working.

## Technical notes

- `SharePageV2.tsx` holds a `focusPoint` state (`{ lat, lng, photoId }`), passed down to `ShareMapV2` and set by a new `onShowOnMap` callback on `ShareLightboxV2`. Setting it also forces `mapOpen` true and calls `scrollIntoView` on the map container.
- `ShareLightboxV2` gains an optional `onShowOnMap?(photo)` prop; the button renders only when `photo.gps_lat != null && photo.gps_lng != null`.
- `ShareMapLive` gains a `focusPoint` prop: on change it `panTo`s, applies a min zoom, and renders a pulsing marker — a small `OverlayView` div with a CSS keyframe ring (constant screen size, same pattern as the existing label overlay). Clicking it fires an `onFocusPhotoClick` back up to re-open the lightbox.
- `ShareMapStatic` gains the same prop and renders the pulsing dot as an absolutely-positioned element using its existing lat/lng → pixel projection.
- Pulse keyframes added once in `src/index.css` using existing tokens; no hardcoded colours in components.
- Optional analytics: `share_link_photo_located` event on button press, alongside the existing `share_link_map_opened`.

## Effort

Roughly a small-to-medium change: 4 files touched, no migrations, no edge function changes.
