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
  is_primary: boolean;
}

const SELECT = "id, project_id, area_id, kind, geometry, label, color, is_primary";

export function useMapFeatures(projectId: string) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("area_map_features")
      .select(SELECT)
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
    // If the area has no primary feature yet, promote this one.
    const areaHasPrimary = features.some((f) => f.area_id === areaId && f.is_primary);
    const willBePrimary = !areaHasPrimary && (kind === "polygon" || kind === "rectangle");

    const { data, error } = await supabase
      .from("area_map_features")
      .insert({
        project_id: projectId, area_id: areaId, kind, geometry,
        color: color ?? null, created_by: user?.id,
        is_primary: willBePrimary,
      })
      .select(SELECT)
      .single();
    if (error) { toast.error(error.message); return null; }
    setFeatures((cur) => [...cur, data as MapFeature]);
    return data as MapFeature;
  }, [projectId, features]);

  /** Map-led create: RPC creates an Area + a primary geometry in one step. Returns new area id. */
  const createZone = useCallback(async (
    name: string,
    kind: "polygon" | "rectangle" | "pin",
    geometry: any,
    color?: string | null,
  ): Promise<string | null> => {
    const { data, error } = await supabase.rpc("create_zone_with_geometry", {
      _project_id: projectId,
      _name: name,
      _kind: kind,
      _geometry: geometry,
      _color: color ?? null,
    });
    if (error) { toast.error(error.message); return null; }
    await load();
    return data as string;
  }, [projectId, load]);

  const setPrimary = useCallback(async (featureId: string) => {
    const target = features.find((f) => f.id === featureId);
    if (!target) return;
    // Optimistic
    setFeatures((cur) => cur.map((f) => {
      if (f.area_id !== target.area_id) return f;
      return { ...f, is_primary: f.id === featureId };
    }));
    const { error } = await supabase.rpc("set_primary_map_feature", { _feature_id: featureId });
    if (error) { toast.error(error.message); await load(); }
  }, [features, load]);

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

  const updateColor = useCallback(async (id: string, color: string) => {
    setFeatures((cur) => cur.map((f) => f.id === id ? { ...f, color } : f));
    const { error } = await supabase.from("area_map_features").update({ color }).eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  const updateLabel = useCallback(async (id: string, label: string) => {
    const clean = label.trim() || null;
    setFeatures((cur) => cur.map((f) => f.id === id ? { ...f, label: clean } : f));
    const { error } = await supabase.from("area_map_features").update({ label: clean }).eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  return {
    features, loading,
    create, createZone, setPrimary,
    updateGeometry, remove, updateColor, updateLabel,
    reload: load,
  };
}
