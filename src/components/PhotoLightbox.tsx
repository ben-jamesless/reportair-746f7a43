import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, MapPin, Calendar, Camera, Aperture, MapPinned } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LightboxPhoto = {
  id: string;
  storage_path: string;
  file_name: string;
  caption: string | null;
  captured_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  focal_length: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  width: number | null;
  height: number | null;
  area_id: string | null;
  album_id?: string | null;
};

export type LightboxArea = { id: string; name: string };
export type LightboxAlbum = { id: string; name: string };

interface Props {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  areas?: LightboxArea[];
  albums?: LightboxAlbum[];
  onAreaChanged?: (photoId: string, areaId: string | null) => void;
  onAlbumChanged?: (photoId: string, albumId: string | null) => void;
  projectId?: string;
}

const UNASSIGNED = "__unassigned__";

type GuestNote = { id: string; guest_name: string; guest_email: string | null; body: string; created_at: string };

export const PhotoLightbox = ({ photos, index, onClose, onIndexChange, areas = [], albums = [], onAreaChanged, onAlbumChanged, projectId }: Props) => {
  const [i, setI] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setI(index); }, [index]);

  const photo = index !== null ? photos[i] : null;
  const url = useSignedUrl(photo?.storage_path ?? null);
  const [notes, setNotes] = useState<GuestNote[]>([]);

  useEffect(() => {
    let alive = true;
    if (!photo || !projectId) { setNotes([]); return; }
    (async () => {
      const { data } = await supabase
        .from("guest_notes")
        .select("id, guest_name, guest_email, body, created_at")
        .eq("project_id", projectId)
        .eq("photo_id", photo.id)
        .order("created_at", { ascending: false });
      if (alive) setNotes((data ?? []) as GuestNote[]);
    })();
    return () => { alive = false; };
  }, [photo?.id, projectId]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, i, photos.length]);

  const prev = () => { const ni = (i - 1 + photos.length) % photos.length; setI(ni); onIndexChange(ni); };
  const next = () => { const ni = (i + 1) % photos.length; setI(ni); onIndexChange(ni); };

  if (!photo) return null;

  const camera = [photo.camera_make, photo.camera_model].filter(Boolean).join(" ");
  const exposure = [
    photo.aperture ? `f/${photo.aperture}` : null,
    photo.shutter_speed,
    photo.iso ? `ISO ${photo.iso}` : null,
    photo.focal_length ? `${photo.focal_length}mm` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl border-0 bg-background p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
          <div className="relative flex min-h-[50vh] items-center justify-center bg-black md:min-h-[70vh]">
            {url && (
              <img src={url} alt={photo.caption || photo.file_name} className="max-h-[70vh] w-full object-contain" />
            )}
            {photos.length > 1 && (
              <>
                <Button size="icon" variant="secondary" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full opacity-90">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="secondary" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full opacity-90">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
            <Button size="icon" variant="secondary" onClick={onClose} className="absolute right-3 top-3 rounded-full opacity-90 md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <aside className="flex flex-col gap-4 border-l bg-card p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Photo</p>
              <h3 className="mt-1 break-all text-sm font-semibold">{photo.file_name}</h3>
              {photo.caption && <p className="mt-2 text-sm text-foreground">{photo.caption}</p>}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <MapPinned className="h-3 w-3" /> Area
              </p>
              <Select
                value={photo.area_id ?? UNASSIGNED}
                onValueChange={async (val) => {
                  const newAreaId = val === UNASSIGNED ? null : val;
                  const { error } = await supabase.from("photos").update({ area_id: newAreaId }).eq("id", photo.id);
                  if (error) { toast.error(error.message); return; }
                  onAreaChanged?.(photo.id, newAreaId);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {albums.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Album
                </p>
                <Select
                  value={photo.album_id ?? UNASSIGNED}
                  onValueChange={async (val) => {
                    const newAlbumId = val === UNASSIGNED ? null : val;
                    const { error } = await supabase.from("photos").update({ album_id: newAlbumId }).eq("id", photo.id);
                    if (error) { toast.error(error.message); return; }
                    onAlbumChanged?.(photo.id, newAlbumId);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="No album" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>No album</SelectItem>
                    {albums.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 text-sm">
              {photo.captured_at && (
                <Row icon={<Calendar className="h-4 w-4" />} label="Captured">
                  {new Date(photo.captured_at).toLocaleString()}
                </Row>
              )}
              {camera && <Row icon={<Camera className="h-4 w-4" />} label="Camera">{camera}</Row>}
              {photo.lens && <Row icon={<Aperture className="h-4 w-4" />} label="Lens">{photo.lens}</Row>}
              {exposure && <Row icon={<Aperture className="h-4 w-4" />} label="Exposure">{exposure}</Row>}
              {photo.gps_lat !== null && photo.gps_lng !== null && (
                <Row icon={<MapPin className="h-4 w-4" />} label="GPS">
                  <a
                    className="text-primary underline-offset-2 hover:underline"
                    href={`https://www.google.com/maps?q=${photo.gps_lat},${photo.gps_lng}`}
                    target="_blank" rel="noreferrer"
                  >
                    {photo.gps_lat.toFixed(4)}, {photo.gps_lng.toFixed(4)}
                  </a>
                </Row>
              )}
              {photo.width && photo.height && (
                <Badge variant="secondary" className="font-normal">{photo.width} × {photo.height}</Badge>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 text-muted-foreground">{icon}</span>
    <div className="flex-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-foreground">{children}</div>
    </div>
  </div>
);
