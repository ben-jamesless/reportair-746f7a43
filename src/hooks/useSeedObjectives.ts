import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the `seed_todays_objectives` RPC once per (project, date) mount.
 * Idempotent server-side. When it returns true (a seed happened), we trigger
 * onSeeded so the caller can refetch day_notes.
 */
export function useSeedObjectives(
  projectId: string | undefined,
  dateKey: string | null,
  isToday: boolean,
  canEdit: boolean,
  onSeeded: () => void
) {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId || !dateKey || !isToday || !canEdit) return;
    const cacheKey = `${projectId}|${dateKey}`;
    if (seenRef.current.has(cacheKey)) return;
    seenRef.current.add(cacheKey);
    (async () => {
      const { data, error } = await supabase.rpc("seed_todays_objectives", {
        _project_id: projectId,
        _date_key: dateKey,
      });
      if (error) {
        console.error("seed_todays_objectives failed", error);
        return;
      }
      if (data === true) onSeeded();
    })();
  }, [projectId, dateKey, isToday, canEdit, onSeeded]);
}
