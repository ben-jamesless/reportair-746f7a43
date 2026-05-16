import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseExif } from "@/lib/photoUtils";

interface Props { projectId: string }

type Row = {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  captured_at: string | null;
  created_at: string;
};

/**
 * Re-reads EXIF from each photo in storage and updates `captured_at` if it
 * differs from what's stored. Useful for photos uploaded before the EXIF
 * fallback logic landed, or where the original capture date was missed.
 *
 * Runs entirely in the browser — same code path as upload — so it benefits
 * from the same EXIF parser fixes across browsers.
 */
export const PhotoDateBackfillButton = ({ projectId }: Props) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setStatus("Loading photos…");
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id, storage_path, file_name, mime_type, captured_at, created_at")
        .eq("project_id", projectId)
        .limit(2000);
      if (error) throw error;

      const rows = (data ?? []) as Row[];
      if (rows.length === 0) {
        setStatus("No photos to scan.");
        toast.success("Nothing to backfill");
        return;
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setStatus(`Scanning ${i + 1}/${rows.length}…`);
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from("photos")
            .download(r.storage_path);
          if (dlErr || !blob) throw dlErr ?? new Error("download failed");

          const fileName = r.file_name || r.storage_path.split("/").pop() || "photo.jpg";
          const file = new File([blob], fileName, {
            type: r.mime_type || blob.type || "image/jpeg",
            // Best-effort: original lastModified is lost once uploaded, so
            // fall back to created_at so EXIF-less photos at least keep a
            // sensible date rather than "today".
            lastModified: new Date(r.created_at).getTime(),
          });

          const exif = await parseExif(file);
          const next = exif.captured_at;
          if (!next) { unchanged++; continue; }

          // Skip if effectively the same as what's already stored.
          if (r.captured_at && Math.abs(new Date(r.captured_at).getTime() - new Date(next).getTime()) < 2000) {
            unchanged++;
            continue;
          }

          const { error: updErr } = await supabase
            .from("photos")
            .update({ captured_at: next })
            .eq("id", r.id);
          if (updErr) throw updErr;
          updated++;
        } catch (e) {
          failed++;
          console.error("Date backfill failed for", r.file_name ?? r.storage_path, e);
        }
      }

      const summary = `Updated ${updated} · unchanged ${unchanged}${failed ? ` · ${failed} failed` : ""}`;
      setStatus(summary);
      toast.success(summary);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      setStatus(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Fix photo capture dates</p>
          <p className="text-xs text-muted-foreground">
            Re-reads each photo's EXIF and updates the capture date if it's wrong.
            Photos without EXIF (screenshots, AirDropped copies) fall back to their
            original upload time instead of "today".
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
          {busy ? "Scanning…" : "Run"}
        </Button>
      </div>
      {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
    </div>
  );
};
