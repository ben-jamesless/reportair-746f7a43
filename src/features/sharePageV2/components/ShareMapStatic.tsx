import { useEffect, useMemo, useRef, useState } from "react";
import { event as trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import { V2, statusHex, STATUS_SEVERITY, normaliseStatus } from "../tokens";
import { resolveLabelCollisions } from "./ShareMapLive";

import type { ShareV2DayArea } from "../types";
import { StatusMapKey } from "./StatusMapKey";

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

export function ShareMapStatic({
  token,
  areas,
  onAreaClick,
  focusPoint,
  onFocusClick,
}: {
  token: string;
  areas: ShareV2DayArea[];
  onAreaClick?: (areaId: string, featureLabel?: string) => void;
  focusPoint?: { lat: number; lng: number; photoId: string; label?: string } | null;
  onFocusClick?: (photoId: string) => void;
}) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  // Selection is per drawn feature, not per area group: several features can
  // share one area (category), and clicking one should only highlight that one.
  const [highlight, setHighlight] = useState<{ featureId: string | null; areaId: string } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [tf, setTf] = useState({ s: 1, x: 0, y: 0 });

  // Wheel/pinch zoom anchored at the cursor. Attached natively because React's
  // onWheel is passive, so preventDefault() there is ignored.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setTf((p) => {
        const s = Math.min(6, Math.max(1, p.s * Math.exp(-dy * 0.0015)));
        const k = s / p.s;
        const x = px - (px - p.x) * k;
        const y = py - (py - p.y) * k;
        return {
          s,
          x: Math.min(0, Math.max(r.width - r.width * s, x)),
          y: Math.min(0, Math.max(r.height - r.height * s, y)),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [features]);


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


  const statusByArea = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of areas) m.set(a.area_id, a.status);
    return m;
  }, [areas]);

  if (!features || features.length === 0 || !view) return null;

  const imgSrc = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/static-map?lat=${view.center.lat}&lng=${
    view.center.lng
  }&zoom=${view.zoom}&w=${W}&h=${H}&scale=2`;

  // Label de-collision, shared with the live Google map so the interactive
  // view and this fallback (also used for print/PDF) hide the same labels.
  // Boxes are measured in screen space: labels are counter-scaled, so their
  // on-screen size is constant while their position follows the pan/zoom.
  const labelCandidates = features
    .map((f) => {
      const pts = featurePoints(f).map(view.toPx);
      if (pts.length === 0) return null;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const label = f.label || areas.find((a) => a.area_id === f.area_id)?.name || "";
      if (!label) return null;
      const w = label.length * 7.5 + 16;
      const h = 22;
      const sx = cx * tf.s + tf.x;
      const sy = cy * tf.s + tf.y;
      const severity = STATUS_SEVERITY[normaliseStatus(statusByArea.get(f.area_id) ?? null)];
      return {
        id: f.id,
        label,
        cx,
        cy,
        hidden: false,
        severity: f.kind === "pin" ? severity - 0.5 : severity,
        sortName: label.toLowerCase(),
        rect: { left: sx - w / 2, top: sy - h / 2, right: sx + w / 2, bottom: sy + h / 2 },
        setHidden(v: boolean) {
          this.hidden = v;
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  resolveLabelCollisions(labelCandidates);
  const labelPlacements = labelCandidates;

  const mapped = new Set(features.map((f) => f.area_id));

  const legend = areas.filter((a) => mapped.has(a.area_id));

  const select = (areaId: string, featureId: string | null, label?: string) => {
    setHighlight({ featureId, areaId });
    onAreaClick?.(areaId, label);
  };

  const MIN_S = 1;
  const MAX_S = 6;
  const clampT = (s: number, x: number, y: number, w: number, h: number) => ({
    s,
    x: Math.min(0, Math.max(w - w * s, x)),
    y: Math.min(0, Math.max(h - h * s, y)),
  });

  return (
    <div
      ref={rootRef}
      className="overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}
    >
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden select-none"
        style={{
          backgroundColor: V2.rule,
          aspectRatio: `${W} / ${H}`,
          touchAction: "none",
          cursor: tf.s > 1 ? (dragRef.current ? "grabbing" : "grab") : "default",
        }}
        onPointerDown={(e) => {
          if (tf.s <= 1) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const el = viewportRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          dragRef.current = { x: e.clientX, y: e.clientY, moved: d.moved };
          setTf((p) => clampT(p.s, p.x + dx, p.y + dy, r.width, r.height));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          dragRef.current = null;
        }}
      >
        <div
          className="absolute inset-0"
          style={{ transformOrigin: "0 0", transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.s})` }}
        >
          <img
            src={imgSrc}
            alt="Satellite view of the site with area boundaries"
            className="block h-full w-full"
            style={{ objectFit: "cover" }}
            draggable={false}
            loading="lazy"
          />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="presentation"
          >
            {features.map((f) => {
              const col = statusHex(statusByArea.get(f.area_id) ?? null);
              const active = highlight
                ? highlight.featureId
                  ? highlight.featureId === f.id
                  : highlight.areaId === f.area_id
                : false;
              const pts = featurePoints(f).map(view.toPx);
              if (pts.length === 0) return null;

              if (f.kind === "pin") {
                const p = pts[0];
                return (
                  <circle
                    key={f.id}
                    cx={p.x}
                    cy={p.y}
                    r={(active ? 8 : 6) / tf.s}
                    fill={col}
                    stroke="#fff"
                    strokeWidth={2 / tf.s}
                    style={{ cursor: "pointer" }}
                    onClick={() => !dragRef.current?.moved && select(f.area_id, f.id, f.label ?? undefined)}
                  />
                );
              }

              const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
              const label = f.label || areas.find((a) => a.area_id === f.area_id)?.name || "";
              return (
                // White halo underneath keeps small boundaries legible against
                // busy satellite imagery; the status colour sits on top.
                <g
                  key={f.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => !dragRef.current?.moved && select(f.area_id, f.id, label || undefined)}
                >
                  <polygon
                    points={points}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity={0.9}
                    strokeWidth={(active ? 3.5 : 2.5) / tf.s}
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={points}
                    fill={col}
                    fillOpacity={active ? 0.55 : 0.38}
                    stroke={col}
                    strokeWidth={(active ? 2 : 1.25) / tf.s}
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels live outside the SVG so they can be counter-scaled: they
              keep a constant on-screen size at every zoom level, like v1.
              De-collision runs through the same shared, deterministic pass the
              live Google map uses, so both renderings drop the same labels. */}
          {labelPlacements.map((l) => (
            <div
              key={`lbl-${l.id}`}
              className="absolute whitespace-nowrap"
              style={{
                left: `${(l.cx / W) * 100}%`,
                top: `${(l.cy / H) * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / tf.s})`,
                transformOrigin: "center",
                pointerEvents: "none",
                opacity: l.hidden ? 0 : 1,
                backgroundColor: "rgba(20,20,20,0.82)",
                color: "#ffffff",
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: "18px",
                letterSpacing: "-0.01em",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {l.label}
            </div>
          ))}


          {/* Pulsing marker for a photo located from the lightbox. */}
          {focusPoint &&
            (() => {
              const p = view.toPx({ lat: focusPoint.lat, lng: focusPoint.lng });
              return (
                <div
                  className="absolute"
                  style={{
                    left: `${(p.x / W) * 100}%`,
                    top: `${(p.y / H) * 100}%`,
                    transform: `scale(${1 / tf.s})`,
                    transformOrigin: "center",
                  }}
                >
                  <span
                    className="bf-photo-pin"
                    style={{ cursor: onFocusClick ? "pointer" : "default" }}
                    onClick={() => !dragRef.current?.moved && onFocusClick?.(focusPoint.photoId)}
                  />
                  {focusPoint.label && (
                    <div
                      className="absolute whitespace-nowrap"
                      style={{
                        left: 0,
                        top: -14,
                        transform: "translate(-50%, -100%)",
                        pointerEvents: "none",
                        backgroundColor: "rgba(20,20,20,0.9)",
                        color: "#fff",
                        fontFamily: "'Geist', system-ui, sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: "17px",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {focusPoint.label}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>

        {/* Zoom controls */}
        <div className="absolute right-2 top-2 flex flex-col" style={{ border: `1px solid ${V2.rule}` }}>
          {[
            { k: "+", d: 1.5 },
            { k: "−", d: 1 / 1.5 },
          ].map((b) => (
            <button
              key={b.k}
              type="button"
              aria-label={b.d > 1 ? "Zoom in" : "Zoom out"}
              onClick={() => {
                const el = viewportRef.current;
                if (!el) return;
                const r = el.getBoundingClientRect();
                setTf((p) => {
                  const s = Math.min(MAX_S, Math.max(MIN_S, p.s * b.d));
                  const k = s / p.s;
                  const px = r.width / 2;
                  const py = r.height / 2;
                  return clampT(s, px - (px - p.x) * k, py - (py - p.y) * k, r.width, r.height);
                });
              }}
              style={{
                width: 26,
                height: 26,
                backgroundColor: V2.white,
                color: V2.ink,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: "26px",
              }}
            >
              {b.k}
            </button>
          ))}
        </div>
      </div>




      <StatusMapKey />
    </div>
  );
}
