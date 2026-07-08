// Returns weather for a project on given dates. Public via share token.
// Geocoding: prefers stored geo_lat/lng (set via Places Autocomplete),
// falls back to Google Geocoding via the connector gateway, then Open-Meteo
// as a last resort. Weather data comes from Open-Meteo, which is accurate
// once the coordinates are correct.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Heavy freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

export type DayWeather = { tmin: number; tmax: number; condition: string; wind: number };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function geocodeGoogle(query: string): Promise<{ lat: number; lng: number } | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!lovableKey || !gmapsKey) return null;
  try {
    const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmapsKey,
      },
    });
    if (!r.ok) { console.log("google geocode http", r.status, await r.text().catch(() => "")); return null; }
    const j = await r.json();
    const hit = j?.results?.[0];
    const loc = hit?.geometry?.location;
    if (!loc) { console.log("google geocode no result", query, j?.status); return null; }
    return { lat: loc.lat, lng: loc.lng };
  } catch (e) { console.log("google geocode err", String(e)); return null; }
}

async function geocodeOpenMeteo(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j?.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lng: hit.longitude };
  } catch { return null; }
}

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const g = await geocodeGoogle(query);
  if (g) return g;
  // Fallbacks: strip venue suffixes, then first word.
  const stripped = query.replace(/\b(Golf Club|Country Club|Club|Resort|Hotel|Stadium|Arena|Centre|Center)\b/gi, "").replace(/\s+/g, " ").trim();
  if (stripped && stripped !== query) {
    const g2 = await geocodeGoogle(stripped);
    if (g2) return g2;
  }
  return await geocodeOpenMeteo(query);
}

// Friendly labels for Google Weather API `weatherCondition.type` enum values.
const GOOGLE_TYPE_LABEL: Record<string, string> = {
  TYPE_UNSPECIFIED: "Clear sky",
  CLEAR: "Clear sky",
  MOSTLY_CLEAR: "Mainly clear",
  PARTLY_CLOUDY: "Partly cloudy",
  MOSTLY_CLOUDY: "Mostly cloudy",
  CLOUDY: "Overcast",
  WINDY: "Windy",
  WIND_AND_RAIN: "Wind and rain",
  LIGHT_RAIN_SHOWERS: "Light rain showers",
  CHANCE_OF_SHOWERS: "Chance of showers",
  SCATTERED_SHOWERS: "Scattered showers",
  RAIN_SHOWERS: "Rain showers",
  HEAVY_RAIN_SHOWERS: "Heavy rain showers",
  LIGHT_TO_MODERATE_RAIN: "Light rain",
  MODERATE_TO_HEAVY_RAIN: "Heavy rain",
  RAIN: "Rain",
  LIGHT_RAIN: "Light rain",
  HEAVY_RAIN: "Heavy rain",
  RAIN_PERIODICALLY_HEAVY: "Rain",
  LIGHT_SNOW_SHOWERS: "Light snow showers",
  CHANCE_OF_SNOW_SHOWERS: "Chance of snow",
  SCATTERED_SNOW_SHOWERS: "Scattered snow",
  SNOW_SHOWERS: "Snow showers",
  HEAVY_SNOW_SHOWERS: "Heavy snow showers",
  LIGHT_TO_MODERATE_SNOW: "Light snow",
  MODERATE_TO_HEAVY_SNOW: "Heavy snow",
  SNOW: "Snow",
  LIGHT_SNOW: "Light snow",
  HEAVY_SNOW: "Heavy snow",
  SNOWSTORM: "Snowstorm",
  SNOW_PERIODICALLY_HEAVY: "Snow",
  HEAVY_SNOW_STORM: "Heavy snowstorm",
  BLOWING_SNOW: "Blowing snow",
  RAIN_AND_SNOW: "Rain and snow",
  HAIL: "Hail",
  HAIL_SHOWERS: "Hail showers",
  THUNDERSTORM: "Thunderstorm",
  THUNDERSHOWER: "Thundershowers",
  LIGHT_THUNDERSTORM_RAIN: "Light thunderstorm",
  SCATTERED_THUNDERSTORMS: "Scattered thunderstorms",
  HEAVY_THUNDERSTORM: "Heavy thunderstorm",
  FOG: "Fog",
  LIGHT_FOG: "Light fog",
  MIST: "Mist",
  HAZE: "Haze",
  SMOKE: "Smoke",
  DUST: "Dust",
  SAND: "Sand",
  ICE: "Ice",
};

const GMAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

type GoogleDay = {
  displayDate?: { year: number; month: number; day: number };
  interval?: { startTime?: string };
  maxTemperature?: { degrees?: number };
  minTemperature?: { degrees?: number };
  daytimeForecast?: {
    weatherCondition?: { type?: string; description?: { text?: string } };
    wind?: { speed?: { value?: number; unit?: string } };
  };
  maxWindSpeed?: { value?: number; unit?: string };
  wind?: { speed?: { value?: number; unit?: string } };
};

function isoFromDisplay(d?: { year: number; month: number; day: number }, fallback?: string): string | null {
  if (d?.year && d?.month && d?.day) {
    return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  }
  if (fallback) return fallback.slice(0, 10);
  return null;
}

function toKmh(value?: number, unit?: string): number | null {
  if (value == null) return null;
  if (!unit || unit === "KILOMETERS_PER_HOUR") return value;
  if (unit === "MILES_PER_HOUR") return value * 1.60934;
  if (unit === "METERS_PER_SECOND") return value * 3.6;
  return value;
}

function mapGoogleDay(g: GoogleDay): { key: string; day: DayWeather } | null {
  const key = isoFromDisplay(g.displayDate, g.interval?.startTime);
  if (!key) return null;
  const tmin = g.minTemperature?.degrees;
  const tmax = g.maxTemperature?.degrees;
  if (tmin == null || tmax == null) return null;
  const cond = g.daytimeForecast?.weatherCondition;
  const condition =
    cond?.description?.text ||
    (cond?.type ? GOOGLE_TYPE_LABEL[cond.type] ?? cond.type.toLowerCase().replace(/_/g, " ") : "Clear sky");
  const windRaw =
    g.maxWindSpeed?.value ??
    g.daytimeForecast?.wind?.speed?.value ??
    g.wind?.speed?.value;
  const windUnit =
    g.maxWindSpeed?.unit ??
    g.daytimeForecast?.wind?.speed?.unit ??
    g.wind?.speed?.unit;
  const wind = toKmh(windRaw ?? 0, windUnit) ?? 0;
  return { key, day: { tmin: Math.round(tmin), tmax: Math.round(tmax), condition, wind: Math.round(wind) } };
}

async function fetchGoogleWeather(
  lat: number,
  lng: number,
  start: string,
  end: string,
): Promise<Record<string, DayWeather>> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!lovableKey || !gmapsKey) return {};
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gmapsKey,
  };
  const out: Record<string, DayWeather> = {};
  const today = todayUTC();
  const pastEnd = end < today ? end : today;
  const futureStart = start > today ? start : today;

  // History: past dates (Google supports up to 30 days back)
  if (start < today) {
    const daysBack = Math.min(30, Math.max(1, daysBetween(start, pastEnd) + 1));
    const url = `${GMAPS_GATEWAY}/weather/v1/history/days:lookup?location.latitude=${lat}&location.longitude=${lng}&days=${daysBack}&unitsSystem=METRIC&pageSize=30`;
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) {
        console.log("google weather history http", r.status, await r.text().catch(() => ""));
      } else {
        const j = await r.json();
        for (const g of (j?.historyDays ?? []) as GoogleDay[]) {
          const m = mapGoogleDay(g);
          if (m && m.key >= start && m.key <= end && !out[m.key]) out[m.key] = m.day;
        }
      }
    } catch (e) { console.log("google weather history err", String(e)); }
  }

  // Forecast: today + future dates (Google supports up to 10 days forward)
  if (end >= today) {
    const daysFwd = Math.min(10, Math.max(1, daysBetween(today, end) + 1));
    const url = `${GMAPS_GATEWAY}/weather/v1/forecast/days:lookup?location.latitude=${lat}&location.longitude=${lng}&days=${daysFwd}&unitsSystem=METRIC&pageSize=10`;
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) {
        console.log("google weather forecast http", r.status, await r.text().catch(() => ""));
      } else {
        const j = await r.json();
        for (const g of (j?.forecastDays ?? []) as GoogleDay[]) {
          const m = mapGoogleDay(g);
          if (m && m.key >= futureStart && m.key <= end && !out[m.key]) out[m.key] = m.day;
        }
      }
    } catch (e) { console.log("google weather forecast err", String(e)); }
  }

  return out;
}

