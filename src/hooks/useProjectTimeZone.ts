import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveEventTimeZone, cachedEventTimeZone, UTC } from "@/lib/eventTime";

/**
 * The event's local timezone for a project id, resolved from its coordinates.
 * Cached per project so every surface (Library, Daily Report, lightbox,
 * exports) renders capture times from the same zone.
 */
const geoCache = new Map<string, { lat: number | null; lng: number | null }>();
const tzByProject = new Map<string, string>();

export function useProjectTimeZone(projectId: string | null | undefined): string {
  const [tz, setTz] = useState<string>(() =>
    projectId ? tzByProject.get(projectId) ?? UTC : UTC
  );

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      let geo = geoCache.get(projectId);
      if (!geo) {
        const { data } = await supabase
          .from("projects")
          .select("geo_lat, geo_lng")
          .eq("id", projectId)
          .maybeSingle();
        geo = {
          lat: (data as { geo_lat: number | null } | null)?.geo_lat ?? null,
          lng: (data as { geo_lng: number | null } | null)?.geo_lng ?? null,
        };
        geoCache.set(projectId, geo);
      }
      const zone = await resolveEventTimeZone(geo.lat, geo.lng);
      tzByProject.set(projectId, zone);
      if (!cancelled) setTz(zone);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return tz;
}

export { cachedEventTimeZone };
