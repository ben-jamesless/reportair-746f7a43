## Goal

Two changes to the live share page (`/s/:token`):

1. Source weather from Google's Weather API (via the Google Maps connector gateway) instead of Open-Meteo.
2. Colour the weather badge by condition so sunny days look sunny, rainy days look wet, etc.

## 1. Switch weather source to Google Weather API

Edit `supabase/functions/project-weather/index.ts`:

- Keep the existing geocoding pipeline (stored `geo_lat/lng` → Google Geocoding → Open-Meteo geocode fallback). That part already works.
- Replace `fetchWeatherRange` (Open-Meteo forecast/archive) with calls to Google's Weather API through the connector gateway:
  - Forecast (dates in the next ~10 days): `GET /weather/v1/forecast/days:lookup?location.latitude=..&location.longitude=..&days=10`
  - History (past dates): `GET /weather/v1/history/days:lookup?location.latitude=..&location.longitude=..&days=N` (Google returns up to ~30 days back)
  - Gateway base: `https://connector-gateway.lovable.dev/google_maps/weather/...` with `Authorization: Bearer $LOVABLE_API_KEY` and `X-Connection-Api-Key: $GOOGLE_MAPS_API_KEY`.
- Map Google's response fields to the existing `DayWeather` shape:
  - `tmin` ← `minTemperature.degrees` (round)
  - `tmax` ← `maxTemperature.degrees` (round)
  - `wind` ← `maxWindSpeed.value` converted to km/h (round)
  - `condition` ← `daytimeForecast.weatherCondition.description.text` (fallback to `type` mapped to a friendly string like "Clear sky", "Partly cloudy", "Rain", "Snow", "Thunderstorm", "Fog")
- Keep a single Open-Meteo fallback only if the Google call fails (network error / non-2xx), so the share page never breaks.
- Preserve the existing response envelope: `{ weather: { "YYYY-MM-DD": { tmin, tmax, condition, wind } } }`. No changes needed on the frontend fetch.
- Surface provider errors (log status + body) but still return `weather: {}` for missing days so the UI degrades gracefully.

No new secrets — the Google Maps connector is already linked and `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY` are available in the function environment.

## 2. Colour the weather badge

Edit `src/pages/SharePage.tsx` (only the `WeatherBadge` component and `weatherIconFor`; nothing else changes):

- Add a `weatherTintFor(condition)` helper returning `{ bg, border, icon, text }` per condition family, using semantic hex tints that read well in both light and dark share themes:
  - Clear / sunny → amber (`#FEF3C7` bg, `#F59E0B` icon)
  - Partly cloudy / mainly clear → soft sky (`#E0F2FE` bg, `#0EA5E9` icon)
  - Cloudy / overcast → neutral slate (`#F1F5F9` bg, `#64748B` icon)
  - Fog → warm grey (`#F5F5F4` bg, `#78716C` icon)
  - Drizzle / rain → blue (`#DBEAFE` bg, `#2563EB` icon)
  - Snow → cool slate (`#E0E7FF` bg, `#6366F1` icon)
  - Thunderstorm → violet (`#EDE9FE` bg, `#7C3AED` icon)
- In dark mode (`dark === true` on the page), swap to a darker translucent version of the same hue (e.g. `bg: rgba(hue, 0.15)`, keep the same icon colour, text stays `body`).
- Update `WeatherBadge` to accept `dark: boolean` and apply the tint to the pill background + border, and to the weather icon (currently muted grey). Temperature text keeps `body` colour so it stays readable; the "·" separators and the wind number stay muted.
- Pass `dark` from `SharePage` where `<WeatherBadge />` is rendered (three call sites: latest-update card, day header in expanded All Days, and single-day header).

No layout / size / typography changes to the badge — just colour.

## Verification

- Deploy the edge function, then hit it with `supabase--curl_edge_functions` for a known token + a mix of past and future dates; confirm Google returns data and the response shape matches. Log any non-OK Google response body so we can spot API-enablement issues in one pass.
- Open the share page in the preview, screenshot the latest-update card and one day header in both light and dark mode; verify the pill picks up the right tint for the current "Clear sky" example and that dark mode remains legible.

## Technical notes

- Google's Weather API requires the "Weather API" to be enabled on the user's Google Cloud project. If the first call returns 403 with `SERVICE_DISABLED`, the function will fall back to Open-Meteo and we'll surface a one-line note in the response (`source: "open-meteo-fallback"`) so we can tell the user to enable it in Cloud Console.
- Wind: Google returns `maxWindSpeed` with a `unit` field — we'll request/normalise to `KILOMETERS_PER_HOUR` via the `unitsSystem=METRIC` query parameter so no client-side conversion is needed.
- No DB migration, no new secrets, no changes to `ProjectEditForm`, and no changes to weather fetch code on the client.
