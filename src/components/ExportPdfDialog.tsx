import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FileDown, Loader2, Upload, AlertTriangle, Download, X, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

const PHOTO_CAP = 300;

type ExportRow = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  output_path: string | null;
  error_message: string | null;
  photo_count: number | null;
};

type Sections = {
  cover: boolean; grid: boolean; captions: boolean; exif: boolean; notes: boolean; activity: boolean;
};

const DEFAULT_SECTIONS: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false };

export type AvailableDay = { key: string; label: string; date: Date; photoCount: number };

type Props = {
  projectId: string;
  /** Single-day photo count (used when mode=single & dayKey set) or fallback total. */
  photoCount: number;
  /** When set, scope export to this single day (YYYY-M-D, matches edge function dayKey) and label. */
  dayKey?: string | null;
  dayLabel?: string | null;
  /** All days that have photos in the project, used by date-range mode. */
  availableDays?: AvailableDay[];
  /** Lock the mode toggle to "single" (used from the per-day icon). */
  lockMode?: "single" | null;
  /** Render a custom trigger instead of the default "Export PDF" button. */
  trigger?: React.ReactNode;
  /** Controlled open (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type Mode = "single" | "range";

export const ExportPdfDialog = ({
  projectId,
  photoCount,
  dayKey = null,
  dayLabel = null,
  availableDays = [],
  lockMode = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { if (onOpenChange) onOpenChange(v); else setInternalOpen(v); };
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [accent, setAccent] = useState("#01696F");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentExport, setCurrentExport] = useState<ExportRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Mode state. Default to "single" if dayKey provided or lockMode=single, else "range" only when there are multiple days available.
  const initialMode: Mode = lockMode === "single" || dayKey ? "single" : "single";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null); // YYYY-MM-DD key
  const [rangeTo, setRangeTo] = useState<string | null>(null);

  // Sorted ascending for picker convenience
  const daysAsc = useMemo(
    () => [...availableDays].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [availableDays],
  );
  const dayKeySet = useMemo(() => new Set(daysAsc.map((d) => d.key)), [daysAsc]);
  const photoCountByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of daysAsc) m.set(d.key, d.photoCount);
    return m;
  }, [daysAsc]);

  // Reset session state whenever the dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentExport(null);
      setSubmitting(false);
    } else {
      // Re-derive defaults each time the dialog opens
      setMode(lockMode === "single" || dayKey ? "single" : "single");
      if (daysAsc.length > 0) {
        setRangeFrom(daysAsc[0].key);
        setRangeTo(daysAsc[daysAsc.length - 1].key);
      } else {
        setRangeFrom(null);
        setRangeTo(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Poll the active export until it resolves
  useEffect(() => {
    if (!open || !currentExport) return;
    if (currentExport.status === "ready" || currentExport.status === "failed") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("project_exports")
        .select("id,status,output_path,error_message,photo_count")
        .eq("id", currentExport.id).maybeSingle();
      if (data) setCurrentExport(data as ExportRow);
    }, 3000);
    return () => clearInterval(t);
  }, [open, currentExport]);

  const handleLogoSelect = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setLogoFile(file);
    const path = `${projectId}/logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("export-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setLogoFile(null); return; }
    setLogoPath(path);
  };

  // Compute photos covered + cap for current selection
  const { effectivePhotoCount, rangeDays } = useMemo(() => {
    if (mode === "range" && rangeFrom && rangeTo) {
      const lo = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const hi = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      const inRange = daysAsc.filter((d) => d.key >= lo && d.key <= hi);
      const total = inRange.reduce((sum, d) => sum + d.photoCount, 0);
      return { effectivePhotoCount: total, rangeDays: inRange };
    }
    return { effectivePhotoCount: photoCount, rangeDays: [] as AvailableDay[] };
  }, [mode, rangeFrom, rangeTo, daysAsc, photoCount]);

  const overCap = effectivePhotoCount > PHOTO_CAP;

  const startExport = async () => {
    if (overCap) { toast.error(`Photo cap exceeded (${PHOTO_CAP}). Split per album first.`); return; }
    if (mode === "range" && (!rangeFrom || !rangeTo)) {
      toast.error("Pick a from and to date");
      return;
    }
    setSubmitting(true);
    setCurrentExport(null);
    const { data: auth } = await supabase.auth.getUser();

    const lo = mode === "range" && rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeFrom : rangeTo) : null;
    const hi = mode === "range" && rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeTo : rangeFrom) : null;

    const options: Record<string, unknown> = { sections };
    if (mode === "single") {
      options.day_key = dayKey ?? null;
      options.day_label = dayLabel ?? null;
    } else {
      options.date_from = lo;
      options.date_to = hi;
    }

    const { data: row, error } = await supabase.from("project_exports").insert({
      project_id: projectId,
      created_by: auth.user!.id,
      status: "queued",
      options: options as never,
      logo_path: logoPath,
      accent_color: accent,
    }).select("id,status,output_path,error_message,photo_count").single();
    if (error || !row) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    setCurrentExport(row as ExportRow);
    supabase.functions.invoke("generate-pdf", { body: { export_id: row.id } }).catch(() => { /* polling will catch failure */ });
    setSubmitting(false);
  };

  const downloadExport = async (path: string) => {
    const { data, error } = await supabase.storage.from("exports").createSignedUrl(path, 300, { download: true });
    if (error || !data) { toast.error("Could not get download link"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.rel = "noopener";
    a.target = "_self";
    const name = path.split("/").pop() || "site-story.pdf";
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const inProgress = currentExport && (currentExport.status === "queued" || currentExport.status === "processing");
  const showModeToggle = !lockMode && daysAsc.length > 0;
  const titleText = mode === "range"
    ? "Export date range as PDF"
    : dayKey ? "Export day as PDF" : "Export project as PDF";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>
            {mode === "range"
              ? "Photos are grouped by day, then by area within each day."
              : dayKey
                ? `Only photos from ${dayLabel ?? "this day"} will be included, grouped by area.`
                : "Generate a branded PDF of your project. Photos are grouped by date."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2">
          {showModeToggle && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single day</TabsTrigger>
                <TabsTrigger value="range">Date range</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {mode === "single" && dayKey && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-2 pt-4 text-sm">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span>Scoped to <span className="font-medium">{dayLabel}</span> · {photoCount} photo{photoCount === 1 ? "" : "s"}</span>
              </CardContent>
            </Card>
          )}

          {mode === "range" && (
            <Card>
              <CardContent className="space-y-3 pt-4 text-sm">
                {daysAsc.length === 0 ? (
                  <p className="text-muted-foreground">This project has no dated photos yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <DayPickerField
                        label="From"
                        value={rangeFrom}
                        onChange={setRangeFrom}
                        days={daysAsc}
                        boundKey={rangeTo}
                        boundary="max"
                      />
                      <DayPickerField
                        label="To"
                        value={rangeTo}
                        onChange={setRangeTo}
                        days={daysAsc}
                        boundKey={rangeFrom}
                        boundary="min"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{rangeDays.length} day{rangeDays.length === 1 ? "" : "s"} selected</span>
                      <span>{effectivePhotoCount} photo{effectivePhotoCount === 1 ? "" : "s"} total</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {overCap && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex gap-3 pt-4 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Too many photos for a single export</p>
                  <p className="mt-1 text-muted-foreground">
                    {mode === "range"
                      ? `This range covers ${effectivePhotoCount} photos across ${rangeDays.length} day${rangeDays.length === 1 ? "" : "s"}. The PDF export is capped at ${PHOTO_CAP}. Narrow the range or split into multiple albums before exporting.`
                      : dayKey
                        ? `This day has ${effectivePhotoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Remove some photos or split across more days before exporting.`
                        : `This project has ${effectivePhotoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Export day-by-day or a narrower date range, or remove photos before exporting.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium">Sections to include</h3>
            <div className="grid grid-cols-2 gap-2">
              <SectionToggle label="Cover page" checked={sections.cover} onChange={(v) => setSections((s) => ({ ...s, cover: v }))} />
              <SectionToggle label="Photo grid" checked={sections.grid} onChange={(v) => setSections((s) => ({ ...s, grid: v }))} />
              <SectionToggle label="Captions under photos" checked={sections.captions} onChange={(v) => setSections((s) => ({ ...s, captions: v }))} />
              <SectionToggle label="EXIF table" checked={sections.exif} onChange={(v) => setSections((s) => ({ ...s, exif: v }))} />
              <SectionToggle label="Guest notes" checked={sections.notes} onChange={(v) => setSections((s) => ({ ...s, notes: v }))} />
              <SectionToggle label="Activity log" checked={sections.activity} onChange={(v) => setSections((s) => ({ ...s, activity: v }))} />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <Label>Accent colour</Label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label>Logo (optional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />{logoFile ? "Replace" : "Upload"}</Button>
                {logoFile && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {logoFile.name}
                    <button onClick={() => { setLogoFile(null); setLogoPath(null); }}><X className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            </div>
          </section>

          <Button
            className="w-full"
            onClick={startExport}
            disabled={
              submitting ||
              overCap ||
              !!inProgress ||
              (mode === "range" && (!rangeFrom || !rangeTo || effectivePhotoCount === 0))
            }
          >
            {(submitting || inProgress) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {inProgress ? "Generating…" : "Generate PDF"}
          </Button>

          {currentExport && (
            <Card>
              <CardContent className="flex items-center justify-between gap-2 pt-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={currentExport.status === "ready" ? "default" : currentExport.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                      {(currentExport.status === "processing" || currentExport.status === "queued") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {currentExport.status}
                    </Badge>
                    {currentExport.photo_count != null && (
                      <span className="text-xs text-muted-foreground">{currentExport.photo_count} photos</span>
                    )}
                  </div>
                  {currentExport.error_message && <p className="mt-1 text-xs text-destructive">{currentExport.error_message}</p>}
                </div>
                {currentExport.status === "ready" && currentExport.output_path && (
                  <Button size="sm" variant="outline" onClick={() => downloadExport(currentExport.output_path!)}>
                    <Download className="mr-2 h-4 w-4" />Download
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SectionToggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-secondary/40">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    {label}
  </label>
);

/**
 * A date picker that only enables dates which actually have photos in the project.
 * `boundKey` + `boundary` constrains the range so From <= To.
 */
const DayPickerField = ({
  label,
  value,
  onChange,
  days,
  boundKey,
  boundary,
}: {
  label: string;
  value: string | null;
  onChange: (k: string) => void;
  days: AvailableDay[];
  boundKey: string | null;
  boundary: "min" | "max";
}) => {
  const [open, setOpen] = useState(false);
  const valueDay = days.find((d) => d.key === value);
  const allowedKeys = useMemo(() => new Set(days.map((d) => d.key)), [days]);

  // For Calendar component, we need a Date; map back via key match
  const selectedDate = valueDay?.date ?? undefined;
  const minDate = days[0]?.date;
  const maxDate = days[days.length - 1]?.date;

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const isDisabled = (d: Date) => {
    const k = dateKey(d);
    if (!allowedKeys.has(k)) return true;
    if (boundKey) {
      if (boundary === "min" && k < boundKey) return true;
      if (boundary === "max" && k > boundKey) return true;
    }
    return false;
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("mt-1 w-full justify-start text-left font-normal", !valueDay && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {valueDay ? format(valueDay.date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                onChange(dateKey(d));
                setOpen(false);
              }
            }}
            disabled={isDisabled}
            defaultMonth={selectedDate ?? maxDate ?? minDate}
            fromDate={minDate}
            toDate={maxDate}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
