import { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import type { LightboxPhoto } from "@/components/PhotoLightbox";
import type { AreaStatus } from "@/components/AreaStatusPicker";
import type { ProjectStatus } from "@/lib/projectStatus";
import type {
  Album,
  Area,
  DailyField,
  DailyFields,
  DayNote,
  Project,
} from "@/lib/projectDetailTypes";

export interface ProjectDetailState {
  // Data
  project: Project | null;
  isOwner: boolean;
  canEdit: boolean;
  albums: Album[];
  areas: Area[];
  photos: LightboxPhoto[];
  dayNotes: Map<string, string | null>;
  dailyFields: Map<string, DailyFields>;
  areaDayNotes: Map<string, string | null>;
  areaDayStatus: Map<string, AreaStatus>;
  dayStatus: Map<string, AreaStatus>;

  // Load lifecycle
  loading: boolean;
  loadError: boolean;
  refetch: () => Promise<void>;

  // Per-row mutations
  setDayNote: (dayKey: string, value: string | null) => Promise<void>;
  setDailyField: (dayKey: string, field: DailyField, value: string | null) => Promise<void>;
  setAreaDayNote: (areaId: string, dayKey: string, value: string | null) => Promise<void>;
  setAreaDayStatus: (areaId: string, dayKey: string, status: AreaStatus) => Promise<void>;
  setDayStatus: (dayKey: string, status: AreaStatus) => Promise<void>;

  // Project-level mutations
  saveProjectStatus: (next: ProjectStatus) => Promise<void>;
  archiveProject: () => Promise<void>;
  restoreProject: () => Promise<void>;

  // Area mutations
  addArea: (name: string) => Promise<void>;
  softDeleteArea: (id: string) => Promise<void>;
  restoreArea: (id: string) => Promise<void>;

  // Photo mutations (bulk)
  bulkAssignArea: (photoIds: string[], areaId: string | null) => Promise<void>;
  bulkMoveToDay: (photoIds: string[], targetDayKey: string) => Promise<void>;
  bulkDelete: (photoIds: string[]) => Promise<void>;
  bulkDownloadZip: (photoIds: string[]) => Promise<void>;
  downloading: boolean;
  deleting: boolean;

  // Local photo cache updates (called from child components after they mutate)
  applyPhotoAreaChange: (photoId: string, areaId: string | null) => void;
  applyPhotoAlbumChange: (photoId: string, albumId: string | null) => void;
}

/**
 * useProjectDetail
 *
 * Owns ALL data-layer state for the project detail page:
 *   - Project, members (isOwner / canEdit), albums, areas, photos
 *   - Per-day notes, per-day daily fields, per-area-day notes & status
 *   - Loading + error state
 *
 * Exposes refetch + a fixed set of mutation helpers. The page component is
 * responsible for UI-only state (lightbox index, selection set, open days,
 * tab state, URL sync, etc.) and orchestrates calls into this hook.
 *
 * Pure refactor — behaviour matches the previous inline implementation in
 * `src/pages/ProjectDetail.tsx` exactly.
 */
export function useProjectDetail(projectId: string | undefined): ProjectDetailState {
  const { user } = useAuth();
  const { limits, projectCount, refetch: refetchPlan } = usePlan();

  // ---- Data state ----
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [dayNotes, setDayNotes] = useState<Map<string, string | null>>(new Map());
  const [dailyFields, setDailyFields] = useState<Map<string, DailyFields>>(new Map());
  const [areaDayNotes, setAreaDayNotes] = useState<Map<string, string | null>>(new Map());
  const [areaDayStatus, setAreaDayStatus] = useState<Map<string, AreaStatus>>(new Map());
  const [dayStatus, setDayStatus] = useState<Map<string, AreaStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ---- Load ----
  const refetch = useCallback(async () => {
    if (!projectId) return;
    try {
      const [
        { data: p },
        { data: a },
        { data: ar },
        { data: ph },
        { data: dn },
        { data: ads },
        { data: adn },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, name, description, template, color, event_date, build_start_date, event_location, overall_status, event_type, client_name, archived_at, default_view"
          )
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("albums")
          .select("id, name, slug, position")
          .eq("project_id", projectId)
          .order("position"),
        supabase
          .from("areas")
          .select("id, name, sort_order")
          .eq("project_id", projectId)
          .is("deleted_at", null)
          .order("sort_order"),
        supabase
          .from("photos")
          .select(
            "id, project_id, album_id, area_id, storage_path, file_name, caption, captured_at, created_at, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height, assignment_source"
          )
          .eq("project_id", projectId)
          .order("captured_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("day_notes")
          .select(
            "date, notes, today_objectives, today_achievements, tomorrow_objectives, open_issues, day_status"
          )
          .eq("project_id", projectId),
        supabase
          .from("area_day_status")
          .select("area_id, date, status")
          .eq("project_id", projectId),
        supabase
          .from("area_day_notes")
          .select("area_id, date, notes")
          .eq("project_id", projectId),
      ]);
      setProject(p ?? null);
      setAlbums(a ?? []);
      setAreas((ar ?? []) as Area[]);
      setPhotos((ph ?? []) as LightboxPhoto[]);
      const map = new Map<string, string | null>();
      const fieldMap = new Map<string, DailyFields>();
      const dsMap = new Map<string, AreaStatus>();
      for (const row of (dn ?? []) as (DayNote & { day_status?: AreaStatus | null })[]) {
        map.set(row.date, row.notes ?? null);
        fieldMap.set(row.date, {
          today_objectives: row.today_objectives ?? null,
          today_achievements: row.today_achievements ?? null,
          tomorrow_objectives: row.tomorrow_objectives ?? null,
          open_issues: row.open_issues ?? null,
        });
        dsMap.set(row.date, (row.day_status ?? "no_status") as AreaStatus);
      }
      setDayNotes(map);
      setDailyFields(fieldMap);
      setDayStatus(dsMap);
      const sm = new Map<string, AreaStatus>();
      for (const row of (ads ?? []) as { area_id: string; date: string; status: AreaStatus }[]) {
        sm.set(`${row.area_id}|${row.date}`, row.status);
      }
      setAreaDayStatus(sm);
      const nm = new Map<string, string | null>();
      for (const row of (adn ?? []) as { area_id: string; date: string; notes: string | null }[]) {
        nm.set(`${row.area_id}|${row.date}`, row.notes ?? null);
      }
      setAreaDayNotes(nm);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load project data. Please refresh.");
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Listen for cross-component photo mutations (e.g. GlobalUploadModal completes)
  // so every consumer of this hook picks up new photos without a manual reload.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { projectId?: string } | undefined;
      if (!detail?.projectId || detail.projectId === projectId) refetch();
    };
    window.addEventListener("bf:photos-updated", handler as EventListener);
    return () => window.removeEventListener("bf:photos-updated", handler as EventListener);
  }, [projectId, refetch]);

  // ---- Membership / permissions ----
  useEffect(() => {
    (async () => {
      if (!user || !projectId) return;
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsOwner(data?.role === "owner");
      setCanEdit(data?.role === "owner" || data?.role === "editor");
    })();
  }, [user, projectId]);

  // ---- Per-row mutations ----
  const setDayNote = useCallback(
    async (dateKey: string, next: string | null) => {
      if (!projectId) return;
      const prev = new Map(dayNotes);
      setDayNotes((cur) => {
        const n = new Map(cur);
        n.set(dateKey, next);
        return n;
      });
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("day_notes").upsert(
        { project_id: projectId, date: dateKey, notes: next, updated_by: authUser?.id },
        { onConflict: "project_id,date" }
      );
      if (error) {
        toast.error(error.message);
        setDayNotes(prev);
      }
    },
    [projectId, dayNotes]
  );

  const setDailyField = useCallback(
    async (dateKey: string, field: DailyField, next: string | null) => {
      if (!projectId) return;
      const prev = new Map(dailyFields);
      setDailyFields((cur) => {
        const n = new Map(cur);
        const existing =
          n.get(dateKey) ?? {
            today_objectives: null,
            today_achievements: null,
            tomorrow_objectives: null,
            open_issues: null,
          };
        n.set(dateKey, { ...existing, [field]: next });
        return n;
      });
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const payload = {
        project_id: projectId,
        date: dateKey,
        [field]: next,
        updated_by: authUser?.id,
      } as never;
      const { error } = await supabase
        .from("day_notes")
        .upsert(payload, { onConflict: "project_id,date" });
      if (error) {
        toast.error(error.message);
        setDailyFields(prev);
      }
    },
    [projectId, dailyFields]
  );

  const setAreaDayNote = useCallback(
    async (areaId: string, dateKey: string, next: string | null) => {
      if (!projectId) return;
      const key = `${areaId}|${dateKey}`;
      const prev = new Map(areaDayNotes);
      setAreaDayNotes((cur) => {
        const n = new Map(cur);
        n.set(key, next);
        return n;
      });
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("area_day_notes").upsert(
        {
          project_id: projectId,
          area_id: areaId,
          date: dateKey,
          notes: next,
          updated_by: authUser?.id,
        },
        { onConflict: "project_id,area_id,date" }
      );
      if (error) {
        toast.error(error.message);
        setAreaDayNotes(prev);
      }
    },
    [projectId, areaDayNotes]
  );

  const setAreaDayStatusFn = useCallback(
    async (areaId: string, dateKey: string, next: AreaStatus) => {
      if (!projectId) return;
      const key = `${areaId}|${dateKey}`;
      const prev = new Map(areaDayStatus);
      setAreaDayStatus((cur) => {
        const n = new Map(cur);
        n.set(key, next);
        return n;
      });
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("area_day_status").upsert(
        {
          project_id: projectId,
          area_id: areaId,
          date: dateKey,
          status: next,
          updated_by: authUser?.id,
        },
        { onConflict: "project_id,area_id,date" }
      );
      if (error) {
        toast.error(error.message);
        setAreaDayStatus(prev);
      }
    },
    [projectId, areaDayStatus]
  );

  const setDayStatusFn = useCallback(
    async (dateKey: string, next: AreaStatus) => {
      if (!projectId) return;
      const prev = new Map(dayStatus);
      setDayStatus((cur) => {
        const n = new Map(cur);
        n.set(dateKey, next);
        return n;
      });
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const payload = {
        project_id: projectId,
        date: dateKey,
        day_status: next,
        updated_by: authUser?.id,
      } as never;
      const { error } = await supabase
        .from("day_notes")
        .upsert(payload, { onConflict: "project_id,date" });
      if (error) {
        toast.error(error.message);
        setDayStatus(prev);
      }
    },
    [projectId, dayStatus]
  );


  // ---- Project-level mutations ----
  const saveProjectStatus = useCallback(
    async (next: ProjectStatus) => {
      if (!projectId) return;
      const prev = project;
      setProject((cur) => (cur ? { ...cur, overall_status: next } : cur));
      const { error } = await supabase
        .from("projects")
        .update({ overall_status: next })
        .eq("id", projectId);
      if (error) {
        toast.error(error.message);
        setProject(prev);
      }
    },
    [projectId, project]
  );

  const archiveProject = useCallback(async () => {
    if (!projectId) return;
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event archived");
    refetch();
  }, [projectId, refetch]);

  const restoreProject = useCallback(async () => {
    if (!projectId) return;
    if (limits.maxProjects !== -1 && projectCount >= limits.maxProjects) {
      toast.error(
        `You've reached your ${limits.maxProjects}-project limit. Archive or delete a project before restoring this one.`
      );
      return;
    }
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: null })
      .eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project restored");
    refetchPlan?.();
    refetch();
  }, [projectId, refetch, limits.maxProjects, projectCount, refetchPlan]);

  // ---- Area mutations ----
  const addArea = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !projectId) return;
      const nextOrder = areas.length ? Math.max(...areas.map((a) => a.sort_order)) + 1 : 0;
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("areas").insert({
        project_id: projectId,
        name: trimmed,
        sort_order: nextOrder,
        created_by: authUser?.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      refetch();
    },
    [projectId, areas, refetch]
  );

  const softDeleteArea = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("areas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      refetch();
    },
    [refetch]
  );

  const restoreArea = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("areas")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      refetch();
    },
    [refetch]
  );

  // ---- Photo bulk mutations ----
  const bulkAssignArea = useCallback(
    async (photoIds: string[], areaId: string | null) => {
      if (photoIds.length === 0) return;
      const { error } = await supabase
        .from("photos")
        .update({ area_id: areaId, assignment_source: 'manual' })
        .in("id", photoIds);
      if (error) {
        toast.error(error.message);
        return;
      }
      const label =
        areaId === null ? "Unassigned" : (areas.find((a) => a.id === areaId)?.name ?? "area");
      toast.success(
        `Assigned ${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} to ${label}`
      );
      const idSet = new Set(photoIds);
      setPhotos((cur) => cur.map((p) => (idSet.has(p.id) ? { ...p, area_id: areaId, assignment_source: 'manual' } : p)));

    },
    [areas]
  );

  const bulkMoveToDay = useCallback(async (photoIds: string[], targetDayKey: string) => {
    if (photoIds.length === 0) return;
    const newCaptured = `${targetDayKey}T12:00:00.000Z`;
    const { error } = await supabase
      .from("photos")
      .update({ captured_at: newCaptured })
      .in("id", photoIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Moved ${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} to ${targetDayKey}`
    );
    const idSet = new Set(photoIds);
    setPhotos((cur) =>
      cur.map((p) => (idSet.has(p.id) ? { ...p, captured_at: newCaptured } : p))
    );
  }, []);

  const bulkDelete = useCallback(
    async (photoIds: string[]) => {
      if (photoIds.length === 0) return;
      setDeleting(true);
      const idSet = new Set(photoIds);
      const paths = photos
        .filter((p) => idSet.has(p.id))
        .map((p) => p.storage_path)
        .filter(Boolean);
      const { error: dbError } = await supabase.from("photos").delete().in("id", photoIds);
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
      setPhotos((cur) => cur.filter((p) => !idSet.has(p.id)));
      toast.success(`${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} deleted.`);
      setDeleting(false);
    },
    [photos]
  );

  const bulkDownloadZip = useCallback(
    async (photoIds: string[]) => {
      if (photoIds.length === 0 || !project) return;
      setDownloading(true);
      try {
        const idSet = new Set(photoIds);
        const selected = photos.filter((p) => idSet.has(p.id));
        const zip = new JSZip();
        const seen = new Map<string, number>();
        await Promise.all(
          selected.map(async (p) => {
            try {
              const { data, error } = await supabase.storage
                .from("photos")
                .createSignedUrl(p.storage_path, 600);
              if (error || !data?.signedUrl) return;
              const res = await fetch(data.signedUrl);
              if (!res.ok) return;
              const blob = await res.blob();
              let name = p.file_name || `${p.id}.jpg`;
              const count = seen.get(name) ?? 0;
              seen.set(name, count + 1);
              if (count > 0) {
                const dot = name.lastIndexOf(".");
                name =
                  dot > 0
                    ? `${name.slice(0, dot)}-${count}${name.slice(dot)}`
                    : `${name}-${count}`;
              }
              zip.file(name, blob);
            } catch (e) {
              console.error("Failed to add photo to zip", p.id, e);
            }
          })
        );
        const blob = await zip.generateAsync({ type: "blob" });
        const slug =
          (project.name || "project")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "project";
        const today = new Date().toISOString().slice(0, 10);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `buildfolder-${slug}-${today}.zip`;
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
    },
    [photos, project]
  );

  // ---- Local photo cache updates ----
  const applyPhotoAreaChange = useCallback((photoId: string, areaId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, area_id: areaId, assignment_source: 'manual' } : p)));

  }, []);

  const applyPhotoAlbumChange = useCallback((photoId: string, albumId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, album_id: albumId } : p)));
  }, []);

  return {
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
    dayStatus,
    setDayStatus: setDayStatusFn,
    loading,
    loadError,
    refetch,
    setDayNote,
    setDailyField,
    setAreaDayNote,
    setAreaDayStatus: setAreaDayStatusFn,
    saveProjectStatus,
    archiveProject,
    restoreProject,
    addArea,
    softDeleteArea,
    restoreArea,
    bulkAssignArea,
    bulkMoveToDay,
    bulkDelete,
    bulkDownloadZip,
    downloading,
    deleting,
    applyPhotoAreaChange,
    applyPhotoAlbumChange,
  };
}
