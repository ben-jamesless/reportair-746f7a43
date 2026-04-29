import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, MapPinned, Calendar, ChevronDown, ChevronRight, FileDown, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DayNavSkeleton, PhotoGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { PhotoUploader } from "@/components/PhotoUploader";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { EditableNote } from "@/components/EditableNote";
import { AreaStatusPicker, AreaStatusDot, type AreaStatus } from "@/components/AreaStatusPicker";
import { CommentsPanel } from "@/components/CommentsPanel";
import { ProjectDetailsTab } from "@/components/ProjectDetailsTab";
import { type ProjectStatus } from "@/lib/projectStatus";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  color: string | null;
  event_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
};

type Album = { id: string; name: string; slug: string; position: number };
type Area = { id: string; name: string; sort_order: number; notes: string | null };
type DayNote = { date: string; notes: string | null };

const NO_AREA = "__no_area__";
const ALL_DAYS = "__all__";
const PRE_EVENT_DAY = "__pre_event__";
const PRE_EVENT_SLUG = "pre-event";

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dayKey = (p: LightboxPhoto): string => {
  const raw = p.captured_at || p.created_at;
  const d = raw ? new Date(raw) : new Date(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [dayNotes, setDayNotes] = useState<Map<string, string | null>>(new Map());
  // status keyed by `${areaId}|${dateKey}` -> AreaStatus
  const [areaDayStatus, setAreaDayStatus] = useState<Map<string, AreaStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string>(ALL_DAYS);
  const [activeArea, setActiveArea] = useState<string | null>(null); // null = all areas in day
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "activity" | "details">("photos");

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ar }, { data: ph }, { data: dn }, { data: ads }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template, color, event_date, event_location, overall_status, event_type, client_name").eq("id", id).maybeSingle(),
      supabase.from("albums").select("id, name, slug, position").eq("project_id", id).order("position"),
      supabase.from("areas").select("id, name, sort_order, notes").eq("project_id", id).order("sort_order"),
      supabase
        .from("photos")
        .select(
          "id, project_id, album_id, area_id, storage_path, file_name, caption, captured_at, created_at, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height"
        )
        .eq("project_id", id)
        .order("captured_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("day_notes").select("date, notes").eq("project_id", id),
      supabase.from("area_day_status").select("area_id, date, status").eq("project_id", id),
    ]);
    setProject(p ?? null);
    setAlbums(a ?? []);
    setAreas((ar ?? []) as Area[]);
    setPhotos((ph ?? []) as LightboxPhoto[]);
    const map = new Map<string, string | null>();
    for (const row of (dn ?? []) as DayNote[]) map.set(row.date, row.notes ?? null);
    setDayNotes(map);
    const sm = new Map<string, AreaStatus>();
    for (const row of (ads ?? []) as { area_id: string; date: string; status: AreaStatus }[]) sm.set(`${row.area_id}|${row.date}`, row.status);
    setAreaDayStatus(sm);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- Mutations: area notes, day notes, per-day area status ----
  const saveAreaNotes = async (areaId: string, next: string | null) => {
    const prev = areas;
    setAreas((cur) => cur.map((a) => (a.id === areaId ? { ...a, notes: next } : a)));
    const { error } = await supabase.from("areas").update({ notes: next }).eq("id", areaId);
    if (error) { toast.error(error.message); setAreas(prev); }
  };
  const getAreaDayStatus = (areaId: string, dateKey: string): AreaStatus =>
    areaDayStatus.get(`${areaId}|${dateKey}`) ?? "no_status";
  const saveAreaDayStatus = async (areaId: string, dateKey: string, next: AreaStatus) => {
    if (!id) return;
    const key = `${areaId}|${dateKey}`;
    const prev = new Map(areaDayStatus);
    setAreaDayStatus((cur) => { const n = new Map(cur); n.set(key, next); return n; });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("area_day_status").upsert(
      { project_id: id, area_id: areaId, date: dateKey, status: next, updated_by: user?.id },
      { onConflict: "project_id,area_id,date" },
    );
    if (error) { toast.error(error.message); setAreaDayStatus(prev); }
  };
  const saveDayNote = async (dateKey: string, next: string | null) => {
    if (!id) return;
    const prev = new Map(dayNotes);
    setDayNotes((cur) => { const n = new Map(cur); n.set(dateKey, next); return n; });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("day_notes").upsert(
      { project_id: id, date: dateKey, notes: next, updated_by: user?.id },
      { onConflict: "project_id,date" },
    );
    if (error) { toast.error(error.message); setDayNotes(prev); }
  };

  // Identify the Pre-event album (if it exists)
  const preEventAlbum = useMemo(() => albums.find((a) => a.slug === PRE_EVENT_SLUG) ?? null, [albums]);

  // Split photos: anything in the Pre-event album goes to the Pre-event bucket;
  // everything else groups by capture/upload date.
  const { datedPhotos, preEventPhotos } = useMemo(() => {
    const dated: LightboxPhoto[] = [];
    const pre: LightboxPhoto[] = [];
    for (const p of photos) {
      if (preEventAlbum && p.album_id === preEventAlbum.id) pre.push(p);
      else dated.push(p);
    }
    return { datedPhotos: dated, preEventPhotos: pre };
  }, [photos, preEventAlbum]);

  // Build day buckets from dated photos only
  const days = useMemo(() => {
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
  }, [datedPhotos]);

  // Auto-open first day on load
  useEffect(() => {
    if (days.length > 0 && openDays.size === 0) {
      setOpenDays(new Set([days[0].key]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

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
  const visiblePhotos = useMemo(() => {
    let pool: LightboxPhoto[];
    if (activeDay === ALL_DAYS) pool = photos;
    else if (activeDay === PRE_EVENT_DAY) pool = preEventPhotos;
    else pool = days.find((d) => d.key === activeDay)?.photos ?? [];
    if (activeArea === null) return pool;
    if (activeArea === NO_AREA) return pool.filter((p) => !p.area_id);
    return pool.filter((p) => p.area_id === activeArea);
  }, [activeDay, activeArea, days, photos, preEventPhotos]);

  const photoIndexById = useMemo(() => {
    const m = new Map<string, number>();
    visiblePhotos.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [visiblePhotos]);

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

  const handleAreaChanged = (photoId: string, areaId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, area_id: areaId } : p)));
  };
  const handleAlbumChanged = (photoId: string, albumId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, album_id: albumId } : p)));
  };

  // Upload context: when "Pre-event" is the active day, uploads land in the pre-event album.
  const uploadAreaId = activeArea && activeArea !== NO_AREA ? activeArea : null;
  const uploadAlbumId = activeDay === PRE_EVENT_DAY && preEventAlbum ? preEventAlbum.id : null;
  const uploadContextLabel = useMemo(() => {
    const parts: string[] = [];
    if (activeDay === PRE_EVENT_DAY) parts.push("Pre-event");
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
  }, [activeDay, activeArea, uploadAreaId, days, areas]);

  // Selection title
  const selectionTitle = useMemo(() => {
    if (activeDay === ALL_DAYS && activeArea === null) return "Event Gallery";
    const parts: string[] = [];
    if (activeDay === PRE_EVENT_DAY) parts.push("Pre-event");
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
  }, [activeDay, activeArea, days, areas]);

  // Day-scoped export trigger state
  const [exportDayKey, setExportDayKey] = useState<string | null>(null);
  const [exportDayLabel, setExportDayLabel] = useState<string | null>(null);
  const [exportPhotoCount, setExportPhotoCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const openDayExport = (e: React.MouseEvent, day: { key: string; label: string; photos: LightboxPhoto[] }) => {
    e.stopPropagation();
    setExportDayKey(day.key);
    setExportDayLabel(day.label);
    setExportPhotoCount(day.photos.length);
    setExportOpen(true);
  };

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
  if (activeDay === PRE_EVENT_DAY) {
    crumbs.push({ label: "Pre-event" });
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
    setExportOpen(true);
  };

  const accent = project.color || "#01696F";

  return (
    <AppShell crumbs={crumbs}>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {project.template === "event_production" ? "Event production" : "Project"}
            </Badge>
          </div>
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{project.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ErrorBoundary label="uploader">
              <PhotoUploader
                projectId={project.id}
                albumId={uploadAlbumId}
                areaId={uploadAreaId}
                areas={areas}
                onUploaded={loadAll}
              />
            </ErrorBoundary>
          </div>
          <p className="text-xs text-muted-foreground">
            Uploading to: <span className="font-medium">{uploadContextLabel}</span>
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "photos" | "activity" | "details")} className="w-full">
        {/* Top controls row: tabs + settings + export */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <TabsList>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={openTopExport}
              disabled={photos.length === 0}
              title={mostRecentDay ? `Export ${mostRecentDay.label}` : "Export project"}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export {mostRecentDay ? "latest day" : "project"}
            </Button>
            <ProjectSettingsDialog projectId={project.id} project={project} onChanged={loadAll} />
          </div>
        </div>

          <TabsContent value="photos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[400px_1fr] xl:grid-cols-[400px_minmax(0,1fr)_320px]">
              {/* Day → Area sidebar */}
              <aside className="space-y-1">
                {days.length === 0 && preEventPhotos.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No photos yet.</p>
                )}

                {days.map((day) => {
                  const isOpen = openDays.has(day.key);
                  const dayActive = activeDay === day.key && activeArea === null;
                  const { counts, unassigned } = areaCountsForDay(day.photos);
                  
                  return (
                    <div key={day.key} className="rounded-md">
                      <div className="flex items-stretch gap-1">
                        <button
                          onClick={() => toggleDay(day.key)}
                          className="flex items-center px-2 text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => { setActiveDay(day.key); setActiveArea(null); setOpenDays((p) => new Set(p).add(day.key)); }}
                          className={cn(
                            "flex flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors",
                            dayActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <Calendar className={cn("h-3.5 w-3.5", dayActive ? "" : "text-muted-foreground")} />
                            <span className="font-medium">{SHORT_FMT.format(day.date)}</span>
                          </span>
                          <span className={cn("text-xs", dayActive ? "opacity-80" : "text-muted-foreground")}>
                            {day.photos.length}
                          </span>
                        </button>
                        <button
                          onClick={(e) => openDayExport(e, day)}
                          className="flex items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title={`Export ${day.label} as PDF`}
                          aria-label={`Export ${day.label} as PDF`}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {isOpen && (
                        <div className="ml-7 mt-0.5 space-y-0.5 border-l pl-2">
                          {areas.map((ar) => {
                            const c = counts.get(ar.id) ?? 0;
                            if (c === 0) return null;
                            const sel = activeDay === day.key && activeArea === ar.id;
                            const st = getAreaDayStatus(ar.id, day.key);
                            return (
                              <button
                                key={ar.id}
                                onClick={() => selectDayArea(day.key, ar.id)}
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                  sel ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                                )}
                              >
                                <AreaStatusDot status={st} className="shrink-0" />
                                <MapPinned className={cn("h-3 w-3 shrink-0", sel ? "" : "text-muted-foreground")} />
                                <span className="flex-1 truncate">{ar.name}</span>
                                <span className={cn("ml-1 text-[10px]", sel ? "opacity-80" : "text-muted-foreground")}>{c}</span>
                              </button>
                            );
                          })}
                          {unassigned > 0 && (
                            <button
                              onClick={() => selectDayArea(day.key, NO_AREA)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                activeDay === day.key && activeArea === NO_AREA
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-secondary"
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                <MapPinned className="h-3 w-3 shrink-0 text-muted-foreground" />
                                Unassigned
                              </span>
                              <span className={cn(
                                "ml-2 text-[10px]",
                                activeDay === day.key && activeArea === NO_AREA ? "opacity-80" : "text-muted-foreground"
                              )}>{unassigned}</span>
                            </button>
                          )}
                          {areas.length === 0 && unassigned === 0 && (
                            <p className="px-2 py-1 text-[11px] text-muted-foreground">No areas defined.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="mt-3 space-y-1 border-t pt-3">
                  {preEventAlbum && (
                    <button
                      onClick={() => { setActiveDay(PRE_EVENT_DAY); setActiveArea(null); }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                        activeDay === PRE_EVENT_DAY && activeArea === null
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <Layers className={cn(
                          "h-3.5 w-3.5",
                          activeDay === PRE_EVENT_DAY && activeArea === null ? "" : "text-muted-foreground"
                        )} />
                        <span className="font-medium">Pre-event</span>
                      </span>
                      <span className={cn(
                        "text-xs",
                        activeDay === PRE_EVENT_DAY && activeArea === null ? "opacity-80" : "text-muted-foreground"
                      )}>
                        {preEventPhotos.length}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveDay(ALL_DAYS); setActiveArea(null); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                      activeDay === ALL_DAYS && activeArea === null
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <ImagePlus className={cn(
                        "h-3.5 w-3.5",
                        activeDay === ALL_DAYS && activeArea === null ? "" : "text-muted-foreground"
                      )} />
                      <span className="font-medium">Event Gallery</span>
                    </span>
                    <span className={cn(
                      "text-xs",
                      activeDay === ALL_DAYS && activeArea === null ? "opacity-80" : "text-muted-foreground"
                    )}>
                      {photos.length}
                    </span>
                  </button>
                </div>
              </aside>

              {/* Main grid */}
              <section>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{selectionTitle}</h2>
                  <span className="text-xs text-muted-foreground">
                    {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Day comment shown at the top of the main panel when a dated day is active */}
                {activeDay !== ALL_DAYS && activeDay !== PRE_EVENT_DAY && (
                  <div className="mb-5">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Day comment
                    </p>
                    <EditableNote
                      value={dayNotes.get(activeDay) ?? null}
                      placeholder="Add a comment for this day…"
                      onSave={(next) => saveDayNote(activeDay, next)}
                    />
                  </div>
                )}

                {visiblePhotos.length === 0 ? (
                  <EmptyState
                    icon={<ImagePlus className="h-6 w-6" />}
                    title="No photos here"
                    description={
                      activeDay === ALL_DAYS
                        ? "Upload images to extract EXIF (capture time, camera, GPS) and start telling the story."
                        : "Upload to this day + area context, or pick a different selection."
                    }
                    action={
                      <ErrorBoundary label="uploader">
                        <PhotoUploader
                          projectId={project.id}
                          albumId={uploadAlbumId}
                          areaId={uploadAreaId}
                          areas={areas}
                          onUploaded={loadAll}
                        />
                      </ErrorBoundary>
                    }
                  />
                ) : activeDay !== ALL_DAYS && activeDay !== PRE_EVENT_DAY ? (
                  // Dated day view: group by area, with per-area comment + per-day status picker
                  (() => {
                    const dayPool = days.find((d) => d.key === activeDay)?.photos ?? [];
                    const filtered = activeArea === null
                      ? dayPool
                      : activeArea === NO_AREA
                        ? dayPool.filter((p) => !p.area_id)
                        : dayPool.filter((p) => p.area_id === activeArea);
                    const byArea = new Map<string, LightboxPhoto[]>();
                    const unassigned: LightboxPhoto[] = [];
                    for (const p of filtered) {
                      if (!p.area_id) unassigned.push(p);
                      else { const arr = byArea.get(p.area_id) ?? []; arr.push(p); byArea.set(p.area_id, arr); }
                    }
                    const orderedAreas = areas.filter((a) => (byArea.get(a.id)?.length ?? 0) > 0);
                    return (
                      <div className="space-y-8">
                        {orderedAreas.map((ar) => {
                          const list = byArea.get(ar.id) ?? [];
                          const st = getAreaDayStatus(ar.id, activeDay);
                          return (
                            <div key={ar.id}>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold">{ar.name}</h3>
                                <span className="text-xs text-muted-foreground">
                                  {list.length} photo{list.length === 1 ? "" : "s"}
                                </span>
                                <AreaStatusPicker
                                  value={st}
                                  onChange={(s) => saveAreaDayStatus(ar.id, activeDay, s)}
                                  className="ml-auto"
                                />
                              </div>
                              <div className="mb-3">
                                <EditableNote
                                  value={ar.notes}
                                  placeholder="Add a comment for this area…"
                                  onSave={(next) => saveAreaNotes(ar.id, next)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {list.map((p) => (
                                  <PhotoThumb
                                    key={p.id}
                                    path={p.storage_path}
                                    alt={p.caption || p.file_name}
                                    onClick={() => setLightboxIndex(photoIndexById.get(p.id) ?? 0)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {unassigned.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <h3 className="text-base font-semibold">Unassigned</h3>
                              <span className="text-xs text-muted-foreground">
                                {unassigned.length} photo{unassigned.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                              {unassigned.map((p) => (
                                <PhotoThumb
                                  key={p.id}
                                  path={p.storage_path}
                                  alt={p.caption || p.file_name}
                                  onClick={() => setLightboxIndex(photoIndexById.get(p.id) ?? 0)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {visiblePhotos.map((p) => (
                      <PhotoThumb
                        key={p.id}
                        path={p.storage_path}
                        alt={p.caption || p.file_name}
                        onClick={() => setLightboxIndex(photoIndexById.get(p.id) ?? 0)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <CommentsPanel
                projectId={project.id}
                visiblePhotos={visiblePhotos}
                onOpenPhoto={(photoId) => {
                  const idx = photoIndexById.get(photoId);
                  if (idx !== undefined) setLightboxIndex(idx);
                }}
                className="hidden xl:flex xl:max-h-[calc(100vh-12rem)] xl:sticky xl:top-6"
              />
            </div>
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

        <ErrorBoundary label="lightbox">
          <PhotoLightbox
            photos={visiblePhotos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
            areas={areas}
            albums={albums}
            onAreaChanged={handleAreaChanged}
            onAlbumChanged={handleAlbumChanged}
            projectId={project.id}
          />
        </ErrorBoundary>

        {/* Day-scoped PDF export, opened from the day row in the sidebar.
            Only mount when open to avoid the polling effect + hidden Dialog
            being instantiated on every project view. */}
        {exportOpen && (
          <ExportPdfDialog
            projectId={project.id}
            photoCount={exportPhotoCount}
            dayKey={exportDayKey}
            dayLabel={exportDayLabel}
            open={exportOpen}
            onOpenChange={setExportOpen}
            trigger={<span className="hidden" />}
          />
        )}
    </AppShell>
  );
};

export default ProjectDetail;
