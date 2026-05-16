import { useEffect, useState } from "react";

import { PhotoThumb } from "@/components/PhotoThumb";
import type { LightboxPhoto } from "@/components/PhotoLightbox";

const PHOTO_PAGE_SIZE = 150;

type Props = {
  photos: LightboxPhoto[];

  // Selection mode
  selectMode: boolean;
  selectedIds: Set<string>;
  photoIndexById: Map<string, number>;

  // Reset key — pagination resets to first page when this changes
  // (e.g. when activeDay or activeArea changes).
  resetKey: string;

  // Callbacks
  onToggleSelect: (photoId: string) => void;
  onSetLightboxIndex: (index: number) => void;
};

export function PhotoGallery({
  photos,
  selectMode,
  selectedIds,
  photoIndexById,
  resetKey,
  onToggleSelect,
  onSetLightboxIndex,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PHOTO_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PHOTO_PAGE_SIZE);
  }, [resetKey]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.slice(0, visibleCount).map((p) => (
          <PhotoThumb
            key={p.id}
            path={p.storage_path}
            alt={p.caption || p.file_name}
            selectable={selectMode}
            selected={selectedIds.has(p.id)}
            onClick={() =>
              selectMode
                ? onToggleSelect(p.id)
                : onSetLightboxIndex(photoIndexById.get(p.id) ?? 0)
            }
          />
        ))}
      </div>
      {photos.length > visibleCount && (
        <button
          className="mt-4 rounded border px-4 py-2 text-sm"
          onClick={() => setVisibleCount((c) => c + PHOTO_PAGE_SIZE)}
        >
          Load more photos ({photos.length - visibleCount} remaining)
        </button>
      )}
    </>
  );
}
