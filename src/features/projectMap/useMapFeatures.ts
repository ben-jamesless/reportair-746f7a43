import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MapFeatureKind = "pin" | "polygon" | "rectangle";

export interface MapFeature {
  id: string;
  project_id: string;
  area_id: string;
  kind: MapFeatureKind;
  geometry: any;
  label: string | null;
  color: string | null;
}

export function useMapFeatures(projectId: string) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("area_map_features")
      .select("id, project_id, area_id, kind, geometry, label, color")
      .eq("project_id", projectId);
    if (error) toast.error(error.message);
    setFeatures((data ?? []) as MapFeature[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (
    areaId: string,
    kind: MapFeatureKind,
    geometry: any,
    color?: string | null,
  ): Promise<MapFeature | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("area_map_features")
      .insert({ project_id: projectId, area_id: areaId, kind, geometry, color: color ?? null, created_by: user?.id })
      .select("id, project_id, area_id, kind, geometry, label, color")
      .single();
    if (error) { toast.error(error.message); return null; }
    setFeatures((cur) => [...cur, data as MapFeature]);
    return data as MapFeature;
  }, [projectId]);

  const updateGeometry = useCallback(async (id: string, geometry: any) => {
    setFeatures((cur) => cur.map((f) => f.id === id ? { ...f, geometry } : f));
    const { error } = await supabase
      .from("area_map_features")
      .update({ geometry })
      .eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  const remove = useCallback(async (id: string) => {
    setFeatures((cur) => cur.filter((f) => f.id !== id));
    const { error } = await supabase.from("area_map_features").delete().eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  return { features, loading, create, updateGeometry, remove, reload: load };
}
