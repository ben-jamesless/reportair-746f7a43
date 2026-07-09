// Client-side point-in-primary-zone assignment used at photo upload time.
// Only primary boundaries (polygon / rectangle) are considered. Pins are
// annotations, not zones. Silent no-op when there's no GPS or no match.

import { supabase } from "@/integrations/supabase/client";

export type PrimaryZone = {
  area_id: string;
  area_name: string;
  kind: "polygon" | "rectangle";
  geometry: any;
};

export async function fetchPrimaryZones(projectId: string): Promise<PrimaryZone[]> {
  // Considers ALL boundary features (primary and secondary) so photos taken
  // inside any drawn zone get auto-assigned. The exactly-one-match policy in
  // assignZoneForPoint still prevents ambiguous hits.
  const { data, error } = await supabase
    .from("area_map_features")
    .select("area_id, kind, geometry, areas!inner(name)")
    .eq("project_id", projectId)
    .in("kind", ["polygon", "rectangle"]);
  if (error || !data) return [];
  return data.map((r: any) => ({
    area_id: r.area_id,
    area_name: r.areas?.name ?? "",
    kind: r.kind,
    geometry: r.geometry,
  }));
}

function pointInRect(lat: number, lng: number, g: any): boolean {
  return lat >= g.south && lat <= g.north && lng >= g.west && lng <= g.east;
}

// Ray-casting on a lat/lng polygon. Fine for the small, non-antimeridian
// event-site polygons we deal with here.
function pointInPolygon(lat: number, lng: number, g: any): boolean {
  const pts = (g?.paths ?? []) as Array<{ lat: number; lng: number }>;
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i].lat, xi = pts[i].lng;
    const yj = pts[j].lat, xj = pts[j].lng;
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Returns the matching primary zone, or null if none / ambiguous. */
export function assignZoneForPoint(
  lat: number,
  lng: number,
  zones: PrimaryZone[],
): PrimaryZone | null {
  const hits = zones.filter((z) =>
    z.kind === "rectangle" ? pointInRect(lat, lng, z.geometry) : pointInPolygon(lat, lng, z.geometry),
  );
  // Exactly-one policy: don't guess between overlapping zones.
  return hits.length === 1 ? hits[0] : null;
}
