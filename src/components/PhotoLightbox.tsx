import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, MapPin, Calendar, Camera, Aperture } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";

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
};

interface Props {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export const PhotoLightbox = ({ photos, index, onClose, onIndexChange }: Props) => {
  const [i, setI] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setI(index); }, [index]);

  const photo = index !== null ? photos[i] : null;
  const url = useSignedUrl(photo?.storage_path ?? null);

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
