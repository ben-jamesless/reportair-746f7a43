import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Photo = { id: string; storage_path: string; captured_at: string | null };

interface Props {
  projectId: string;
}

export const CoverPhotoManager = ({ projectId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [coverAssetPath, setCoverAssetPath] = useState<string | null>(null);
  const [coverAssetUrl, setCoverAssetUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: proj }, { data: ph }] = await Promise.all([
      supabase
        .from("projects")
        .select("cover_photo_id, cover_asset_path")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("photos")
        .select("id, storage_path, captured_at")
        .eq("project_id", projectId)
        .order("captured_at", { ascending: false })
        .limit(30),
    ]);
    const p = proj as { cover_photo_id: string | null; cover_asset_path: string | null } | null;
    setCoverPhotoId(p?.cover_photo_id ?? null);
    setCoverAssetPath(p?.cover_asset_path ?? null);
    setPhotos((ph ?? []) as Photo[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Build signed thumbnail URLs in parallel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (photos.length === 0) return;
      const results = await Promise.all(
        photos.map(async (p) => {
          const { data } = await supabase.storage
            .from("photos")
            .createSignedUrl(p.storage_path, 60 * 30, {
              transform: { width: 180, height: 120, resize: "cover" },
            });
          return [p.id, data?.signedUrl ?? ""] as const;
        }),
      );
      if (cancelled) return;
      setThumbs(Object.fromEntries(results));
    })();
    return () => { cancelled = true; };
  }, [photos]);

  // Signed URL for custom cover asset preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coverAssetPath) { setCoverAssetUrl(null); return; }
      const { data } = await supabase.storage
        .from("export-assets")
        .createSignedUrl(coverAssetPath, 60 * 30);
      if (!cancelled) setCoverAssetUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [coverAssetPath]);

  const selectPhoto = async (photoId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ cover_photo_id: photoId, cover_asset_path: null })
      .eq("id", projectId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCoverPhotoId(photoId);
    setCoverAssetPath(null);
    toast.success("Cover photo updated");
  };

  const clearCover = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ cover_photo_id: null, cover_asset_path: null })
      .eq("id", projectId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCoverPhotoId(null);
    setCoverAssetPath(null);
    toast.success("Cover photo cleared");
  };

  const handlePickUpload = () => fileRef.current?.click();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Only PNG or JPG files are supported.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `covers/${projectId}/cover.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("export-assets")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("projects")
        .update({ cover_asset_path: path, cover_photo_id: null })
        .eq("id", projectId);
      if (updErr) throw updErr;
      setCoverAssetPath(path);
      setCoverPhotoId(null);
      toast.success("Custom cover uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <Label>Cover image</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            This image is used as the hero photo on the cover page of Client Deck exports. Changes apply to all future exports.
          </p>
        </div>

        {loading ? (
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[60px] w-[90px] shrink-0 rounded" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No photos in this project yet.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex gap-2">
              {photos.map((p) => {
                const selected = coverPhotoId === p.id;
                const url = thumbs[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPhoto(p.id)}
                    disabled={saving}
                    className={cn(
                      "relative h-[60px] w-[90px] shrink-0 overflow-hidden rounded bg-muted ring-offset-background transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      selected && "ring-2 ring-primary ring-offset-2",
                    )}
                    aria-label="Select cover photo"
                  >
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Skeleton className="h-full w-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearCover} disabled={saving || (!coverPhotoId && !coverAssetPath)}>
            Clear
          </Button>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <Label>Or upload a custom cover image</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG or JPG only. SVG is not supported. Recommended size: 800 × 800 px.
          </p>
        </div>

        {coverAssetUrl && (
          <div className="flex h-[120px] w-[180px] items-center justify-center overflow-hidden rounded border bg-card">
            <img src={coverAssetUrl} alt="Custom cover" className="h-full w-full object-cover" />
          </div>
        )}

        <div>
          <Button onClick={handlePickUpload} disabled={uploading} variant="outline" size="sm">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? "Uploading…" : coverAssetPath ? "Replace custom cover" : "Upload custom cover"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </section>
    </div>
  );
};
