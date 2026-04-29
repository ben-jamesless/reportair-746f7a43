import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseExif, getImageDimensions, sanitizeFileName } from "@/lib/photoUtils";

interface Props {
  projectId: string;
  albumId: string | null;
  areaId?: string | null;
  onUploaded?: () => void;
}

export const PhotoUploader = ({ projectId, albumId, areaId = null, onUploaded }: Props) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("No image files selected");

    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let failures = 0;

    for (const file of list) {
      try {
        const exif = await parseExif(file);
        if (!exif.width || !exif.height) {
          const dims = await getImageDimensions(file);
          if (dims) { exif.width = dims.width; exif.height = dims.height; }
        }

        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safe = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
        const key = `${projectId}/${albumId ?? "unsorted"}/${crypto.randomUUID()}-${safe}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(key, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("photos").insert({
          project_id: projectId,
          album_id: albumId,
          storage_path: key,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: user.id,
          ...exif,
        });
        if (insErr) {
          await supabase.storage.from("photos").remove([key]);
          throw insErr;
        }
      } catch (e: any) {
        failures++;
        console.error("Upload failed for", file.name, e);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setBusy(false);
    setProgress({ done: 0, total: 0 });
    if (failures === 0) toast.success(`Uploaded ${list.length} photo${list.length > 1 ? "s" : ""}`);
    else if (failures < list.length) toast.warning(`Uploaded ${list.length - failures} of ${list.length} (${failures} failed)`);
    else toast.error("All uploads failed");
    onUploaded?.();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? `Uploading ${progress.done}/${progress.total}` : "Upload photos"}
      </Button>
      {busy && progress.total > 0 && (
        <div className="mt-3 w-full max-w-sm">
          <Progress value={(progress.done / progress.total) * 100} />
        </div>
      )}
    </>
  );
};
