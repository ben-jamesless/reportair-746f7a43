import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImagePlus, Loader2, MapPinned, Calendar, ChevronDown, ChevronRight, FileDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

type Album = { id: string; name: string; slug: string; position: number };
type Area = { id: string; name: string; sort_order: number };

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
  const raw = p.captured_at || (p as any).created_at;
  const d = raw ? new Date(raw) : new Date(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string>(ALL_DAYS);
  const [activeArea, setActiveArea] = useState<string | null>(null); // null = all areas in day
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ar }, { data: ph }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template").eq("id", id).maybeSingle(),
      supabase.from("albums").select("id, name, slug, position").eq("project_id", id).order("position"),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", id).order("sort_order"),
      supabase
        .from("photos")
        .select(
          "id, project_id, album_id, area_id, storage_path, file_name, caption, captured_at, created_at, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height"
        )
        .eq("project_id", id)
        .order("captured_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);
    setProject(p ?? null);
    setAlbums(a ?? []);
    setAreas((ar ?? []) as Area[]);
    setPhotos((ph ?? []) as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Identify the Pre-event album (if it exists)
  const preEventAlbum = useMemo(() => albums.find((a) => a.slug === PRE_EVENT_SLUG) ?? null, [albums]);

  // Split photos: anything in the Pre-event album goes to the Pre-event bucket;
  // everything else groups by capture/upload date.
  const { datedPhotos, preEventPhotos } = useMemo(() => {
    const dated: LightboxPhoto[] = [];
    const pre: LightboxPhoto[] = [];
    for (const p of photos) {
      if (preEventAlbum && (p as any).album_id === preEventAlbum.id) pre.push(p);
      else dated.push(p);
    }
    return { datedPhotos: dated, preEventPhotos: pre };
  }, [photos, preEventAlbum]);

  // Build day buckets from dated photos only
  const days = useMemo(() => {
    const map = new Map<string, { key: string; label: string; date: Date; photos: LightboxPhoto[] }>();
    for (const ph of datedPhotos) {
      const k = dayKey(ph);
      const raw = ph.captured_at || (ph as any).created_at;
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
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? ({ ...p, album_id: albumId } as any) : p)));
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
    return parts.length ? parts.join(" · ") : "All photos";
  }, [activeDay, activeArea, uploadAreaId, days, areas]);

  // Selection title
  const selectionTitle = useMemo(() => {
    if (activeDay === ALL_DAYS && activeArea === null) return "All photos";
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
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container py-10">
          <p className="text-muted-foreground">Project not found.</p>
          <Link to="/projects" className="mt-4 inline-block text-sm text-primary underline">Back to projects</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-10">
        <Link to="/projects" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All projects
        </Link>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">
              {project.template === "event_production" ? "Event production" : "Blank"}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <ProjectSettingsDialog projectId={project.id} onChanged={loadAll} />
              <ExportPdfDialog projectId={project.id} photoCount={photos.length} />
              <PhotoUploader projectId={project.id} albumId={null} areaId={uploadAreaId} onUploaded={loadAll} />
            </div>
            <p className="text-xs text-muted-foreground">
              Uploading to: <span className="font-medium">{uploadContextLabel}</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="photos" className="w-full">
          <TabsList>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
              {/* Day → Area sidebar */}
              <aside className="space-y-1">
                <button
                  onClick={() => { setActiveDay(ALL_DAYS); setActiveArea(null); }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    activeDay === ALL_DAYS && activeArea === null
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  )}
                >
                  <span className="font-medium">All photos</span>
                  <span className={cn("text-xs", activeDay === ALL_DAYS && activeArea === null ? "opacity-80" : "text-muted-foreground")}>
                    {photos.length}
                  </span>
                </button>

                {days.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No photos yet.</p>
                )}

                {days.map((day) => {
                  const isOpen = openDays.has(day.key);
                  const dayActive = activeDay === day.key && activeArea === null;
                  const { counts, unassigned } = areaCountsForDay(day.photos);
                  return (
                    <div key={day.key} className="rounded-md">
                      <div className="flex items-stretch">
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
                      </div>

                      {isOpen && (
                        <div className="ml-7 mt-0.5 space-y-0.5 border-l pl-2">
                          {areas.map((ar) => {
                            const c = counts.get(ar.id) ?? 0;
                            if (c === 0) return null;
                            const sel = activeDay === day.key && activeArea === ar.id;
                            return (
                              <button
                                key={ar.id}
                                onClick={() => selectDayArea(day.key, ar.id)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                  sel ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                                )}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <MapPinned className={cn("h-3 w-3 shrink-0", sel ? "" : "text-muted-foreground")} />
                                  <span className="truncate">{ar.name}</span>
                                </span>
                                <span className={cn("ml-2 text-[10px]", sel ? "opacity-80" : "text-muted-foreground")}>{c}</span>
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
              </aside>

              {/* Main grid */}
              <section>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{selectionTitle}</h2>
                  <span className="text-xs text-muted-foreground">
                    {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
                  </span>
                </div>

                {visiblePhotos.length === 0 ? (
                  <Card className="border-dashed shadow-none">
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                      <h2 className="text-lg font-semibold">No photos here</h2>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {activeDay === ALL_DAYS
                          ? "Upload images to extract EXIF (capture time, camera, GPS) and start telling the story."
                          : "Upload to this day + area context, or pick a different selection."}
                      </p>
                      <PhotoUploader projectId={project.id} albumId={null} areaId={uploadAreaId} onUploaded={loadAll} />
                    </CardContent>
                  </Card>
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
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ActivityFeed projectId={project.id} />
          </TabsContent>
        </Tabs>

        <PhotoLightbox
          photos={visiblePhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          areas={areas}
          albums={albums}
          onAreaChanged={handleAreaChanged}
          onAlbumChanged={handleAlbumChanged}
        />
      </main>
    </div>
  );
};

export default ProjectDetail;
