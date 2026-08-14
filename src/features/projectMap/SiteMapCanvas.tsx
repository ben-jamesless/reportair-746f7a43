/// <reference types="google.maps" />
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { MapFeature } from "./useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";

export interface SiteMapCanvasHandle {
  undoLastPoint: () => void;
  confirmPolygon: () => void;
  getDraftPointCount: () => number;
  getCameraState: () => { lat: number; lng: number; zoom: number } | null;
}

export type StatusTint = { fill: string; stroke: string };

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  mapType?: "roadmap" | "satellite" | "hybrid";
  areas: Area[];
  features: MapFeature[];
  drawingAreaId?: string | null;
  drawingKind?: "pin" | "polygon" | "rectangle" | null;
  onCreate?: (areaId: string | null, kind: "pin" | "polygon" | "rectangle", geometry: any, color: string) => void;
  onUpdate?: (id: string, geometry: any) => void;
  onFeatureClick?: (f: MapFeature) => void;
  fallbackColor?: string;
  editable?: boolean;
  selectedId?: string | null;
  onDraftChange?: (count: number) => void;
  fitToFeatures?: boolean;
  /** areaId -> tint applied only to that area's PRIMARY polygon/rectangle */
  statusTintByArea?: Record<string, StatusTint | undefined>;
  /** When set, this area's primary feature is emphasised and others are dimmed */
  highlightAreaId?: string | null;
  /**
   * "status" (default) paints every shape from the derived day status — the
   * same field the area pills read. "plan" restores the manual planning
   * colours, which live in `plan_color` and never leave the ops editor.
   */
  colorMode?: "status" | "plan";
}

