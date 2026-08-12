import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteMapCanvas } from "@/features/projectMap/SiteMapCanvas";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import type { Area } from "@/components/AreasManager";
import { V2, statusMeta } from "../tokens";
import type { ShareV2DayArea } from "../types";

/**
 * Read-only site map for the v2 share page. Areas are tinted with their status
 * for the active day; clicking a shape jumps to that area's card.
 */
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
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: feats }, { data: c }] = await Promise.all([
        supabase.rpc("list_share_map_features" as never, { _token: token } as never),
        supabase.rpc("get_share_project_center" as never, { _token: token } as never),
      ]);
      if (!alive) return;
      setFeatures(((feats ?? []) as unknown) as MapFeature[]);
      const cc = c as unknown as { lat?: number; lng?: number } | null;
      if (cc && typeof cc.lat === "number" && typeof cc.lng === "number")
        setCenter({ lat: cc.lat, lng: cc.lng });
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const tints = useMemo(() => {
    const out: Record<string, { fill: string; stroke: string }> = {};
    for (const a of areas) {
      const m = statusMeta(a.status);
      out[a.area_id] = { fill: m.fg, stroke: m.fg };
    }
    return out;
  }, [areas]);

  const canvasAreas = useMemo(
    () =>
      areas.map((a, i) => ({ id: a.area_id, project_id: "", name: a.name, sort_order: i })) as Area[],
    [areas]
  );

  if (!features || features.length === 0) return null;

  const first = features[0];
  const fallbackCenter =
    first.kind === "pin"
      ? { lat: first.geometry.lat, lng: first.geometry.lng }
      : first.kind === "rectangle"
      ? {
          lat: (first.geometry.north + first.geometry.south) / 2,
          lng: (first.geometry.east + first.geometry.west) / 2,
        }
      : first.geometry.paths?.[0] ?? { lat: 0, lng: 0 };

  const mapped = new Set(features.map((f) => f.area_id));
  const legend = areas.filter((a) => mapped.has(a.area_id));

  const select = (id: string) => {
    setHighlight(id);
    onAreaClick?.(id);
  };

  return (
    <div className="overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="uppercase"
        style={{
          fontFamily: V2.mono,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: V2.muted,
          padding: "10px 14px",
          backgroundColor: V2.paperDim,
          borderBottom: `1px solid ${V2.rule}`,
        }}
      >
        Site map
      </div>
      <div style={{ height: 340, width: "100%" }}>
        <SiteMapCanvas
          center={center ?? fallbackCenter}
          zoom={17}
          areas={canvasAreas}
          features={features}
          editable={false}
          fitToFeatures
          statusTintByArea={tints}
          highlightAreaId={highlight}
          onFeatureClick={(f) => select(f.area_id)}
        />
      </div>
      {legend.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          style={{ padding: "10px 12px", borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          {legend.map((a) => {
            const m = statusMeta(a.status);
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
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: m.fg }} />
                {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
