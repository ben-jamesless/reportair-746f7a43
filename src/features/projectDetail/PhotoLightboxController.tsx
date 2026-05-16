import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import type { Album, Area } from "@/lib/projectDetailTypes";

type Props = {
  // Data
  photos: LightboxPhoto[];
  areas: Area[];
  albums: Album[];
  projectId: string;
  isOwner: boolean;

  // Controlled state (owned by parent so other code paths can open the
  // lightbox: AreaGrid / PhotoGallery / FeedbackPanel deep-link).
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;

  // Mutations forwarded to the lightbox's edit affordances
  onAreaChanged: (photoId: string, areaId: string | null) => void;
  onAlbumChanged: (photoId: string, albumId: string | null) => void;
};

export function PhotoLightboxController({
  photos,
  areas,
  albums,
  projectId,
  isOwner,
  index,
  onIndexChange,
  onClose,
  onAreaChanged,
  onAlbumChanged,
}: Props) {
  return (
    <ErrorBoundary label="lightbox">
      <PhotoLightbox
        photos={photos}
        index={index}
        onClose={onClose}
        onIndexChange={onIndexChange}
        areas={areas}
        albums={albums}
        onAreaChanged={onAreaChanged}
        onAlbumChanged={onAlbumChanged}
        projectId={projectId}
        isOwner={isOwner}
      />
    </ErrorBoundary>
  );
}
