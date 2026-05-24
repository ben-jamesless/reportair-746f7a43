import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the number of distinct calendar dates (UTC) on which photos have
 * been uploaded to the given project. Used to enforce the Free plan's
 * 3-update-day cap.
 */
export function useProjectUpdateDays(projectId: string | null) {
  const [dayCount, setDayCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    let cancelled = false;

    const fetchCount = async () => {
      const { data, error } = await supabase
        .rpc("get_project_update_day_count" as never, { _project_id: projectId } as never);
      if (cancelled) return;
      if (!error && typeof data === "number") setDayCount(data);
      setLoading(false);
    };

    fetchCount();

    // Use a unique channel name per mount to avoid Supabase rejecting
    // .on() calls on an already-subscribed channel when the effect re-runs.
    const channelName = `update-days-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: `project_id=eq.${projectId}` },
        () => { fetchCount(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { dayCount, loading };
}
