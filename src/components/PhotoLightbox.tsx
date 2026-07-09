import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, MapPin, Calendar, MapPinned, ChevronDown } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PhotoCommentsThread } from "@/components/PhotoCommentsThread";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Section that's collapsible on mobile, always-open on md+. */
const MobileSection = ({
  title,
  defaultOpen = false,
  children,
  count,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !isMobile || open;
  return (
    <div>
      <button
        type="button"
        onClick={() => isMobile && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between text-xs uppercase tracking-wide text-muted-foreground",
          isMobile ? "cursor-pointer py-1" : "cursor-default mb-1",
        )}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1">
          {title}
          {typeof count === "number" && <span className="ml-1 text-foreground/60 normal-case">{count}</span>}
        </span>
        {isMobile && (
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        )}
      </button>
      {expanded && <div className={isMobile ? "mt-2" : ""}>{children}</div>}
    </div>
  );
};

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
  created_at?: string | null;
  assignment_source?: string | null;
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
  /** True when the viewer is the project owner — enables deleting any team comment. */
  isOwner?: boolean;
}

const UNASSIGNED = "__unassigned__";

import type { GuestNote } from "@/lib/types";

export const PhotoLightbox = ({ photos, index, onClose, onIndexChange, areas = [], albums = [], onAreaChanged, onAlbumChanged, projectId, isOwner = false }: Props) => {
  const [i, setI] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setI(index); }, [index]);

  const photo = index !== null ? photos[i] : null;
  const url = useSignedUrl(photo?.storage_path ?? null);
  const [notes, setNotes] = useState<GuestNote[]>([]);

  const photoId = photo?.id ?? null;
  useEffect(() => {
    let alive = true;
    if (!photoId || !projectId) { setNotes([]); return; }
    (async () => {
      const { data } = await supabase
        .from("guest_notes")
        .select("id, guest_name, guest_email, body, created_at")
        .eq("project_id", projectId)
        .eq("photo_id", photoId)
        .order("created_at", { ascending: false });
      if (alive) setNotes((data ?? []) as GuestNote[]);
    })();
    return () => { alive = false; };
  }, [photoId, projectId]);

  const prev = useCallback(() => {
    const ni = (i - 1 + photos.length) % photos.length;
    setI(ni);
    onIndexChange(ni);
  }, [i, photos.length, onIndexChange]);
  const next = useCallback(() => {
    const ni = (i + 1) % photos.length;
    setI(ni);
    onIndexChange(ni);
  }, [i, photos.length, onIndexChange]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, next, prev, onClose]);

  if (!photo) return null;

  // Camera/lens/exposure intentionally hidden — only date, time, and location are surfaced.

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[100dvh] max-w-6xl overflow-y-auto border-0 bg-background p-0 sm:max-h-[90vh] [&>button]:hidden">
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
            <Button
              size="icon"
              variant="secondary"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 h-10 w-10 rounded-full bg-background/95 text-foreground shadow-lg ring-1 ring-border hover:bg-background"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <aside className="flex flex-col gap-4 border-l bg-card p-5 md:max-h-[80vh] md:overflow-y-auto">
            <MobileSection title="Photo" defaultOpen>
              <h3 className="break-all text-sm font-semibold">{photo.file_name}</h3>
              {photo.caption && <p className="mt-2 text-sm text-foreground">{photo.caption}</p>}
            </MobileSection>

            <MobileSection title="Area">
              <Select
                value={photo.area_id ?? UNASSIGNED}
                onValueChange={async (val) => {
                  const newAreaId = val === UNASSIGNED ? null : val;
                  const { error } = await supabase.from("photos").update({ area_id: newAreaId, assignment_source: 'manual' }).eq("id", photo.id);
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
              {photo.area_id && photo.assignment_source === 'gps_auto' && (
                <p className="mt-1 text-[11px] text-muted-foreground">Auto-assigned by GPS</p>
              )}
            </MobileSection>


            {albums.length > 0 && (
              <MobileSection title="Album">
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
              </MobileSection>
            )}

            {(photo.captured_at || (photo.gps_lat !== null && photo.gps_lng !== null)) && (
              <MobileSection title="Details">
                <div className="space-y-3 text-sm">
                  {photo.captured_at && (
                    <Row icon={<Calendar className="h-4 w-4" />} label="Captured">
                      {new Date(photo.captured_at).toLocaleString()}
                    </Row>
                  )}
                  {photo.gps_lat !== null && photo.gps_lng !== null && (
                    <Row icon={<MapPin className="h-4 w-4" />} label="Location">
                      <a
                        className="text-primary underline-offset-2 hover:underline"
                        href={`https://www.google.com/maps?q=${photo.gps_lat},${photo.gps_lng}`}
                        target="_blank" rel="noreferrer"
                      >
                        {photo.gps_lat.toFixed(4)}, {photo.gps_lng.toFixed(4)}
                      </a>
                    </Row>
                  )}
                </div>
              </MobileSection>
            )}

            {projectId && photo && (
              <MobileSection title="Comments">
                <PhotoCommentsThread projectId={projectId} photoId={photo.id} isOwner={isOwner} />
              </MobileSection>
            )}

            {projectId && (
              <MobileSection title="Client feedback" count={notes.length}>
                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments on this photo yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-md border border-border bg-background p-2.5 text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-medium">{n.guest_name}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs">{n.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </MobileSection>
            )}
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
