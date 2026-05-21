import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { DayNavSkeleton, PhotoGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { PhotoUploader } from "@/components/PhotoUploader";
import { type LightboxPhoto } from "@/components/PhotoLightbox";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { type AreaStatus } from "@/components/AreaStatusPicker";
import { RichNotes } from "@/components/RichNotes";
import { ProjectDetailsTab } from "@/components/ProjectDetailsTab";
import { MobileProjectToolbar } from "@/components/MobileProjectToolbar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlan } from "@/hooks/usePlan";
import {
  ALBUM_PREFIX,
  ALL_DAYS,
  DATE_FMT,
  LEGACY_PRE_EVENT_DAY,
  LEGACY_PRE_EVENT_SLUG,
  NO_AREA,
  SHORT_FMT,
  albumIdFromKey,
  albumKey,
  dayKey,
  isAlbumKey,
  type DailyField,
  type ProjectView,
} from "@/lib/projectDetailTypes";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { ProjectHeader } from "@/features/projectDetail/ProjectHeader";
import { DayTimeline } from "@/features/projectDetail/DayTimeline";
import { SelectionToolbar } from "@/features/projectDetail/SelectionToolbar";
import { PhotoLightboxController } from "@/features/projectDetail/PhotoLightboxController";
import { DayReport } from "@/features/projectDetail/DayReport";
import { FeedbackSheet } from "@/features/projectDetail/FeedbackSheet";
import { PhotoContent } from "@/features/projectDetail/PhotoContent";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { canUseShareLink, canExportPdf } = usePlan();

  // All data-layer state (project / albums / areas / photos / notes / status)
  // lives in useProjectDetail. UI-only state (filters, selection, lightbox,
  // dialogs, tab/view, URL sync) stays in this component.
  const {
    project,
    isOwner,
    canEdit,
    albums,
    areas,
    photos,
    dayNotes,
    dailyFields,
    areaDayNotes,
    areaDayStatus,
    loading,
    loadError,
    refetch: loadAll,
    setDayNote: saveDayNote,
    setDailyField: saveDailyField,
    setAreaDayNote: saveAreaDayNote,
    setAreaDayStatus: saveAreaDayStatus,
    saveProjectStatus,
    archiveProject,
    restoreProject,
    addArea,
    softDeleteArea,
    restoreArea,
    bulkAssignArea: bulkAssignAreaIds,
    bulkMoveToDay: bulkMoveToDayIds,
    bulkDelete,
    bulkDownloadZip,
    downloading,
    deleting,
    applyPhotoAreaChange,
    applyPhotoAlbumChange,
  } = useProjectDetail(id);
  // Initialise filter state from URL so refreshing / sharing a link preserves the view.
  const [activeDay, setActiveDay] = useState<string>(() => {
    const d = searchParams.get("day");
    if (!d) return ALL_DAYS;
    if (d === LEGACY_PRE_EVENT_DAY || d === LEGACY_PRE_EVENT_SLUG) return LEGACY_PRE_EVENT_DAY;
    if (isAlbumKey(d)) return d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return ALL_DAYS;
  });
  const [activeArea, setActiveArea] = useState<string | null>(() => {
    const a = searchParams.get("area");
    if (!a) return null;
    if (a === NO_AREA || a === "unassigned") return NO_AREA;
    return a;
  });
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const isMobileViewport = useIsMobile();
  const [tabletCollapsedDays, setTabletCollapsedDays] = useState<Set<string>>(new Set());
  const [closedAreaKeys, setClosedAreaKeys] = useState<Set<string>>(new Set());
  const isAreaOpen = (key: string) => !closedAreaKeys.has(key);
  const toggleAreaOpen = (key: string) => setClosedAreaKeys((c) => {
    const n = new Set(c);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });
  const [collapsedDailyKeys, setCollapsedDailyKeys] = useState<Set<string>>(new Set());
  const isDailyOpen = (key: string) => !collapsedDailyKeys.has(key);
  const toggleDailyOpen = (key: string) => setCollapsedDailyKeys((c) => {
    const n = new Set(c);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "activity" | "details">(() => {
    const t = searchParams.get("tab");
    if (t === "activity") return "activity";
    if (t === "details") return "details";
    if (t === "updates" || t === "photos") return "photos";
    return "photos";
  });


  // Session-only view toggle (overrides project default for current session). null = use project default.
  const [viewOverride, setViewOverride] = useState<ProjectView | null>(null);
  // Whether we've already auto-selected the latest day (only do this once per project load).
  const [didAutoSelectDay, setDidAutoSelectDay] = useState(false);
  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((photoId: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }, []);

  // Auto-collapse daily briefing & per-area report blocks on tablet when a day is first visited
  useEffect(() => {
    if (!activeDay || activeDay === ALL_DAYS || isAlbumKey(activeDay)) return;
    if (tabletCollapsedDays.has(activeDay)) return;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1280;
    if (!isTablet) return;
    setTabletCollapsedDays((d) => new Set(d).add(activeDay));
    setCollapsedDailyKeys((prev) => {
      const n = new Set(prev);
      ["today_objectives", "today_achievements", "tomorrow_objectives", "open_issues"].forEach((k) => n.add(`daily|${activeDay}|${k}`));
      return n;
    });
    setClosedAreaKeys((prev) => {
      const n = new Set(prev);
      areas.forEach((ar) => n.add(`report|${ar.id}|${activeDay}`));
      return n;
    });
  }, [activeDay, areas, tabletCollapsedDays]);

  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitSelectMode(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, exitSelectMode]);

  // Bulk operations delegate to the hook with the currently-selected ids,
  // then reset the selection UI here so behaviour matches the old inline impl.
  const bulkAssignArea = useCallback(
    async (areaId: string | null) => {
      if (selectedIds.size === 0) return;
      await bulkAssignAreaIds(Array.from(selectedIds), areaId);
      exitSelectMode();
    },
    [selectedIds, bulkAssignAreaIds, exitSelectMode]
  );

  const bulkMoveToDay = useCallback(
    async (targetDayKey: string) => {
      if (selectedIds.size === 0) return;
      await bulkMoveToDayIds(Array.from(selectedIds), targetDayKey);
      exitSelectMode();
    },
    [selectedIds, bulkMoveToDayIds, exitSelectMode]
  );

  const bulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await bulkDownloadZip(Array.from(selectedIds));
  }, [selectedIds, bulkDownloadZip]);

  const bulkDeletePhotos = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await bulkDelete(Array.from(selectedIds));
    exitSelectMode();
  }, [selectedIds, bulkDelete, exitSelectMode]);

  const [settingsDefaultTab, setSettingsDefaultTab] = useState<"details" | "areas" | "albums" | "members" | "share">("details");
  useEffect(() => {
    const handler = () => {
      setShareSettingsOpen(true);
      setSettingsDefaultTab("share");
      setSettingsDialogOpen(true);
    };
    window.addEventListener("open-share-settings", handler);
    return () => window.removeEventListener("open-share-settings", handler);
  }, []);

  // Trivial read-side helpers over the maps owned by the hook.
  const getAreaDayNote = (areaId: string, dateKey: string): string | null =>
    areaDayNotes.get(`${areaId}|${dateKey}`) ?? null;
  const getAreaDayStatus = (areaId: string, dateKey: string): AreaStatus =>
    areaDayStatus.get(`${areaId}|${dateKey}`) ?? "no_status";
  const getDailyField = (dateKey: string, field: DailyField): string | null =>
    dailyFields.get(dateKey)?.[field] ?? null;
  // only when their album is selected from the sidebar.
  const albumPhotos = (() => {
    const m = new Map<string, LightboxPhoto[]>();
    for (const p of photos) {
      if (!p.album_id) continue;
      const arr = m.get(p.album_id) ?? [];
      arr.push(p);
      m.set(p.album_id, arr);
    }
    return m;
  })();
  const datedPhotos = photos.filter((p) => !p.album_id);

  // Resolve the legacy `pre-event` URL value to the matching album once
  // albums load, so old shared links continue to work.
  useEffect(() => {
    if (activeDay !== LEGACY_PRE_EVENT_DAY) return;
    const a = albums.find((x) => x.slug === LEGACY_PRE_EVENT_SLUG);
    if (a) setActiveDay(albumKey(a.id));
  }, [activeDay, albums]);

  // Build day buckets from dated photos only
  const days = (() => {
    const map = new Map<string, { key: string; label: string; date: Date; photos: LightboxPhoto[] }>();
    for (const ph of datedPhotos) {
      const k = dayKey(ph);
      const raw = ph.captured_at || ph.created_at;
      const d = raw ? new Date(raw) : new Date(0);
      let g = map.get(k);
      if (!g) {
        g = { key: k, label: raw ? DATE_FMT.format(d) : "Unknown date", date: d, photos: [] };
        map.set(k, g);
      }
      g.photos.push(ph);
    }
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  })();

  // Auto-open the active day (from URL) or fall back to the most recent day on first load.
  useEffect(() => {
    if (days.length === 0 || openDays.size > 0) return;
    const target = activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && days.some((d) => d.key === activeDay)
      ? activeDay
      : days[0].key;
    setOpenDays(new Set([target]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  // On first project load: if no day is in the URL, default to the most recent day with photos.
  // Falls back silently to Event Gallery (ALL_DAYS) when there are no photos.
  useEffect(() => {
    if (didAutoSelectDay) return;
    if (!project) return;
    // If the URL pinned a specific day/album already, respect it.
    const pinned = searchParams.get("day");
    if (pinned) { setDidAutoSelectDay(true); return; }
    // If deep-linking to a specific photo (e.g. from a notification), don't auto-select a day —
    // the deep-link effect will reset filters to ALL_DAYS so the photo is visible.
    if (searchParams.get("photo")) { setDidAutoSelectDay(true); return; }
    if (days.length > 0) {
      setActiveDay(days[0].key);
      setActiveArea(null);
    }
    setDidAutoSelectDay(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, days.length, didAutoSelectDay]);

  // Effective view: session override wins, else project default, else "report".
  const effectiveView: ProjectView = viewOverride ?? project?.default_view ?? "report";

  const areaCountsForDay = useCallback(
    (dayPhotos: LightboxPhoto[]) => {
      const counts = new Map<string, number>();
      let unassigned = 0;
      for (const p of dayPhotos) {
        if (!p.area_id) unassigned++;
        else counts.set(p.area_id, (counts.get(p.area_id) ?? 0) + 1);
      }
      return { counts, unassigned };
    },
    []
  );

  // Photos shown in main grid
  const visiblePhotos = (() => {
    let pool: LightboxPhoto[];
    if (activeDay === ALL_DAYS) pool = photos;
    else if (isAlbumKey(activeDay)) pool = albumPhotos.get(albumIdFromKey(activeDay)!) ?? [];
    else pool = days.find((d) => d.key === activeDay)?.photos ?? [];
    if (activeArea === null) return pool;
    if (activeArea === NO_AREA) return pool.filter((p) => !p.area_id);
    return pool.filter((p) => p.area_id === activeArea);
  })();

  const photoIndexById = (() => {
    const m = new Map<string, number>();
    visiblePhotos.forEach((p, i) => m.set(p.id, i));
    return m;
  })();

  // Deep-link from notifications: ?photo=<id> opens the lightbox once photos load.
  useEffect(() => {
    const target = searchParams.get("photo");
    if (!target || photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === target);
    if (idx === -1) return;
    // Reset filters so the photo is in `visiblePhotos` (which equals `photos` when ALL_DAYS + no area).
    if (activeDay !== ALL_DAYS) setActiveDay(ALL_DAYS);
    if (activeArea !== null) setActiveArea(null);
    setLightboxIndex(idx);
    // Clear params so refresh/back doesn't re-trigger.
    const next = new URLSearchParams(searchParams);
    next.delete("photo");
    next.delete("comments");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, searchParams]);

  // Keep URL in sync with filter state (replaceState — don't pollute history).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    // day
    if (activeDay === ALL_DAYS) next.delete("day");
    else next.set("day", activeDay);
    // area
    if (activeArea === null) next.delete("area");
    else if (activeArea === NO_AREA) next.set("area", NO_AREA);
    else next.set("area", activeArea);
    // tab — store as updates|activity|details (user-facing names)
    if (activeTab === "photos") next.delete("tab");
    else next.set("tab", activeTab);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, activeArea, activeTab]);

  const toggleDay = (key: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectDayArea = (dayKey: string, areaId: string | null) => {
    setActiveDay(dayKey);
    setActiveArea(areaId);
    setOpenDays((prev) => new Set(prev).add(dayKey));
  };

  // Upload context: when an album is the active day, uploads land in that album.
  const activeAlbumId = albumIdFromKey(activeDay);
  const activeAlbum = activeAlbumId ? albums.find((a) => a.id === activeAlbumId) ?? null : null;
  const uploadAreaId = activeArea && activeArea !== NO_AREA ? activeArea : null;
  const uploadAlbumId = activeAlbum?.id ?? null;
  const uploadContextLabel = (() => {
    const parts: string[] = [];
    if (activeAlbum) parts.push(activeAlbum.name);
    else if (activeDay !== ALL_DAYS) {
      const d = days.find((x) => x.key === activeDay);
      if (d) parts.push(SHORT_FMT.format(d.date));
    }
    if (uploadAreaId) {
      const ar = areas.find((a) => a.id === uploadAreaId);
      if (ar) parts.push(ar.name);
    } else if (activeArea === NO_AREA) {
      parts.push("Unassigned");
    }
    return parts.length ? parts.join(" · ") : "Event Gallery";
  })();

  // Selection title
  const selectionTitle = (() => {
    if (activeDay === ALL_DAYS && activeArea === null) return "Event Gallery";
    const parts: string[] = [];
    if (activeAlbum) parts.push(activeAlbum.name);
    else if (activeDay !== ALL_DAYS) {
      const d = days.find((x) => x.key === activeDay);
      if (d) parts.push(d.label);
    } else {
      parts.push("All days");
    }
    if (activeArea && activeArea !== NO_AREA) {
      const ar = areas.find((a) => a.id === activeArea);
      if (ar) parts.push(ar.name);
    } else if (activeArea === NO_AREA) {
      parts.push("Unassigned");
    }
    return parts.join(" · ");
  })();

  // Export trigger state (shared by per-day icon and top-level button)
  const [exportDayKey, setExportDayKey] = useState<string | null>(null);
  const [exportDayLabel, setExportDayLabel] = useState<string | null>(null);
  const [exportPhotoCount, setExportPhotoCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLockMode, setExportLockMode] = useState<"single" | null>(null);
  const [shareSettingsOpen, setShareSettingsOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const openDayExport = (e: React.MouseEvent, day: { key: string; label: string; photos: LightboxPhoto[] }) => {
    e.stopPropagation();
    setExportDayKey(day.key);
    setExportDayLabel(day.label);
    setExportPhotoCount(day.photos.length);
    setExportLockMode("single"); // per-day icon always opens in single-day mode
    setExportOpen(true);
  };

  // Days available for the date-range picker (only those with photos).
  // MUST be declared before any early returns to keep hook order stable across renders.
  const availableDaysForExport = days.map((d) => ({ key: d.key, label: d.label, date: d.date, photoCount: d.photos.length }));

  if (loadError) {
    return <p className="p-8 text-center text-destructive">Failed to load project data. Please refresh the page.</p>;
  }

  if (loading) {
    return (
      <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Loading…" }]}>
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[400px_1fr]">
          <DayNavSkeleton />
          <PhotoGridSkeleton count={10} />
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Not found" }]}>
        <EmptyState
          className="mx-auto max-w-md"
          icon={<ArrowLeft className="h-5 w-5" />}
          title="Project not found"
          description="It may have been deleted, or you no longer have access."
          action={
            <Link to="/projects" className="text-sm text-primary underline-offset-4 hover:underline">
              Back to projects
            </Link>
          }
        />
      </AppShell>
    );
  }

  // Build breadcrumbs reflecting current selection
  const crumbs: { label: string; to?: string }[] = [
    { label: "Projects", to: "/projects" },
    { label: project.name, to: `/projects/${project.id}` },
  ];
  if (activeAlbum) {
    crumbs.push({ label: activeAlbum.name });
  } else if (activeDay !== ALL_DAYS) {
    const d = days.find((x) => x.key === activeDay);
    if (d) crumbs.push({ label: SHORT_FMT.format(d.date) });
  }
  if (activeArea && activeArea !== NO_AREA) {
    const ar = areas.find((a) => a.id === activeArea);
    if (ar) crumbs.push({ label: ar.name });
  } else if (activeArea === NO_AREA) {
    crumbs.push({ label: "Unassigned" });
  }

  // Top-level export defaults to most recent day with photos (else whole project)
  const mostRecentDay = days[0] ?? null;
  const openTopExport = () => {
    if (mostRecentDay) {
      setExportDayKey(mostRecentDay.key);
      setExportDayLabel(mostRecentDay.label);
      setExportPhotoCount(mostRecentDay.photos.length);
    } else {
      setExportDayKey(null);
      setExportDayLabel(null);
      setExportPhotoCount(photos.length);
    }
    setExportLockMode(null); // top-level allows mode toggle
    setExportOpen(true);
  };

  // (availableDaysForExport is computed earlier, above the early returns, to keep hook order stable)

  const accent = project.color || "#01696F";

  return (
    <AppShell crumbs={[{ label: "Events", to: "/projects" }, { label: project.name }]}>
      <MobileProjectToolbar
        project={project}
        photosCount={photos.length}
        mostRecentDayLabel={mostRecentDay?.label ?? null}
        effectiveView={effectiveView}
        setViewOverride={setViewOverride}
        canEdit={canEdit}
        uploader={
          canEdit ? (
            <ErrorBoundary label="uploader-mobile">
              <PhotoUploader
                projectId={project.id}
                albumId={uploadAlbumId}
                areaId={uploadAreaId}
                areas={areas}
                onUploaded={loadAll}
              />
            </ErrorBoundary>
          ) : null
        }
        onOpenExport={openTopExport}
        onOpenActivity={() => setActiveTab("activity")}
        onOpenDetails={() => setActiveTab("details")}
        onOpenFeedback={() => setFeedbackSheetOpen(true)}
        onLoadAll={loadAll}
      />

      <ProjectHeader
        project={project}
        canEdit={canEdit}
        isOwner={isOwner}
        canUseShareLink={canUseShareLink}
        photoCount={photos.length}
        areas={areas}
        uploadAlbumId={uploadAlbumId}
        uploadAreaId={uploadAreaId}
        activeTab={activeTab}
        viewOverride={viewOverride}
        onSetActiveTab={setActiveTab}
        onSetViewOverride={setViewOverride}
        onSaveProjectStatus={saveProjectStatus}
        onArchive={archiveProject}
        onRestore={restoreProject}
        onOpenExport={openTopExport}
        onOpenFeedback={() => setFeedbackSheetOpen(true)}
        onOpenSettings={() => setSettingsDialogOpen(true)}
        onOpenShareSettings={() => setShareSettingsOpen(true)}
        onUploaded={loadAll}
      />

      <div className="flex flex-1 overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
        {/* Main tab content */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "photos" | "activity" | "details")} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">

          <TabsContent value="photos" className="mt-4">
            <div className="grid grid-cols-1 gap-0 md:grid-cols-[200px_1fr] xl:grid-cols-[220px_1fr]">
              <DayTimeline
                days={days}
                albums={albums}
                albumPhotos={albumPhotos}
                areas={areas}
                photos={photos}
                project={project}
                activeDay={activeDay}
                activeArea={activeArea}
                openDays={openDays}
                canEdit={canEdit}
                isMobileViewport={isMobileViewport}
                onSetActiveDay={setActiveDay}
                onSetActiveArea={setActiveArea}
                onSetOpenDays={setOpenDays}
                onSelectDayArea={selectDayArea}
                onOpenDayExport={openDayExport}
                onAddArea={addArea}
                onDeleteArea={async (ar) => {
                  await softDeleteArea(ar.id);
                  if (activeArea === ar.id) setActiveArea(null);
                  toast(`Area "${ar.name}" deleted`, {
                    duration: 5000,
                    action: { label: "Undo", onClick: () => { void restoreArea(ar.id); } },
                  });
                }}
                getAreaDayStatus={getAreaDayStatus}
                areaCountsForDay={areaCountsForDay}
              />

              {/* Main grid */}
              <section className="px-4 xl:border-r xl:border-[#E8E6DF]">
                {/* Day / selection header — full-width flush strip, sticky */}
                <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <h2 className="truncate text-base font-bold text-foreground">{selectionTitle}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {visiblePhotos.length > 0 && selectMode && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const allVisible = visiblePhotos.map((p) => p.id);
                          const allSelected = allVisible.every((pid) => selectedIds.has(pid));
                          setSelectedIds(allSelected ? new Set() : new Set(allVisible));
                        }}
                      >
                        {visiblePhotos.every((p) => selectedIds.has(p.id)) && visiblePhotos.length > 0
                          ? "Clear all"
                          : "Select all"}
                      </Button>
                    )}
                    {visiblePhotos.length > 0 && effectiveView !== "report" && (
                      <Button size="sm" variant={selectMode ? "default" : "outline"} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                        {selectMode ? "Done" : "Select"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status accent colors for the 3px left bar (matches share view). */}
                {(() => null)()}

                {/* REPORT VIEW — written briefing per area, no photo grids. */}
                {activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && effectiveView === "report" && (
                  <DayReport
                    activeDay={activeDay}
                    areas={areas}
                    dayNotes={dayNotes}
                    canEdit={canEdit}
                    getDailyField={getDailyField}
                    getAreaDayNote={getAreaDayNote}
                    getAreaDayStatus={getAreaDayStatus}
                    onSaveDailyField={saveDailyField}
                    onSaveDayNote={saveDayNote}
                    onSaveAreaDayNote={saveAreaDayNote}
                    onSaveAreaDayStatus={saveAreaDayStatus}
                  />
                )}

                {/* Hide photo grids in Report view for dated days — Report is text-only briefing. */}
                {!(activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && effectiveView === "report") && (
                  <PhotoContent
                    projectId={project.id}
                    photos={photos}
                    visiblePhotos={visiblePhotos}
                    days={days}
                    areas={areas}
                    activeDay={activeDay}
                    activeArea={activeArea}
                    uploadAlbumId={uploadAlbumId}
                    uploadAreaId={uploadAreaId}
                    canEdit={canEdit}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    photoIndexById={photoIndexById}
                    isAreaOpen={isAreaOpen}
                    onToggleAreaOpen={toggleAreaOpen}
                    getAreaDayStatus={getAreaDayStatus}
                    onSaveAreaDayStatus={saveAreaDayStatus}
                    onToggleSelect={toggleSelect}
                    onSetLightboxIndex={setLightboxIndex}
                    onLoadAll={loadAll}
                  />
                )}
              </section>

            </div>

            {/* Feedback right-side panel — all breakpoints */}
            <FeedbackSheet
              open={feedbackSheetOpen}
              onOpenChange={setFeedbackSheetOpen}
              projectId={project.id}
              visiblePhotos={visiblePhotos}
              allPhotos={photos}
              onOpenPhoto={(photoId) => {
                setFeedbackSheetOpen(false);
                const idx = photoIndexById.get(photoId);
                if (idx !== undefined) {
                  setLightboxIndex(idx);
                } else {
                  setActiveDay(ALL_DAYS);
                  setActiveArea(null);
                  setTimeout(() => {
                    const all = photos.findIndex((p) => p.id === photoId);
                    if (all >= 0) setLightboxIndex(all);
                  }, 0);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ActivityFeed projectId={project.id} />
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <ProjectDetailsTab
              project={project}
              lastUploadAt={photos.reduce<string | null>((acc, p) => {
                const ts = p.created_at ?? null;
                if (!ts) return acc;
                return !acc || ts > acc ? ts : acc;
              }, null)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ProjectSettingsDialog
        projectId={project.id}
        project={project}
        onChanged={loadAll}
        trigger={null}
        defaultTab={settingsDefaultTab}
        open={settingsDialogOpen}
        onOpenChange={(o) => { setSettingsDialogOpen(o); if (!o) setSettingsDefaultTab("details"); }}
      />

        <PhotoLightboxController
          photos={visiblePhotos}
          areas={areas}
          albums={albums}
          projectId={project.id}
          isOwner={isOwner}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onAreaChanged={applyPhotoAreaChange}
          onAlbumChanged={applyPhotoAlbumChange}
        />

        {/* Day-scoped PDF export, opened from the day row in the sidebar.
            Only mount when open to avoid the polling effect + hidden Dialog
            being instantiated on every project view. */}
        {exportOpen && (
          <ExportPdfDialog
            projectId={project.id}
            photoCount={exportPhotoCount}
            dayKey={exportDayKey}
            dayLabel={exportDayLabel}
            availableDays={availableDaysForExport}
            lockMode={exportLockMode}
            open={exportOpen}
            onOpenChange={setExportOpen}
            trigger={<span className="hidden" />}
          />
        )}

        <SelectionToolbar
          visible={selectMode}
          selectedCount={selectedIds.size}
          areas={areas}
          days={days}
          canEdit={canEdit}
          downloading={downloading}
          deleting={deleting}
          onAssignArea={bulkAssignArea}
          onMoveToDay={bulkMoveToDay}
          onDownload={bulkDownload}
          onDelete={bulkDeletePhotos}
          onExitSelectMode={exitSelectMode}
        />
    </AppShell>
  );
};

export default ProjectDetail;
