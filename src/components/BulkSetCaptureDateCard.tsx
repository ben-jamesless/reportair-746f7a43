import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { projectId: string }

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Photos uploaded from iOS Safari's share sheet arrive with EXIF stripped,
 * which used to silently land them all on "today". This control finds those
 * specific photos (filename starts with `tempImage` AND captured_at is within
 * a few seconds of created_at) and bulk-sets their capture date.
 */
export const BulkSetCaptureDateCard = ({ projectId }: Props) => {
  const [count, setCount] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayYmd());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadCount = async () => {
    setLoading(true);
    try {
      // Heuristic: iOS temp-named files where captured_at ≈ created_at.
      // We can't express the time-delta filter purely in PostgREST, so we
      // fetch the candidate rows and filter client-side.
      const { data, error } = await supabase
        .from("photos")
        .select("id, captured_at, created_at, file_name")
        .eq("project_id", projectId)
        .ilike("file_name", "tempImage%")
        .limit(5000);
      if (error) throw error;
      const matching = (data ?? []).filter((p) => {
        if (!p.captured_at || !p.created_at) return true;
        const diff = Math.abs(new Date(p.captured_at).getTime() - new Date(p.created_at).getTime());
        return diff < 5000;
      });
      setCount(matching.length);
    } catch (e) {
      console.warn("Failed to count affected photos", e);
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCount(); }, [projectId]);

  const apply = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id, captured_at, created_at")
        .eq("project_id", projectId)
        .ilike("file_name", "tempImage%")
        .limit(5000);
      if (error) throw error;
      const ids = (data ?? [])
        .filter((p) => {
          if (!p.captured_at || !p.created_at) return true;
          const diff = Math.abs(new Date(p.captured_at).getTime() - new Date(p.created_at).getTime());
          return diff < 5000;
        })
        .map((p) => p.id);
      if (ids.length === 0) {
        toast.info("No affected photos to update.");
        return;
      }
      const iso = new Date(`${date}T12:00:00`).toISOString();
      const { error: updErr } = await supabase
        .from("photos")
        .update({ captured_at: iso })
        .in("id", ids);
      if (updErr) throw updErr;
      toast.success(`Updated capture date on ${ids.length} photo${ids.length === 1 ? "" : "s"}`);
      await loadCount();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to update photos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Set capture date for photos missing one</p>
          <p className="text-xs text-muted-foreground">
            When you upload from iPhone, Safari can strip the original capture date —
            those photos all show up as "today". Newly uploaded photos now ask for a
            date up front, but this control fixes any from earlier uploads in this
            project.
          </p>
          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">Checking…</p>
          ) : count === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No affected photos found.</p>
          ) : count != null ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="bulk-date" className="text-xs">Set date to</Label>
                <Input
                  id="bulk-date"
                  type="date"
                  value={date}
                  max={todayYmd()}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-44"
                />
              </div>
              <Button size="sm" onClick={apply} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Apply to {count} photo{count === 1 ? "" : "s"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