function colorForArea(area: Area | undefined, fallback: string): string {
  if (!area) return fallback;
  const palette = ["#01696F", "#0EA5E9", "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#84CC16", "#64748B"];
  let h = 0;
  for (let i = 0; i < area.id.length; i++) h = (h * 31 + area.id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export const SiteMapCanvas = forwardRef<SiteMapCanvasHandle, Props>(function SiteMapCanvas({
  center, zoom = 17, mapType = "hybrid", areas, features,
  drawingAreaId, drawingKind, onCreate, onUpdate, onFeatureClick,
  fallbackColor = DEFAULT_PROJECT_COLOR, editable = false,
  selectedId, onDraftChange, fitToFeatures = false,
  statusTintByArea, highlightAreaId, colorMode = "status",
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const overlaysRef = useRef<Map<string, google.maps.Marker | google.maps.Polygon | google.maps.Rectangle>>(new Map());
  const labelsRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const drawingStateRef = useRef({ drawingAreaId, drawingKind, editable });
  const onCreateRef = useRef(onCreate);
  const onDraftChangeRef = useRef(onDraftChange);
  const areasRef = useRef(areas);
  const fallbackColorRef = useRef(fallbackColor);
  const draftRef = useRef<{
    points: google.maps.LatLng[];
    tempPoly: google.maps.Polyline | null;
    vertexMarkers: google.maps.Marker[];
    edgeLabels: google.maps.Marker[];
    tempRect: google.maps.Rectangle | null;
    rectStart: google.maps.LatLng | null;
    rectMoveListener: google.maps.MapsEventListener | null;
    rectUpListener: google.maps.MapsEventListener | null;
  }>({ points: [], tempPoly: null, vertexMarkers: [], edgeLabels: [], tempRect: null, rectStart: null, rectMoveListener: null, rectUpListener: null });

  useEffect(() => { drawingStateRef.current = { drawingAreaId, drawingKind, editable }; }, [drawingAreaId, drawingKind, editable]);
  useEffect(() => { onCreateRef.current = onCreate; }, [onCreate]);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);
  useEffect(() => { areasRef.current = areas; }, [areas]);
  useEffect(() => { fallbackColorRef.current = fallbackColor; }, [fallbackColor]);

  const notifyDraft = () => onDraftChangeRef.current?.(draftRef.current.points.length);

  const formatDistance = (m: number) => (m < 1000 ? `${m.toFixed(1)} m` : `${(m / 1000).toFixed(2)} km`);

  const updateEdgeLabels = () => {
    const g = window.google;
    const map = mapRef.current;
    const d = draftRef.current;
    if (!g || !map) return;
    // Clear existing
    d.edgeLabels.forEach((m) => m.setMap(null));
    d.edgeLabels = [];
    if (d.points.length < 2 || !g.maps.geometry?.spherical) return;
    for (let i = 0; i < d.points.length - 1; i++) {
      const a = d.points[i];
      const b = d.points[i + 1];
      const dist = g.maps.geometry.spherical.computeDistanceBetween(a, b);
      const mid = { lat: (a.lat() + b.lat()) / 2, lng: (a.lng() + b.lng()) / 2 };
      const lm = new g.maps.Marker({
        position: mid, map,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
        label: {
          text: formatDistance(dist),
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "600",
          className: "site-map-edge-label",
        },
        clickable: false,
        zIndex: 10000,
      });
      d.edgeLabels.push(lm);
    }
  };

  const clearDraft = () => {
    const d = draftRef.current;
    d.tempPoly?.setMap(null);
    d.vertexMarkers.forEach((m) => m.setMap(null));
    d.edgeLabels.forEach((m) => m.setMap(null));
    d.tempRect?.setMap(null);
    d.rectMoveListener?.remove();
    d.rectUpListener?.remove();
    draftRef.current = { points: [], tempPoly: null, vertexMarkers: [], edgeLabels: [], tempRect: null, rectStart: null, rectMoveListener: null, rectUpListener: null };
    notifyDraft();
  };


  const finishPolygon = () => {
    const { drawingAreaId: aid, drawingKind: kind } = drawingStateRef.current;
    const pts = draftRef.current.points;
    if (kind !== "polygon" || pts.length < 3 || !onCreateRef.current) { clearDraft(); return; }
    const area = aid ? areasRef.current.find((a) => a.id === aid) : undefined;
    const color = colorForArea(area, fallbackColorRef.current);
    const geometry = { paths: pts.map((p) => ({ lat: p.lat(), lng: p.lng() })) };
    clearDraft();
    onCreateRef.current(aid ?? null, "polygon", geometry, color);
  };

  const undoLastPoint = () => {
    const d = draftRef.current;
    if (d.points.length === 0) return;
    d.points.pop();
    const removed = d.vertexMarkers.pop();
    removed?.setMap(null);
    if (d.tempPoly) {
      if (d.points.length === 0) {
        d.tempPoly.setMap(null);
        d.tempPoly = null;
      } else {
        d.tempPoly.setPath(d.points);
      }
    }
    updateEdgeLabels();
    notifyDraft();
  };

  useImperativeHandle(ref, () => ({
    undoLastPoint,
    confirmPolygon: finishPolygon,
    getDraftPointCount: () => draftRef.current.points.length,
    getCameraState: () => {
      const map = mapRef.current;
      if (!map) return null;
      const c = map.getCenter();
      const z = map.getZoom();
      if (!c || z == null) return null;
      return { lat: c.lat(), lng: c.lng(), zoom: z };
    },
  }));

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
      setMapReady(true);

      if (!editable) return;

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const { drawingAreaId: aid, drawingKind: kind } = drawingStateRef.current;
        if (!kind || !onCreateRef.current || !e.latLng) return;
        const area = aid ? areasRef.current.find((a) => a.id === aid) : undefined;
        const color = colorForArea(area, fallbackColorRef.current);

        if (kind === "pin") {
          onCreateRef.current(aid ?? null, "pin", { lat: e.latLng.lat(), lng: e.latLng.lng() }, color);
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
          const vm = new g.maps.Marker({
            position: e.latLng, map,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 4, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
            clickable: false,
          });
          d.vertexMarkers.push(vm);
          updateEdgeLabels();
          notifyDraft();
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
        if (kind !== "rectangle" || !e.latLng) return;
        map.setOptions({ draggable: false });
        const start = e.latLng as google.maps.LatLng;
        const area = aid ? areasRef.current.find((a) => a.id === aid) : undefined;
        const color = colorForArea(area, fallbackColorRef.current);
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
          if (Math.abs(start.lat() - end.lat()) < 1e-6 && Math.abs(start.lng() - end.lng()) < 1e-6) return;
          const finalBounds = b ?? new g.maps.LatLngBounds(start, end);
          const ne = finalBounds.getNorthEast(), sw = finalBounds.getSouthWest();
          if (onCreateRef.current) onCreateRef.current(aid ?? null, "rectangle", { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() }, color);
        });
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Render/refresh feature overlays (recreates on color change via signature)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const g = window.google;
    const seen = new Set<string>();

    for (const f of features) {
      seen.add(f.id);
      const area = areas.find((a) => a.id === f.area_id);
      const tint = statusTintByArea?.[f.area_id];
      const isPrimary = f.is_primary;
      const planColor = f.plan_color || colorForArea(area, fallbackColor);
      const baseColor = colorMode === "plan" ? planColor : (tint?.stroke ?? planColor);
      const applyTint = colorMode === "status" && isPrimary && tint && (f.kind === "polygon" || f.kind === "rectangle");
      const fillColor = applyTint ? tint!.fill : baseColor;
      const strokeColor = applyTint ? tint!.stroke : baseColor;
      const isSelected = selectedId === f.id;
      const isHighlighted = highlightAreaId && f.area_id === highlightAreaId;
      const isDimmed = highlightAreaId && f.area_id !== highlightAreaId;
      const strokeWeight = (isHighlighted && isPrimary) ? 6 : (isSelected ? 4 : (isPrimary ? 2.5 : 1.5));
      const fillOpacity = isDimmed ? 0.05 : (isHighlighted && isPrimary ? 0.6 : (isPrimary ? 0.35 : 0.2));
      const strokeOpacity = isDimmed ? 0.2 : 1;
      let overlay = overlaysRef.current.get(f.id);

      if (f.kind === "pin") {
        const pos = { lat: f.geometry.lat, lng: f.geometry.lng };
        const icon = {
          path: g.maps.SymbolPath.CIRCLE, scale: isSelected ? 11 : 9,
          fillColor: baseColor, fillOpacity: isDimmed ? 0.35 : 1,
          strokeColor: "#ffffff", strokeWeight: isSelected ? 3 : 2,
        };
        if (!overlay) {
          const m = new g.maps.Marker({
            position: pos, map, draggable: editable, title: area?.name ?? "",
            icon,
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
          overlay.setIcon(icon);
        }
      } else if (f.kind === "polygon") {
        const paths = (f.geometry.paths ?? []) as Array<{ lat: number; lng: number }>;
        if (!overlay) {
          const poly = new g.maps.Polygon({
            paths, map,
            strokeColor, fillColor,
            fillOpacity, strokeOpacity, strokeWeight,
            editable, draggable: editable,
            zIndex: (isHighlighted && isPrimary) ? 5 : (isPrimary ? 2 : 1),
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
        } else if (overlay instanceof g.maps.Polygon) {
          overlay.setOptions({ strokeColor, fillColor, fillOpacity, strokeOpacity, strokeWeight, zIndex: (isHighlighted && isPrimary) ? 5 : (isPrimary ? 2 : 1) });
        }
      } else if (f.kind === "rectangle") {
        const b = new g.maps.LatLngBounds(
          { lat: f.geometry.south, lng: f.geometry.west },
          { lat: f.geometry.north, lng: f.geometry.east },
        );
        if (!overlay) {
          const rect = new g.maps.Rectangle({
            bounds: b, map,
            strokeColor, fillColor,
            fillOpacity, strokeOpacity, strokeWeight,
            editable, draggable: editable,
            zIndex: (isHighlighted && isPrimary) ? 5 : (isPrimary ? 2 : 1),
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
        } else if (overlay instanceof g.maps.Rectangle) {
          overlay.setOptions({ strokeColor, fillColor, fillOpacity, strokeOpacity, strokeWeight, zIndex: (isHighlighted && isPrimary) ? 5 : (isPrimary ? 2 : 1) });
        }
      }

      // Label overlay (transparent marker with text).
      // Fallback: on a primary polygon/rectangle with no custom label, show the area name.
      let labelText = f.label?.trim();
      if (!labelText && f.is_primary && (f.kind === "polygon" || f.kind === "rectangle")) {
        labelText = area?.name?.trim() || undefined;
      }
      let labelPos: google.maps.LatLngLiteral | null = null;
      if (labelText) {
        if (f.kind === "pin") {
          labelPos = { lat: f.geometry.lat, lng: f.geometry.lng };
        } else if (f.kind === "polygon") {
          const paths = (f.geometry.paths ?? []) as Array<{ lat: number; lng: number }>;
          if (paths.length) {
            const sum = paths.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
            labelPos = { lat: sum.lat / paths.length, lng: sum.lng / paths.length };
          }
        } else if (f.kind === "rectangle") {
          labelPos = {
            lat: (f.geometry.north + f.geometry.south) / 2,
            lng: (f.geometry.east + f.geometry.west) / 2,
          };
        }
      }
      const existingLabel = labelsRef.current.get(f.id);
      if (labelText && labelPos) {
        const labelOpts: google.maps.MarkerLabel = {
          text: labelText,
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "600",
          className: "site-map-label",
        };
        if (!existingLabel) {
          const lm = new g.maps.Marker({
            position: labelPos, map,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
            label: labelOpts,
            clickable: false,
            zIndex: 9999,
          });
          labelsRef.current.set(f.id, lm);
        } else {
          existingLabel.setPosition(labelPos);
          existingLabel.setLabel(labelOpts);
        }
      } else if (existingLabel) {
        existingLabel.setMap(null);
        labelsRef.current.delete(f.id);
      }
    }

    for (const [id, ov] of overlaysRef.current) {
      if (!seen.has(id)) { ov.setMap(null); overlaysRef.current.delete(id); }
    }
    for (const [id, lm] of labelsRef.current) {
      if (!seen.has(id)) { lm.setMap(null); labelsRef.current.delete(id); }
    }
  }, [features, areas, editable, fallbackColor, onFeatureClick, onUpdate, selectedId, mapReady, statusTintByArea, highlightAreaId, colorMode]);

  // Fit map to all features (read-only share view)
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!fitToFeatures || didFitRef.current) return;
    const map = mapRef.current;
    if (!map || !window.google || features.length === 0) return;
    const g = window.google;
    const bounds = new g.maps.LatLngBounds();
    for (const f of features) {
      if (f.kind === "pin") {
        bounds.extend({ lat: f.geometry.lat, lng: f.geometry.lng });
      } else if (f.kind === "rectangle") {
        bounds.extend({ lat: f.geometry.north, lng: f.geometry.east });
        bounds.extend({ lat: f.geometry.south, lng: f.geometry.west });
      } else if (f.kind === "polygon") {
        for (const p of (f.geometry.paths ?? [])) bounds.extend({ lat: p.lat, lng: p.lng });
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
      didFitRef.current = true;
    }
  }, [fitToFeatures, features, mapReady]);

  return <div ref={containerRef} className="h-full w-full rounded-md border bg-muted/40" aria-label="Site map" />;
});
