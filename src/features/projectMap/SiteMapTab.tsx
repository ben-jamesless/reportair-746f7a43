import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pentagon, Trash2, X, Undo2, Check, Star, Plus, Pencil, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiteMapCanvas, type SiteMapCanvasHandle, type StatusTint } from "./SiteMapCanvas";
import { useMapFeatures, type MapFeature } from "./useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { toast } from "sonner";
import { PROJECT_COLOR_PALETTE } from "@/lib/projectColors";

interface Props {
  projectId: string;
  color?: string | null;
  canEdit: boolean;
  onAreasChanged?: () => void;
  /** v2 wrapper hook: called when user taps a polygon in View mode. */
  onAreaOpen?: (areaId: string) => void;
  /** v2 wrapper hook: default mode (view or edit). Falls back to "view". */
  defaultMode?: "view" | "edit";
}

// Status → hex, aligned with PROJECT_STATUSES in src/lib/projectStatus.ts
const STATUS_HEX: Record<string, string> = {
  no_status: "#9C9A93",
  on_track: "#3A6EA5",
  requires_discussion: "#D4A017",
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

export function SiteMapTab({ projectId, color, canEdit, onAreasChanged, onAreaOpen, defaultMode }: Props) {
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
  // Consolidated Map tab: one surface, two modes. View mode is the default read-only surface;
  // Edit mode exposes draw/edit/delete for boundaries. Toggle sits in the tab header.
  const [mode, setMode] = useState<"view" | "edit">(defaultMode ?? "view");
  const isEditMode = canEdit && mode === "edit";
  const canvasRef = useRef<SiteMapCanvasHandle>(null);
  const [deleteArea, setDeleteArea] = useState<Area | null>(null);

  const handleDeleteArea = async (area: Area) => {
    const { error } = await supabase
      .from("areas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", area.id);
    if (error) { toast.error(error.message); return; }
    setAreas((cur) => cur.filter((a) => a.id !== area.id));
    setDeleteArea(null);
    onAreasChanged?.();
    toast.success(`Area "${area.name}" deleted`);
  };

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
        onAreasChanged?.();
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

  // Header: mode toggle + status legend. Present in both modes so switching feels obvious.
  const legendStatuses = useMemo(() => {
    const used = new Set(Object.values(statusByArea).filter(Boolean));
    return Array.from(used);
  }, [statusByArea]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">Site map</h3>
        {legendStatuses.length > 0 && (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            {legendStatuses.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full border border-white/60"
                  style={{ backgroundColor: tintForStatus(s)?.stroke }}
                />
                {s.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
      {canEdit && (
        isEditMode ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { cancelDraw(); setSelectedId(null); setMode("view"); }}
          >
            <Eye className="mr-1 h-3 w-3" /> Done editing
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
            <Pencil className="mr-1 h-3 w-3" /> Edit boundaries
          </Button>
        )
      )}
    </div>
  );

  // VIEW MODE — single-column map, read-only. Tapping a polygon opens that area
  // (via onAreaOpen, or nothing if not provided).
  if (!isEditMode) {
    return (
      <div className="space-y-3">
        {header}
        <div className="h-[70vh] min-h-[500px] overflow-hidden rounded-md border border-[#E3DFD4] bg-card">
          {geo ? (
            <SiteMapCanvas
              center={geo}
              areas={areas}
              features={features}
              onFeatureClick={(f) => onAreaOpen?.(f.area_id)}
              fallbackColor={color ?? undefined}
              editable={false}
              statusTintByArea={statusTintByArea}
              fitToFeatures
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          )}
        </div>
      </div>
    );
  }

  // EDIT MODE — original two-column layout with drawing tools.
  return (
    <div className="space-y-3">
      {header}
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
          <Button size="sm" variant="outline" className="h-8 w-full" onClick={() => startNewZone("polygon")}>
            <Plus className="mr-1 h-3 w-3" /> Add zone
          </Button>
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
            No areas yet. Use <span className="font-medium">Add zone</span> above to draw one, or add areas in Settings → Areas.
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
                    {canEdit && (
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setDeleteArea(a)}
                        aria-label={`Delete area ${a.name}`}
                        title="Delete area"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {!hasPrimary && items.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">No primary boundary — add or promote one.</p>
                )}
                {canEdit && (
                  <div className="mt-2">
                    <Button size="sm" variant={isActive && drawingKind === "polygon" ? "default" : "outline"}
                      className="h-7 w-full px-2 text-xs" onClick={() => startDraw(a.id, "polygon")}>
                      <Pentagon className="mr-1 h-3 w-3" /> {hasPrimary ? "Add zone" : "Draw boundary"}
                    </Button>
                  </div>
                )}
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {items.map((f) => {
                      const isSel = selectedId === f.id;
                      const isEditable = canEdit && (f.kind === "polygon" || f.kind === "rectangle");
                      return (
                        <li
                          key={f.id}
                          className={`flex items-center justify-between gap-1 rounded px-1.5 py-1 text-xs ${isSel ? "ring-1 ring-inset ring-border" : ""}`}
                        >
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-white/60 shrink-0"
                              style={{ backgroundColor: f.color ?? "#64748B" }}
                            />
                            <span className="truncate">
                              {f.label?.trim() || kindLabel(f.kind)}
                            </span>
                            {f.is_primary && (
                              <Star className="h-3 w-3 text-amber-500 shrink-0" aria-label="Primary boundary" />
                            )}
                          </div>
                          {isEditable ? (
                            <Popover
                              open={isSel}
                              onOpenChange={(o) => setSelectedId(o ? f.id : (isSel ? null : selectedId))}
                            >
                              <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Edit zone">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3" side="right" align="start">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold">Edit zone</span>
                                  </div>
                                  <label className="block text-[11px] text-muted-foreground">Label</label>
                                  <input
                                    key={f.id}
                                    type="text"
                                    defaultValue={f.label ?? ""}
                                    placeholder="e.g. Main stage"
                                    maxLength={60}
                                    onBlur={(e) => {
                                      const v = e.target.value;
                                      if ((v.trim() || null) !== (f.label ?? null)) updateLabel(f.id, v);
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                  />
                                  <p className="text-[11px] text-muted-foreground">Color</p>
                                  <ColorSwatches current={f.color} onPick={(c) => updateColor(f.id, c)} />
                                  {!f.is_primary && (
                                    <Button
                                      size="sm" variant="outline" className="h-7 w-full text-xs"
                                      onClick={() => setPrimary(f.id)}
                                    >
                                      <Star className="mr-1 h-3 w-3" /> Set as primary boundary
                                    </Button>
                                  )}
                                  <Button
                                    size="sm" variant="destructive" className="h-7 w-full text-xs"
                                    onClick={() => { remove(f.id); setSelectedId(null); }}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : canEdit && (
                            <Button
                              size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => { remove(f.id); if (isSel) setSelectedId(null); }}
                              aria-label="Delete feature"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
      </aside>


      <div className="h-[70vh] min-h-[500px] overflow-hidden rounded-md border border-[#E3DFD4] bg-card">
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
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
