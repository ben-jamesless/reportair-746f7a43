import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Key = string; // `${photoId}|${dateKey}`

/**
 * Tracks which photos have been hidden from specific days in a project.
 * v2-only surface: writes to `photo_day_hidden`, filters used by DailyReport,
 * share day view, and day PDF (via edge function).
 */
export function useDayHiddenPhotos(projectId: string | undefined) {
  const [hidden, setHidden] = useState<Set<Key>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from("photo_day_hidden")
      .select("photo_id, date_key")
      .eq("project_id", projectId);
    if (error) {
      console.error("photo_day_hidden load failed", error);
      setLoading(false);
      return;
    }
    const s = new Set<Key>();
    for (const r of data ?? []) s.add(`${r.photo_id}|${r.date_key}`);
    setHidden(s);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const isHidden = useCallback(
    (photoId: string, dateKey: string) => hidden.has(`${photoId}|${dateKey}`),
    [hidden]
  );

  const hide = useCallback(
    async (photoId: string, dateKey: string) => {
      if (!projectId) return;
      const key = `${photoId}|${dateKey}`;
      setHidden((cur) => new Set(cur).add(key));
      const { error } = await supabase.from("photo_day_hidden").insert({
        project_id: projectId,
        photo_id: photoId,
        date_key: dateKey,
      });
      if (error && !/duplicate key/i.test(error.message)) {
        toast.error(error.message);
        setHidden((cur) => {
          const n = new Set(cur);
          n.delete(key);
          return n;
        });
      }
    },
    [projectId]
  );

  const unhide = useCallback(
    async (photoId: string, dateKey: string) => {
      if (!projectId) return;
      const key = `${photoId}|${dateKey}`;
      setHidden((cur) => {
        const n = new Set(cur);
        n.delete(key);
        return n;
      });
      const { error } = await supabase
        .from("photo_day_hidden")
        .delete()
        .eq("project_id", projectId)
        .eq("photo_id", photoId)
        .eq("date_key", dateKey);
      if (error) {
        toast.error(error.message);
        setHidden((cur) => new Set(cur).add(key));
      }
    },
    [projectId]
  );

  return { hidden, isHidden, hide, unhide, loading, refetch: load };
}
