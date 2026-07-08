## Goal

Accurate event location + weather via Google Maps Platform, plus a small map preview in project settings.

## Steps

1. **Connect Google Maps connector** — one-click, no key handling.

2. **DB migration** — add `geo_place_id text` to `projects` (nullable). Existing `geo_lat`, `geo_lng`, `geo_location_query` stay.

3. **Places Autocomplete on the Event location field**
   - New `src/components/PlacesAutocompleteInput.tsx` using Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions` with a session token, loaded via the browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`).
   - Free-text entry still allowed (fallback for users who don't pick a suggestion).
   - On select: save `event_location` (formatted address), `geo_lat`, `geo_lng`, `geo_place_id`.
   - Small "Verified ✓" hint when `geo_place_id` is set.

4. **Map preview in Project settings → Details**
   - Small, cheap: load Maps JS API async with the browser key + `callback=initMap`, render a ~250px `google.maps.Map` centered on the saved lat/lng with a single `google.maps.Marker`. No `mapId`, no AdvancedMarker.
   - Shown only when `geo_lat`/`geo_lng` exist. Updates when a new place is picked.
   - Effort: ~1 small component (~80 lines), no backend work. Trivial.

5. **Rewrite `supabase/functions/project-weather/index.ts`**
   - Use saved `geo_lat`/`geo_lng` first.
   - Fallback: Google Geocoding API via gateway (`/maps/api/geocode/json`), cache result on the project row.
   - Fetch weather from Google Weather API via gateway (`/weather/v1/...`) — historical + forecast, keeps the existing `{ weather: { "YYYY-MM-DD": {tmin, tmax, condition, wind} } }` response shape so no frontend/report/share changes.
   - Keep Open-Meteo as last-resort fallback so nothing regresses.

6. **No data migration** — legacy projects self-heal: next weather fetch geocodes with Google and caches lat/lng; or the user re-picks the location.

## Files touched

- new `src/components/PlacesAutocompleteInput.tsx`
- new `src/components/LocationMapPreview.tsx`
- `src/components/ProjectEditForm.tsx` (swap location input, show map preview)
- `supabase/functions/project-weather/index.ts` (Google geocode + weather)
- migration adding `geo_place_id`

## Notes / caveats

- Google Maps has a prohibited-territories list (China, Iran, etc.) — irrelevant for you but noting it.
- Browser key is referrer-locked to `*.lovable.app` and `*.lovableproject.com`. For custom domains (`buildfolder.com`, `reportair.co`, `buildslides.com`) the managed key will fail with `RefererNotAllowedMapError` and the map + autocomplete won't work there. Server-side geocoding/weather (via gateway) is unaffected and works on any domain. To make the map + autocomplete work on the custom domains, you'll need your own Google Cloud API key with those domains in the referrer allowlist — I can walk you through that after the build if you want.
