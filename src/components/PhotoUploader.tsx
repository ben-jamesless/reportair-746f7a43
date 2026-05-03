import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { parseExif, getImageDimensions, sanitizeFileName } from "@/lib/photoUtils";

const isHeic = (file: File) => {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
};

const convertHeicToJpeg = async (file: File): Promise<File> => {
  // Dynamically import to keep the heic2any bundle out of the initial JS payload.
  const { default: heic2any } = await import("heic2any");
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const out = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([out], newName, { type: "image/jpeg", lastModified: file.lastModified });
};

type AreaOption = { id: string; name: string };

interface Props {
  projectId: string;
  albumId: string | null;
  areaId?: string | null;
  areas?: AreaOption[];
  onUploaded?: () => void;
}

const NO_AREA = "__no_area__";

export const PhotoUploader = ({ projectId, albumId, areaId = null, areas = [], onUploaded }: Props) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>(areaId ?? NO_AREA);

  // Keep dropdown synced if context area changes between opens
  useEffect(() => { setSelectedArea(areaId ?? NO_AREA); }, [areaId]);

  const onFilesPicked = (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) { toast.error("No image files selected"); return; }
    setPendingFiles(list);
    setSelectedArea(areaId ?? NO_AREA);
  };

  const runUpload = async () => {
    if (!pendingFiles || !user) return;
    const list = pendingFiles;
    const targetArea = selectedArea === NO_AREA ? null : selectedArea;
    setPendingFiles(null);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let failures = 0;
    const errors: string[] = [];

    for (const original of list) {
      let file = original;
      try {
        if (isHeic(file)) {
          try {
            file = await convertHeicToJpeg(file);
          } catch (convErr) {
            // Some HEIC variants can't be decoded in-browser — upload original; backfill will convert server-side.
            console.warn("HEIC conversion failed, uploading original", file.name, convErr);
          }
        }

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
          area_id: targetArea,
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
        const msg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
        errors.push(`${file.name}: ${msg}`);
        console.error("Upload failed for", file.name, e);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setBusy(false);
    setProgress({ done: 0, total: 0 });
    const firstErr = errors[0];
    if (failures === 0) toast.success(`Uploaded ${list.length} photo${list.length > 1 ? "s" : ""}`);
    else if (failures < list.length) toast.warning(`Uploaded ${list.length - failures} of ${list.length} (${failures} failed)`, { description: firstErr });
    else toast.error("All uploads failed", { description: firstErr ?? "Check console for details", duration: 10000 });
    onUploaded?.();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => onFilesPicked(e.target.files)}
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

      <Dialog
        open={!!pendingFiles}
        onOpenChange={(open) => { if (!open) { setPendingFiles(null); if (inputRef.current) inputRef.current.value = ""; } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {pendingFiles?.length ?? 0} photo{(pendingFiles?.length ?? 0) === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Confirm where these photos belong. The capture day comes from each photo's EXIF data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {pendingFiles?.length} file{(pendingFiles?.length ?? 0) === 1 ? "" : "s"} selected
            </div>

            <div>
              <Label htmlFor="upload-area">Add to area</Label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger id="upload-area" className="mt-1">
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AREA}>Unassigned</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Applies to all {pendingFiles?.length ?? 0} photo{(pendingFiles?.length ?? 0) === 1 ? "" : "s"} in this batch.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingFiles(null); if (inputRef.current) inputRef.current.value = ""; }}>Cancel</Button>
            <Button onClick={runUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
