import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, ImageIcon, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { parseExif, getImageDimensions, sanitizeFileName, makeReportVariant, isExifStrippedIosUpload } from "@/lib/photoUtils";
import { isHeicFile as isHeic, convertHeicFileToJpegFile as convertHeicToJpeg } from "@/lib/heicToJpeg";
import { usePlan } from "@/hooks/usePlan";
import { useProjectUpdateDays } from "@/hooks/useProjectUpdateDays";
import { FreePlanUploadGate } from "@/components/FreePlanUploadGate";
import { event as gaEvent } from "@/lib/analytics";
import { fetchPrimaryZones, assignZoneForPoint } from "@/lib/zoneAssign";

type AreaOption = { id: string; name: string };

interface Props {
  projectId: string;
  albumId: string | null;
  areaId?: string | null;
  areas?: AreaOption[];
  onUploaded?: () => void;
  trigger?: React.ReactNode;
  /** Optional share token for the "View your live report" link in the Free-plan gate. */
  shareToken?: string | null;
}

const NO_AREA = "__no_area__";

const todayYmd = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const PhotoUploader = ({ projectId, albumId, areaId = null, areas = [], onUploaded, trigger, shareToken = null }: Props) => {
  const { user } = useAuth();
  const { limits } = usePlan();
  const { dayCount, loading: daysLoading } = useProjectUpdateDays(
    limits.maxUpdateDays !== -1 ? projectId : null
  );
  const isUpdateDayLimitReached =
    limits.maxUpdateDays !== -1 && !daysLoading && dayCount >= limits.maxUpdateDays;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>(areaId ?? NO_AREA);
  const [fallbackDate, setFallbackDate] = useState<string>(todayYmd());

  // Any file whose name matches the iOS share-sheet temp pattern. EXIF is
  // almost certainly gone, so we'll need a user-chosen date as a fallback.
  const iosStrippedCount = (pendingFiles ?? []).filter(isExifStrippedIosUpload).length;
  const needsFallbackDate = iosStrippedCount > 0;

  // Keep dropdown synced if context area changes between opens
  useEffect(() => { setSelectedArea(areaId ?? NO_AREA); }, [areaId]);

  const onFilesPicked = (files: FileList | null) => {
    if (!files || !files.length) return;
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
    const list = Array.from(files).filter((f) => {
      const type = (f.type || "").toLowerCase();
      const name = f.name.toLowerCase();
      return ALLOWED_TYPES.includes(type) || /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(name);
    });
    if (!list.length) { toast.error("No image files selected"); return; }
    const MAX_SIZE_MB = 100;
    const oversized = list.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} file(s) exceed the ${MAX_SIZE_MB}MB limit and were removed.`);
    }
    const sizedList = list.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    if (!sizedList.length) return;
    setPendingFiles(sizedList);
    setSelectedArea(areaId ?? NO_AREA);
    setFallbackDate(todayYmd());
  };

  const runUpload = async () => {
    if (!pendingFiles || !user) return;
    const list = pendingFiles;
    const targetArea = selectedArea === NO_AREA ? null : selectedArea;
    // Fallback captured_at for iOS-stripped files. Use noon local time to
    // avoid timezone slip pushing the day backwards.
    const fallbackIso = needsFallbackDate
      ? new Date(`${fallbackDate}T12:00:00`).toISOString()
      : null;
    setPendingFiles(null);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let failures = 0;
    let gpsDetectedCount = 0;
    let autoAssignedCount = 0;
    const autoAssignedNames = new Set<string>();
    const errors: string[] = [];
    const insertedIds: string[] = [];

    // Fetch primary zones once per batch. Only used when the user leaves the
    // batch as "Unassigned" — an explicit area choice always wins.
    const primaryZones = targetArea == null ? await fetchPrimaryZones(projectId) : [];

    for (const original of list) {
      let file = original;
      try {
        if (isHeic(file)) {
          try {
            file = await convertHeicToJpeg(file);
          } catch (convErr) {
            console.warn("HEIC conversion failed, uploading original", file.name, convErr);
          }
        }

        const exif = await parseExif(file);
        // For iOS-stripped batches, if we have no real captured_at, use the
        // user-supplied date so photos don't all land on "today".
        if (!exif.captured_at && fallbackIso && isExifStrippedIosUpload(file)) {
          exif.captured_at = fallbackIso;
        }
        if (!exif.width || !exif.height) {
          const dims = await getImageDimensions(file);
          if (dims) { exif.width = dims.width; exif.height = dims.height; }
        }

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
            if (rErr) { console.warn("Report variant upload failed", rErr); reportKey = null; }
          }
        } catch (e) { console.warn("Report variant failed", e); }

        // Silent EXIF-based zone assignment: only when the user picked
        // "Unassigned", the photo has GPS, and exactly one primary zone matches.
        let assignedAreaId: string | null = targetArea;
        let assignedZoneName: string | null = null;
        if (
          assignedAreaId == null &&
          exif.gps_lat != null &&
          exif.gps_lng != null &&
          primaryZones.length > 0
        ) {
          const match = assignZoneForPoint(exif.gps_lat, exif.gps_lng, primaryZones);
          if (match) {
            assignedAreaId = match.area_id;
            assignedZoneName = match.area_name;
          }
        }

        const { data: inserted, error: insErr } = await supabase.from("photos").insert({
          project_id: projectId,
          album_id: albumId,
          area_id: assignedAreaId,
          storage_path: key,
          report_path: reportKey,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: user.id,
          ...exif,
        } as never).select("id").single();
        if (insErr) {
          await supabase.storage.from("photos").remove([key]);
          if (reportKey) await supabase.storage.from("photos").remove([reportKey]);
          throw insErr;
        }
        if (inserted?.id) insertedIds.push(inserted.id);
        if (exif.gps_lat != null && exif.gps_lng != null) gpsDetectedCount++;
        if (assignedZoneName && targetArea == null) {
          autoAssignedCount++;
          autoAssignedNames.add(assignedZoneName);
        }
      } catch (e: any) {
        failures++;
        const msg = e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
        errors.push(`${file.name}: ${msg}`);
        console.error("Upload failed for", file.name, e);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    // Fire-and-forget: server-side EXIF re-parse for every inserted photo.
    // This is the automatic "back-up, back-up" date detection — runs even
    // when the browser parser misses something, and silently no-ops when
    // there's truly nothing to recover (e.g. iOS-stripped uploads).
    for (const id of insertedIds) {
      supabase.functions.invoke("photo-exif-extract", { body: { photo_id: id } })
        .catch((err) => console.warn("photo-exif-extract failed", id, err));
    }

    setBusy(false);
    setProgress({ done: 0, total: 0 });
    const firstErr = errors[0];
    if (failures === 0) toast.success(`Uploaded ${list.length} photo${list.length > 1 ? "s" : ""}`);
    else if (failures < list.length) toast.warning(`Uploaded ${list.length - failures} of ${list.length} (${failures} failed)`, { description: firstErr });
    else toast.error("All uploads failed", { description: firstErr ?? "Check console for details", duration: 10000 });
    const successful = insertedIds.length;
    if (successful > 0) {
      const zoneName = targetArea
        ? areas.find((a) => a.id === targetArea)?.name ?? null
        : null;
      gaEvent("upload_photos", {
        count: successful,
        zone: zoneName,
        has_gps: gpsDetectedCount > 0,
        unassigned_count: targetArea == null ? successful : 0,
      });
    }
    onUploaded?.();
    if (inputRef.current) inputRef.current.value = "";
  };

  if (isUpdateDayLimitReached) {
    return <FreePlanUploadGate projectId={projectId} shareToken={shareToken} />;
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => onFilesPicked(e.target.files)}
      />
      {trigger ? (
        <span onClick={() => !busy && inputRef.current?.click()} style={{ display: "contents" }}>
          {trigger}
        </span>
      ) : (
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy ? `Uploading ${progress.done}/${progress.total}` : "Upload photos"}
        </Button>
      )}
      {busy && progress.total > 0 && (
        <div className="mt-3 w-full max-w-sm">
          <Progress value={(progress.done / progress.total) * 100} />
        </div>
      )}

      <Dialog
        open={!!pendingFiles}
        onOpenChange={(open) => { if (!open) { setPendingFiles(null); if (inputRef.current) inputRef.current.value = ""; } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {pendingFiles?.length ?? 0} photo{(pendingFiles?.length ?? 0) === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Confirm where these photos belong. The capture day comes from each photo's EXIF data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {pendingFiles?.length} file{(pendingFiles?.length ?? 0) === 1 ? "" : "s"} selected
            </div>

            <div>
              <Label htmlFor="upload-area">Add to area</Label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger id="upload-area" className="mt-1">
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AREA}>Unassigned</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Applies to all {pendingFiles?.length ?? 0} photo{(pendingFiles?.length ?? 0) === 1 ? "" : "s"} in this batch.
              </p>
            </div>

            {needsFallbackDate && (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Capture date missing on {iosStrippedCount} photo{iosStrippedCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
                      Your phone removed the original date from these photos before upload. Choose the day they were taken.
                    </p>
                    <div className="mt-2">
                      <Label htmlFor="upload-fallback-date" className="text-xs">Photo date</Label>
                      <Input
                        id="upload-fallback-date"
                        type="date"
                        value={fallbackDate}
                        max={todayYmd()}
                        onChange={(e) => setFallbackDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingFiles(null); if (inputRef.current) inputRef.current.value = ""; }}>Cancel</Button>
            <Button onClick={runUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
