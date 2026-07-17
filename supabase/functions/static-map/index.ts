// Proxies Google Static Maps requests through the Google Maps Platform
// connector gateway and returns image bytes. Called via <img src="…"> from
// the events grid, so verify_jwt is disabled. Query params are validated
// and capped; the endpoint only proxies to the staticmap endpoint.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Muted, desaturated style tuned to the Ink / Paper palette used across
// the events grid and Map tab surfaces. Passed as repeated style= params.
const STYLE = [
  "feature:all|element:labels.icon|visibility:off",
  "feature:all|element:geometry|saturation:-100|lightness:5",
  "feature:administrative|element:labels|visibility:off",
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:road|element:geometry|color:0xffffff",
  "feature:road|element:labels|visibility:off",
  "feature:landscape|element:geometry|color:0xfaf8f2",
  "feature:water|element:geometry|color:0xe3dfd4",
  "feature:water|element:labels|visibility:off",
];

function clampNum(raw: string | null, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response("Invalid coordinates", { status: 400, headers: corsHeaders });
    }
    const zoom = Math.round(clampNum(url.searchParams.get("zoom"), 1, 20, 15));
    const w = Math.round(clampNum(url.searchParams.get("w"), 100, 640, 600));
    const h = Math.round(clampNum(url.searchParams.get("h"), 100, 640, 300));
    const scale = clampNum(url.searchParams.get("scale"), 1, 2, 2);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const gmapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!lovableKey || !gmapsKey) {
      return new Response("Maps connector not configured", { status: 503, headers: corsHeaders });
    }

    const params = new URLSearchParams();
    params.set("center", `${lat},${lng}`);
    params.set("zoom", String(zoom));
    params.set("size", `${w}x${h}`);
    params.set("scale", String(scale));
    params.set("format", "jpg");
    params.set("maptype", "satellite");
    // Note: custom `style` params are ignored by Google for satellite/hybrid
    // maptypes, so we omit the muted styling block here.


    const gwUrl = `${GATEWAY_URL}/maps/api/staticmap?${params.toString()}`;
    const upstream = await fetch(gwUrl, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmapsKey,
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      console.error("static-map upstream failed", upstream.status, body);
      return new Response("Upstream error", { status: upstream.status, headers: corsHeaders });
    }

    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
        // Static maps for the same viewport rarely change. Cache aggressively.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (e) {
    console.error("static-map error", e);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
