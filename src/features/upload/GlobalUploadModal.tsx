import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  ImageIcon,
  MapPin,
  AlertTriangle,
  Loader2,
  X,
  MoveRight,
  Check,
  CalendarClock,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  parseExif,
  getImageDimensions,
  sanitizeFileName,
  makeReportVariant,
  isExifStrippedIosUpload,
  type ExifData,
} from "@/lib/photoUtils";
import { isHeicFile, convertHeicFileToJpegFile } from "@/lib/heicToJpeg";
import { fetchPrimaryZones, assignZoneForPoint, type PrimaryZone } from "@/lib/zoneAssign";
import { event as gaEvent } from "@/lib/analytics";
import { useNavigate } from "react-router-dom";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const MAX_SIZE_MB = 100;

const UNASSIGNED_ID = "__unassigned__";

type Phase = "sort" | "uploading" | "done";
type ItemStatus = "queued" | "analyzing" | "ready" | "uploading" | "done" | "error";

type Item = {
  id: string;
  file: File;
  /** Pre-converted JPEG for HEIC uploads, so we don't re-convert at upload time. */
  convertedFile: File | null;
  /** Object URL for the thumbnail. Null while a HEIC preview is still decoding. */
  previewUrl: string | null;
  /** True for HEIC/HEIF originals — used to show a placeholder tile while decoding. */
  isHeic: boolean;
  status: ItemStatus;
  exif: ExifData | null;
  /** GPS auto-detected area (before user override) */
  gpsMatchAreaId: string | null;
  gpsMatchAreaName: string | null;
  /** Effective assignment shown in the UI. */
  assignedAreaId: string | null;
  source: "gps" | "manual" | "none";
  /** True when EXIF captured_at was missing → falls back to today (or user date). */
  noCaptureDate: boolean;
  error?: string;
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDayLabel(iso: string | null): string {
  if (!iso) return "Today";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function filterAcceptedFiles(files: File[]): File[] {
  return files.filter((f) => {
    const type = (f.type || "").toLowerCase();
    const name = f.name.toLowerCase();
    return (
      (ALLOWED_TYPES.includes(type) || /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(name)) &&
      f.size <= MAX_SIZE_MB * 1024 * 1024
    );
  });
}

interface Props {
  projectId: string;
  areas: { id: string; name: string }[];
  albumId: string | null;
  initialAreaId: string | null;
  initialFiles: File[] | null;
  onClose: () => void;
  onUploaded?: () => void;
}

/**
 * GlobalUploadModal — Phase 3 hero moment.
 *
 * Users drop or pick photos and watch them stream into area groups as EXIF
 * parses and GPS resolves against project zones. Any grouping decision can
 * be overridden pre-upload; assignment_source is recorded ('gps' | 'manual').
 * The classic PhotoUploader stays mounted for classic view; this modal is the
 * v2 shell's single upload surface.
 */
export function GlobalUploadModal({
  projectId,
  areas,
  albumId,
  initialAreaId,
  initialFiles,
  onClose,
  onUploaded,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const zonesRef = useRef<PrimaryZone[] | null>(null);
  const zonesPromiseRef = useRef<Promise<PrimaryZone[]> | null>(null);

  const [phase, setPhase] = useState<Phase>("sort");
  const [items, setItems] = useState<Item[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fallbackDate, setFallbackDate] = useState<string>(todayYmd());
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    total: number;
    autoSorted: number;
    unassigned: number;
    failed: number;
    dayLabel: string;
  } | null>(null);

  // Kick zone fetch once on mount (before user drops files).
  useEffect(() => {
    zonesPromiseRef.current = fetchPrimaryZones(projectId).then((z) => {
      zonesRef.current = z;
      return z;
    });
  }, [projectId]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      for (const it of items) URL.revokeObjectURL(it.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  /** Groups: one per area with items, plus Unassigned. Only shows groups that have items. */
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const key = it.assignedAreaId ?? UNASSIGNED_ID;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    // Order: areas as given, then Unassigned last.
    const ordered: { id: string; name: string; items: Item[]; isUnassigned: boolean }[] = [];
    for (const a of areas) {
      const arr = map.get(a.id);
      if (arr && arr.length) ordered.push({ id: a.id, name: a.name, items: arr, isUnassigned: false });
    }
    const un = map.get(UNASSIGNED_ID);
    if (un && un.length) ordered.push({ id: UNASSIGNED_ID, name: "Unassigned", items: un, isUnassigned: true });
    return ordered;
  }, [items, areas]);

  const unassignedCount = items.filter((it) => it.assignedAreaId == null).length;
  const readyCount = items.filter((it) => it.status === "ready").length;
  const analyzingCount = items.filter((it) => it.status === "analyzing" || it.status === "queued").length;
  const noDateCount = items.filter((it) => it.noCaptureDate).length;

  /** Analyze a batch of freshly-added files, streaming updates as each resolves. */
  const analyzeFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const newItems: Item[] = files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: "queued" as ItemStatus,
        exif: null,
        gpsMatchAreaId: null,
        gpsMatchAreaName: null,
        assignedAreaId: initialAreaId, // if launched from within an area, default there
        source: initialAreaId ? "manual" : "none",
        noCaptureDate: false,
      }));
      setItems((cur) => [...cur, ...newItems]);

      const zones = zonesRef.current ?? (await (zonesPromiseRef.current ?? fetchPrimaryZones(projectId)));

      // Sequential analysis keeps the streaming visible and avoids EXIF-lib CPU spikes.
      for (const it of newItems) {
        setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, status: "analyzing" } : c)));
        try {
          const exif = await parseExif(it.file);
          let gpsAreaId: string | null = null;
          let gpsAreaName: string | null = null;
          // GPS auto-sort only when the user did NOT preselect an area.
          if (initialAreaId == null && exif.gps_lat != null && exif.gps_lng != null && zones.length) {
            const match = assignZoneForPoint(exif.gps_lat, exif.gps_lng, zones);
            if (match) {
              gpsAreaId = match.area_id;
              gpsAreaName = match.area_name;
            }
          }
          const noCaptureDate = !exif.captured_at;
          setItems((cur) =>
            cur.map((c) => {
              if (c.id !== it.id) return c;
              const assigned = initialAreaId ?? gpsAreaId ?? null;
              const source: Item["source"] = initialAreaId
                ? "manual"
                : gpsAreaId
                ? "gps"
                : "none";
              return {
                ...c,
                status: "ready",
                exif,
                gpsMatchAreaId: gpsAreaId,
                gpsMatchAreaName: gpsAreaName,
                assignedAreaId: assigned,
                source,
                noCaptureDate,
              };
            })
          );
        } catch (e: any) {
          setItems((cur) =>
            cur.map((c) =>
              c.id === it.id ? { ...c, status: "error", error: e?.message ?? "Analyze failed" } : c
            )
          );
        }
      }
    },
    [projectId, initialAreaId]
  );

  // If launched with initial files (e.g. drag-drop onto shell), start analyzing immediately.
  useEffect(() => {
    if (initialFiles && initialFiles.length) {
      const accepted = filterAcceptedFiles(initialFiles);
      if (accepted.length) analyzeFiles(accepted);
      const rejected = initialFiles.length - accepted.length;
      if (rejected > 0) toast.warning(`${rejected} file${rejected > 1 ? "s" : ""} skipped (unsupported or too large)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return;
      const files = Array.from(fileList as ArrayLike<File>);
      const accepted = filterAcceptedFiles(files);
      const rejected = files.length - accepted.length;
      if (rejected > 0) toast.warning(`${rejected} file${rejected > 1 ? "s" : ""} skipped (unsupported or too large)`);
      if (accepted.length) analyzeFiles(accepted);
    },
    [analyzeFiles]
  );

  const moveItem = useCallback((itemId: string, areaId: string | null) => {
    setItems((cur) =>
      cur.map((c) => (c.id === itemId ? { ...c, assignedAreaId: areaId, source: "manual" } : c))
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((cur) => {
      const it = cur.find((c) => c.id === itemId);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return cur.filter((c) => c.id !== itemId);
    });
  }, []);

  const bulkAssignUnassigned = useCallback((areaId: string) => {
    setItems((cur) =>
      cur.map((c) => (c.assignedAreaId == null ? { ...c, assignedAreaId: areaId, source: "manual" } : c))
    );
  }, []);

  const canUpload = phase === "sort" && items.length > 0 && analyzingCount === 0 && !!user;

  /** Actual upload — sequential, matches PhotoUploader semantics. */
  const runUpload = useCallback(async () => {
    if (!user || !items.length) return;
    setPhase("uploading");
    setUploadProgress({ done: 0, total: items.length });

    const fallbackIso = noDateCount > 0 ? new Date(`${fallbackDate}T12:00:00`).toISOString() : null;

    let failures = 0;
    let autoSortedCount = 0;
    let unassignedCountFinal = 0;
    let gpsDetected = 0;
    const insertedIds: string[] = [];
    // For the day label in the summary, use the median captured_at across successes,
    // falling back to today.
    let latestCaptured: string | null = null;

    for (const it of items) {
      setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, status: "uploading" } : c)));
      let file = it.file;
      try {
        if (isHeicFile(file)) {
          try {
            file = await convertHeicFileToJpegFile(file);
          } catch (convErr) {
            console.warn("HEIC conversion failed, uploading original", file.name, convErr);
          }
        }

        const exif = { ...(it.exif ?? {}) } as ExifData;
        if (!exif.captured_at && fallbackIso) exif.captured_at = fallbackIso;
        if (!exif.width || !exif.height) {
          const dims = await getImageDimensions(file);
          if (dims) {
            exif.width = dims.width;
            exif.height = dims.height;
          }
        }
        if (exif.gps_lat != null && exif.gps_lng != null) gpsDetected++;
        if (exif.captured_at) latestCaptured = exif.captured_at;

        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safe = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
        const key = `${projectId}/${albumId ?? "unsorted"}/${crypto.randomUUID()}-${safe}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(key, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        let reportKey: string | null = null;
        try {
          const variant = await makeReportVariant(file, 1600, 0.75);
          if (variant) {
            reportKey = `${projectId}/${albumId ?? "unsorted"}/report-${crypto.randomUUID()}-${safe}.jpg`;
            const { error: rErr } = await supabase.storage
              .from("photos")
              .upload(reportKey, variant, { contentType: "image/jpeg", upsert: false });
            if (rErr) {
              console.warn("Report variant upload failed", rErr);
              reportKey = null;
            }
          }
        } catch (e) {
          console.warn("Report variant failed", e);
        }

        const assignedAreaId = it.assignedAreaId;
        const assignmentSource = assignedAreaId ? (it.source === "gps" ? "gps_auto" : "manual") : null;

        const { data: inserted, error: insErr } = await supabase
          .from("photos")
          .insert({
            project_id: projectId,
            album_id: albumId,
            area_id: assignedAreaId,
            assignment_source: assignmentSource,
            storage_path: key,
            report_path: reportKey,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: user.id,
            ...exif,
          } as never)
          .select("id")
          .single();

        if (insErr) {
          await supabase.storage.from("photos").remove([key]);
          if (reportKey) await supabase.storage.from("photos").remove([reportKey]);
          throw insErr;
        }
        if (inserted?.id) insertedIds.push(inserted.id);
        if (assignedAreaId) {
          if (it.source === "gps") autoSortedCount++;
        } else {
          unassignedCountFinal++;
        }
        setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, status: "done" } : c)));
      } catch (e: any) {
        failures++;
        setItems((cur) =>
          cur.map((c) => (c.id === it.id ? { ...c, status: "error", error: e?.message ?? "Upload failed" } : c))
        );
        console.error("Upload failed for", file.name, e);
      } finally {
        setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    // Server-side EXIF re-parse for anything inserted (recovers dates the browser missed).
    for (const id of insertedIds) {
      supabase.functions.invoke("photo-exif-extract", { body: { photo_id: id } }).catch((err) =>
        console.warn("photo-exif-extract failed", id, err)
      );
    }

    const total = items.length;
    if (insertedIds.length > 0) {
      gaEvent("upload_photos", {
        count: insertedIds.length,
        has_gps: gpsDetected > 0,
        unassigned_count: unassignedCountFinal,
        auto_sorted_count: autoSortedCount,
      });
    }

    const dayLabel = fmtDayLabel(latestCaptured ?? new Date().toISOString());

    setSummary({
      total: insertedIds.length,
      autoSorted: autoSortedCount,
      unassigned: unassignedCountFinal,
      failed: failures,
      dayLabel,
    });
    setPhase("done");
    onUploaded?.();
    window.dispatchEvent(new CustomEvent("bf:photos-updated", { detail: { projectId } }));

    if (failures === 0) {
      toast.success(`${insertedIds.length} photo${insertedIds.length === 1 ? "" : "s"} added to ${dayLabel}`);
    } else if (insertedIds.length > 0) {
      toast.warning(`Uploaded ${insertedIds.length} of ${total} (${failures} failed)`);
    } else {
      toast.error("All uploads failed");
    }
  }, [user, items, fallbackDate, noDateCount, projectId, albumId, onUploaded]);

  const handleClose = useCallback(() => {
    if (phase === "uploading") return; // block close mid-upload
    for (const it of items) URL.revokeObjectURL(it.previewUrl);
    onClose();
  }, [phase, items, onClose]);

  const openUnassignedTray = useCallback(() => {
    for (const it of items) URL.revokeObjectURL(it.previewUrl);
    onClose();
    navigate(`/projects/${projectId}?tab=library&filter=unassigned`);
  }, [items, onClose, navigate, projectId]);

  // Drop handlers on the dialog surface
  const onDragOver = (e: React.DragEvent) => {
    if (phase !== "sort") return;
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    if (phase !== "sort") return;
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className="max-w-3xl gap-0 p-0"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <DialogHeader className="border-b px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload photos
          </DialogTitle>
          <DialogDescription>
            {phase === "sort" && (items.length === 0
              ? "Drop photos here or pick files. We'll sort them into areas by GPS as they load."
              : `${items.length} photo${items.length === 1 ? "" : "s"} · sorting by GPS as they load. Move any photo before uploading.`)}
            {phase === "uploading" && `Uploading ${uploadProgress.done} of ${uploadProgress.total}…`}
            {phase === "done" && summary && `Done — ${summary.total} photo${summary.total === 1 ? "" : "s"} added.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          {/* Empty state / picker */}
          {phase === "sort" && items.length === 0 && (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
            >
              <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Drop photos here</p>
              <p className="mt-1 text-xs text-muted-foreground">or</p>
              <Button className="mt-3" variant="secondary" onClick={() => inputRef.current?.click()}>
                Choose files
              </Button>
              <p className="mt-3 max-w-md text-xs text-muted-foreground">
                Photos with GPS are auto-sorted into areas. Others land in Unassigned so you can bulk-assign in one tap.
              </p>
            </div>
          )}

          {/* Groups */}
          {phase !== "sort" || items.length > 0 ? (
            <div className="space-y-5">
              {analyzingCount > 0 && phase === "sort" && (
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing {analyzingCount} more photo{analyzingCount === 1 ? "" : "s"}…
                </div>
              )}

              {/* Unassigned prompt */}
              {phase === "sort" && unassignedCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  <span className="flex-1 text-amber-900 dark:text-amber-100">
                    {unassignedCount} photo{unassignedCount === 1 ? "" : "s"} have no location — assign an area
                  </span>
                  {areas.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          Assign all to…
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Bulk-assign unassigned</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {areas.map((a) => (
                          <DropdownMenuItem key={a.id} onSelect={() => bulkAssignUnassigned(a.id)}>
                            {a.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

              {/* No-date prompt */}
              {phase === "sort" && noDateCount > 0 && (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Capture date missing on {noDateCount} photo{noDateCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                        Choose the day these photos were taken.
                      </p>
                      <div className="mt-2">
                        <Label htmlFor="upload-fallback-date" className="text-xs">Photo date</Label>
                        <Input
                          id="upload-fallback-date"
                          type="date"
                          value={fallbackDate}
                          max={todayYmd()}
                          onChange={(e) => setFallbackDate(e.target.value)}
                          className="mt-1 max-w-[200px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {groups.map((g) => (
                <section key={g.id} className="rounded-lg border">
                  <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    <h3 className="text-sm font-semibold">
                      {g.name}{" "}
                      <span className="font-normal text-muted-foreground">({g.items.length})</span>
                    </h3>
                    {!g.isUnassigned && g.items.some((it) => it.source === "gps") && (
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        auto-sorted by GPS
                      </Badge>
                    )}
                    {g.isUnassigned && (
                      <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                        <CircleHelp className="h-3 w-3" />
                        needs area
                      </Badge>
                    )}
                  </header>
                  <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-6">
                    {g.items.map((it) => (
                      <ItemCard
                        key={it.id}
                        item={it}
                        areas={areas}
                        canEdit={phase === "sort"}
                        onMove={(areaId) => moveItem(it.id, areaId)}
                        onRemove={() => removeItem(it.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {phase === "uploading" && uploadProgress.total > 0 && (
                <div className="sticky bottom-0 -mx-6 border-t bg-background px-6 py-3">
                  <Progress value={(uploadProgress.done / uploadProgress.total) * 100} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Uploading {uploadProgress.done} of {uploadProgress.total}
                  </p>
                </div>
              )}

              {phase === "done" && summary && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {summary.total} photo{summary.total === 1 ? "" : "s"} added to {summary.dayLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {summary.autoSorted} auto-sorted{summary.unassigned > 0 ? `, ${summary.unassigned} need an area` : ""}
                        {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t bg-background px-6 py-3">
          {phase === "sort" && (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              />
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              {items.length > 0 && (
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  Add more
                </Button>
              )}
              <Button
                onClick={runUpload}
                disabled={!canUpload}
              >
                <Upload className="mr-2 h-4 w-4" />
                {readyCount === items.length
                  ? `Upload ${items.length} photo${items.length === 1 ? "" : "s"}`
                  : `Upload (${readyCount}/${items.length} ready)`}
              </Button>
            </>
          )}
          {phase === "uploading" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </Button>
          )}
          {phase === "done" && summary && (
            <>
              {summary.unassigned > 0 ? (
                <Button variant="outline" onClick={openUnassignedTray}>
                  Open Unassigned tray
                </Button>
              ) : null}
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemCard({
  item,
  areas,
  canEdit,
  onMove,
  onRemove,
}: {
  item: Item;
  areas: { id: string; name: string }[];
  canEdit: boolean;
  onMove: (areaId: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
      <img
        src={item.previewUrl}
        alt={item.file.name}
        className={cn(
          "h-full w-full object-cover transition-opacity",
          item.status === "uploading" && "opacity-60",
          item.status === "error" && "opacity-40"
        )}
      />
      {(item.status === "analyzing" || item.status === "queued") && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
      {item.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
      {item.status === "done" && (
        <div className="absolute right-1 top-1 rounded-full bg-emerald-500/90 p-0.5 text-white">
          <Check className="h-3 w-3" />
        </div>
      )}
      {item.status === "error" && (
        <div className="absolute inset-x-0 bottom-0 bg-red-600/90 px-1 py-0.5 text-[10px] text-white">
          Failed
        </div>
      )}
      {item.source === "gps" && item.status === "ready" && (
        <Badge variant="secondary" className="absolute left-1 top-1 h-5 gap-0.5 px-1 text-[10px]">
          <MapPin className="h-2.5 w-2.5" />
          GPS
        </Badge>
      )}
      {canEdit && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="pointer-events-auto h-6 gap-1 px-1.5 text-[10px]">
                <MoveRight className="h-3 w-3" />
                Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Move to area</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onMove(null)}>Unassigned</DropdownMenuItem>
              {areas.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => onMove(a.id)}>
                  {a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto h-6 w-6"
            onClick={onRemove}
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
