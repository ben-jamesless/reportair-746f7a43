import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EyeOff, Eye, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EditableNote } from "@/components/EditableNote";
import { AreaStatusPicker, type AreaStatus } from "@/components/AreaStatusPicker";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { areaStatusAccent, dayKey as photoDayKey, type DailyField } from "@/lib/projectDetailTypes";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { useDayHiddenPhotos } from "@/hooks/useDayHiddenPhotos";
import { useProjectTimeZone } from "@/hooks/useProjectTimeZone";
import { formatCaptureTime } from "@/lib/eventTime";
import { useSeedObjectives } from "@/hooks/useSeedObjectives";
import { DayFieldContent } from "@/features/projectDetailV2/DayFieldContent";



const DAILY_BLOCKS: { key: DailyField; label: string; sublabel?: string }[] = [
  { key: "today_objectives", label: "Today's Objectives" },
  { key: "today_achievements", label: "Today's Achievements" },
  { key: "tomorrow_objectives", label: "Tomorrow's Objectives", sublabel: "pre-fills next day" },
  { key: "open_issues", label: "Open Issues / Risks" },
];

// Presentational tokens for the "filed sheet" pattern — themed via CSS vars so dark mode adapts.
const SHEET_BG = "var(--sheet-bg)";
const SHEET_BORDER = "var(--sheet-border)";
const LABEL_INK = "var(--sheet-label)";
const SUBLABEL_INK = "var(--sheet-sublabel)";

function toTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}



