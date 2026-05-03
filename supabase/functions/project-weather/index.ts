// Returns weather for a project on given dates. Public via share token.
// Caches project lat/lng on first geocode. Silently returns {} on any failure.
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

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
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

export async function fetchWeatherRange(lat: number, lng: number, start: string, end: string): Promise<Record<string, DayWeather>> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&start_date=${start}&end_date=${end}&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return {};
    const j = await r.json();
    const d = j?.daily;
    if (!d?.time) return {};
    const out: Record<string, DayWeather> = {};
    for (let i = 0; i < d.time.length; i++) {
      const code = d.weathercode?.[i];
      const cond = WMO[code] ?? null;
      if (cond == null) continue;
      out[d.time[i]] = {
        tmin: Math.round(d.temperature_2m_min?.[i]),
        tmax: Math.round(d.temperature_2m_max?.[i]),
        condition: cond,
        wind: Math.round(d.windspeed_10m_max?.[i]),
      };
    }
    return out;
  } catch { return {}; }
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
