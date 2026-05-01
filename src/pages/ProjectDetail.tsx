import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, ArchiveRestore, ImagePlus, MapPinned, Calendar, ChevronDown, ChevronRight, FileDown, Layers, Trash2 } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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
import { PROJECT_STATUSES, projectStatusMeta, type ProjectStatus } from "@/lib/projectStatus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  archived_at: string | null;
};

type Album = { id: string; name: string; slug: string; position: number };
type Area = { id: string; name: string; sort_order: number };
type DayNote = { date: string; notes: string | null };

const NO_AREA = "__no_area__";
const ALL_DAYS = "__all__";
const ALBUM_PREFIX = "album:";
const isAlbumKey = (k: string) => k.startsWith(ALBUM_PREFIX);
const albumIdFromKey = (k: string) => (isAlbumKey(k) ? k.slice(ALBUM_PREFIX.length) : null);
const albumKey = (id: string) => `${ALBUM_PREFIX}${id}`;
// Legacy URL value preserved so old shared links keep working until we can
// resolve the slug to an album id (handled in an effect below).
const LEGACY_PRE_EVENT_DAY = "__pre_event__";
const LEGACY_PRE_EVENT_SLUG = "pre-event";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [dayNotes, setDayNotes] = useState<Map<string, string | null>>(new Map());
  // per-area, per-day update notes keyed by `${areaId}|${dateKey}` -> string
  const [areaDayNotes, setAreaDayNotes] = useState<Map<string, string | null>>(new Map());
  // status keyed by `${areaId}|${dateKey}` -> AreaStatus
  const [areaDayStatus, setAreaDayStatus] = useState<Map<string, AreaStatus>>(new Map());
  const [loading, setLoading] = useState(true);
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "activity" | "details">(() => {
    const t = searchParams.get("tab");
    if (t === "activity") return "activity";
    if (t === "details") return "details";
    if (t === "updates" || t === "photos") return "photos";
    return "photos";
  });
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

  // Escape exits selection mode
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitSelectMode(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode, exitSelectMode]);

  const bulkAssignArea = useCallback(async (areaId: string | null) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("photos").update({ area_id: areaId }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    const label = areaId === null ? "Unassigned" : (areas.find((a) => a.id === areaId)?.name ?? "area");
    toast.success(`Assigned ${ids.length} photo${ids.length === 1 ? "" : "s"} to ${label}`);
    // Optimistically update local photos
    setPhotos((cur) => cur.map((p) => (selectedIds.has(p.id) ? { ...p, area_id: areaId } : p)));
    exitSelectMode();
  }, [selectedIds, areas, exitSelectMode]);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ar }, { data: ph }, { data: dn }, { data: ads }, { data: adn }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template, color, event_date, event_location, overall_status, event_type, client_name, archived_at").eq("id", id).maybeSingle(),
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
      supabase.from("day_notes").select("date, notes").eq("project_id", id),
      supabase.from("area_day_status").select("area_id, date, status").eq("project_id", id),
      supabase.from("area_day_notes").select("area_id, date, notes").eq("project_id", id),
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
    const nm = new Map<string, string | null>();
    for (const row of (adn ?? []) as { area_id: string; date: string; notes: string | null }[]) nm.set(`${row.area_id}|${row.date}`, row.notes ?? null);
    setAreaDayNotes(nm);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    (async () => {
      if (!user || !id) return;
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsOwner(data?.role === "owner");
    })();
  }, [user, id]);

  const restoreProject = async () => {
    if (!id) return;
    const { error } = await supabase.from("projects").update({ archived_at: null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Project restored");
    loadAll();
  };

  // ---- Mutations: per-day area notes, day notes, per-day area status, project status ----
  const getAreaDayNote = (areaId: string, dateKey: string): string | null =>
    areaDayNotes.get(`${areaId}|${dateKey}`) ?? null;
  const saveAreaDayNote = async (areaId: string, dateKey: string, next: string | null) => {
    if (!id) return;
    const key = `${areaId}|${dateKey}`;
    const prev = new Map(areaDayNotes);
    setAreaDayNotes((cur) => { const n = new Map(cur); n.set(key, next); return n; });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("area_day_notes").upsert(
      { project_id: id, area_id: areaId, date: dateKey, notes: next, updated_by: user?.id },
      { onConflict: "project_id,area_id,date" },
    );
    if (error) { toast.error(error.message); setAreaDayNotes(prev); }
  };
  const saveProjectStatus = async (next: ProjectStatus) => {
    if (!id) return;
    const prev = project;
    setProject((cur) => (cur ? { ...cur, overall_status: next } : cur));
    const { error } = await supabase.from("projects").update({ overall_status: next }).eq("id", id);
    if (error) { toast.error(error.message); setProject(prev); }
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

  // Photos in any album are excluded from the date-grouped pool and shown
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
    const exists = photos.some((p) => p.id === target);
    if (!exists) return;
    // Reset filters so the photo is in `visiblePhotos`.
    if (activeDay !== ALL_DAYS) setActiveDay(ALL_DAYS);
    if (activeArea !== null) setActiveArea(null);
    const idx = photoIndexById.get(target);
    if (idx !== undefined) {
      setLightboxIndex(idx);
      // Clear params so refresh/back doesn't re-trigger.
      const next = new URLSearchParams(searchParams);
      next.delete("photo");
      next.delete("comments");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, photoIndexById, searchParams]);

  // Keep URL in sync with filter state (replaceState — don't pollute history).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    // day
    if (activeDay === ALL_DAYS) next.delete("day");
    else if (activeDay === PRE_EVENT_DAY) next.set("day", PRE_EVENT_DAY);
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

  const handleAreaChanged = (photoId: string, areaId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, area_id: areaId } : p)));
  };
  const handleAlbumChanged = (photoId: string, albumId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, album_id: albumId } : p)));
  };

  // Upload context: when "Pre-event" is the active day, uploads land in the pre-event album.
  const uploadAreaId = activeArea && activeArea !== NO_AREA ? activeArea : null;
  const uploadAlbumId = activeDay === PRE_EVENT_DAY && preEventAlbum ? preEventAlbum.id : null;
  const uploadContextLabel = (() => {
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
  })();

  // Selection title
  const selectionTitle = (() => {
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
  })();

  // Export trigger state (shared by per-day icon and top-level button)
  const [exportDayKey, setExportDayKey] = useState<string | null>(null);
  const [exportDayLabel, setExportDayLabel] = useState<string | null>(null);
  const [exportPhotoCount, setExportPhotoCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLockMode, setExportLockMode] = useState<"single" | null>(null);

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
    setExportLockMode(null); // top-level allows mode toggle
    setExportOpen(true);
  };

  // (availableDaysForExport is computed earlier, above the early returns, to keep hook order stable)

  const accent = project.color || "#01696F";

  return (
    <AppShell crumbs={crumbs}>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {project.template === "event_production" ? "Event production" : "Project"}
            </Badge>
            <Select value={project.overall_status ?? "no_status"} onValueChange={(v) => saveProjectStatus(v as ProjectStatus)}>
              <SelectTrigger
                aria-label="Project status"
                className={cn(
                  "h-7 w-auto gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  projectStatusMeta(project.overall_status).pillClass,
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", projectStatusMeta(project.overall_status).dotClass)} />
                  <span>{projectStatusMeta(project.overall_status).label}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {project?.archived_at && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              This project was archived on{" "}
              <span className="font-medium">
                {new Date(project.archived_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              .
            </span>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={restoreProject}>
              Restore
            </Button>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "photos" | "activity" | "details")} className="w-full">
        {/* Top controls row: tabs + settings + export */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <TabsList>
            <TabsTrigger value="photos">Updates</TabsTrigger>
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-lg font-semibold">{selectionTitle}</h2>
                    <span className="text-xs text-muted-foreground">
                      {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {visiblePhotos.length > 0 && !selectMode && (
                    <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
                      Select
                    </Button>
                  )}
                </div>

                {/* Bulk-selection toolbar */}
                {selectMode && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium">
                      {selectedIds.size} selected
                    </span>
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
                    <div className="ml-auto flex items-center gap-2">
                      <Select
                        value=""
                        onValueChange={(v) => bulkAssignArea(v === "__none__" ? null : v)}
                        disabled={selectedIds.size === 0}
                      >
                        <SelectTrigger className="h-9 w-[200px]">
                          <SelectValue placeholder="Assign area…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {areas.map((ar) => (
                            <SelectItem key={ar.id} value={ar.id}>{ar.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={exitSelectMode}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}

                {/* Daily updates note shown at the top of the main panel when a dated day is active */}
                {activeDay !== ALL_DAYS && activeDay !== PRE_EVENT_DAY && (
                  <div className="mb-5">
                    <EditableNote
                      value={dayNotes.get(activeDay) ?? null}
                      placeholder="Daily updates"
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
                                  value={getAreaDayNote(ar.id, activeDay)}
                                  placeholder="Daily updates"
                                  onSave={(next) => saveAreaDayNote(ar.id, activeDay, next)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                {list.map((p) => (
                                  <PhotoThumb
                                    key={p.id}
                                    path={p.storage_path}
                                    alt={p.caption || p.file_name}
                                    selectable={selectMode}
                                    selected={selectedIds.has(p.id)}
                                    onClick={() =>
                                      selectMode
                                        ? toggleSelect(p.id)
                                        : setLightboxIndex(photoIndexById.get(p.id) ?? 0)
                                    }
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
                                  selectable={selectMode}
                                  selected={selectedIds.has(p.id)}
                                  onClick={() =>
                                    selectMode
                                      ? toggleSelect(p.id)
                                      : setLightboxIndex(photoIndexById.get(p.id) ?? 0)
                                  }
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
                        selectable={selectMode}
                        selected={selectedIds.has(p.id)}
                        onClick={() =>
                          selectMode
                            ? toggleSelect(p.id)
                            : setLightboxIndex(photoIndexById.get(p.id) ?? 0)
                        }
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
            isOwner={isOwner}
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
            availableDays={availableDaysForExport}
            lockMode={exportLockMode}
            open={exportOpen}
            onOpenChange={setExportOpen}
            trigger={<span className="hidden" />}
          />
        )}
    </AppShell>
  );
};

export default ProjectDetail;
