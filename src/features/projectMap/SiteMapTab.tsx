import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Square, Pentagon, Trash2, X, Undo2, Check, Palette, Star, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SiteMapCanvas, type SiteMapCanvasHandle, type StatusTint } from "./SiteMapCanvas";
import { useMapFeatures, type MapFeature } from "./useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { toast } from "sonner";
import { PROJECT_COLOR_PALETTE } from "@/lib/projectColors";

interface Props {
  projectId: string;
  color?: string | null;
  canEdit: boolean;
}

// Status → hex, aligned with PROJECT_STATUSES in src/lib/projectStatus.ts
const STATUS_HEX: Record<string, string> = {
  no_status: "#9C9A93",
  on_track: "#3A6EA5",
  requires_discussion: "#D94F2A",
  concern: "#C7382A",
  behind_schedule: "#C7382A",
  complete: "#3A7D44",
};

function tintForStatus(status: string | undefined): StatusTint | undefined {
  if (!status || status === "no_status") return undefined;
  const stroke = STATUS_HEX[status] ?? "#64748B";
  return { fill: stroke, stroke };
}

function ColorSwatches({ current, onPick }: { current?: string | null; onPick: (c: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {PROJECT_COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className={`h-6 w-6 rounded-full border-2 transition ${current === c ? "border-foreground ring-2 ring-offset-1 ring-foreground/30" : "border-white/60"}`}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}

const NEW_ZONE = "__new_zone__";

export function SiteMapTab({ projectId, color, canEdit }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [statusByArea, setStatusByArea] = useState<Record<string, string>>({});
  const { features, create, createZone, setPrimary, updateGeometry, remove, updateColor, updateLabel } = useMapFeatures(projectId);
  const [drawingAreaId, setDrawingAreaId] = useState<string | null>(null); // null + drawingKind set → new zone
  const [drawingKind, setDrawingKind] = useState<"pin" | "polygon" | "rectangle" | null>(null);
  const [drawingMode, setDrawingMode] = useState<"attach" | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const canvasRef = useRef<SiteMapCanvasHandle>(null);

  const reloadAreas = async () => {
    const { data: ar } = await supabase.from("areas")
      .select("id, project_id, name, sort_order, color")
      .eq("project_id", projectId).is("deleted_at", null).order("sort_order");
    setAreas((ar ?? []) as Area[]);
  };

  useEffect(() => {
    (async () => {
      const [{ data: ar }, { data: pr }, { data: st }] = await Promise.all([
        supabase.from("areas").select("id, project_id, name, sort_order, color")
          .eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
        supabase.from("projects").select("geo_lat, geo_lng").eq("id", projectId).maybeSingle(),
        // Today's status per area — one row per area, latest date
        supabase.from("area_day_status")
          .select("area_id, date, status")
          .eq("project_id", projectId)
          .order("date", { ascending: false }),
      ]);
      setAreas((ar ?? []) as Area[]);
      if (pr?.geo_lat != null && pr?.geo_lng != null) setGeo({ lat: pr.geo_lat, lng: pr.geo_lng });
      const latest: Record<string, string> = {};
      for (const row of (st ?? []) as any[]) {
        if (!latest[row.area_id]) latest[row.area_id] = row.status;
      }
      setStatusByArea(latest);
      setGeoLoaded(true);
    })();
  }, [projectId]);

  const byArea = useMemo(() => {
    const m = new Map<string, MapFeature[]>();
    for (const f of features) {
      const arr = m.get(f.area_id) ?? [];
      arr.push(f); m.set(f.area_id, arr);
    }
    return m;
  }, [features]);

  const statusTintByArea = useMemo(() => {
    const out: Record<string, StatusTint | undefined> = {};
    for (const [id, s] of Object.entries(statusByArea)) out[id] = tintForStatus(s);
    return out;
  }, [statusByArea]);

  const selectedFeature = useMemo(
    () => features.find((f) => f.id === selectedId) ?? null,
    [features, selectedId],
  );

  if (geoLoaded && !geo) {
    return (
      <Card className="p-6 text-sm">
        <p className="mb-3">Set the event location in project settings first — the map will center on it.</p>
        <p className="text-muted-foreground">Open <span className="font-medium">Settings → Details</span> and search for the venue.</p>
      </Card>
    );
  }

  const startDraw = (areaId: string, kind: "pin" | "polygon" | "rectangle") => {
    setDrawingAreaId(areaId);
    setDrawingKind(kind);
    setDrawingMode("attach");
    setSelectedId(null);
  };
  const startNewZone = (kind: "polygon" | "rectangle") => {
    setDrawingAreaId(null);
    setDrawingKind(kind);
    setDrawingMode("new");
    setSelectedId(null);
  };
  const cancelDraw = () => {
    setDrawingAreaId(null); setDrawingKind(null); setDrawingMode(null); setDraftCount(0);
  };

  const handleCreate = async (areaId: string | null, kind: any, geometry: any, col: string) => {
    if (drawingMode === "new") {
      const nextIdx = areas.length + 1;
      const newAreaId = await createZone(`Zone ${nextIdx}`, kind, geometry, col);
      if (newAreaId) {
        await reloadAreas();
        toast.success("Zone added");
      }
    } else if (areaId) {
      await create(areaId, kind, geometry, col);
      toast.success("Added to site map");
    }
    cancelDraw();
  };

  const kindLabel = (k: MapFeature["kind"]) => k === "pin" ? "Pin" : k === "polygon" ? "Zone" : "Box";

  const drawHintText =
    drawingMode === "new"
      ? (drawingKind === "polygon" ? "Click to add points — a new zone is created on Confirm." : "Click and drag to draw a new zone as a box.")
      : drawingKind === "pin" ? "Click on the map to drop the pin."
      : drawingKind === "polygon" ? "Click to add points, then press Confirm (or double-click)."
      : "Click and drag on the map to draw a box.";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Areas</h3>
          {drawingKind && (
            <Button size="sm" variant="ghost" onClick={cancelDraw}>
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
          )}
        </div>

        {canEdit && !drawingKind && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => startNewZone("polygon")}>
              <Plus className="mr-1 h-3 w-3" /> New zone
            </Button>
            <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => startNewZone("rectangle")}>
              <Plus className="mr-1 h-3 w-3" /> New box
            </Button>
          </div>
        )}

        {drawingKind === "polygon" && (
          <div className="flex gap-1">
            <Button
              size="sm" variant="outline" className="h-8 flex-1"
              disabled={draftCount === 0}
              onClick={() => canvasRef.current?.undoLastPoint()}
            >
              <Undo2 className="mr-1 h-3 w-3" /> Undo
            </Button>
            <Button
              size="sm" className="h-8 flex-1"
              disabled={draftCount < 3}
              onClick={() => canvasRef.current?.confirmPolygon()}
            >
              <Check className="mr-1 h-3 w-3" /> Confirm ({draftCount})
            </Button>
          </div>
        )}

        {areas.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No areas yet. Use <span className="font-medium">New zone</span> above to draw one, or add areas in Settings → Areas.
          </p>
        )}
        <ul className="space-y-2">
          {areas.map((a) => {
            const items = byArea.get(a.id) ?? [];
            const hasPrimary = items.some((f) => f.is_primary);
            const isActive = drawingAreaId === a.id;
            return (
              <li key={a.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.name}</span>
                  <div className="flex items-center gap-1">
                    {statusByArea[a.id] && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border border-white/60"
                        style={{ backgroundColor: tintForStatus(statusByArea[a.id])?.stroke }}
                        title={`Status: ${statusByArea[a.id]}`}
                      />
                    )}
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                </div>
                {!hasPrimary && items.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">No primary boundary — add or promote one.</p>
                )}
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant={isActive && drawingKind === "pin" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs" onClick={() => startDraw(a.id, "pin")}>
                      <MapPin className="mr-1 h-3 w-3" /> Pin
                    </Button>
                    <Button size="sm" variant={isActive && drawingKind === "polygon" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs" onClick={() => startDraw(a.id, "polygon")}>
                      <Pentagon className="mr-1 h-3 w-3" /> {hasPrimary ? "Zone" : "Boundary"}
                    </Button>
                    <Button size="sm" variant={isActive && drawingKind === "rectangle" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs" onClick={() => startDraw(a.id, "rectangle")}>
                      <Square className="mr-1 h-3 w-3" /> Box
                    </Button>
                  </div>
                )}
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {items.map((f) => {
                      const isSel = selectedId === f.id;
                      return (
                        <li
                          key={f.id}
                          className={`flex items-center justify-between gap-1 rounded px-1.5 py-1 text-xs ${isSel ? "bg-accent" : ""}`}
                        >
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 text-left"
                            onClick={() => setSelectedId(isSel ? null : f.id)}
                          >
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-white/60"
                              style={{ backgroundColor: f.color ?? "#64748B" }}
                            />
                            <span className="truncate">
                              {f.label?.trim() || kindLabel(f.kind)}
                            </span>
                            {f.is_primary && (
                              <Star className="h-3 w-3 text-amber-500 shrink-0" aria-label="Primary boundary" />
                            )}
                          </button>
                          {canEdit && (
                            <>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Change color">
                                    <Palette className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" side="right">
                                  <ColorSwatches current={f.color} onPick={(c) => updateColor(f.id, c)} />
                                </PopoverContent>
                              </Popover>
                              <Button
                                size="icon" variant="ghost" className="h-6 w-6"
                                onClick={() => { remove(f.id); if (isSel) setSelectedId(null); }}
                                aria-label="Delete feature"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {drawingKind && (
          <p className="text-xs text-muted-foreground">{drawHintText}</p>
        )}

        {selectedFeature && canEdit && !drawingKind && (
          <div className="rounded-md border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">Selected: {kindLabel(selectedFeature.kind)}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedId(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <label className="mb-1 block text-xs text-muted-foreground">Label</label>
            <input
              key={selectedFeature.id}
              type="text"
              defaultValue={selectedFeature.label ?? ""}
              placeholder="e.g. Main stage"
              maxLength={60}
              onBlur={(e) => {
                const v = e.target.value;
                if ((v.trim() || null) !== (selectedFeature.label ?? null)) updateLabel(selectedFeature.id, v);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="mb-2 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            />
            <p className="mb-2 text-xs text-muted-foreground">Color</p>
            <ColorSwatches current={selectedFeature.color} onPick={(c) => updateColor(selectedFeature.id, c)} />
            {(selectedFeature.kind === "polygon" || selectedFeature.kind === "rectangle") && !selectedFeature.is_primary && (
              <Button
                size="sm" variant="outline" className="mt-2 h-7 w-full text-xs"
                onClick={() => setPrimary(selectedFeature.id)}
              >
                <Star className="mr-1 h-3 w-3" /> Set as primary boundary
              </Button>
            )}
            <Button
              size="sm" variant="destructive" className="mt-2 h-7 w-full text-xs"
              onClick={() => { remove(selectedFeature.id); setSelectedId(null); }}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
          </div>
        )}
      </aside>

      <div className="h-[70vh] min-h-[500px]">
        {geo ? (
          <SiteMapCanvas
            ref={canvasRef}
            center={geo}
            areas={areas}
            features={features}
            drawingAreaId={drawingAreaId}
            drawingKind={drawingKind}
            onCreate={handleCreate}
            onUpdate={updateGeometry}
            onFeatureClick={(f) => setSelectedId(f.id)}
            onDraftChange={setDraftCount}
            selectedId={selectedId}
            fallbackColor={color ?? undefined}
            editable={canEdit}
            statusTintByArea={statusTintByArea}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
      </div>
    </div>
  );
}
