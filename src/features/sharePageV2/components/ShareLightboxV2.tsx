import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ShareV2Photo } from "../types";
import { useSharePhotoUrl } from "../useSharePhotoUrl";
import { V2, timeLabel } from "../tokens";

export function ShareLightboxV2({
  token,
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  token: string;
  photos: ShareV2Photo[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
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
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-white/70 hover:text-white">
          <X className="h-5 w-5" />
        </button>
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
        {url && <img src={url} alt={photo.caption || photo.file_name} className="max-h-full max-w-full object-contain" />}
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