function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DailyReportTab({ projectId }: { projectId: string }) {
  const {
    project,
    areas,
    photos,
    dailyFields,
    areaDayNotes,
    areaDayStatus,
    dayStatus,
    canEdit,
    loading,
    loadError,
    refetch,
    setDailyField,
    setAreaDayNote,
    setAreaDayStatus,
    setDayStatus,
  } = useProjectDetail(projectId);
  const eventTz = useProjectTimeZone(projectId);



  const todayKey = useMemo(() => toTodayKey(), []);
  const [activeDay, setActiveDay] = useState<string>(todayKey);
  const [copying, setCopying] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const hidden = useDayHiddenPhotos(projectId);

  useSeedObjectives(projectId, todayKey, activeDay === todayKey, canEdit, () => {
    refetch();
  });

  // Available days: today + any day that has photos
  const days = useMemo(() => {
    const set = new Set<string>();
    set.add(todayKey);
    for (const p of photos) set.add(photoDayKey(p));
    return Array.from(set).sort().reverse();
  }, [photos, todayKey]);

  useEffect(() => {
    if (!days.includes(activeDay)) setActiveDay(days[0] ?? todayKey);
  }, [days, activeDay, todayKey]);

  // Photos for the active day, per-area
  const dayPhotos = useMemo(() => photos.filter((p) => photoDayKey(p) === activeDay), [photos, activeDay]);
  const visibleDayPhotos = useMemo(
    () => (previewMode ? dayPhotos.filter((p) => !hidden.isHidden(p.id, activeDay)) : dayPhotos),
    [dayPhotos, previewMode, hidden, activeDay]
  );
  const photosByArea = useMemo(() => {
    const m = new Map<string, LightboxPhoto[]>();
    for (const p of visibleDayPhotos) {
      const k = p.area_id ?? "__unassigned";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [visibleDayPhotos]);

  const lightboxPhotos = visibleDayPhotos;
  const openLightbox = (photoId: string) => {
    const i = lightboxPhotos.findIndex((p) => p.id === photoId);
    if (i >= 0) setLightboxIndex(i);
  };

  const handleCopyYesterday = useCallback(async () => {
    if (!projectId) return;
    setCopying(true);
    const { data, error } = await (supabase as any).rpc("copy_prior_day_statuses", {
      _project_id: projectId,
      _date_key: activeDay,
    });
    setCopying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const n = typeof data === "number" ? data : 0;
    if (n > 0) {
      toast.success(`Copied ${n} status${n === 1 ? "" : "es"} from the previous day`);
      refetch();
    } else {
      toast.info("Nothing to copy — statuses already set or no prior day found");
    }
  }, [projectId, activeDay, refetch]);

  const handleHideToggle = async (photoId: string) => {
    if (hidden.isHidden(photoId, activeDay)) {
      await hidden.unhide(photoId, activeDay);
      toast.success("Photo restored to this day");
    } else {
      await hidden.hide(photoId, activeDay);
      toast.success("Photo hidden from this day", {
        description: "Still visible in Library and the area story",
      });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (loadError || !project) return <p className="text-sm text-destructive">Failed to load project.</p>;

  const isToday = activeDay === todayKey;

  return (
    <div className="space-y-6">
      {/* Day picker + toggles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={activeDay} onValueChange={setActiveDay}>
          <SelectTrigger
            className="w-full sm:w-[280px]"
            style={{ borderColor: SHEET_BORDER }}
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {days.map((k) => (
              <SelectItem key={k} value={k}>
                {formatDayLabel(k)}
                {k === todayKey ? "  ·  Today" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day status</span>
          <AreaStatusPicker
            value={(dayStatus.get(activeDay) ?? "not_started") as AreaStatus}
            onChange={(s) => setDayStatus(activeDay, s)}
            readOnly={!canEdit || previewMode}
          />
          <Button
            variant={previewMode ? "default" : "outline"}
            size="sm"
            className="ml-auto sm:hidden"
            onClick={() => setPreviewMode((v) => !v)}
          >
            {previewMode ? "Back to edit" : "Client preview"}
          </Button>
        </div>
        {isToday && canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyYesterday}
            disabled={copying}
            className="w-full sm:w-auto"
          >
            {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            <span className="sm:hidden">Copy yesterday</span>
            <span className="hidden sm:inline">Copy yesterday's statuses</span>
          </Button>
        )}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="text-xs text-muted-foreground">
            {previewMode ? "Client preview" : "Edit"}
          </span>
          <Button
            variant={previewMode ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewMode((v) => !v)}
          >
            {previewMode ? "Back to edit" : "Client preview"}
          </Button>
        </div>
      </div>


      {/* Day header — one "filed sheet" card, four rows */}
      <div
        className="border overflow-hidden"
        style={{ backgroundColor: SHEET_BG, borderColor: SHEET_BORDER, borderRadius: 0 }}
      >
        {DAILY_BLOCKS.map((b, idx) => {
          const value = dailyFields.get(activeDay)?.[b.key] ?? null;
          const isLast = idx === DAILY_BLOCKS.length - 1;
          return (
            <div
              key={b.key}
              className="grid grid-cols-1 gap-y-2 px-4 py-4 md:grid-cols-[190px_1fr] md:gap-x-5 md:px-5"
              style={{
                borderBottom: isLast ? "none" : `1px dashed ${SHEET_BORDER}`,
              }}
            >
              <div className="pt-1">
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: LABEL_INK,
                  }}
                >
                  {b.label}
                </div>
                {b.sublabel && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "11px",
                      fontWeight: 400,
                      color: SUBLABEL_INK,
                      marginTop: "2px",
                    }}
                  >
                    {b.sublabel}
                  </div>
                )}
              </div>
              <div className="text-sm text-foreground">
                {!canEdit || previewMode ? (
                  <DayFieldContent
                    value={value}
                    placeholder={previewMode ? undefined : `No ${b.label.toLowerCase()} recorded.`}
                  />
                ) : (
                  <EditableNote
                    value={value}
                    placeholder={`Add ${b.label.toLowerCase()}…`}
                    onSave={(next) => setDailyField(activeDay, b.key, next)}
                    rich
                    rows={3}
                    readOnly={false}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>


      {/* Per-area cards */}
      {areas.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No areas defined yet. Add areas in project settings.
        </p>
      ) : (
        <div className="space-y-4">
          {(() => {
            // An area with no photos, no note and a default status has nothing
            // to say for this day — those collapse into one summary row.
            const isQuiet = (ar: { id: string }) =>
              (photosByArea.get(ar.id)?.length ?? 0) === 0 &&
              !(areaDayNotes.get(`${ar.id}|${activeDay}`) ?? "").trim() &&
              (areaDayStatus.get(`${ar.id}|${activeDay}`) ?? "not_started") === "not_started";
            const quiet = areas.filter(isQuiet);
            if (quiet.length === 0 || showQuietAreas) return null;
            return (
              <button
                type="button"
                onClick={() => setShowQuietAreas(true)}
                className="flex w-full flex-wrap items-center justify-between gap-2 border border-dashed border-border px-4 py-2.5 text-left"
              >
                <span className="text-xs text-muted-foreground">
                  {quiet.length} area{quiet.length === 1 ? "" : "s"} with no update today — {quiet.map((a) => a.name).join(", ")}
                </span>
                <span className="text-xs font-medium underline">Show</span>
              </button>
            );
          })()}
          {areas
            .filter((ar) =>
              showQuietAreas ||
              (photosByArea.get(ar.id)?.length ?? 0) > 0 ||
              (areaDayNotes.get(`${ar.id}|${activeDay}`) ?? "").trim() !== "" ||
              (areaDayStatus.get(`${ar.id}|${activeDay}`) ?? "not_started") !== "not_started",
            )
            .map((ar) => {

            const st = areaDayStatus.get(`${ar.id}|${activeDay}`) ?? "not_started";
            const note = areaDayNotes.get(`${ar.id}|${activeDay}`) ?? null;
            const ps = photosByArea.get(ar.id) ?? [];
            return (
              <article
                key={ar.id}
                className="overflow-hidden border bg-card shadow-none"
                style={{ borderColor: SHEET_BORDER, borderRadius: 0 }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: `1px solid ${SHEET_BORDER}` }}
                >
                  <span className="text-sm font-semibold text-foreground">{ar.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {ps.length} photo{ps.length === 1 ? "" : "s"}
                    </span>
                    <AreaStatusPicker
                      value={st as AreaStatus}
                      onChange={(s) => setAreaDayStatus(ar.id, activeDay, s)}
                      readOnly={!canEdit || previewMode}
                    />
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <EditableNote
                    value={note}
                    placeholder={previewMode ? "" : "No notes for this area yet."}
                    onSave={(next) => setAreaDayNote(ar.id, activeDay, next)}
                    rich
                    rows={3}
                    readOnly={!canEdit || previewMode}
                  />
                  {ps.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {ps.map((p) => {
                        const isHidden = hidden.isHidden(p.id, activeDay);
                        return (
                          <div key={p.id} className="group relative">
                            <div className={isHidden ? "opacity-40" : ""}>
                              <PhotoThumb
                                path={p.storage_path}
                                alt={p.caption || p.file_name}
                                onClick={() => openLightbox(p.id)}
                                captureTime={formatCaptureTime(p.captured_at, eventTz)}
                              />
                            </div>
                            {canEdit && !previewMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleHideToggle(p.id);
                                }}
                                className="absolute right-1 top-1 rounded-md bg-background/90 px-1.5 py-1 text-xs opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"
                                title={isHidden ? "Restore to this day" : "Hide from this day"}
                              >
                                {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {isHidden && (
                              <Badge
                                variant="secondary"
                                className="absolute bottom-1 left-1 text-[10px] uppercase tracking-wide"
                              >
                                Hidden
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {/* Unassigned bucket for the day */}
          {(photosByArea.get("__unassigned")?.length ?? 0) > 0 && (
            <article className="border border-dashed border-border p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unassigned photos this day
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {(photosByArea.get("__unassigned") ?? []).map((p) => (
                  <PhotoThumb
                    key={p.id}
                    path={p.storage_path}
                    alt={p.caption || p.file_name}
                    onClick={() => openLightbox(p.id)}
                    captureTime={formatCaptureTime(p.captured_at, eventTz)}
                  />
                ))}
              </div>
            </article>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
