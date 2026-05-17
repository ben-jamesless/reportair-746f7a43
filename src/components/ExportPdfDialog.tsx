import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TEMPLATE_DEFS,
  RECOMMENDED_LAYOUT_KEY,
  TEMPLATE_ID_KEY,
} from "@/lib/eventTemplates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FileDown,
  Loader2,
  AlertTriangle,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  History,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";

const PHOTO_CAP = 300;

type ExportRow = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  output_path: string | null;
  error_message: string | null;
  photo_count: number | null;
};

type HistoryRow = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  output_path: string | null;
  error_message: string | null;
  photo_count: number | null;
  created_at: string;
  options: Record<string, unknown> | null;
};

type Sections = {
  cover: boolean; grid: boolean; captions: boolean; exif: boolean; notes: boolean; activity: boolean;
};

const DEFAULT_SECTIONS: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false };

// Layout variant — drives orientation + template in the PDF generator.
// portrait_v1 ships at launch on every plan. The two horizontal variants are
// Pro+ at launch; backend branches on options.template.
type LayoutVariant = "portrait_v1" | "horizontal_deck_v1" | "horizontal_log_v1";

// `comingSoon` gates layouts that don't yet have a renderer in the generate-pdf
// edge function. Until that lands, the tiles are visible (so users see the
// roadmap) but disabled — selecting one would produce a Portrait PDF anyway.
const LAYOUTS: { value: LayoutVariant; label: string; hint: string; orientation: "portrait" | "landscape"; pro: boolean; comingSoon: boolean }[] = [
  { value: "portrait_v1",       label: "Portrait",        hint: "Original · photo-led report",         orientation: "portrait",  pro: false, comingSoon: false },
  { value: "horizontal_deck_v1", label: "Client deck",     hint: "Landscape · hero photo + grid",       orientation: "landscape", pro: true,  comingSoon: true  },
  { value: "horizontal_log_v1",  label: "Production log",  hint: "Landscape · data-dense, zone view",   orientation: "landscape", pro: true,  comingSoon: true  },
];

const LAYOUT_STORAGE_KEY = (projectId: string) => `bs:export:layout:${projectId}`;

export type AvailableDay = { key: string; label: string; date: Date; photoCount: number };

type AlbumOption = { id: string; name: string; photoCount: number };

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

type Mode = "single" | "range" | "album";

const fmtScope = (opts: Record<string, unknown> | null): string => {
  if (!opts) return "Export";
  const dayLabel = (opts.day_label as string | undefined) ?? null;
  const dayKey = (opts.day_key as string | undefined) ?? null;
  const dateFrom = (opts.date_from as string | undefined) ?? null;
  const dateTo = (opts.date_to as string | undefined) ?? null;
  const albumLabel = (opts.album_label as string | undefined) ?? null;
  const albumId = (opts.album_id as string | undefined) ?? null;
  if (dayLabel || dayKey) return `Single day — ${dayLabel ?? dayKey}`;
  if (dateFrom && dateTo) {
    const fmt = (k: string) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };
    return `Date range — ${fmt(dateFrom)} – ${fmt(dateTo)}`;
  }
  if (albumLabel || albumId) return `Album — ${albumLabel ?? "Album"}`;
  return "Full project";
};

