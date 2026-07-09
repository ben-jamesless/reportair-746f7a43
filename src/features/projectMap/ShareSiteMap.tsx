import { useEffect, useMemo, useState } from "react";
import { Link2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteMapCanvas } from "@/features/projectMap/SiteMapCanvas";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { toast } from "sonner";

interface Props {
  token: string;
  areas: Array<{ id: string; name: string }>;
  onAreaClick?: (areaId: string) => void;
  highlightAreaId?: string | null;
}

// Read-only site map for the public share page. Renders only if features exist.
export function ShareSiteMap({ token, areas, onAreaClick, highlightAreaId }: Props) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyZoneLink = async (areaId: string, name: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("zone", areaId);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedId(areaId);
      toast.success(`Link to "${name}" copied`);
      setTimeout(() => setCopiedId((c) => (c === areaId ? null : c)), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  };

  useEffect(() => {
    (async () => {
      const [{ data: feats }, { data: c }] = await Promise.all([
        supabase.rpc("list_share_map_features", { _token: token }),
        supabase.rpc("get_share_project_center", { _token: token }),
      ]);
      setFeatures((feats ?? []) as any);
      if (c && typeof (c as any).lat === "number") setCenter(c as any);
    })();
  }, [token]);

  // Area id -> representative color from placed features (fallback swatch if none)
  const areaColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features ?? []) {
      if (!m.has(f.area_id) && f.color) m.set(f.area_id, f.color);
    }
    return m;
  }, [features]);

  if (!features || features.length === 0) return null;

  // Fallback center = first feature's centroid
  const fallbackCenter = (() => {
    const first = features[0];
    if (first.kind === "pin") return { lat: first.geometry.lat, lng: first.geometry.lng };
    if (first.kind === "rectangle") return {
      lat: (first.geometry.north + first.geometry.south) / 2,
      lng: (first.geometry.east + first.geometry.west) / 2,
    };
    return first.geometry.paths?.[0] ?? { lat: 0, lng: 0 };
  })();

  const areaShape = areas.map((a, i) => ({ id: a.id, project_id: "", name: a.name, sort_order: i })) as Area[];
  const areasWithFeatures = areas.filter((a) => areaColor.has(a.id));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Site map</h3>
        <p className="text-xs text-muted-foreground">Click an area on the map to view its photos.</p>
      </div>
      <div className="min-h-0 flex-1 w-full">
        <SiteMapCanvas
          center={center ?? fallbackCenter}
          zoom={17}
          areas={areaShape}
          features={features}
          editable={false}
          fitToFeatures
          highlightAreaId={highlightAreaId ?? null}
          onFeatureClick={(f) => onAreaClick?.(f.area_id)}
        />
      </div>
      {areasWithFeatures.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          {areasWithFeatures.map((a) => {
            const active = highlightAreaId === a.id;
            return (
              <div key={a.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => onAreaClick?.(a.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? "bg-foreground text-background border-foreground font-semibold shadow-sm ring-2 ring-foreground/30"
                      : "bg-background hover:bg-accent"
                  } ${active ? "rounded-r-none border-r-0" : ""}`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-white/60"
                    style={{ backgroundColor: areaColor.get(a.id) ?? "#64748B" }}
                  />
                  <span>{a.name}</span>
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={() => copyZoneLink(a.id, a.name)}
                    title="Copy link to this zone"
                    aria-label={`Copy link to ${a.name}`}
                    className="inline-flex items-center gap-1 rounded-r-full border border-l-0 border-foreground bg-foreground px-2 py-1 text-xs text-background hover:bg-foreground/90"
                  >
                    {copiedId === a.id ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
