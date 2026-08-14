/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import { event as trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import { V2, statusHex, STATUS_SEVERITY, normaliseStatus } from "../tokens";
import type { ShareV2DayArea } from "../types";

/**
 * Interactive (Google JS API) site map for the v2 share page.
 * Rendered only when the Google Maps script loads successfully; otherwise the
 * parent falls back to the static satellite + SVG renderer.
 */

type LatLng = { lat: number; lng: number };

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

// Google's own place pins fight with our area labels on a busy site, so the
// base map is stripped back to imagery + roads only.
const NO_POI_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

// Constant-size dark chip label, anchored at the feature centroid.
function makeLabelOverlay(g: typeof google) {
  return class LabelOverlay extends g.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    /** Screen-space box of the last draw, used for collision resolution. */
    public rect: { left: number; top: number; right: number; bottom: number } | null = null;
    public hidden = false;
    constructor(
      private position: google.maps.LatLng,
      private text: string,
      /** Deterministic placement order: higher severity wins a collision. */
      public severity = 0,
      /** Tie-break within a severity band, so order never depends on fetch order. */
      public sortName = "",
    ) {
      super();
    }
    onAdd() {
      const d = document.createElement("div");
      d.textContent = this.text;
      Object.assign(d.style, {
        position: "absolute",
        transform: "translate(-50%, -50%)",
        whiteSpace: "nowrap",
        backgroundColor: "rgba(20,20,20,0.82)",
        color: "#ffffff",
        fontFamily: "'Geist', system-ui, sans-serif",
        fontSize: "13px",
        fontWeight: "700",
        lineHeight: "18px",
        letterSpacing: "-0.01em",
        padding: "2px 8px",
        borderRadius: "4px",
        pointerEvents: "none",
        transition: "opacity 120ms ease",
      } as CSSStyleDeclaration);
      this.div = d;
      this.getPanes()?.floatPane.appendChild(d);
    }
    draw() {
      if (!this.div) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
      const w = this.div.offsetWidth || this.text.length * 7.5;
      const h = this.div.offsetHeight || 22;
      this.rect = { left: p.x - w / 2, top: p.y - h / 2, right: p.x + w / 2, bottom: p.y + h / 2 };
    }
    setHidden(hidden: boolean) {
      this.hidden = hidden;
      if (this.div) this.div.style.opacity = hidden ? "0" : "1";
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  };
}

export type CollidableLabel = {
  rect: { left: number; top: number; right: number; bottom: number } | null;
  severity: number;
  sortName: string;
  setHidden: (hidden: boolean) => void;
};

/**
 * Greedy label de-clutter with a *stable* placement order.
 *
 * The candidate order is a pure function of the data (status severity, then
 * area name), never of geometry, fetch order or container size. That is what
 * makes the interactive share map and the static map baked into the PDF export
 * hide the same labels, and makes one site render identically at any width.
 */
export function resolveLabelCollisions(labels: CollidableLabel[], padding = 4) {
  const kept: Array<NonNullable<CollidableLabel["rect"]>> = [];
  const ordered = labels
    .filter((l) => l.rect)
    .slice()
    .sort((a, b) => b.severity - a.severity || a.sortName.localeCompare(b.sortName));
  for (const l of ordered) {
    const r = l.rect!;
    const clash = kept.some(
      (k) =>
        r.left < k.right + padding &&
        r.right > k.left - padding &&
        r.top < k.bottom + padding &&
        r.bottom > k.top - padding,
    );
    l.setHidden(clash);
    if (!clash) kept.push(r);
  }
}



// Pulsing dot + optional caption chip marking where a photo was taken.
function makeFocusOverlay(g: typeof google) {
  return class FocusOverlay extends g.maps.OverlayView {
    private div: HTMLDivElement | null = null;
    constructor(
      private position: google.maps.LatLng,
      private text: string | undefined,
      private onClick?: () => void
    ) {
      super();
    }
    onAdd() {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, { position: "absolute", cursor: this.onClick ? "pointer" : "default" });

      const dot = document.createElement("div");
      dot.className = "bf-photo-pin";
      wrap.appendChild(dot);

      if (this.text) {
        const chip = document.createElement("div");
        chip.textContent = this.text;
        Object.assign(chip.style, {
          position: "absolute",
          left: "0px",
          top: "-14px",
          transform: "translate(-50%, -100%)",
          whiteSpace: "nowrap",
          backgroundColor: "rgba(20,20,20,0.9)",
          color: "#ffffff",
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: "12px",
          fontWeight: "600",
          lineHeight: "17px",
          padding: "2px 8px",
          borderRadius: "4px",
        } as CSSStyleDeclaration);
        wrap.appendChild(chip);
      }

      if (this.onClick) wrap.addEventListener("click", this.onClick);
      this.div = wrap;
      this.getPanes()?.floatPane.appendChild(wrap);
    }
    draw() {
      if (!this.div) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  };
}

export function ShareMapLive({
  token,
  areas,
  onAreaClick,
  onFailure,
  focusPoint,
  onFocusClick,
  onFocusClear,
}: {
  token: string;
  areas: ShareV2DayArea[];
  onAreaClick?: (areaId: string, featureLabel?: string) => void;
  onFailure?: () => void;
  focusPoint?: { lat: number; lng: number; photoId: string; label?: string } | null;
  onFocusClick?: (photoId: string) => void;
  onFocusClear?: () => void;
}) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  const [highlight, setHighlight] = useState<{ featureId: string | null; areaId: string } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shapesRef = useRef<Array<{ feature: MapFeature; shape: google.maps.Polygon | google.maps.Marker }>>([]);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  /** True once the reader (or "Show on map") owns the viewport. */
  const viewportLockedRef = useRef(false);
  /** Guards our own fitBounds from being mistaken for a user zoom. */
  const fittingRef = useRef(false);
  const fitRef = useRef<(() => void) | null>(null);
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);


  const seenRef = useRef(false);
  const [mapReady, setMapReady] = useState(0);
  const focusRef = useRef<google.maps.OverlayView | null>(null);
  const onFocusClearRef = useRef<(() => void) | undefined>(undefined);
  onFocusClearRef.current = onFocusClear;
  const selectRef = useRef<(areaId: string, featureId: string | null, label?: string) => void>(() => {});

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("list_share_map_features" as never, { _token: token } as never);
      if (!alive) return;
      setFeatures((data ?? []) as unknown as MapFeature[]);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

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

  const statusByArea = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of areas) m.set(a.area_id, a.status);
    return m;
  }, [areas]);

  const colorByArea = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features ?? []) if (f.color) m.set(f.area_id, f.color);
    return m;
  }, [features]);

  selectRef.current = (areaId, featureId, label) => {
    setHighlight({ featureId, areaId });
    onAreaClick?.(areaId, label);
  };

  // Build the map + shapes once features are known.
  useEffect(() => {
    if (!features || features.length === 0) return;
    let alive = true;
    (async () => {
      let g: typeof google;
      try {
        g = await loadGoogleMaps();
      } catch {
        if (alive) onFailure?.();
        return;
      }
      if (!alive || !mapElRef.current) return;

      const map = new g.maps.Map(mapElRef.current, {
        mapTypeId: "hybrid",
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        tilt: 0,
        clickableIcons: false,
        styles: NO_POI_STYLES,
      });
      mapRef.current = map;
      map.addListener("click", () => onFocusClearRef.current?.());
      setMapReady((n) => n + 1);


      const bounds = new g.maps.LatLngBounds();
      const LabelOverlay = makeLabelOverlay(g);

      for (const f of features) {
        const pts = featurePoints(f);
        if (pts.length === 0) continue;
        pts.forEach((p) => bounds.extend(p));
        const col = f.color || statusHex(statusByArea.get(f.area_id) ?? null);
        const label = f.label || areas.find((a) => a.area_id === f.area_id)?.name || "";

        if (f.kind === "pin") {
          const marker = new g.maps.Marker({ position: pts[0], map, title: label || undefined });
          marker.addListener("click", () => selectRef.current(f.area_id, f.id, label || undefined));
          shapesRef.current.push({ feature: f, shape: marker });
        } else {
          const poly = new g.maps.Polygon({
            paths: pts,
            map,
            strokeColor: col,
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: col,
            fillOpacity: 0.38,
            clickable: true,
          });
          poly.addListener("click", () => selectRef.current(f.area_id, f.id, label || undefined));
          shapesRef.current.push({ feature: f, shape: poly });
        }

        if (label) {
          const c = pts.reduce(
            (acc, p) => ({ lat: acc.lat + p.lat / pts.length, lng: acc.lng + p.lng / pts.length }),
            { lat: 0, lng: 0 }
          );
          // Placement order is data-driven, not geometry-driven: the worst
          // status is the label a reader must not lose, then alphabetical.
          const severity = STATUS_SEVERITY[normaliseStatus(statusByArea.get(f.area_id) ?? null)];
          const ov = new LabelOverlay(
            new g.maps.LatLng(c.lat, c.lng),
            label,
            f.kind === "pin" ? severity - 0.5 : severity,
            label.toLowerCase(),
          );
          ov.setMap(map);
          overlaysRef.current.push(ov);
        }
      }

      // Re-run de-clutter whenever the view settles (pan, zoom, resize).
      const declutter = () => resolveLabelCollisions(overlaysRef.current as unknown as CollidableLabel[]);
      map.addListener("idle", declutter);

      // Fit-bounds is an *initial framing* step, not a resize handler. Once the
      // reader has moved the map — or "Show on map" has framed a photo — the
      // viewport is theirs: a mobile soft keyboard opening under the comment
      // composer resizes the container, and must not yank the map back out.
      const fit = () => {
        if (bounds.isEmpty()) return;
        fittingRef.current = true;
        map.fitBounds(bounds, 48);
        g.maps.event.addListenerOnce(map, "idle", () => {
          fittingRef.current = false;
        });
      };
      fitRef.current = fit;
      boundsRef.current = bounds;
      fit();

      // Any interaction that isn't our own fitBounds locks the viewport.
      const lock = () => {
        if (!fittingRef.current) viewportLockedRef.current = true;
      };
      map.addListener("dragstart", lock);
      map.addListener("zoom_changed", lock);

      const ro = new ResizeObserver(() => {
        const centre = map.getCenter();
        const zoom = map.getZoom();
        g.maps.event.trigger(map, "resize");
        if (viewportLockedRef.current) {
          // Preserve exactly what the reader was looking at.
          if (centre) map.setCenter(centre);
          if (typeof zoom === "number") map.setZoom(zoom);
        } else {
          fit();
        }
      });
      ro.observe(mapElRef.current);
      resizeObsRef.current = ro;
    })();


    return () => {
      alive = false;
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      shapesRef.current.forEach(({ shape }) => shape.setMap(null));
      shapesRef.current = [];
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
    // Shapes are rebuilt only when the feature set changes; status/colour
    // updates are applied in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);


  // Keep polygon styling in sync with status + selection.
  useEffect(() => {
    for (const { feature, shape } of shapesRef.current) {
      if (!(shape instanceof google.maps.Polygon)) continue;
      const col = feature.color || statusHex(statusByArea.get(feature.area_id) ?? null);
      const active = highlight
        ? highlight.featureId
          ? highlight.featureId === feature.id
          : highlight.areaId === feature.area_id
        : false;
      shape.setOptions({
        strokeColor: col,
        fillColor: col,
        fillOpacity: active ? 0.55 : 0.38,
        strokeWeight: active ? 3 : 2,
        zIndex: active ? 2 : 1,
      });
    }
  }, [highlight, statusByArea, features]);

  // Pulsing marker for a photo located from the lightbox.
  useEffect(() => {
    const map = mapRef.current;
    focusRef.current?.setMap(null);
    focusRef.current = null;
    if (!map || !focusPoint) return;
    let alive = true;
    (async () => {
      let g: typeof google;
      try {
        g = await loadGoogleMaps();
      } catch {
        return;
      }
      if (!alive || mapRef.current !== map) return;
      const FocusOverlay = makeFocusOverlay(g);
      const pos = new g.maps.LatLng(focusPoint.lat, focusPoint.lng);
      const ov = new FocusOverlay(pos, focusPoint.label, () => onFocusClick?.(focusPoint.photoId));
      ov.setMap(map);
      focusRef.current = ov;
      // Framing a photo hands the viewport to the reader: keep it on resize.
      viewportLockedRef.current = true;
      map.panTo(pos);
      if ((map.getZoom() ?? 0) < 20) map.setZoom(20);

    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPoint?.photoId, focusPoint?.lat, focusPoint?.lng, mapReady]);

  if (!features || features.length === 0) return null;

  const mapped = new Set(features.map((f) => f.area_id));
  const legend = areas.filter((a) => mapped.has(a.area_id));

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}
    >
      <div
        ref={mapElRef}
        className="w-full"
        style={{ aspectRatio: "640 / 420", backgroundColor: V2.rule }}
        aria-label="Interactive satellite map of the site with area boundaries"
        role="application"
      />

      {/* The only path back to the whole-site framing now that resize no
          longer re-fits the map under the reader. */}
      <button
        type="button"
        onClick={() => {
          viewportLockedRef.current = false;
          fitRef.current?.();
        }}
        className="absolute left-2.5 top-2.5"
        style={{
          fontFamily: V2.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: V2.ink,
          backgroundColor: "rgba(255,255,255,0.92)",
          padding: "5px 9px",
          borderRadius: 4,
        }}
      >
        Reset view
      </button>


      {legend.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          style={{ padding: "10px 12px", borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          {legend.map((a) => {
            const dot = colorByArea.get(a.area_id) || statusHex(a.status);
            const active = highlight?.areaId === a.area_id && !highlight?.featureId;
            return (
              <button
                key={a.area_id}
                type="button"
                onClick={() => selectRef.current(a.area_id, null, a.name)}
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