const fmtCreated = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
  const { canExportPdf, exportsThisMonth, limits, plan } = usePlan();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { if (onOpenChange) onOpenChange(v); else setInternalOpen(v); };
  const sections: Sections = { ...DEFAULT_SECTIONS, cover: true, grid: true, captions: true, activity: false };
  const [accent, setAccent] = useState("#D94F2A");
  const [submitting, setSubmitting] = useState(false);
  const [currentExport, setCurrentExport] = useState<ExportRow | null>(null);
  const [quality, setQuality] = useState<"compressed" | "high_res">("compressed");

  // Pro+ unlocks the two horizontal layouts at launch. Solo gets portrait only.
  const isPro = plan !== "solo";

  // Default order: last-used layout for THIS project (LAYOUT_STORAGE_KEY) →
  // template's recommended layout (set by NewProjectDialog at create time) →
  // portrait. This means a freshly-created Exhibition project opens the
  // export dialog with Production Log already selected, while users who
  // override it once keep their override.
  const isValidLayout = (v: unknown): v is LayoutVariant =>
    v === "portrait_v1" || v === "horizontal_deck_v1" || v === "horizontal_log_v1";
  const recommendedLayout = useMemo<LayoutVariant | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(RECOMMENDED_LAYOUT_KEY(projectId));
    return isValidLayout(v) ? (v as LayoutVariant) : null;
  }, [projectId]);
  const templateForProject = useMemo(() => {
    if (typeof window === "undefined") return null;
    const id = window.localStorage.getItem(TEMPLATE_ID_KEY(projectId));
    return EVENT_TEMPLATE_DEFS.find((t) => t.id === id) ?? null;
  }, [projectId]);
  // A layout is selectable only if it isn't coming-soon and the user has Pro
  // (when required). Used to keep the default selection on a working tile.
  const isSelectableLayout = (v: LayoutVariant): boolean => {
    const def = LAYOUTS.find(l => l.value === v);
    if (!def) return false;
    if (def.comingSoon) return false;
    if (def.pro && !isPro) return false;
    return true;
  };
  const [layout, setLayout] = useState<LayoutVariant>(() => {
    if (typeof window === "undefined") return "portrait_v1";
    const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY(projectId)) as LayoutVariant | null;
    if (isValidLayout(saved) && isSelectableLayout(saved)) return saved;
    const rec = window.localStorage.getItem(RECOMMENDED_LAYOUT_KEY(projectId));
    if (isValidLayout(rec) && isSelectableLayout(rec as LayoutVariant)) return rec as LayoutVariant;
    return "portrait_v1";
  });
  // Guard: if a remembered layout becomes unavailable (Pro downgrade, or layout
  // newly flagged coming-soon), fall back to portrait.
  useEffect(() => {
    if (!isSelectableLayout(layout)) setLayout("portrait_v1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, layout]);
  const orientation = LAYOUTS.find(l => l.value === layout)?.orientation ?? "portrait";

  const initialMode: Mode = lockMode === "single" || dayKey ? "single" : "single";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState<string | null>(null);

  // Albums
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sorted ascending for picker convenience
  const daysAsc = useMemo(
    () => [...availableDays].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [availableDays],
  );

  // Reset session state whenever the dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentExport(null);
      setSubmitting(false);
      setHistoryOpen(false);
    } else {
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

  // Load albums + photo counts + project brand colour when opening
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [{ data: alb }, { data: ph }, { data: proj }] = await Promise.all([
        supabase.from("albums").select("id, name, position").eq("project_id", projectId).order("position"),
        supabase.from("photos").select("album_id").eq("project_id", projectId).not("album_id", "is", null),
        supabase.from("projects").select("color").eq("id", projectId).maybeSingle(),
      ]);
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const r of (ph ?? []) as { album_id: string }[]) {
        counts.set(r.album_id, (counts.get(r.album_id) ?? 0) + 1);
      }
      const opts: AlbumOption[] = (alb ?? []).map((a: { id: string; name: string }) => ({
        id: a.id, name: a.name, photoCount: counts.get(a.id) ?? 0,
      }));
      setAlbums(opts);
      setSelectedAlbumId((prev) => prev ?? opts[0]?.id ?? null);
      // Seed accent from the project's brand colour so admin & share PDFs match.
      const projColor = (proj as { color?: string | null } | null)?.color;
      if (projColor && /^#[0-9a-fA-F]{6}$/.test(projColor)) setAccent(projColor);
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  // Poll the active export until it resolves
  const pollStartedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !currentExport) return;
    if (currentExport.status === "ready" || currentExport.status === "failed") return;
    pollStartedAt.current = Date.now();
    const t = setInterval(async () => {
      const { data } = await supabase.from("project_exports")
        .select("id,status,output_path,error_message,photo_count")
        .eq("id", currentExport.id).maybeSingle();
      if (data) setCurrentExport(data as ExportRow);
      if (pollStartedAt.current && Date.now() - pollStartedAt.current > 5 * 60 * 1000) {
        clearInterval(t);
        setCurrentExport((prev) => prev ? { ...prev, status: "failed", error_message: "Export timed out" } : prev);
        toast.error("Export timed out. Please try again.");
        return;
      }
    }, 3000);
    return () => clearInterval(t);
  }, [open, currentExport]);

  // Load history when collapsible opens (or after a new export completes)
  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("project_exports")
      .select("id, status, output_path, error_message, photo_count, created_at, options")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as HistoryRow[]);
    setHistoryLoading(false);
  };
  useEffect(() => {
    if (open && historyOpen) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyOpen]);


  // Compute photos covered + cap for current selection
  const { effectivePhotoCount, rangeDays } = useMemo(() => {
    if (mode === "range" && rangeFrom && rangeTo) {
      const lo = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const hi = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      const inRange = daysAsc.filter((d) => d.key >= lo && d.key <= hi);
      const total = inRange.reduce((sum, d) => sum + d.photoCount, 0);
      return { effectivePhotoCount: total, rangeDays: inRange };
    }
    if (mode === "album" && selectedAlbumId) {
      const a = albums.find((x) => x.id === selectedAlbumId);
      return { effectivePhotoCount: a?.photoCount ?? 0, rangeDays: [] as AvailableDay[] };
    }
    return { effectivePhotoCount: photoCount, rangeDays: [] as AvailableDay[] };
  }, [mode, rangeFrom, rangeTo, daysAsc, photoCount, selectedAlbumId, albums]);

  const overCap = effectivePhotoCount > PHOTO_CAP;

  const startExport = async () => {
    if (overCap) { toast.error(`Photo cap exceeded (${PHOTO_CAP}). Split per album first.`); return; }
    if (mode === "range" && (!rangeFrom || !rangeTo)) {
      toast.error("Pick a from and to date");
      return;
    }
    if (mode === "album" && !selectedAlbumId) {
      toast.error("Pick an album to export");
      return;
    }
    setSubmitting(true);
    setCurrentExport(null);
    const { data: auth } = await supabase.auth.getUser();

    const lo = mode === "range" && rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeFrom : rangeTo) : null;
    const hi = mode === "range" && rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeTo : rangeFrom) : null;

    const options: Record<string, unknown> = { sections, orientation, quality, template: layout };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY(projectId), layout);
    }
    if (mode === "single") {
      options.day_key = dayKey ?? null;
      options.day_label = dayLabel ?? null;
    } else if (mode === "range") {
      options.date_from = lo;
      options.date_to = hi;
    } else if (mode === "album") {
      const album = albums.find((a) => a.id === selectedAlbumId);
      options.album_id = selectedAlbumId;
      options.album_label = album?.name ?? null;
    }

    const { data: row, error } = await supabase.from("project_exports").insert({
      project_id: projectId,
      created_by: auth.user!.id,
      status: "queued",
      options: options as never,
      logo_path: null,
      accent_color: accent,
    }).select("id,status,output_path,error_message,photo_count").single();
    if (error || !row) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    setCurrentExport(row as ExportRow);
    supabase.functions.invoke("generate-pdf", { body: { export_id: row.id } }).catch(() => { /* polling will catch failure */ });
    setSubmitting(false);
  };

  const downloadingRef = useRef(false);
  const downloadExport = async (path: string) => {
    if (downloadingRef.current) return;
    downloadingRef.current = true;
    try {
      let lastErr: unknown = null;
      let signed: { signedUrl: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, error } = await supabase.storage.from("exports").createSignedUrl(path, 300, { download: true });
          if (!error && data?.signedUrl) { signed = data; break; }
          lastErr = error;
        } catch (e) {
          lastErr = e;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      if (!signed) {
        console.error("createSignedUrl failed", lastErr);
        toast.error("Could not get download link");
        return;
      }
      const a = document.createElement("a");
      a.href = signed.signedUrl;
      a.rel = "noopener";
      a.target = "_self";
      const name = path.split("/").pop() || "site-story.pdf";
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      downloadingRef.current = false;
    }
  };

  const inProgress = currentExport && (currentExport.status === "queued" || currentExport.status === "processing");
  const showModeToggle = !lockMode && (daysAsc.length > 0 || albums.length > 0);
  const titleText = mode === "range"
    ? "Export date range as PDF"
    : mode === "album"
      ? "Export album as PDF"
      : dayKey ? "Export day as PDF" : "Export project as PDF";

  // History excludes the current in-progress row
  const historyRows = history.filter(
    (h) => !(currentExport && h.id === currentExport.id),
  );

  const albumsDisabled = albums.length === 0;

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
              : mode === "album"
                ? "Photos in the selected album are grouped by date."
                : dayKey
                  ? `Only photos from ${dayLabel ?? "this day"} will be included, grouped by area.`
                  : "Generate a branded PDF of your project. Photos are grouped by date."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2">
          {showModeToggle && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">Single day</TabsTrigger>
                <TabsTrigger value="range" disabled={daysAsc.length === 0}>Date range</TabsTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(albumsDisabled && "cursor-not-allowed")}>
                        <TabsTrigger value="album" disabled={albumsDisabled} className="w-full">
                          By album
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    {albumsDisabled && (
                      <TooltipContent>No albums in this project.</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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

          {mode === "album" && (
            <Card>
              <CardContent className="space-y-3 pt-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Album</Label>
                  <Select
                    value={selectedAlbumId ?? ""}
                    onValueChange={(v) => setSelectedAlbumId(v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pick an album" />
                    </SelectTrigger>
                    <SelectContent>
                      {albums.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.photoCount} photo{a.photoCount === 1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  {effectivePhotoCount} photo{effectivePhotoCount === 1 ? "" : "s"} in this album
                </div>
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
                      : mode === "album"
                        ? `This album contains ${effectivePhotoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Split into smaller albums or remove photos before exporting.`
                        : dayKey
                          ? `This day has ${effectivePhotoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Remove some photos or split across more days before exporting.`
                          : `This project has ${effectivePhotoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Export day-by-day or a narrower date range, or remove photos before exporting.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Layout</label>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map((opt) => {
                const selected = layout === opt.value;
                const locked = opt.comingSoon || (opt.pro && !isPro);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { if (!locked) setLayout(opt.value); }}
                    aria-pressed={selected}
                    aria-disabled={locked}
                    className={cn(
                      "rounded-lg border-2 px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground",
                      locked && "cursor-not-allowed opacity-60 hover:border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{opt.label}</p>
                      {opt.comingSoon ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Coming soon
                        </span>
                      ) : opt.pro && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <Crown className="h-3 w-3" />Pro
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
                    {selected && templateForProject && recommendedLayout === opt.value && !opt.comingSoon && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Recommended for {templateForProject.title}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Export quality</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuality("compressed")}
                className={`rounded-lg border-2 px-3 py-3 text-left transition-colors ${
                  quality === "compressed"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <p className="text-sm font-medium">Compressed</p>
                <p className="text-xs text-muted-foreground mt-0.5">Smaller file · ~2–4 MB</p>
              </button>
              <button
                type="button"
                onClick={() => setQuality("high_res")}
                className={`rounded-lg border-2 px-3 py-3 text-left transition-colors ${
                  quality === "high_res"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <p className="text-sm font-medium">High Res</p>
                <p className="text-xs text-muted-foreground mt-0.5">Full detail · ~6–10 MB</p>
              </button>
            </div>
          </div>

          {!canExportPdf && (
            <p className="text-xs text-destructive">
              You've used all {limits.maxExportsMonth} exports this month. Resets on the 1st.{" "}
              <a href="/billing" className="underline">Upgrade for unlimited exports.</a>
            </p>
          )}

          <Button
            className="w-full"
            onClick={startExport}
            disabled={
              submitting ||
              overCap ||
              !!inProgress ||
              !canExportPdf ||
              (mode === "range" && (!rangeFrom || !rangeTo || effectivePhotoCount === 0)) ||
              (mode === "album" && (!selectedAlbumId || effectivePhotoCount === 0))
            }
          >
            {(submitting || inProgress) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!canExportPdf && !(submitting || inProgress) && <Crown className="mr-1.5 h-3.5 w-3.5 text-amber-400" />}
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

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <History className="h-4 w-4" />
                  Export history
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", historyOpen && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
                </div>
              ) : historyRows.length === 0 ? (
                <p className="px-1 py-3 text-sm text-muted-foreground">No previous exports yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {historyRows.map((h) => {
                    const ready = h.status === "ready" && !!h.output_path;
                    const variant =
                      h.status === "ready" ? "default" : h.status === "failed" ? "destructive" : "secondary";
                    return (
                      <li key={h.id} className="flex items-center gap-3 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{fmtScope(h.options)}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={variant} className="capitalize">{h.status}</Badge>
                            <span>{fmtCreated(h.created_at)}</span>
                            {h.photo_count != null && <span>· {h.photo_count} photos</span>}
                          </div>
                          {h.error_message && (
                            <p className="mt-1 truncate text-xs text-destructive">{h.error_message}</p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!ready}
                          onClick={() => ready && downloadExport(h.output_path!)}
                          aria-label="Download export"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
            className={cn(
              "mt-1 w-full justify-start text-left font-normal px-2 sm:px-3 truncate",
              !valueDay && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
            {valueDay ? (
              <>
                <span className="truncate sm:hidden">{format(valueDay.date, "d MMM yyyy")}</span>
                <span className="hidden truncate sm:inline">{format(valueDay.date, "PPP")}</span>
              </>
            ) : (
              <span className="truncate">Pick a date</span>
            )}
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
