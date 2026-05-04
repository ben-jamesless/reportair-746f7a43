import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { projectId: string }

type HeicPhoto = {
  id: string;
  storage_path: string;
  file_name: string | null;
};

const convertHeicBlobToJpeg = async (blob: Blob, fileName: string) => {
  const newName = fileName.replace(/\.(heic|heif)$/i, "") + ".jpg";
  // Try heic-to first (uses libheif-js, supports HEVC from iPhones reliably)
  try {
    const { heicTo } = await import("heic-to");
    const file = blob instanceof File ? blob : new File([blob], fileName, { type: blob.type || "image/heic" });
    const jpegBlob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.88 });
    return { jpegBlob: jpegBlob as Blob, newName };
  } catch (primaryErr) {
    console.warn("heic-to failed, falling back to heic2any:", primaryErr);
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.88 });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    return { jpegBlob, newName };
  }
};

export const HeicBackfillButton = ({ projectId }: Props) => {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setLastResult(null);
    let totalConverted = 0;
    let totalFailed = 0;
    try {
      const { data: photos, error: listError } = await supabase
        .from("photos")
        .select("id, storage_path, file_name")
        .eq("project_id", projectId)
        .or("file_name.ilike.%.heic,file_name.ilike.%.heif,mime_type.eq.image/heic,mime_type.eq.image/heif")
        .limit(1000);
      if (listError) throw listError;

      const queue = (photos ?? []) as HeicPhoto[];
      for (const photo of queue) {
        const originalName = photo.file_name || photo.storage_path.split("/").pop() || "photo.heic";
        try {
          setLastResult(`Converting ${totalConverted + totalFailed + 1}/${queue.length}…`);
          const { data: blob, error: downloadError } = await supabase.storage.from("photos").download(photo.storage_path);
          if (downloadError || !blob) throw downloadError ?? new Error("Download failed");

          const { jpegBlob, newName } = await convertHeicBlobToJpeg(blob, originalName);
          const newPath = /\.(heic|heif)$/i.test(photo.storage_path)
            ? photo.storage_path.replace(/\.(heic|heif)$/i, ".jpg")
            : `${photo.storage_path}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("photos")
            .upload(newPath, jpegBlob, { contentType: "image/jpeg", upsert: true });
          if (uploadError) throw uploadError;

          const { error: updateError } = await supabase
            .from("photos")
            .update({ storage_path: newPath, file_name: newName, mime_type: "image/jpeg", size_bytes: jpegBlob.size })
            .eq("id", photo.id);
          if (updateError) throw updateError;

          if (newPath !== photo.storage_path) {
            await supabase.storage.from("photos").remove([photo.storage_path]);
          }
          totalConverted++;
        } catch (photoError) {
          totalFailed++;
          console.error("HEIC backfill failed for", originalName, photoError);
        }
      }

      if (queue.length === 0) {
        setLastResult("No HEIC photos found.");
        toast.success("No HEIC photos to convert");
      } else {
        setLastResult(`Converted ${totalConverted}${totalFailed ? ` (${totalFailed} skipped — too large or corrupt)` : ""}.`);
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
