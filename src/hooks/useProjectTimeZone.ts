import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveEventZone,
  cachedEventTimeZone,
  timeZoneNote,
  UTC,
  type EventZone,
} from "@/lib/eventTime";

/**
 * The event's local timezone for a project id, resolved from its coordinates.
 * Cached per project so every surface (Library, Daily Report, lightbox,
 * exports) renders capture times from the same zone.
 *
 * The zone is returned WITH its provenance: a project with no coordinates
 * falls back to UTC, and every surface that prints a time has to say so
 * rather than let the reader assume site-local.
 */
const geoCache = new Map<string, { lat: number | null; lng: number | null }>();
const zoneByProject = new Map<string, EventZone>();

const UNRESOLVED: EventZone = { tz: UTC, resolved: false, reason: "no_coords" };

export function useProjectTimeZoneInfo(
  projectId: string | null | undefined
): EventZone & { note: string } {
  const [zone, setZone] = useState<EventZone>(() =>
    projectId ? zoneByProject.get(projectId) ?? UNRESOLVED : UNRESOLVED
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
      const z = await resolveEventZone(geo.lat, geo.lng);
      zoneByProject.set(projectId, z);
      if (!cancelled) setZone(z);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { ...zone, note: timeZoneNote(zone) };
}

export function useProjectTimeZone(projectId: string | null | undefined): string {
  return useProjectTimeZoneInfo(projectId).tz;
}

export { cachedEventTimeZone };
