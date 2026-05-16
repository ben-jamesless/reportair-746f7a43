import { ImagePlus } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PhotoUploader } from "@/components/PhotoUploader";
import EventSetup from "@/components/EventSetup";
import { type LightboxPhoto } from "@/components/PhotoLightbox";
import { type AreaStatus } from "@/components/AreaStatusPicker";
import { AreaGrid } from "@/features/projectDetail/AreaGrid";
import { PhotoGallery } from "@/features/projectDetail/PhotoGallery";
import { ALL_DAYS, isAlbumKey, type Area } from "@/lib/projectDetailTypes";

type Day = { key: string; label: string; date: Date; photos: LightboxPhoto[] };

type PhotoContentProps = {
  projectId: string;
  photos: LightboxPhoto[];
  visiblePhotos: LightboxPhoto[];
  days: Day[];
  areas: Area[];
  activeDay: string;
  activeArea: string | null;
  uploadAlbumId: string | null;
  uploadAreaId: string | null;
  canEdit: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  photoIndexById: Map<string, number>;
  isAreaOpen: (key: string) => boolean;
  onToggleAreaOpen: (key: string) => void;
  getAreaDayStatus: (areaId: string, dateKey: string) => AreaStatus;
  onSaveAreaDayStatus: (areaId: string, dateKey: string, status: AreaStatus) => void;
  onToggleSelect: (photoId: string) => void;
  onSetLightboxIndex: (index: number | null) => void;
  onLoadAll: () => void;
};

// Photo-grid routing: chooses between EventSetup (no photos), EmptyState
// (filtered to zero), AreaGrid (dated day) and PhotoGallery (gallery/album).
// Used only when the report briefing is NOT showing.
export function PhotoContent({
  projectId,
  photos,
  visiblePhotos,
  days,
  areas,
  activeDay,
  activeArea,
  uploadAlbumId,
  uploadAreaId,
  canEdit,
  selectMode,
  selectedIds,
  photoIndexById,
  isAreaOpen,
  onToggleAreaOpen,
  getAreaDayStatus,
  onSaveAreaDayStatus,
  onToggleSelect,
  onSetLightboxIndex,
  onLoadAll,
}: PhotoContentProps) {
  if (photos.length === 0) {
    return (
      <EventSetup
        projectId={projectId}
        areas={areas}
        albumId={uploadAlbumId}
        uploadAreaId={uploadAreaId}
        onAreasChanged={onLoadAll}
        onUploaded={onLoadAll}
      />
    );
  }

  if (visiblePhotos.length === 0) {
    return (
      <EmptyState
        icon={<ImagePlus className="h-6 w-6" />}
        title="No photos here"
        description={
          activeDay === ALL_DAYS
            ? "Upload images to extract EXIF (capture time, camera, GPS) and start telling the story."
            : "Upload to this day + area context, or pick a different selection."
        }
        action={
          canEdit ? (
            <ErrorBoundary label="uploader">
              <PhotoUploader
                projectId={projectId}
                albumId={uploadAlbumId}
                areaId={uploadAreaId}
                areas={areas}
                onUploaded={onLoadAll}
              />
            </ErrorBoundary>
          ) : undefined
        }
      />
    );
  }

  if (activeDay !== ALL_DAYS && !isAlbumKey(activeDay)) {
    return (
      <AreaGrid
        activeDay={activeDay}
        activeArea={activeArea}
        dayPhotos={days.find((d) => d.key === activeDay)?.photos ?? []}
        areas={areas}
        selectMode={selectMode}
        selectedIds={selectedIds}
        photoIndexById={photoIndexById}
        canEdit={canEdit}
        isAreaOpen={isAreaOpen}
        onToggleAreaOpen={onToggleAreaOpen}
        getAreaDayStatus={getAreaDayStatus}
        onSaveAreaDayStatus={onSaveAreaDayStatus}
        onToggleSelect={onToggleSelect}
        onSetLightboxIndex={onSetLightboxIndex}
      />
    );
  }

  return (
    <PhotoGallery
      photos={visiblePhotos}
      selectMode={selectMode}
      selectedIds={selectedIds}
      photoIndexById={photoIndexById}
      resetKey={`${activeDay}|${activeArea ?? "null"}`}
      onToggleSelect={onToggleSelect}
      onSetLightboxIndex={onSetLightboxIndex}
    />
  );
}
