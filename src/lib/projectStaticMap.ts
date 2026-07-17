/**
 * Builds the URL for the `static-map` edge function that proxies Google
 * Static Maps through the connector gateway and returns image bytes.
 * Returns null when there's no location to render.
 */
export function projectStaticMapUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  zoom?: number | null;
  width?: number;
  height?: number;
}): string | null {
  const { lat, lng, zoom, width = 600, height = 300 } = opts;
  if (lat == null || lng == null) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return null;
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    w: String(width),
    h: String(height),
  });
  if (zoom != null) params.set("zoom", String(zoom));
  return `${base}/functions/v1/static-map?${params.toString()}`;
}
