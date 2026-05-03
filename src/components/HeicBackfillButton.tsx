import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { projectId: string }

export const HeicBackfillButton = ({ projectId }: Props) => {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setLastResult(null);
    let totalConverted = 0;
    let totalFailed = 0;
    let totalSeen = 0;
    try {
      // Loop in small batches to avoid edge function memory limits.
      // Loop in small batches to avoid edge function memory limits.
      // Hard safety cap of 2000 photos per click.
      for (let i = 0; i < 700; i++) {
        const { data, error } = await supabase.functions.invoke("heic-backfill", {
          body: { project_id: projectId, limit: 3 },
        });
        if (error) throw error;
        const r = data as { total: number; converted: number; failed: number };
        totalSeen += r.total;
        totalConverted += r.converted;
        totalFailed += r.failed;
        setLastResult(`Converting… ${totalConverted} done${totalFailed ? ` (${totalFailed} failed)` : ""}`);
        if (r.total === 0) break;
      }
      if (totalSeen === 0) {
        setLastResult("No HEIC photos found.");
        toast.success("No HEIC photos to convert");
      } else {
        setLastResult(`Converted ${totalConverted}${totalFailed ? ` (${totalFailed} failed)` : ""}.`);
        toast.success(`Converted ${totalConverted} HEIC photos`);
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      setLastResult(`Error: ${msg}${totalConverted ? ` — ${totalConverted} converted before failure` : ""}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Convert HEIC photos to JPEG</p>
          <p className="text-xs text-muted-foreground">
            HEIC files don't display in Chrome or Firefox. Run this once to convert existing HEIC photos in this project.
            New uploads are converted automatically.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {busy ? "Converting…" : "Run"}
        </Button>
      </div>
      {lastResult && <p className="mt-2 text-xs text-muted-foreground">{lastResult}</p>}
    </div>
  );
};
