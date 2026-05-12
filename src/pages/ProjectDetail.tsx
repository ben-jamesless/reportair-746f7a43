import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, ArchiveRestore, ImagePlus, MapPinned, Calendar, ChevronDown, ChevronRight, FileDown, Layers, Trash2, FileText, LayoutGrid, MapPin, CalendarDays, Download, X, MessageSquare, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import JSZip from "jszip";
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
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { RichNotes } from "@/components/RichNotes";
import { ProjectDetailsTab } from "@/components/ProjectDetailsTab";
import { MobileProjectToolbar } from "@/components/MobileProjectToolbar";
import { PROJECT_STATUSES, projectStatusMeta, type ProjectStatus } from "@/lib/projectStatus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProjectView = "report" | "gallery";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  color: string | null;
  event_date: string | null;
  build_start_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  archived_at: string | null;
  default_view: ProjectView | null;
};

type Album = { id: string; name: string; slug: string; position: number };
type Area = { id: string; name: string; sort_order: number };
type DayNote = {
  date: string;
  notes: string | null;
  today_objectives: string | null;
  today_achievements: string | null;
  tomorrow_objectives: string | null;
  open_issues: string | null;
};
type DailyField = "today_objectives" | "today_achievements" | "tomorrow_objectives" | "open_issues";
type DailyFields = { [K in DailyField]: string | null };

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

