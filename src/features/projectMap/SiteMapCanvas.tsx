/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { MapFeature } from "./useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  mapType?: "roadmap" | "satellite" | "hybrid";
  areas: Area[];
  features: MapFeature[];
  /** null = view-only (share/guest). Otherwise the area currently being placed. */
  drawingAreaId?: string | null;
  drawingKind?: "pin" | "polygon" | "rectangle" | null;
  onCreate?: (areaId: string, kind: "pin" | "polygon" | "rectangle", geometry: any, color: string) => void;
  onUpdate?: (id: string, geometry: any) => void;
  onFeatureClick?: (f: MapFeature) => void;
  fallbackColor?: string;
  editable?: boolean;
}

// Distinct colours per area from the project palette hash.
function colorForArea(area: Area | undefined, fallback: string): string {
  if (!area) return fallback;
  const palette = ["#01696F", "#0EA5E9", "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#84CC16", "#64748B"];
  let h = 0;
  for (let i = 0; i < area.id.length; i++) h = (h * 31 + area.id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function SiteMapCanvas({
  center, zoom = 17, mapType = "hybrid", areas, features,
  drawingAreaId, drawingKind, onCreate, onUpdate, onFeatureClick,
  fallbackColor = DEFAULT_PROJECT_COLOR, editable = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Map<string, google.maps.Marker | google.maps.Polygon | google.maps.Rectangle>>(new Map());
  const drawingStateRef = useRef({ drawingAreaId, drawingKind, editable });
  // In-progress drawing (polygon points + preview overlays, or rectangle drag start)
  const draftRef = useRef<{
    points: google.maps.LatLng[];
    tempPoly: google.maps.Polyline | null;
    tempPolygon: google.maps.Polygon | null;
    tempRect: google.maps.Rectangle | null;
    rectStart: google.maps.LatLng | null;
    rectMoveListener: google.maps.MapsEventListener | null;
    rectUpListener: google.maps.MapsEventListener | null;
  }>({ points: [], tempPoly: null, tempPolygon: null, tempRect: null, rectStart: null, rectMoveListener: null, rectUpListener: null });

  useEffect(() => { drawingStateRef.current = { drawingAreaId, drawingKind, editable }; }, [drawingAreaId, drawingKind, editable]);

  const clearDraft = () => {
    const d = draftRef.current;
    d.tempPoly?.setMap(null);
    d.tempPolygon?.setMap(null);
    d.tempRect?.setMap(null);
    d.rectMoveListener?.remove();
    d.rectUpListener?.remove();
    draftRef.current = { points: [], tempPoly: null, tempPolygon: null, tempRect: null, rectStart: null, rectMoveListener: null, rectUpListener: null };
  };

  const finishPolygon = () => {
    const { drawingAreaId: aid, drawingKind: kind } = drawingStateRef.current;
    const pts = draftRef.current.points;
    if (kind !== "polygon" || !aid || pts.length < 3 || !onCreate) { clearDraft(); return; }
    const area = areas.find((a) => a.id === aid);
    const color = colorForArea(area, fallbackColor);
    const geometry = { paths: pts.map((p) => ({ lat: p.lat(), lng: p.lng() })) };
    clearDraft();
    onCreate(aid, "polygon", geometry, color);
  };

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !containerRef.current) return;
      const map = new g.maps.Map(containerRef.current, {
        center, zoom,
        mapTypeId: mapType,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        tilt: 0,
      });
      mapRef.current = map;

      if (!editable) return;

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const { drawingAreaId: aid, drawingKind: kind } = drawingStateRef.current;
        if (!aid || !kind || !onCreate || !e.latLng) return;
        const area = areas.find((a) => a.id === aid);
        const color = colorForArea(area, fallbackColor);

        if (kind === "pin") {
          onCreate(aid, "pin", { lat: e.latLng.lat(), lng: e.latLng.lng() }, color);
          return;
        }
        if (kind === "polygon") {
          const d = draftRef.current;
          d.points.push(e.latLng);
          if (!d.tempPoly) {
            d.tempPoly = new g.maps.Polyline({
              map, path: d.points, strokeColor: color, strokeWeight: 2,
            });
          } else {
            d.tempPoly.setPath(d.points);
          }
          // small vertex markers
          new g.maps.Marker({
            position: e.latLng, map,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 4, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
            clickable: false,
          });
        }
      });

      map.addListener("dblclick", (e: google.maps.MapMouseEvent) => {
        const { drawingKind: kind } = drawingStateRef.current;
        if (kind === "polygon") {
          e.stop?.();
          finishPolygon();
        }
      });

      map.addListener("mousedown", (e: any) => {
        const { drawingKind: kind, drawingAreaId: aid } = drawingStateRef.current;
        if (kind !== "rectangle" || !aid || !e.latLng) return;
        // Block map panning while drawing
        map.setOptions({ draggable: false });
        const start = e.latLng as google.maps.LatLng;
        const area = areas.find((a) => a.id === aid);
        const color = colorForArea(area, fallbackColor);
        const rect = new g.maps.Rectangle({
          map,
          bounds: new g.maps.LatLngBounds(start, start),
          strokeColor: color, fillColor: color, fillOpacity: 0.35, strokeWeight: 2,
          clickable: false,
        });
        draftRef.current.rectStart = start;
        draftRef.current.tempRect = rect;
        draftRef.current.rectMoveListener = map.addListener("mousemove", (me: google.maps.MapMouseEvent) => {
          if (!me.latLng) return;
          rect.setBounds(new g.maps.LatLngBounds(start, me.latLng));
        });
        draftRef.current.rectUpListener = map.addListener("mouseup", (ue: google.maps.MapMouseEvent) => {
          map.setOptions({ draggable: true });
          const b = rect.getBounds();
          const end = ue.latLng ?? start;
          draftRef.current.rectMoveListener?.remove();
          draftRef.current.rectUpListener?.remove();
          draftRef.current.rectMoveListener = null;
          draftRef.current.rectUpListener = null;
          rect.setMap(null);
          draftRef.current.tempRect = null;
          draftRef.current.rectStart = null;
          // Ignore accidental clicks (no drag)
          if (Math.abs(start.lat() - end.lat()) < 1e-6 && Math.abs(start.lng() - end.lng()) < 1e-6) return;
          const finalBounds = b ?? new g.maps.LatLngBounds(start, end);
          const ne = finalBounds.getNorthEast(), sw = finalBounds.getSouthWest();
          if (onCreate) onCreate(aid, "rectangle", { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() }, color);
        });
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cursor + reset draft when drawing mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (editable && drawingKind) {
      map.setOptions({ draggableCursor: "crosshair", disableDoubleClickZoom: drawingKind === "polygon" });
    } else {
      map.setOptions({ draggableCursor: null, disableDoubleClickZoom: false });
      clearDraft();
    }
  }, [drawingAreaId, drawingKind, editable]);

  // Render/refresh feature overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const g = window.google;
    const seen = new Set<string>();

    for (const f of features) {
      seen.add(f.id);
      const area = areas.find((a) => a.id === f.area_id);
      const color = f.color || colorForArea(area, fallbackColor);
      let overlay = overlaysRef.current.get(f.id);

      if (f.kind === "pin") {
        const pos = { lat: f.geometry.lat, lng: f.geometry.lng };
        if (!overlay) {
          const m = new g.maps.Marker({
            position: pos, map, draggable: editable, title: area?.name ?? "",
            icon: {
              path: g.maps.SymbolPath.CIRCLE, scale: 9,
              fillColor: color, fillOpacity: 1,
              strokeColor: "#ffffff", strokeWeight: 2,
            },
          });
          m.addListener("click", () => onFeatureClick?.(f));
          if (editable) {
            m.addListener("dragend", () => {
              const p = m.getPosition(); if (!p) return;
              onUpdate?.(f.id, { lat: p.lat(), lng: p.lng() });
            });
          }
          overlaysRef.current.set(f.id, m);
        } else if (overlay instanceof g.maps.Marker) {
          overlay.setPosition(pos);
        }
      } else if (f.kind === "polygon") {
        const paths = (f.geometry.paths ?? []) as Array<{ lat: number; lng: number }>;
        if (!overlay) {
          const poly = new g.maps.Polygon({
            paths, map,
            strokeColor: color, fillColor: color,
            fillOpacity: 0.35, strokeWeight: 2,
            editable, draggable: editable,
          });
          poly.addListener("click", () => onFeatureClick?.(f));
          const persist = () => {
            const arr = poly.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
            onUpdate?.(f.id, { paths: arr });
          };
          if (editable) {
            const path = poly.getPath();
            path.addListener("set_at", persist);
            path.addListener("insert_at", persist);
            path.addListener("remove_at", persist);
            poly.addListener("dragend", persist);
          }
          overlaysRef.current.set(f.id, poly);
        }
      } else if (f.kind === "rectangle") {
        const b = new g.maps.LatLngBounds(
          { lat: f.geometry.south, lng: f.geometry.west },
          { lat: f.geometry.north, lng: f.geometry.east },
        );
        if (!overlay) {
          const rect = new g.maps.Rectangle({
            bounds: b, map,
            strokeColor: color, fillColor: color,
            fillOpacity: 0.35, strokeWeight: 2,
            editable, draggable: editable,
          });
          rect.addListener("click", () => onFeatureClick?.(f));
          if (editable) {
            const persist = () => {
              const nb = rect.getBounds(); if (!nb) return;
              const ne = nb.getNorthEast(), sw = nb.getSouthWest();
              onUpdate?.(f.id, { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() });
            };
            rect.addListener("bounds_changed", persist);
          }
          overlaysRef.current.set(f.id, rect);
        }
      }
    }

    // Remove stale overlays
    for (const [id, ov] of overlaysRef.current) {
      if (!seen.has(id)) { ov.setMap(null); overlaysRef.current.delete(id); }
    }
  }, [features, areas, editable, fallbackColor, onFeatureClick, onUpdate]);

  return <div ref={containerRef} className="h-full w-full rounded-md border bg-muted/40" aria-label="Site map" />;
}
