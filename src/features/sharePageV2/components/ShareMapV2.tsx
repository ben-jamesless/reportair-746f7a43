import { useEffect, useMemo, useRef, useState } from "react";
import { event as trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import { V2, statusMeta } from "../tokens";
import type { ShareV2DayArea } from "../types";

/**
 * Read-only site map for the v2 share page.
 *
 * Deliberately does NOT load the Google Maps JS SDK: the share page is a
 * public, client-facing artifact and a browser-key/referrer failure renders a
 * visible "didn't load Google Maps correctly" error. Instead we request a
 * single static satellite tile through the server-side `static-map` proxy and
 * draw area boundaries as an SVG overlay using Web Mercator projection.
 */

const W = 640;
const H = 420;

type LatLng = { lat: number; lng: number };

const worldSize = (zoom: number) => 256 * Math.pow(2, zoom);

const projectX = (lng: number, zoom: number) => ((lng + 180) / 360) * worldSize(zoom);

const projectY = (lat: number, zoom: number) => {
  const clamped = Math.max(Math.min(lat, 85.05112878), -85.05112878);
  const rad = (clamped * Math.PI) / 180;
  const merc = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (1 - merc / Math.PI) * (worldSize(zoom) / 2);
};

function featurePoints(f: MapFeature): LatLng[] {
  if (f.kind === "pin") return [{ lat: f.geometry.lat, lng: f.geometry.lng }];
  if (f.kind === "rectangle") {
    const g = f.geometry;
    return [
      { lat: g.north, lng: g.west },
      { lat: g.north, lng: g.east },
      { lat: g.south, lng: g.east },
      { lat: g.south, lng: g.west },
    ];
  }
  return (f.geometry.paths ?? []) as LatLng[];
}

export function ShareMapV2({
  token,
  areas,
  onAreaClick,
}: {
  token: string;
  areas: ShareV2DayArea[];
  onAreaClick?: (areaId: string) => void;
}) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(false);

  // Fires once when the (static) map scrolls into view, so we can measure
  // whether clients engage with it before investing in an interactive map.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || seenRef.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !seenRef.current) {
          seenRef.current = true;
          trackEvent("share_link_map_opened", { area_count: areas.length });
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [features, areas.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: feats } = await supabase.rpc("list_share_map_features" as never, { _token: token } as never);
      if (!alive) return;
      setFeatures((feats ?? []) as unknown as MapFeature[]);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const view = useMemo(() => {
    if (!features || features.length === 0) return null;
    const pts = features.flatMap(featurePoints).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (pts.length === 0) return null;

    const north = Math.max(...pts.map((p) => p.lat));
    const south = Math.min(...pts.map((p) => p.lat));
    const east = Math.max(...pts.map((p) => p.lng));
    const west = Math.min(...pts.map((p) => p.lng));
    const center = { lat: (north + south) / 2, lng: (east + west) / 2 };

    // Largest zoom where the bounding box (plus padding) still fits the frame.
    let zoom = 20;
    const padX = W - 80;
    const padY = H - 80;
    while (zoom > 1) {
      const dx = Math.abs(projectX(east, zoom) - projectX(west, zoom));
      const dy = Math.abs(projectY(south, zoom) - projectY(north, zoom));
      if (dx <= padX && dy <= padY) break;
      zoom -= 1;
    }

    const cx = projectX(center.lng, zoom);
    const cy = projectY(center.lat, zoom);
    const toPx = (p: LatLng) => ({
      x: projectX(p.lng, zoom) - cx + W / 2,
      y: projectY(p.lat, zoom) - cy + H / 2,
    });

    return { center, zoom, toPx };
  }, [features]);

  // Area colour as configured in the ops app (per-feature colour set when the
  // zone was drawn). Falls back to the status colour when unset.
  const colorByArea = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features ?? []) if (f.color) m.set(f.area_id, f.color);
    return m;
  }, [features]);

  const statusByArea = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of areas) m.set(a.area_id, a.status);
    return m;
  }, [areas]);

  if (!features || features.length === 0 || !view) return null;

  const imgSrc = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/static-map?lat=${view.center.lat}&lng=${
    view.center.lng
  }&zoom=${view.zoom}&w=${W}&h=${H}&scale=2`;

  const mapped = new Set(features.map((f) => f.area_id));
  const legend = areas.filter((a) => mapped.has(a.area_id));

  const select = (id: string) => {
    setHighlight(id);
    onAreaClick?.(id);
  };

  return (
    <div
      ref={rootRef}
      className="overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}
    >
      <div className="relative w-full" style={{ backgroundColor: V2.rule }}>
        <img
          src={imgSrc}
          alt="Satellite view of the site with area boundaries"
          className="block w-full"
          style={{ aspectRatio: `${W} / ${H}`, objectFit: "cover" }}
          loading="lazy"
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="presentation"
        >
          {features.map((f) => {
            const meta = statusMeta(statusByArea.get(f.area_id) ?? null);
            const col = f.color || meta.fg;
            const active = highlight === f.area_id;
            const pts = featurePoints(f).map(view.toPx);
            if (pts.length === 0) return null;

            if (f.kind === "pin") {
              const p = pts[0];
              return (
                <circle
                  key={f.id}
                  cx={p.x}
                  cy={p.y}
                  r={active ? 8 : 6}
                  fill={col}
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                  onClick={() => select(f.area_id)}
                />
              );
            }

            const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
            // Centroid of the polygon for the label anchor.
            const centroid = (() => {
              let x = 0, y = 0;
              for (const p of pts) { x += p.x; y += p.y; }
              return { x: x / pts.length, y: y / pts.length };
            })();
            const label = f.label || areas.find((a) => a.area_id === f.area_id)?.name || "";
            return (
              // White halo underneath keeps small boundaries legible against
              // busy satellite imagery; the status colour sits on top.
              <g key={f.id} style={{ cursor: "pointer" }} onClick={() => select(f.area_id)}>
                <polygon
                  points={points}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.9}
                  strokeWidth={active ? 3.5 : 2.5}
                  strokeLinejoin="round"
                />
                <polygon
                  points={points}
                  fill={col}
                  fillOpacity={active ? 0.55 : 0.38}
                  stroke={col}
                  strokeWidth={active ? 2 : 1.25}
                  strokeLinejoin="round"
                />
                {label && (
                  <text
                    x={centroid.x}
                    y={centroid.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontFamily: "'Geist', system-ui, sans-serif",
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      fill: "#ffffff",
                      pointerEvents: "none",
                      textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                      textTransform: "capitalize",
                    }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>


      {legend.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          style={{ padding: "10px 12px", borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          {legend.map((a) => {
            const m = statusMeta(a.status);
            const dot = colorByArea.get(a.area_id) || m.fg;
            const active = highlight === a.area_id;
            return (
              <button
                key={a.area_id}
                type="button"
                onClick={() => select(a.area_id)}
                className="flex items-center gap-1.5 px-2 py-1"
                style={{
                  border: `1px solid ${active ? V2.ink : V2.rule}`,
                  backgroundColor: active ? V2.ink : V2.white,
                  color: active ? "#fff" : V2.soft,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: dot }} />
                {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