/** Hex accent for the 3px left bar on area blocks (matches share view). */
const areaStatusAccent = (s: AreaStatus | null | undefined): string => {
  switch (s) {
    case "on_track": return "#3b82f6";
    case "requires_discussion": return "#f97316";
    case "concern": return "#ef4444";
    case "complete": return "#10b981";
    default: return "#e5e7eb";
  }
};

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
  const [canEdit, setCanEdit] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [dayNotes, setDayNotes] = useState<Map<string, string | null>>(new Map());
  // 4 daily update fields keyed by dateKey
  const [dailyFields, setDailyFields] = useState<Map<string, DailyFields>>(new Map());
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

  const bulkMoveToDay = useCallback(async (targetDayKey: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    // Set captured_at to noon UTC of the target day so it groups under that day.
    const newCaptured = `${targetDayKey}T12:00:00.000Z`;
    const { error } = await supabase.from("photos").update({ captured_at: newCaptured }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved ${ids.length} photo${ids.length === 1 ? "" : "s"} to ${targetDayKey}`);
    setPhotos((cur) => cur.map((p) => (selectedIds.has(p.id) ? { ...p, captured_at: newCaptured } : p)));
    exitSelectMode();
  }, [selectedIds, exitSelectMode]);

  const [downloading, setDownloading] = useState(false);
  const bulkDownload = useCallback(async () => {
    if (selectedIds.size === 0 || !project) return;
    setDownloading(true);
    try {
      const selected = photos.filter((p) => selectedIds.has(p.id));
      const zip = new JSZip();
      const seen = new Map<string, number>();
      await Promise.all(selected.map(async (p) => {
        try {
          const { data, error } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 600);
          if (error || !data?.signedUrl) return;
          const res = await fetch(data.signedUrl);
          if (!res.ok) return;
          const blob = await res.blob();
          let name = p.file_name || `${p.id}.jpg`;
          const count = seen.get(name) ?? 0;
          seen.set(name, count + 1);
          if (count > 0) {
            const dot = name.lastIndexOf(".");
            name = dot > 0 ? `${name.slice(0, dot)}-${count}${name.slice(dot)}` : `${name}-${count}`;
          }
          zip.file(name, blob);
        } catch (e) {
          console.error("Failed to add photo to zip", p.id, e);
        }
      }));
      const blob = await zip.generateAsync({ type: "blob" });
      const slug = (project.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reportair-${slug}-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${selected.length} photo${selected.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error("Download failed");
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [selectedIds, photos, project]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bulkDeletePhotos = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const paths = photos.filter((p) => selectedIds.has(p.id)).map((p) => p.storage_path).filter(Boolean);
    const { error: dbError } = await supabase.from("photos").delete().in("id", ids);
    if (dbError) {
      setDeleting(false);
      toast.error(dbError.message);
      return;
    }
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("photos").remove(paths);
      // Storage failures are non-fatal — DB rows are the source of truth.
      if (storageError) console.error("Storage delete partial failure:", storageError);
    }
    setPhotos((cur) => cur.filter((p) => !selectedIds.has(p.id)));
    toast.success(`${ids.length} photo${ids.length === 1 ? "" : "s"} deleted.`);
    exitSelectMode();
    setConfirmDeleteOpen(false);
    setDeleting(false);
  }, [selectedIds, photos, exitSelectMode]);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ar }, { data: ph }, { data: dn }, { data: ads }, { data: adn }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template, color, event_date, build_start_date, event_location, overall_status, event_type, client_name, archived_at, default_view").eq("id", id).maybeSingle(),
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
      supabase.from("day_notes").select("date, notes, today_objectives, today_achievements, tomorrow_objectives, open_issues").eq("project_id", id),
      supabase.from("area_day_status").select("area_id, date, status").eq("project_id", id),
      supabase.from("area_day_notes").select("area_id, date, notes").eq("project_id", id),
    ]);
    setProject(p ?? null);
    setAlbums(a ?? []);
    setAreas((ar ?? []) as Area[]);
    setPhotos((ph ?? []) as LightboxPhoto[]);
    const map = new Map<string, string | null>();
    const fieldMap = new Map<string, DailyFields>();
    for (const row of (dn ?? []) as DayNote[]) {
      map.set(row.date, row.notes ?? null);
      fieldMap.set(row.date, {
        today_objectives: row.today_objectives ?? null,
        today_achievements: row.today_achievements ?? null,
        tomorrow_objectives: row.tomorrow_objectives ?? null,
        open_issues: row.open_issues ?? null,
      });
    }
    setDayNotes(map);
    setDailyFields(fieldMap);
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
      setCanEdit(data?.role === "owner" || data?.role === "editor");
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
  const getDailyField = (dateKey: string, field: DailyField): string | null =>
    dailyFields.get(dateKey)?.[field] ?? null;
  const saveDailyField = async (dateKey: string, field: DailyField, next: string | null) => {
    if (!id) return;
    const prev = new Map(dailyFields);
    setDailyFields((cur) => {
      const n = new Map(cur);
      const existing = n.get(dateKey) ?? { today_objectives: null, today_achievements: null, tomorrow_objectives: null, open_issues: null };
      n.set(dateKey, { ...existing, [field]: next });
      return n;
    });
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { project_id: id, date: dateKey, [field]: next, updated_by: user?.id } as never;
    const { error } = await supabase.from("day_notes").upsert(payload, { onConflict: "project_id,date" });
    if (error) { toast.error(error.message); setDailyFields(prev); }
  };
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
    <AppShell crumbs={crumbs}>
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
      <div className="mb-6 hidden flex-col gap-4 sm:mb-8 md:flex md:flex-row md:flex-wrap md:items-start md:justify-between">
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
            {canEdit ? (
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
            ) : (
              <span
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
                  projectStatusMeta(project.overall_status).pillClass,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", projectStatusMeta(project.overall_status).dotClass)} />
                <span>{projectStatusMeta(project.overall_status).label}</span>
              </span>
            )}
          </div>
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{project.description}</p>
          )}
        </div>
        {canEdit && (
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
        )}
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
        <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 border-b pb-3 md:flex">
          <TabsList>
            <TabsTrigger value="photos">Updates</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-0.5" role="radiogroup" aria-label="Project view">
              <button
                type="button"
                role="radio"
                aria-checked={effectiveView === "report"}
                onClick={() => setViewOverride("report")}
                title="Daily report view"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  effectiveView === "report"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <FileText className="h-3.5 w-3.5" /> Report
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={effectiveView === "gallery"}
                onClick={() => setViewOverride("gallery")}
                title="Gallery view"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  effectiveView === "gallery"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Gallery
              </button>
            </div>
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
            <Button
              variant="outline"
              size="sm"
              className="xl:hidden"
              onClick={() => setFeedbackSheetOpen(true)}
              title="Feedback"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Feedback
            </Button>
            {canEdit && (
              <ProjectSettingsDialog projectId={project.id} project={project} onChanged={loadAll} />
            )}
          </div>
        </div>

          <TabsContent value="photos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[400px_1fr] xl:grid-cols-[400px_minmax(0,1fr)_320px]">
              {/* Day → Area sidebar */}
              <aside className="space-y-1 rounded-lg dark:bg-card dark:p-2">
                {days.length === 0 && albumPhotos.size === 0 && (
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
                            dayActive
                              ? "border-l-[3px] border-primary bg-primary/15 text-foreground dark:text-white"
                              : "hover:bg-secondary dark:hover:bg-[#1E3050]",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <Calendar className={cn("h-3.5 w-3.5", dayActive ? "text-primary" : "text-muted-foreground")} />
                            <span className="font-medium">{SHORT_FMT.format(day.date)}</span>
                          </span>
                          <span className={cn("text-xs", dayActive ? "text-primary" : "text-muted-foreground")}>
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
                                  sel
                                    ? "border-l-[3px] border-primary bg-primary/15 text-foreground dark:text-white"
                                    : "hover:bg-secondary dark:hover:bg-[#1E3050]",
                                )}
                              >
                                <AreaStatusDot status={st} className="shrink-0" />
                                <MapPinned className={cn("h-3 w-3 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                                <span className="flex-1 truncate">{ar.name}</span>
                                <span className={cn("ml-1 text-[10px]", sel ? "text-primary" : "text-muted-foreground")}>{c}</span>
                              </button>
                            );
                          })}
                          {unassigned > 0 && (
                            <button
                              onClick={() => selectDayArea(day.key, NO_AREA)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                activeDay === day.key && activeArea === NO_AREA
                                  ? "border-l-[3px] border-primary bg-primary/15 text-foreground dark:text-white"
                                  : "hover:bg-secondary dark:hover:bg-[#1E3050]",
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                <MapPinned className="h-3 w-3 shrink-0 text-muted-foreground" />
                                Unassigned
                              </span>
                              <span className={cn(
                                "ml-2 text-[10px]",
                                activeDay === day.key && activeArea === NO_AREA ? "text-primary" : "text-muted-foreground"
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
                  {albums.map((al) => {
                    const count = albumPhotos.get(al.id)?.length ?? 0;
                    const key = albumKey(al.id);
                    const sel = activeDay === key && activeArea === null;
                    return (
                      <button
                        key={al.id}
                        onClick={() => { setActiveDay(key); setActiveArea(null); }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                          sel ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className={cn("h-3.5 w-3.5", sel ? "" : "text-muted-foreground")} />
                          <span className="font-medium">{al.name}</span>
                        </span>
                        <span className={cn("text-xs", sel ? "opacity-80" : "text-muted-foreground")}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
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
                {/* Day / selection header — full-width flush strip, sticky */}
                <div className="sticky top-0 z-20 -mx-1 mb-0 flex flex-wrap items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <h2 className="truncate text-base font-bold text-foreground">{selectionTitle}</h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
                    </span>
                    {activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && (() => {
                      const dayPool = days.find((d) => d.key === activeDay)?.photos ?? [];
                      const areaIds = new Set<string>();
                      dayPool.forEach((p) => { if (p.area_id) areaIds.add(p.area_id); });
                      const counts: Record<AreaStatus, number> = {
                        no_status: 0, on_track: 0, requires_discussion: 0, concern: 0, complete: 0,
                      };
                      areaIds.forEach((aid) => { counts[getAreaDayStatus(aid, activeDay)]++; });
                      const parts: string[] = [];
                      if (counts.complete) parts.push(`${counts.complete} Complete`);
                      if (counts.on_track) parts.push(`${counts.on_track} On Track`);
                      if (counts.requires_discussion) parts.push(`${counts.requires_discussion} Requires Discussion`);
                      if (counts.concern) parts.push(`${counts.concern} Concern`);
                      if (counts.no_status) parts.push(`${counts.no_status} No Status`);
                      if (parts.length === 0) return null;
                      return (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          · {parts.join(" · ")}
                        </span>
                      );
                    })()}
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
                    {visiblePhotos.length > 0 && (
                      <Button size="sm" variant={selectMode ? "default" : "outline"} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                        {selectMode ? "Done" : "Select"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status accent colors for the 3px left bar (matches share view). */}
                {(() => null)()}

                {/* REPORT VIEW — written briefing per area, no photo grids. */}
                {activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && effectiveView === "report" && (() => {
                  const day = days.find((d) => d.key === activeDay);
                  if (!day) return null;
                  const dayPool = day.photos;
                  // Show ALL project areas on the Updates page so users can set status/notes
                  // even before any photos are uploaded for that area on this day.
                  const areasOnDay = areas;
                  const dayNoteVal = dayNotes.get(activeDay) ?? null;
                  const dailyBlocks: { key: DailyField; label: string }[] = [
                    { key: "today_objectives", label: "Today's Objectives" },
                    { key: "today_achievements", label: "Today's Achievements" },
                    { key: "tomorrow_objectives", label: "Tomorrow's Objectives" },
                    { key: "open_issues", label: "Open Issues / Risks" },
                  ];
                  return (
                    <div className="space-y-6">
                      {/* Daily updates — 4 separate fields used by the report PDF cover */}
                      <div className="px-4 pt-2 grid gap-4 sm:grid-cols-2">
                        {dailyBlocks.map((b) => (
                          <div key={b.key}>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {b.label}
                            </p>
                            <EditableNote
                              value={getDailyField(activeDay, b.key)}
                              placeholder={`Add ${b.label.toLowerCase()}…`}
                              onSave={(next) => saveDailyField(activeDay, b.key, next)}
                              rich
                              rows={3}
                              readOnly={!canEdit}
                            />
                          </div>
                        ))}
                      </div>
                      {dayNoteVal && dayNoteVal.trim() && (
                        <div className="px-4">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Legacy notes
                          </p>
                          <EditableNote
                            value={dayNoteVal}
                            placeholder=""
                            onSave={(next) => saveDayNote(activeDay, next)}
                            rich
                            rows={3}
                            readOnly={!canEdit}
                          />
                        </div>
                      )}

                      {/* Per-area briefing — flush, no card */}
                      {areasOnDay.length === 0 ? (
                        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                          No areas defined yet. Add areas in project settings.
                        </p>
                      ) : (
                        <div>
                          {areasOnDay.map((ar, idx) => {
                            const st = getAreaDayStatus(ar.id, activeDay);
                            const note = getAreaDayNote(ar.id, activeDay);
                            const accent = areaStatusAccent(st);
                            const isLast = idx === areasOnDay.length - 1;
                            return (
                              <div key={ar.id}>
                                <article className="py-4 pl-4" style={{ borderLeft: `3px solid ${accent}` }}>
                                  <header className="mb-3 flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{ar.name}</h3>
                                    <AreaStatusPicker
                                      value={st}
                                      onChange={(s) => saveAreaDayStatus(ar.id, activeDay, s)}
                                      className="ml-auto"
                                      readOnly={!canEdit}
                                    />
                                  </header>
                                  <EditableNote
                                    value={note}
                                    placeholder="No notes for this area yet."
                                    onSave={(next) => saveAreaDayNote(ar.id, activeDay, next)}
                                    rich
                                    rows={3}
                                    readOnly={!canEdit}
                                  />
                                </article>
                                {!isLast && (
                                  <div className="ml-4 border-t" style={{ borderColor: "#e5e7eb" }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hide photo grids in Report view for dated days — Report is text-only briefing. */}
                {!(activeDay !== ALL_DAYS && !isAlbumKey(activeDay) && effectiveView === "report") && (
                visiblePhotos.length === 0 ? (
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
                            projectId={project.id}
                            albumId={uploadAlbumId}
                            areaId={uploadAreaId}
                            areas={areas}
                            onUploaded={loadAll}
                          />
                        </ErrorBoundary>
                      ) : undefined
                    }
                  />
                ) : activeDay !== ALL_DAYS && !isAlbumKey(activeDay) ? (
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
                    const totalBlocks = orderedAreas.length + (unassigned.length > 0 ? 1 : 0);
                    return (
                      <div>
                        {orderedAreas.map((ar, idx) => {
                          const list = byArea.get(ar.id) ?? [];
                          const st = getAreaDayStatus(ar.id, activeDay);
                          const accent = areaStatusAccent(st);
                          const isLast = idx === totalBlocks - 1;
                          return (
                            <div key={ar.id}>
                              <article className="py-4 pl-4" style={{ borderLeft: `3px solid ${accent}` }}>
                                <header className="mb-3 flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-medium" style={{ color: "#1a1a1a" }}>{ar.name}</h3>
                                  <span className="text-xs" style={{ color: "#6b7280" }}>
                                    {list.length} photo{list.length === 1 ? "" : "s"}
                                  </span>
                                  <AreaStatusPicker
                                    value={st}
                                    onChange={(s) => saveAreaDayStatus(ar.id, activeDay, s)}
                                    className="ml-auto"
                                    readOnly={!canEdit}
                                  />
                                </header>
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
                              </article>
                              {!(isLast) && (
                                <div className="ml-4 border-t" style={{ borderColor: "#e5e7eb" }} />
                              )}
                            </div>
                          );
                        })}
                        {unassigned.length > 0 && (
                          <article className="py-4 pl-4" style={{ borderLeft: `3px solid #e5e7eb` }}>
                            <header className="mb-3 flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium" style={{ color: "#1a1a1a" }}>Unassigned</h3>
                              <span className="text-xs" style={{ color: "#6b7280" }}>
                                {unassigned.length} photo{unassigned.length === 1 ? "" : "s"}
                              </span>
                            </header>
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
                          </article>
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
                )
                )}
              </section>

              <FeedbackPanel
                projectId={project.id}
                visiblePhotos={visiblePhotos}
                allPhotos={photos}
                onOpenPhoto={(photoId) => {
                  const idx = photoIndexById.get(photoId);
                  if (idx !== undefined) {
                    setLightboxIndex(idx);
                  } else {
                    // Photo isn't in current visible pool — reset filters and re-target.
                    setActiveDay(ALL_DAYS);
                    setActiveArea(null);
                    // Defer to next tick so visiblePhotos updates first.
                    setTimeout(() => {
                      const all = photos.findIndex((p) => p.id === photoId);
                      if (all >= 0) setLightboxIndex(all);
                    }, 0);
                  }
                }}
                className="hidden xl:flex xl:max-h-[calc(100vh-12rem)] xl:sticky xl:top-6"
              />
            </div>

            {/* Feedback bottom sheet — mobile + tablet (xl shows the sticky panel above instead) */}
            <Sheet open={feedbackSheetOpen} onOpenChange={setFeedbackSheetOpen}>
              <SheetContent side="bottom" className="flex h-[85vh] flex-col rounded-t-xl p-0 xl:hidden">
                <SheetHeader className="px-4 pt-4">
                  <SheetTitle>Feedback</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-hidden p-3">
                  <FeedbackPanel
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
                    className="h-full"
                  />
                </div>
              </SheetContent>
            </Sheet>
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

        {selectMode && selectedIds.size > 0 && (
          <div
            className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-3 px-4 py-3 text-white shadow-lg"
            style={{ backgroundColor: "#01696F" }}
            role="toolbar"
            aria-label="Bulk photo actions"
          >
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canEdit && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25 border-0">
                      <MapPin className="mr-1.5 h-4 w-4" />
                      Reassign area
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="end">
                    <button
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => bulkAssignArea(null)}
                    >
                      Unassigned
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <div className="max-h-64 overflow-y-auto">
                      {areas.map((ar) => (
                        <button
                          key={ar.id}
                          className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => bulkAssignArea(ar.id)}
                        >
                          {ar.name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {canEdit && days.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25 border-0">
                      <CalendarDays className="mr-1.5 h-4 w-4" />
                      Move to day
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1" align="end">
                    <div className="max-h-64 overflow-y-auto">
                      {days.map((d) => (
                        <button
                          key={d.key}
                          className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => bulkMoveToDay(d.key)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={bulkDownload}
                disabled={downloading}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {downloading ? "Zipping…" : "Download"}
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25 border-0"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/15 hover:text-white"
                onClick={exitSelectMode}
                aria-label="Exit selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmDeleteOpen} onOpenChange={(o) => !deleting && setConfirmDeleteOpen(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedIds.size} photo{selectedIds.size === 1 ? "" : "s"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the selected photos and remove them from the project. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); bulkDeletePhotos(); }}
                disabled={deleting}
                className={buttonVariants({ variant: "destructive" })}
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </AppShell>
  );
};

export default ProjectDetail;