async function fetchOpenMeteoWeather(lat: number, lng: number, start: string, end: string): Promise<Record<string, DayWeather>> {
  const urls = [
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode&start_date=${start}&end_date=${end}&timezone=auto`,
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode&start_date=${start}&end_date=${end}&timezone=auto`,
  ];
  const out: Record<string, DayWeather> = {};
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log("weather http", r.status, url); continue; }
      const j = await r.json();
      const d = j?.daily;
      if (!d?.time) continue;
      for (let i = 0; i < d.time.length; i++) {
        if (out[d.time[i]]) continue;
        const cond = WMO[d.weathercode?.[i]];
        if (!cond) continue;
        const tmin = d.temperature_2m_min?.[i], tmax = d.temperature_2m_max?.[i], wind = d.windspeed_10m_max?.[i];
        if (tmin == null || tmax == null || wind == null) continue;
        out[d.time[i]] = { tmin: Math.round(tmin), tmax: Math.round(tmax), condition: cond, wind: Math.round(wind) };
      }
    } catch (e) { console.log("weather err", String(e)); }
  }
  return out;
}

export async function fetchWeatherRange(lat: number, lng: number, start: string, end: string): Promise<Record<string, DayWeather>> {
  // Prefer Google Weather API via connector gateway.
  const google = await fetchGoogleWeather(lat, lng, start, end);
  // Fill any missing days with Open-Meteo as a safety net (e.g. Google Weather API not enabled,
  // or dates outside Google's supported range).
  const missing: string[] = [];
  const startD = new Date(start + "T00:00:00Z");
  const endD = new Date(end + "T00:00:00Z");
  for (let t = startD.getTime(); t <= endD.getTime(); t += 86400000) {
    const k = new Date(t).toISOString().slice(0, 10);
    if (!google[k]) missing.push(k);
  }
  if (missing.length === 0) return google;
  const fallback = await fetchOpenMeteoWeather(lat, lng, missing[0], missing[missing.length - 1]);
  return { ...fallback, ...google };
}

export function formatWeather(w: DayWeather): string {
  return `${w.tmin}°C – ${w.tmax}°C · ${w.condition} · ${w.wind} km/h wind`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, dates } = await req.json();
    if (!token || !Array.isArray(dates) || dates.length === 0) {
      return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: link } = await supabase.from("share_links").select("project_id, revoked_at, expires_at").eq("token", token).maybeSingle();
    if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) {
      return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: proj } = await supabase.from("projects")
      .select("event_location, geo_lat, geo_lng, geo_location_query")
      .eq("id", link.project_id).single();
    if (!proj?.event_location) {
      return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let lat = proj.geo_lat, lng = proj.geo_lng;
    if (lat == null || lng == null || proj.geo_location_query !== proj.event_location) {
      const geo = await geocode(proj.event_location);
      if (!geo) return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      lat = geo.lat; lng = geo.lng;
      await supabase.from("projects").update({ geo_lat: lat, geo_lng: lng, geo_location_query: proj.event_location }).eq("id", link.project_id);
    }
    const sorted = [...dates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (sorted.length === 0) {
      return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const weather = await fetchWeatherRange(Number(lat), Number(lng), sorted[0], sorted[sorted.length - 1]);
    return new Response(JSON.stringify({ weather }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ weather: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
