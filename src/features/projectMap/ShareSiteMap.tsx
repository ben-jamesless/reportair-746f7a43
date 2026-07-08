import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteMapCanvas } from "@/features/projectMap/SiteMapCanvas";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import type { Area } from "@/components/AreasManager";

interface Props {
  token: string;
  areas: Array<{ id: string; name: string }>;
}

// Read-only site map for the public share page. Renders only if features exist.
export function ShareSiteMap({ token, areas }: Props) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_share_map_features", { _token: token });
      setFeatures((data ?? []) as any);
    })();
  }, [token]);

  if (!features || features.length === 0) return null;

  // Derive center from first feature (canvas otherwise fitBounds—we keep it simple).
  const first = features[0];
  const center =
    first.kind === "pin" ? { lat: first.geometry.lat, lng: first.geometry.lng } :
    first.kind === "rectangle" ? {
      lat: (first.geometry.north + first.geometry.south) / 2,
      lng: (first.geometry.east + first.geometry.west) / 2,
    } :
    first.geometry.paths?.[0] ?? { lat: 0, lng: 0 };

  const areaShape = areas.map((a, i) => ({ id: a.id, project_id: "", name: a.name, sort_order: i })) as Area[];

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-md border">
      <SiteMapCanvas
        center={center}
        zoom={17}
        areas={areaShape}
        features={features}
        editable={false}
      />
    </div>
  );
}
