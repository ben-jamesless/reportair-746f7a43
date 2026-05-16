import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, X, Check, ImagePlus, Upload, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseExif, getImageDimensions, sanitizeFileName, makeReportVariant } from "@/lib/photoUtils";
import { Progress } from "@/components/ui/progress";
import { isHeicFile as isHeic, convertHeicFileToJpegFile as convertHeicToJpeg } from "@/lib/heicToJpeg";

type Area = { id: string; name: string; sort_order: number };

interface Props {
  projectId: string;
  areas: Area[];
  albumId: string | null;
  uploadAreaId: string | null;
  onAreasChanged: () => void | Promise<void>;
  onUploaded: () => void | Promise<void>;
}

const SUGGESTIONS = ["Main Stage", "Entrance", "Hospitality", "Back of House", "Car Park", "Media Zone"];



const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const MAX_SIZE_MB = 100;

export default function EventSetup({
  projectId, areas, albumId, uploadAreaId, onAreasChanged, onUploaded,
}: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [advanced, setAdvanced] = useState(false); // user clicked "Done — add photos"
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const existingNames = useMemo(
    () => new Set(areas.map((a) => a.name.toLowerCase())),
    [areas],
  );
  const showStep2 = advanced && areas.length > 0;

  const addArea = useCallback(
    async (raw: string) => {
      const n = raw.trim();
      if (!n) return;
      if (existingNames.has(n.toLowerCase())) { toast.info(`${n} already added`); return; }
      setAdding(true);
      const nextOrder = areas.length ? Math.max(...areas.map((a) => a.sort_order)) + 1 : 0;
      const { data: { user: u } } = await supabase.auth.getUser();
      const { error } = await supabase.from("areas").insert({
        project_id: projectId, name: n, sort_order: nextOrder, created_by: u?.id,
      });
      setAdding(false);
      if (error) { toast.error(error.message); return; }
      setName("");
      await onAreasChanged();
    },
    [areas, existingNames, projectId, onAreasChanged],
  );

  const removeArea = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      await onAreasChanged();
    },
    [onAreasChanged],
  );

  const onFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => {
      const type = (f.type || "").toLowerCase();
      const name = f.name.toLowerCase();
      return ALLOWED_TYPES.includes(type) || /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(name);
    });
    if (!arr.length) { toast.error("No image files selected"); return; }
    const oversized = arr.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length) toast.error(`${oversized.length} file(s) exceed the ${MAX_SIZE_MB}MB limit.`);
    const sized = arr.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    if (!sized.length) return;
    // Revoke previous previews
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPendingFiles(sized);
    setPreviews(sized.map((f) => (isHeic(f) ? "" : URL.createObjectURL(f))));
  }, [previews]);

  const clearPending = useCallback(() => {
    previews.forEach((u) => u && URL.revokeObjectURL(u));
    setPendingFiles([]);
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  }, [previews]);

  const runUpload = useCallback(async () => {
    if (!pendingFiles.length || !user) return;
    const list = pendingFiles;
    const targetArea = uploadAreaId ?? null;
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let failures = 0;
    let firstErr = "";
    for (const original of list) {
      let file = original;
      try {
        if (isHeic(file)) {
          try { file = await convertHeicToJpeg(file); }
          catch (e) { console.warn("HEIC conversion failed", e); }
        }
        const exif = await parseExif(file);
        if (!exif.width || !exif.height) {
          const dims = await getImageDimensions(file);
          if (dims) { exif.width = dims.width; exif.height = dims.height; }
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safe = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
        const key = `${projectId}/${albumId ?? "unsorted"}/${crypto.randomUUID()}-${safe}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("photos").upload(key, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        let reportKey: string | null = null;
        try {
          const variant = await makeReportVariant(file, 1600, 0.75);
          if (variant) {
            reportKey = `${projectId}/${albumId ?? "unsorted"}/report-${crypto.randomUUID()}-${safe}.jpg`;
            const { error: rErr } = await supabase.storage
              .from("photos").upload(reportKey, variant, { contentType: "image/jpeg", upsert: false });
            if (rErr) { console.warn(rErr); reportKey = null; }
          }
        } catch (e) { console.warn(e); }
        const { error: insErr } = await supabase.from("photos").insert({
          project_id: projectId, album_id: albumId, area_id: targetArea,
          storage_path: key, report_path: reportKey, file_name: file.name,
          mime_type: file.type, size_bytes: file.size, uploaded_by: user.id,
          ...exif,
        } as never);
        if (insErr) {
          await supabase.storage.from("photos").remove([key]);
          if (reportKey) await supabase.storage.from("photos").remove([reportKey]);
          throw insErr;
        }
      } catch (e: any) {
        failures++;
        if (!firstErr) firstErr = e?.message || String(e);
        console.error("Upload failed", file.name, e);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    if (failures === 0) toast.success(`Uploaded ${list.length} photo${list.length > 1 ? "s" : ""}`);
    else if (failures < list.length) toast.warning(`Uploaded ${list.length - failures} of ${list.length}`, { description: firstErr });
    else toast.error("All uploads failed", { description: firstErr });
    clearPending();
    await onUploaded();
  }, [pendingFiles, user, uploadAreaId, projectId, albumId, clearPending, onUploaded]);

  return (
    <div className="w-full max-w-3xl mx-auto py-10 px-4">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#1A6EFF]/10 flex items-center justify-center mb-5 mx-auto">
          <ImagePlus className="w-6 h-6 text-[#1A6EFF]" />
        </div>
        <h3 className="text-base font-semibold text-[#0F1724] mb-1">Set up your event</h3>
        <p className="text-sm text-[#7A7974]">Two quick steps to get organised before uploading.</p>
      </div>

      {/* Step 1: Areas */}
      <section
        className={cn(
          "rounded-xl border bg-white p-5 mb-4 transition-colors",
          showStep2 ? "border-[#1A6EFF]/30 bg-[#1A6EFF]/5" : "border-[#D4D1CA]",
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
              areas.length > 0 ? "border-[#1A6EFF] bg-[#1A6EFF]" : "border-[#D4D1CA]",
            )}
          >
            {areas.length > 0 && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F1724]">
              {areas.length > 0
                ? `${areas.length} area${areas.length > 1 ? "s" : ""} added`
                : "Add your event areas"}
            </p>
            <p className="text-xs text-[#7A7974]">Photos will be organised by area.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Stage"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(name); } }}
            className="flex-1 h-11 px-3 rounded-lg border border-[#D4D1CA] bg-white text-sm text-[#0F1724] placeholder:text-[#7A7974] focus:outline-none focus:ring-2 focus:ring-[#1A6EFF]/40 focus:border-[#1A6EFF]"
          />
          <button
            type="button"
            onClick={() => addArea(name)}
            disabled={adding || !name.trim()}
            className="h-11 px-5 rounded-lg bg-[#1A6EFF] text-white text-sm font-medium hover:bg-[#1A6EFF]/90 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </button>
        </div>

        {areas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {areas.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-[#1A6EFF] text-white text-xs font-medium"
              >
                {a.name}
                <button
                  type="button"
                  onClick={() => removeArea(a.id)}
                  className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs text-[#7A7974] mb-2">Common suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => !existingNames.has(s.toLowerCase())).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addArea(s)}
                disabled={adding}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[#D4D1CA] bg-white text-xs font-medium text-[#0F1724] hover:border-[#1A6EFF] hover:text-[#1A6EFF] transition-colors"
              >
                <Plus className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>

        {areas.length > 0 && !showStep2 && (
          <div className="flex justify-end mt-5">
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#1A6EFF] text-white text-sm font-medium hover:bg-[#1A6EFF]/90 transition-colors"
            >
              Done — add photos
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* Step 2: Upload */}
      <section
        className={cn(
          "rounded-xl border bg-white p-5 transition-opacity",
          showStep2 ? "opacity-100" : "opacity-50",
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 rounded-full border-2 border-[#D4D1CA] flex items-center justify-center shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F1724]">Upload your first photos</p>
            <p className="text-xs text-[#7A7974]">Photos are grouped by date automatically.</p>
          </div>
        </div>

        {showStep2 && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFiles(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors px-6 py-12",
                dragOver
                  ? "border-solid border-[#1A6EFF] bg-[#EBF2FF]"
                  : "border-[#D4D1CA] bg-[#EDF1F7] hover:border-[#1A6EFF]/50",
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
                <Upload className="w-5 h-5 text-[#1A6EFF]" />
              </div>
              <p className="text-sm font-medium text-[#0F1724]">
                Drag photos here, or click to browse
              </p>
              <p className="text-xs text-[#7A7974] mt-1">JPG, PNG, HEIC up to 100MB each</p>
            </div>

            {pendingFiles.length > 0 && (
              <div className="mt-5">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                  {pendingFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-[#EDF1F7] border border-[#D4D1CA]">
                      {previews[i] ? (
                        <img src={previews[i]} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-[#7A7974] px-1 text-center">
                          {f.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearPending}
                    disabled={busy}
                    className="h-10 px-4 rounded-lg border border-[#D4D1CA] text-sm font-medium text-[#0F1724] hover:bg-[#FBFBF9] transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={runUpload}
                    disabled={busy}
                    className="h-10 px-5 rounded-lg bg-[#1A6EFF] text-white text-sm font-medium hover:bg-[#1A6EFF]/90 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {busy
                      ? `Uploading ${progress.done}/${progress.total}`
                      : `Upload ${pendingFiles.length} photo${pendingFiles.length > 1 ? "s" : ""}`}
                  </button>
                </div>
                {busy && progress.total > 0 && (
                  <div className="mt-3"><Progress value={(progress.done / progress.total) * 100} /></div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
