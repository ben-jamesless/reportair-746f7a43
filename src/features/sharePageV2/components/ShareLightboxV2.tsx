import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, MapPin, MessageSquarePlus, X } from "lucide-react";
import type { ShareV2Photo } from "../types";
import { useSharePhotoUrl } from "../useSharePhotoUrl";
import { V2, timeLabel } from "../tokens";

export function ShareLightboxV2({
  token,
  photos,
  index,
  onClose,
  onIndexChange,
  onShowOnMap,
  onLeaveComment,
}: {
  token: string;
  photos: ShareV2Photo[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  /** Present only when the share link exposes photo GPS. */
  onShowOnMap?: (photo: ShareV2Photo) => void;
  /** Omitted on filed reports, where feedback is read-only. */
  onLeaveComment?: (photo: ShareV2Photo) => void;
}) {
  const photo = photos[index];
  const url = useSharePhotoUrl(token, photo?.id ?? "", "lightbox");


  const prev = useCallback(
    () => onIndexChange((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndexChange]
  );
  const next = useCallback(() => onIndexChange((index + 1) % photos.length), [index, photos.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "rgba(15,21,32,.94)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <span style={{ fontFamily: V2.mono, fontSize: 11, color: "rgba(255,255,255,.6)" }}>
          {index + 1} / {photos.length}
          {timeLabel(photo.captured_at) ? ` · ${timeLabel(photo.captured_at)}` : ""}
        </span>
        <div className="flex items-center gap-1">
          {onLeaveComment && (
            <button
              type="button"
              onClick={() => onLeaveComment(photo)}
              className="flex items-center gap-1.5 border border-white/40 px-3 py-1.5 text-white hover:bg-white/10"
              style={{
                fontFamily: V2.mono,
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Comment
            </button>
          )}
          {onShowOnMap && photo.gps_lat != null && photo.gps_lng != null && (
            <button
              type="button"
              onClick={() => onShowOnMap(photo)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-white/90"
              style={{
                fontFamily: V2.mono,
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <MapPin className="h-3.5 w-3.5" />
              Show on map
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>

        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-6">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2 p-2 text-white/70 hover:text-white"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        {url && (
          <img
            src={url}
            alt={photo.caption || photo.file_name}
            className="h-full w-full object-contain"
          />
        )}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2 p-2 text-white/70 hover:text-white"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
      {photo.caption && (
        <div className="px-4 pb-5 text-center" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
          {photo.caption}
        </div>
      )}
    </div>
  );
}
