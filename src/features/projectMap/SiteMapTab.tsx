import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Square, Pentagon, Trash2, X } from "lucide-react";
import { SiteMapCanvas } from "./SiteMapCanvas";
import { useMapFeatures, type MapFeature } from "./useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Props {
  projectId: string;
  color?: string | null;
  canEdit: boolean;
}

export function SiteMapTab({ projectId, color, canEdit }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const { features, create, updateGeometry, remove } = useMapFeatures(projectId);
  const [drawingAreaId, setDrawingAreaId] = useState<string | null>(null);
  const [drawingKind, setDrawingKind] = useState<"pin" | "polygon" | "rectangle" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: ar }, { data: pr }] = await Promise.all([
        supabase.from("areas").select("id, project_id, name, sort_order")
          .eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
        supabase.from("projects").select("geo_lat, geo_lng").eq("id", projectId).maybeSingle(),
      ]);
      setAreas((ar ?? []) as Area[]);
      if (pr?.geo_lat != null && pr?.geo_lng != null) setGeo({ lat: pr.geo_lat, lng: pr.geo_lng });
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

  if (geoLoaded && !geo) {
    return (
      <Card className="p-6 text-sm">
        <p className="mb-3">
          Set the event location in project settings first — the map will center on it.
        </p>
        <p className="text-muted-foreground">
          Open <span className="font-medium">Settings → Details</span> and search for the venue.
        </p>
      </Card>
    );
  }

  const startDraw = (areaId: string, kind: "pin" | "polygon" | "rectangle") => {
    setDrawingAreaId(areaId);
    setDrawingKind(kind);
  };
  const cancelDraw = () => { setDrawingAreaId(null); setDrawingKind(null); };

  const handleCreate = async (areaId: string, kind: any, geometry: any, col: string) => {
    await create(areaId, kind, geometry, col);
    cancelDraw();
    toast.success("Added to site map");
  };

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
        {areas.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No areas yet. Add areas in Settings → Areas.
          </p>
        )}
        <ul className="space-y-2">
          {areas.map((a) => {
            const items = byArea.get(a.id) ?? [];
            const isActive = drawingAreaId === a.id;
            return (
              <li key={a.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant={isActive && drawingKind === "pin" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs"
                      onClick={() => startDraw(a.id, "pin")}>
                      <MapPin className="mr-1 h-3 w-3" /> Pin
                    </Button>
                    <Button size="sm" variant={isActive && drawingKind === "polygon" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs"
                      onClick={() => startDraw(a.id, "polygon")}>
                      <Pentagon className="mr-1 h-3 w-3" /> Zone
                    </Button>
                    <Button size="sm" variant={isActive && drawingKind === "rectangle" ? "default" : "outline"}
                      className="h-7 flex-1 px-2 text-xs"
                      onClick={() => startDraw(a.id, "rectangle")}>
                      <Square className="mr-1 h-3 w-3" /> Box
                    </Button>
                  </div>
                )}
                {items.length > 0 && canEdit && (
                  <ul className="mt-2 space-y-1">
                    {items.map((f) => (
                      <li key={f.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{f.kind}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => remove(f.id)} aria-label="Delete feature">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {drawingKind && (
          <p className="text-xs text-muted-foreground">
            {drawingKind === "pin" ? "Click on the map to drop the pin." :
             drawingKind === "polygon" ? "Click to add points, double-click to finish." :
             "Click and drag on the map to draw a box."}
          </p>
        )}
      </aside>

      <div className="h-[70vh] min-h-[500px]">
        <SiteMapCanvas
          center={{ lat: geoLat, lng: geoLng }}
          areas={areas}
          features={features}
          drawingAreaId={drawingAreaId}
          drawingKind={drawingKind}
          onCreate={handleCreate}
          onUpdate={updateGeometry}
          fallbackColor={color ?? undefined}
          editable={canEdit}
        />
      </div>
    </div>
  );
}
