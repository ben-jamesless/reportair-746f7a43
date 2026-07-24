import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, ImagePlus, RotateCcw, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { useDayHiddenPhotos } from "@/hooks/useDayHiddenPhotos";
import { dayKey } from "@/lib/projectDetailTypes";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

function captureTimeLabel(p: { captured_at: string | null }): string | null {
  if (!p.captured_at) return null;
  const d = new Date(p.captured_at);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Library — the everything-store. Every photo in the project shown as a grid
 * with filters (area, day, search), an Unassigned tray, per-photo hide-from-day
 * markers with restore, and the ONLY destructive delete affordance in the app.
 *
 * Single source of truth: every surface (badge, lightbox, filter counts, share)
 * reads `photos[].area_id` — the stored assignment. No badge = unassigned.
 * GPS suggestions never appear as assignments here.
 */
export function LibraryTab({ projectId }: { projectId: string }) {
  const {
    areas,
    albums,
    photos,
    canEdit,
    isOwner,
    loading,
    loadError,
    bulkAssignArea,
    bulkDelete,
    deleting,
    applyPhotoAreaChange,
    applyPhotoAlbumChange,
  } = useProjectDetail(projectId);
  const hidden = useDayHiddenPhotos(projectId);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilterParam = searchParams.get("filter");
  const [areaFilter, setAreaFilter] = useState<string>(
    initialFilterParam === "unassigned" ? UNASSIGNED : (initialFilterParam ?? ALL)
  );
  const [dayFilter, setDayFilter] = useState<string>(ALL);
  // Search removed for now — filters below carry the load.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  // Sync ?filter=<area_id|unassigned> → apply once, then clear the URL flag so
  // reloads don't relock, and switching tabs later doesn't force a stale filter.
  useEffect(() => {
    const f = searchParams.get("filter");
    if (!f) return;
    if (f === "unassigned") {
      setAreaFilter(UNASSIGNED);
    } else if (areaMap.has(f)) {
      setAreaFilter(f);
    } else if (f !== ALL) {
      // unknown filter value — ignore and fall through to clearing the param
    }
    const p = new URLSearchParams(searchParams);
    p.delete("filter");
    setSearchParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, areaMap]);

  // Hidden-days lookup per photo id
  const hiddenDaysByPhoto = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const key of hidden.hidden) {
      const [pid, day] = key.split("|");
      const arr = m.get(pid) ?? [];
      arr.push(day);
      m.set(pid, arr);
    }
    for (const arr of m.values()) arr.sort().reverse();
    return m;
  }, [hidden.hidden]);

  // Distinct days across all photos
  const allDays = useMemo(() => {
    const s = new Set<string>();
    for (const p of photos) s.add(dayKey(p));
    return Array.from(s).sort().reverse();
  }, [photos]);

  const unassigned = useMemo(() => photos.filter((p) => !p.area_id), [photos]);

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (areaFilter === UNASSIGNED && p.area_id) return false;
      if (areaFilter !== ALL && areaFilter !== UNASSIGNED && p.area_id !== areaFilter) return false;
      if (dayFilter !== ALL && dayKey(p) !== dayFilter) return false;
      return true;
    });
  }, [photos, areaFilter, dayFilter]);


  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setLastSelectedId(null);
  }, []);

  // Selection: single toggle + shift-click range across the currently filtered grid.
  const handleSelectClick = useCallback(
    (id: string, shift: boolean) => {
      setSelected((cur) => {
        const n = new Set(cur);
        if (shift && lastSelectedId && lastSelectedId !== id) {
          const ids = filtered.map((p) => p.id);
          const a = ids.indexOf(lastSelectedId);
          const b = ids.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) n.add(ids[i]);
            return n;
          }
        }
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      setLastSelectedId(id);
    },
    [filtered, lastSelectedId]
  );

  // Escape exits selection mode.
  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, clearSelection]);

  const handleAssign = useCallback(
    async (ids: string[], areaId: string | null) => {
      await bulkAssignArea(ids, areaId);
      clearSelection();
    },
    [bulkAssignArea, clearSelection]
  );

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selected);
    setConfirmDelete(false);
    await bulkDelete(ids);
    clearSelection();
  }, [selected, bulkDelete, clearSelection]);

  const restoreAllHides = useCallback(
    async (photoId: string) => {
      if (!projectId) return;
      const { error } = await supabase
        .from("photo_day_hidden")
        .delete()
        .eq("project_id", projectId)
        .eq("photo_id", photoId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Photo restored to its day");
      hidden.refetch();
    },
    [projectId, hidden]
  );

  const openLightbox = (id: string) => {
    const i = filtered.findIndex((p) => p.id === id);
    if (i >= 0) setLightboxIndex(i);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (loadError) return <p className="text-sm text-destructive">Failed to load project.</p>;

  const selectedCount = selected.size;
  const inSelectionMode = selectedCount > 0;

  return (
    <div className="space-y-6">
      {/* Filters — dropdowns on mobile, chips from sm and up */}
      <div className="space-y-3">
        {/* Mobile: compact dropdowns */}
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Area
            </div>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All ({photos.length})</SelectItem>
                <SelectItem value={UNASSIGNED}>
                  Unassigned{unassigned.length > 0 ? ` (${unassigned.length})` : ""}
                </SelectItem>
                {areas.map((a) => {
                  const n = photos.filter((p) => p.area_id === a.id).length;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({n})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Day
            </div>
            <Select value={dayFilter} onValueChange={setDayFilter}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All days</SelectItem>
                {allDays.map((d) => (
                  <SelectItem key={d} value={d}>
                    {formatDayShort(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tablet/Desktop: chip rows */}
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Area
          </span>
          <FilterChip active={areaFilter === ALL} onClick={() => setAreaFilter(ALL)}>
            All
            <span className="ml-1.5 opacity-70">{photos.length}</span>
          </FilterChip>
          <FilterChip
            active={areaFilter === UNASSIGNED}
            onClick={() => setAreaFilter(UNASSIGNED)}
          >
            Unassigned
            {unassigned.length > 0 && (
              <span className="ml-1.5 opacity-70">{unassigned.length}</span>
            )}
          </FilterChip>
          {areas.map((a) => {
            const n = photos.filter((p) => p.area_id === a.id).length;
            return (
              <FilterChip
                key={a.id}
                active={areaFilter === a.id}
                onClick={() => setAreaFilter(a.id)}
              >
                {a.name}
                <span className="ml-1.5 opacity-70">{n}</span>
              </FilterChip>
            );
          })}
        </div>

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Day
          </span>
          <FilterChip active={dayFilter === ALL} onClick={() => setDayFilter(ALL)}>
            All days
          </FilterChip>
          {allDays.slice(0, 12).map((d) => (
            <FilterChip key={d} active={dayFilter === d} onClick={() => setDayFilter(d)}>
              {formatDayShort(d)}
            </FilterChip>
          ))}
          {allDays.length > 12 && (
            <span className="text-xs text-muted-foreground">+{allDays.length - 12} older</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {photos.length}
          </span>
        </div>
      </div>


      {/* Unassigned tray */}
      {unassigned.length > 0 && areaFilter !== UNASSIGNED && (
        <section className="border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Unassigned</p>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setAreaFilter(UNASSIGNED)}
            >
              View all →
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
            {unassigned.slice(0, 18).map((p) => (
              <TrayThumb
                key={p.id}
                photo={p}
                areas={areas}
                canEdit={canEdit}
                onOpen={() => openLightbox(p.id)}
                onAssign={(aid) => handleAssign([p.id], aid)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Selection toolbar */}
      {inSelectionMode && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Assign to Area</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAssign(Array.from(selected), null)}>
                    Unassigned
                  </DropdownMenuItem>
                  {areas.map((a) => (
                    <DropdownMenuItem
                      key={a.id}
                      onClick={() => handleAssign(Array.from(selected), a.id)}
                    >
                      {a.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Main grid */}
      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No photos match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((p) => {
            const hiddenDays = hiddenDaysByPhoto.get(p.id) ?? [];
            const isSel = selected.has(p.id);
            return (
              <div key={p.id} className="group relative">
                <div className={cn(hiddenDays.length > 0 && "opacity-70")}>
                  <PhotoThumb
                    path={p.storage_path}
                    alt={p.caption || p.file_name}
                    onClick={() => openLightbox(p.id)}
                    selected={isSel}
                    captureTime={captureTimeLabel(p)}
                  />
                </div>
                {/* Selection circle — always available when canEdit, permanently
                    visible in selection mode, hover-visible otherwise. Clicks
                    are captured here and never fall through to the thumb. */}
                {canEdit && (
                  <div
                    role="checkbox"
                    aria-checked={isSel}
                    aria-label={isSel ? "Unselect photo" : "Select photo"}
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSelectClick(p.id, e.shiftKey);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleSelectClick(p.id, e.shiftKey);
                      }
                    }}
                    className={cn(
                      "absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm transition",
                      isSel
                        ? "border-primary bg-primary text-primary-foreground opacity-100"
                        : cn(
                            "border-white/80 bg-black/40 text-transparent",
                            inSelectionMode
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                          )
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
                {/* Selected ring overlay */}
                {isSel && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
                  />
                )}
                {/* Area label — stored assignment only. No badge = unassigned. */}
                {p.area_id && (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 max-w-[70%] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
                    {areaMap.get(p.area_id) ?? "Area"}
                  </span>
                )}
                {/* Hidden-from-day marker */}
                {hiddenDays.length > 0 && (
                  <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 rounded-md bg-black/70 px-1.5 py-1 text-[10px] text-white shadow-sm">
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <EyeOff className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {hiddenDays.length === 1
                          ? `Hidden from ${formatDayShort(hiddenDays[0])}`
                          : `Hidden from ${hiddenDays.length} days`}
                      </span>
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreAllHides(p.id);
                        }}
                        className="flex shrink-0 items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 hover:bg-white/25"
                        title="Restore to its day"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={filtered as LightboxPhoto[]}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          areas={areas}
          albums={albums}
          projectId={projectId}
          isOwner={isOwner}
          onAreaChanged={applyPhotoAreaChange}
          onAlbumChanged={applyPhotoAlbumChange}
        />
      )}

      {/* Delete confirm — Library is the ONLY place destructive delete lives */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selectedCount === 1 ? "this photo" : `these ${selectedCount} photos`} from
              storage and every view — the Daily Report, area stories, exports and
              the client share link. This can't be undone. To remove a photo from
              just one day, use "Hide from day" in the Daily Report instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function TrayThumb({
  photo,
  areas,
  canEdit,
  onOpen,
  onAssign,
}: {
  photo: LightboxPhoto;
  areas: { id: string; name: string }[];
  canEdit: boolean;
  onOpen: () => void;
  onAssign: (areaId: string) => void;
}) {
  return (
    <div className="group relative">
      <PhotoThumb
        path={photo.storage_path}
        alt={photo.caption || photo.file_name}
        onClick={onOpen}
        captureTime={captureTimeLabel(photo)}
      />
      {canEdit && areas.length > 0 && (
        <div className="absolute inset-x-1 bottom-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="h-6 w-full text-[10px]">
                Assign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Assign to area</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {areas.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => onAssign(a.id)}>
                  {a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
