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
  const drawingMgrRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const overlaysRef = useRef<Map<string, google.maps.Marker | google.maps.Polygon | google.maps.Rectangle>>(new Map());
  const drawingStateRef = useRef({ drawingAreaId, drawingKind, editable });

  // Keep current drawing intent accessible in event listeners without re-creating them
  useEffect(() => { drawingStateRef.current = { drawingAreaId, drawingKind, editable }; }, [drawingAreaId, drawingKind, editable]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(async (g) => {
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

      if (editable) {
        const { DrawingManager } = (await g.maps.importLibrary("drawing")) as google.maps.DrawingLibrary;
        const mgr = new DrawingManager({
          drawingControl: false,
          markerOptions: { draggable: true },
          polygonOptions: { editable: true, draggable: true, fillOpacity: 0.35, strokeWeight: 2 },
          rectangleOptions: { editable: true, draggable: true, fillOpacity: 0.35, strokeWeight: 2 },
        });
        mgr.setMap(map);
        drawingMgrRef.current = mgr;

        mgr.addListener("overlaycomplete", (e: google.maps.drawing.OverlayCompleteEvent) => {
          const { drawingAreaId: aid, drawingKind: kind } = drawingStateRef.current;
          if (!aid || !kind || !onCreate) { e.overlay?.setMap(null); mgr.setDrawingMode(null); return; }
          const area = areas.find((a) => a.id === aid);
          const color = colorForArea(area, fallbackColor);
          let geometry: any;
          if (e.type === "marker") {
            const m = e.overlay as google.maps.Marker;
            const p = m.getPosition();
            if (!p) return;
            geometry = { lat: p.lat(), lng: p.lng() };
          } else if (e.type === "polygon") {
            const poly = e.overlay as google.maps.Polygon;
            geometry = { paths: poly.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() })) };
          } else if (e.type === "rectangle") {
            const r = e.overlay as google.maps.Rectangle;
            const b = r.getBounds();
            if (!b) return;
            const ne = b.getNorthEast(), sw = b.getSouthWest();
            geometry = { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() };
          }
          e.overlay?.setMap(null);
          mgr.setDrawingMode(null);
          onCreate(aid, kind, geometry, color);
        });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch drawing mode when parent asks
  useEffect(() => {
    const mgr = drawingMgrRef.current;
    if (!mgr || !window.google) return;
    if (!editable || !drawingAreaId || !drawingKind) { mgr.setDrawingMode(null); return; }
    const modes = window.google.maps.drawing.OverlayType;
    mgr.setDrawingMode(
      drawingKind === "pin" ? modes.MARKER :
      drawingKind === "polygon" ? modes.POLYGON :
      modes.RECTANGLE,
    );
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
