import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, X, ChevronLeft, ChevronRight, Download, Calendar, Layers, ImagePlus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { groupPhotosByDate } from "@/lib/photoUtils";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SharePhoto = {
  id: string; storage_path: string; file_name: string; caption: string | null;
  captured_at: string | null; created_at: string;
  album_id: string | null; area_id: string | null;
};
type Album = { id: string; name: string; position: number };
type Area = { id: string; name: string; sort_order: number };
type DayNote = {
  date: string;
  notes: string | null;
  today_objectives: string | null;
  today_achievements: string | null;
  tomorrow_objectives: string | null;
  open_issues: string | null;
};
type AreaDayStatus = { area_id: string; date: string; status: string };
type AreaDayNote = { area_id: string; date: string; notes: string | null };
type ShareProject = {
  id: string;
  name: string;
  description: string | null;
  client_name?: string | null;
  event_type?: string | null;
  event_location?: string | null;
  event_date?: string | null;
  color?: string | null;
  overall_status?: string | null;
};
type LatestExport = { id: string; created_at: string; photo_count: number | null };
type Resolved = {
  ok: boolean;
  error?: string;
  share_link_id?: string;
  project?: ShareProject;
  albums?: Album[];
  areas?: Area[];
  day_notes?: DayNote[];
  area_day_status?: AreaDayStatus[];
  area_day_notes?: AreaDayNote[];
  photos?: SharePhoto[];
  latest_export?: LatestExport | null;
};

type GuestNoteRow = { id: string; photo_id: string; guest_name: string; body: string; created_at: string };

// ReportAir design tokens
const TEAL = "#1A6EFF"; // SKY — kept variable name for compat
const NEAR_BLACK = "#0F1724"; // INK
const BODY = "#3D4F66"; // SLATE
const MUTED = "#7A8FA8"; // MIST
const DIVIDER = "#D0D9E8"; // BORDER
const SURFACE = "#F5F7FA"; // FOG

// Status meta — pill backgrounds & dot colors
const STATUS_META: Record<string, { label: string; bg: string }> = {
  on_track: { label: "On Track", bg: "#1A6EFF" },
  at_risk: { label: "At Risk", bg: "#FF8C00" },
  requires_discussion: { label: "Requires Discussion", bg: "#FF8C00" },
  delayed: { label: "Delayed", bg: "#FF3B30" },
  concern: { label: "Delayed", bg: "#FF3B30" },
  behind_schedule: { label: "Delayed", bg: "#FF3B30" },
  complete: { label: "Complete", bg: "#1DB87A" },
  no_status: { label: "No status", bg: "#7A8FA8" },
};

const StatusPill = ({ statusKey, size = "sm" }: { statusKey: string | null | undefined; size?: "sm" | "md" }) => {
  if (!statusKey) return null;
  const meta = STATUS_META[statusKey];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white",
        size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-xs",
      )}
      style={{ backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
};

const StatusDot = ({ statusKey }: { statusKey: string | null | undefined }) => {
  const meta = statusKey ? STATUS_META[statusKey] : null;
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: meta?.bg ?? "#d1d5db" }}
    />
  );
};

const isoDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ALL_DAYS = "__all_days__";
const guestKey = (token: string) => `guest_identity_${token}`;
const albumKey = (id: string) => `__album_${id}`;
const isAlbumKey = (k: string) => k.startsWith("__album_");
const areaKey = (id: string) => `__area_${id}`;
const isAreaKey = (k: string) => k.startsWith("__area_");

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const SHORT_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const SharePage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(ALL_DAYS); // ALL_DAYS | dateKey | __album_<id>
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [guest, setGuest] = useState<{ name: string; email: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<GuestNoteRow[]>([]);
  const [weather, setWeather] = useState<Record<string, { tmin: number; tmax: number; condition: string; wind: number }>>({});

  useEffect(() => {
    if (!token) return;
    const stored = localStorage.getItem(guestKey(token));
    if (stored) try { setGuest(JSON.parse(stored)); } catch { /* ignore */ }
    resolve(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resolve = async (pwd: string | null) => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("resolve_share_link", { _token: token, _password: pwd });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const r = res as unknown as Resolved;
    if (!r.ok) {
      if (r.error === "password_required") { setNeedPassword(true); return; }
      setData(r);
      return;
    }
    setNeedPassword(false);
    setData(r);
  };

  const loadFeedback = useCallback(async () => {
    if (!token) return;
    const { data: rows } = await supabase.rpc("list_guest_notes_project_public", { _token: token });
    setFeedback((rows ?? []) as GuestNoteRow[]);
  }, [token]);

  useEffect(() => { if (data?.ok) loadFeedback(); }, [data?.ok, loadFeedback]);

  const photos = useMemo(() => data?.photos ?? [], [data?.photos]);
  const albums = useMemo(() => data?.albums ?? [], [data?.albums]);
  const areas = useMemo(() => data?.areas ?? [], [data?.areas]);
  const project = data?.project;

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    (data?.area_day_status ?? []).forEach((s) => m.set(`${s.area_id}|${s.date}`, s.status));
    return m;
  }, [data?.area_day_status]);

  const areaDayNotesMap = useMemo(() => {
    const m = new Map<string, string>();
    (data?.area_day_notes ?? []).forEach((n) => { if (n.notes && n.notes.trim()) m.set(`${n.area_id}|${n.date}`, n.notes); });
    return m;
  }, [data?.area_day_notes]);

  const dayNotesMap = useMemo(() => {
    const m = new Map<string, string>();
    (data?.day_notes ?? []).forEach((n) => { if (n.notes && n.notes.trim()) m.set(n.date, n.notes); });
    return m;
  }, [data?.day_notes]);

  const dayNoteByDate = useMemo(() => {
    const m = new Map<string, DayNote>();
    (data?.day_notes ?? []).forEach((n) => m.set(n.date, n));
    return m;
  }, [data?.day_notes]);

  // Photos grouped by day (for full project)
  const allDayGroups = useMemo(() => groupPhotosByDate(photos), [photos]);

  // Fetch weather for all visible days
  useEffect(() => {
    if (!token || !data?.ok || allDayGroups.length === 0) return;
    const dates = allDayGroups.map((g) => isoDateKey(g.date));
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await supabase.functions.invoke("project-weather", { body: { token, dates } });
        if (!cancelled && res?.weather) setWeather(res.weather);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [token, data?.ok, allDayGroups]);

  // Most recent area-day status per area (for sidebar dots and Latest Update)
  const latestAreaStatus = useMemo(() => {
    const status = new Map<string, string>();
    const latestDate = new Map<string, string>();
    (data?.area_day_status ?? []).forEach((s) => {
      const prev = latestDate.get(s.area_id);
      if (!prev || s.date > prev) {
        latestDate.set(s.area_id, s.date);
        status.set(s.area_id, s.status);
      }
    });
    return status;
  }, [data?.area_day_status]);

  // Latest area-day note per area
  const latestAreaNote = useMemo(() => {
    const note = new Map<string, string>();
    const latestDate = new Map<string, string>();
    (data?.area_day_notes ?? []).forEach((n) => {
      if (!n.notes || !n.notes.trim()) return;
      const prev = latestDate.get(n.area_id);
      if (!prev || n.date > prev) {
        latestDate.set(n.area_id, n.date);
        note.set(n.area_id, n.notes);
      }
    });
    return note;
  }, [data?.area_day_notes]);

  // Most recent day overall (for Latest Update header)
  const latestDayKey = useMemo(() => {
    if (allDayGroups.length === 0) return null;
    return isoDateKey(allDayGroups[0].date);
  }, [allDayGroups]);

  const albumPhotosMap = useMemo(() => {
    const m = new Map<string, SharePhoto[]>();
    photos.forEach((p) => {
      if (!p.album_id) return;
      if (!m.has(p.album_id)) m.set(p.album_id, []);
      m.get(p.album_id)!.push(p);
    });
    return m;
  }, [photos]);

  // Visible groups for centre column based on selection
  const visibleGroups = useMemo(() => {
    if (activeKey === ALL_DAYS) return allDayGroups;
    if (isAlbumKey(activeKey)) {
      const id = activeKey.replace("__album_", "");
      const list = albumPhotosMap.get(id) ?? [];
      return groupPhotosByDate(list);
    }
    if (isAreaKey(activeKey)) {
      const id = activeKey.replace("__area_", "");
      const list = photos.filter((p) => p.area_id === id);
      return groupPhotosByDate(list);
    }
    return allDayGroups.filter((g) => isoDateKey(g.date) === activeKey);
  }, [activeKey, allDayGroups, albumPhotosMap, photos]);

  const visiblePhotos = useMemo(() => visibleGroups.flatMap((g) => g.photos), [visibleGroups]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    visiblePhotos.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [visiblePhotos]);

  const photoById = useMemo(() => {
    const m = new Map<string, SharePhoto>();
    photos.forEach((p) => m.set(p.id, p));
    return m;
  }, [photos]);

  const downloadLatestReport = async () => {
    if (!token || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-export-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) { toast.error("Could not get download link"); return; }
      const a = document.createElement("a");
      a.href = json.url; a.rel = "noopener"; a.target = "_self";
      a.download = "site-story.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Day-level scroll anchors (for ALL_DAYS view)
  const dayAnchorRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const handleSelectDay = (key: string) => {
    setActiveKey(key);
    if (key !== ALL_DAYS && !isAlbumKey(key)) {
      // If we’re showing all days, scroll to anchor; else just switch view
      requestAnimationFrame(() => {
        const el = dayAnchorRefs.current.get(key);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  if (loading && !data) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (needPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6">
            <div className="text-center">
              <Lock className="mx-auto h-8 w-8" style={{ color: MUTED }} />
              <h1 className="mt-2 text-lg font-semibold" style={{ color: NEAR_BLACK }}>Password required</h1>
              <p className="text-sm" style={{ color: MUTED }}>Enter the password to view this gallery.</p>
            </div>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button className="w-full text-white" style={{ backgroundColor: TEAL }} onClick={() => resolve(password)}>Unlock</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data && !data.ok) {
    const msg = data.error === "expired" ? "This link has expired."
      : data.error === "revoked" ? "This link has been revoked."
      : "Link not found.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Card className="max-w-md"><CardContent className="pt-6 text-center"><p className="text-sm" style={{ color: MUTED }}>{msg}</p></CardContent></Card>
      </div>
    );
  }

  if (!guest) {
    return <GuestIdentityPrompt onSubmit={(g) => { localStorage.setItem(guestKey(token!), JSON.stringify(g)); setGuest(g); }} />;
  }

  const overallStatus = project?.overall_status ?? null;
  const subtitleBits = [project?.client_name, project?.event_location, project?.event_type].filter(Boolean) as string[];
  const hasLatestExport = !!data?.latest_export;

  // Latest day header data
  const latestDayPhotos = latestDayKey ? (allDayGroups[0]?.photos ?? []) : [];
  const latestDayAreaIds = Array.from(new Set(latestDayPhotos.map((p) => p.area_id).filter(Boolean) as string[]));

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#ffffff", color: BODY }}>
      {/* HEADER */}
      <header className="border-b" style={{ borderColor: DIVIDER, backgroundColor: "#ffffff" }}>
        <div className="mx-auto max-w-[1400px] px-6 py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: NEAR_BLACK }}>
                {project?.name}
              </h1>
              {subtitleBits.length > 0 && (
                <p className="mt-1.5 text-sm" style={{ color: MUTED }}>
                  {subtitleBits.join(" · ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusPill statusKey={overallStatus} size="md" />
              {hasLatestExport && (
                <Button
                  size="sm"
                  onClick={downloadLatestReport}
                  disabled={downloading}
                  className="text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: TEAL }}
                >
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download latest report
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* THREE-COLUMN LAYOUT */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
          {/* LEFT: Date navigation */}
          <aside className="hidden lg:block space-y-1">
            <button
              onClick={() => setActiveKey(ALL_DAYS)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
              )}
              style={
                activeKey === ALL_DAYS
                  ? { backgroundColor: TEAL, color: "#ffffff" }
                  : { color: BODY }
              }
              onMouseEnter={(e) => {
                if (activeKey !== ALL_DAYS) e.currentTarget.style.backgroundColor = SURFACE;
              }}
              onMouseLeave={(e) => {
                if (activeKey !== ALL_DAYS) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span className="flex items-center gap-2">
                <ImagePlus className="h-3.5 w-3.5" />
                <span className="font-medium">All days</span>
              </span>
              <span className="text-xs opacity-80">{photos.length}</span>
            </button>

            <div className="my-2 border-t" style={{ borderColor: DIVIDER }} />

            {allDayGroups.length === 0 && (
              <p className="px-3 py-4 text-xs" style={{ color: MUTED }}>No photos yet.</p>
            )}

            {allDayGroups.map((g) => {
              const key = isoDateKey(g.date);
              const active = activeKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectDay(key)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
                  style={active ? { backgroundColor: TEAL, color: "#ffffff" } : { color: BODY }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = SURFACE; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-medium">{SHORT_FMT.format(g.date)}</span>
                  </span>
                  <span className="text-xs opacity-80">{g.photos.length}</span>
                </button>
              );
            })}

            {albums.length > 0 && (
              <>
                <div className="my-2 border-t" style={{ borderColor: DIVIDER }} />
                {albums.map((al) => {
                  const key = albumKey(al.id);
                  const active = activeKey === key;
                  const count = albumPhotosMap.get(al.id)?.length ?? 0;
                  return (
                    <button
                      key={al.id}
                      onClick={() => setActiveKey(key)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
                      style={active ? { backgroundColor: TEAL, color: "#ffffff" } : { color: BODY }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = SURFACE; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <span className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5" />
                        <span className="font-medium">{al.name}</span>
                      </span>
                      <span className="text-xs opacity-80">{count}</span>
                    </button>
                  );
                })}
              </>
            )}

            {areas.length > 0 && (
              <>
                <div className="my-2 border-t" style={{ borderColor: DIVIDER }} />
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Areas</p>
                {areas.map((ar) => {
                  const key = areaKey(ar.id);
                  const active = activeKey === key;
                  const count = photos.filter((p) => p.area_id === ar.id).length;
                  return (
                    <button
                      key={ar.id}
                      onClick={() => setActiveKey(key)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs transition-colors"
                      style={active ? { backgroundColor: TEAL, color: "#ffffff" } : { color: BODY }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = SURFACE; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <StatusDot statusKey={latestAreaStatus.get(ar.id) ?? "no_status"} />
                        <span className="truncate">{ar.name}</span>
                      </span>
                      <span className="text-xs opacity-80">{count}</span>
                    </button>
                  );
                })}
              </>
            )}
          </aside>

          {/* CENTRE: Day feed */}
          <section className="min-w-0">
            {/* MOBILE NAV: dropdowns for days & areas */}
            <div className="mb-4 flex flex-col gap-2 lg:hidden">
              <Select
                value={activeKey === ALL_DAYS || allDayGroups.some((g) => isoDateKey(g.date) === activeKey) || albums.some((a) => albumKey(a.id) === activeKey) ? activeKey : ALL_DAYS}
                onValueChange={(v) => {
                  if (v === ALL_DAYS) setActiveKey(ALL_DAYS);
                  else if (v.startsWith("__album_")) setActiveKey(v);
                  else handleSelectDay(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DAYS}>All days ({photos.length})</SelectItem>
                  {allDayGroups.map((g) => {
                    const key = isoDateKey(g.date);
                    return (
                      <SelectItem key={key} value={key}>
                        {SHORT_FMT.format(g.date)} ({g.photos.length})
                      </SelectItem>
                    );
                  })}
                  {albums.map((al) => (
                    <SelectItem key={al.id} value={albumKey(al.id)}>
                      {al.name} ({albumPhotosMap.get(al.id)?.length ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {areas.length > 0 && (
                <Select
                  value={isAreaKey(activeKey) ? activeKey : "__all_areas"}
                  onValueChange={(v) => {
                    if (v === "__all_areas") setActiveKey(ALL_DAYS);
                    else setActiveKey(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_areas">All areas</SelectItem>
                    {areas.map((ar) => (
                      <SelectItem key={ar.id} value={areaKey(ar.id)}>
                        {ar.name} ({photos.filter((p) => p.area_id === ar.id).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {visibleGroups.length === 0 ? (
              <div
                className="rounded-xl border p-12 text-center text-sm"
                style={{ borderColor: DIVIDER, backgroundColor: SURFACE, color: MUTED }}
              >
                No photos in this view.
              </div>
            ) : (
              <div className="space-y-6">
                {visibleGroups.map((group) => {
                  const dateKey = isoDateKey(group.date);
                  // Group photos within this day by area
                  const byArea = new Map<string, SharePhoto[]>();
                  group.photos.forEach((p) => {
                    const k = p.area_id ?? "__noarea__";
                    if (!byArea.has(k)) byArea.set(k, []);
                    byArea.get(k)!.push(p);
                  });
                  const areaIdsForDay = Array.from(byArea.keys());
                  const dayStatusKeys = areaIdsForDay
                    .filter((k) => k !== "__noarea__")
                    .map((aid) => statusMap.get(`${aid}|${dateKey}`))
                    .filter(Boolean) as string[];
                  const dominantDayStatus = pickDominantStatus(dayStatusKeys);

                  const orderedAreas = areas.filter((ar) => byArea.has(ar.id));
                  const hasUnassigned = byArea.has("__noarea__");
                  const totalBlocks = orderedAreas.length + (hasUnassigned ? 1 : 0);

                  return (
                    <div
                      key={group.key}
                      ref={(el) => { dayAnchorRefs.current.set(dateKey, el); }}
                    >
                      {/* Day header strip — full width, flush */}
                      <div
                        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 backdrop-blur"
                        style={{
                          backgroundColor: SURFACE,
                          borderBottom: `1px solid ${DIVIDER}`,
                        }}
                      >
                        <div className="flex items-baseline gap-3 min-w-0">
                          <h2 className="truncate text-base font-bold" style={{ color: NEAR_BLACK }}>
                            {DATE_FMT.format(group.date)}
                          </h2>
                          <span className="shrink-0 text-xs" style={{ color: MUTED }}>
                            {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {dominantDayStatus && <StatusPill statusKey={dominantDayStatus} />}
                      </div>
                      {weather[dateKey] && (
                        <div className="px-4 py-2 text-xs" style={{ color: MUTED, borderBottom: `1px solid ${DIVIDER}` }}>
                          {weather[dateKey].tmin}°C – {weather[dateKey].tmax}°C · {weather[dateKey].condition} · {weather[dateKey].wind} km/h wind
                        </div>
                      )}
                      {dayNotesMap.get(dateKey) && (
                        <div className="py-2 pl-4 text-[15px] leading-relaxed" style={{ color: BODY }}>
                          <RichNotes text={dayNotesMap.get(dateKey)!} />
                        </div>
                      )}

                      {/* Area blocks — flush, no cards */}
                      <div>
                        {orderedAreas.map((ar, idx) => {
                          const areaPhotos = byArea.get(ar.id) ?? [];
                          const sKey = statusMap.get(`${ar.id}|${dateKey}`);
                          const note = areaDayNotesMap.get(`${ar.id}|${dateKey}`);
                          const accent = sKey ? STATUS_META[sKey]?.bg ?? DIVIDER : DIVIDER;
                          const isLast = idx === totalBlocks - 1;
                          return (
                            <div key={ar.id}>
                              <article
                                className="py-4 pl-4"
                                style={{ borderLeft: `3px solid ${accent}` }}
                              >
                                <header className="mb-3 flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-medium" style={{ color: NEAR_BLACK }}>{ar.name}</h3>
                                  {sKey && <StatusPill statusKey={sKey} />}
                                </header>

                                {areaPhotos.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                                    {areaPhotos.map((p) => (
                                      <SharePhotoThumb
                                        key={p.id}
                                        token={token!}
                                        photo={p}
                                        onClick={() => setLightboxIndex(indexById.get(p.id) ?? 0)}
                                      />
                                    ))}
                                  </div>
                                )}

                                {note && (
                                  <div className="mt-3 text-sm" style={{ color: BODY }}>
                                    <RichNotes text={note} />
                                  </div>
                                )}
                              </article>
                              {!isLast && (
                                <div className="ml-4 border-t" style={{ borderColor: DIVIDER }} />
                              )}
                            </div>
                          );
                        })}

                        {hasUnassigned && (
                          <article
                            className="py-4 pl-4"
                            style={{ borderLeft: `3px solid ${DIVIDER}` }}
                          >
                            <header className="mb-3">
                              <h3 className="text-sm font-medium" style={{ color: NEAR_BLACK }}>Unassigned</h3>
                            </header>
                            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                              {byArea.get("__noarea__")!.map((p) => (
                                <SharePhotoThumb
                                  key={p.id}
                                  token={token!}
                                  photo={p}
                                  onClick={() => setLightboxIndex(indexById.get(p.id) ?? 0)}
                                />
                              ))}
                            </div>
                          </article>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: Latest Update + Feedback */}
          <aside className="hidden xl:block">
            <div className="sticky top-6 space-y-4">
              <div
                className="rounded-xl border p-4"
                style={{ borderColor: DIVIDER, backgroundColor: SURFACE }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                  Latest update
                </p>
                {latestDayKey ? (
                  <>
                    <p className="mt-1 text-sm font-bold" style={{ color: NEAR_BLACK }}>
                      {DATE_FMT.format(allDayGroups[0].date)}
                    </p>
                    <div className="mt-2">
                      <StatusPill statusKey={overallStatus} />
                    </div>
                    {latestDayAreaIds.length > 0 && (
                      <ul className="mt-3 space-y-3">
                        {areas
                          .filter((ar) => latestDayAreaIds.includes(ar.id))
                          .map((ar) => {
                            const sKey = statusMap.get(`${ar.id}|${latestDayKey}`) ?? latestAreaStatus.get(ar.id);
                            const note =
                              areaDayNotesMap.get(`${ar.id}|${latestDayKey}`) ?? latestAreaNote.get(ar.id);
                            return (
                              <li key={ar.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: DIVIDER }}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold" style={{ color: NEAR_BLACK }}>{ar.name}</span>
                                  {sKey && <StatusPill statusKey={sKey} />}
                                </div>
                                {note && (
                                  <div className="mt-1.5 text-xs" style={{ color: BODY }}>
                                    <RichNotes text={note} />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-xs italic" style={{ color: MUTED }}>No updates yet.</p>
                )}
              </div>

              <div
                className="rounded-xl border"
                style={{ borderColor: DIVIDER, backgroundColor: "#ffffff" }}
              >
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{ borderColor: DIVIDER }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" style={{ color: MUTED }} />
                    <h3 className="text-sm font-semibold" style={{ color: NEAR_BLACK }}>Feedback</h3>
                  </div>
                  <span className="text-xs" style={{ color: MUTED }}>{feedback.length}</span>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-3">
                  {feedback.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs" style={{ color: MUTED }}>No feedback yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {feedback.map((n) => {
                        const photo = photoById.get(n.photo_id);
                        return (
                          <li key={n.id}>
                            <button
                              onClick={() => {
                                if (!photo) return;
                                const idx = indexById.get(n.photo_id);
                                if (idx !== undefined) setLightboxIndex(idx);
                              }}
                              className="flex w-full gap-3 rounded-md border p-2.5 text-left transition-colors"
                              style={{ borderColor: DIVIDER, backgroundColor: "#ffffff" }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = SURFACE)}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                            >
                              {photo ? (
                                <SharePhotoMiniThumb token={token!} photo={photo} />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded" style={{ backgroundColor: DIVIDER }} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <p className="truncate text-xs font-medium" style={{ color: NEAR_BLACK }}>{n.guest_name}</p>
                                  <span className="ml-auto shrink-0 text-[10px]" style={{ color: MUTED }}>
                                    {TIME_FMT.format(new Date(n.created_at))}
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs" style={{ color: BODY }}>{n.body}</p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {lightboxIndex !== null && (
        <ShareLightbox
          token={token!}
          photos={visiblePhotos}
          index={lightboxIndex}
          guest={guest}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onNotesChanged={loadFeedback}
        />
      )}
    </div>
  );
};

// Pick a single representative status from a list (worst-first ordering)
const STATUS_PRIORITY = ["delayed", "concern", "behind_schedule", "requires_discussion", "at_risk", "on_track", "complete", "no_status"];
const pickDominantStatus = (keys: string[]): string | null => {
  if (keys.length === 0) return null;
  for (const s of STATUS_PRIORITY) if (keys.includes(s)) return s;
  return keys[0];
};

const GuestIdentityPrompt = ({ onSubmit }: { onSubmit: (g: { name: string; email: string }) => void }) => {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: NEAR_BLACK }}>Welcome</h1>
            <p className="text-sm" style={{ color: MUTED }}>Tell us who you are so the team knows whose notes are whose.</p>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <Button
            className="w-full text-white"
            style={{ backgroundColor: TEAL }}
            disabled={!name.trim() || !email.trim()}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim() })}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Lightweight markdown-ish renderer for share-page notes ---
const renderInline = (line: string, keyPrefix: string) => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) parts.push(<span key={`${keyPrefix}-t-${i++}`}>{line.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{tok.slice(1, -1)}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < line.length) parts.push(<span key={`${keyPrefix}-t-${i++}`}>{line.slice(last)}</span>);
  return parts;
};

const RichNotes = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm">
      {lines.map((raw, idx) => {
        const line = raw.trim();
        if (!line) return <div key={idx} className="h-1" />;
        if (line.startsWith("# ")) {
          return <p key={idx} className="mt-2 text-sm font-bold" style={{ color: NEAR_BLACK }}>{renderInline(line.slice(2), `h-${idx}`)}</p>;
        }
        const isBullet = line.startsWith("- ") || line.startsWith("* ");
        if (isBullet) {
          return (
            <p key={idx} className="flex gap-2">
              <span aria-hidden className="select-none" style={{ color: MUTED }}>•</span>
              <span className="min-w-0">{renderInline(line.slice(2), `l-${idx}`)}</span>
            </p>
          );
        }
        return (
          <p key={idx} className="min-w-0">{renderInline(line, `l-${idx}`)}</p>
        );
      })}
    </div>
  );
};

const useShareSignedUrl = (token: string, photoId: string) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-photo-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photo_id: photoId }),
      });
      const json = await res.json();
      if (alive && json.url) setUrl(json.url);
    })();
    return () => { alive = false; };
  }, [token, photoId]);
  return url;
};

const SharePhotoThumb = ({ token, photo, onClick }: { token: string; photo: SharePhoto; onClick: () => void }) => {
  const url = useShareSignedUrl(token, photo.id);
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-[#f3f4f6]"
      title={photo.caption || undefined}
    >
      {url ? <img src={url} alt={photo.caption || ""} className="h-full w-full object-cover" loading="lazy" /> : null}
      {photo.caption && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {photo.caption}
        </span>
      )}
    </button>
  );
};

const SharePhotoMiniThumb = ({ token, photo }: { token: string; photo: SharePhoto }) => {
  const url = useShareSignedUrl(token, photo.id);
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded" style={{ backgroundColor: DIVIDER }}>
      {url && <img src={url} alt={photo.caption || photo.file_name} className="h-full w-full object-cover" loading="lazy" />}
    </div>
  );
};

const ShareLightbox = ({ token, photos, index, guest, onClose, onIndexChange, onNotesChanged }: {
  token: string; photos: SharePhoto[]; index: number; guest: { name: string; email: string };
  onClose: () => void; onIndexChange: (i: number) => void; onNotesChanged?: () => void;
}) => {
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index]);
  const photo = photos[i];
  const [url, setUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ id: string; guest_name: string; body: string; created_at: string }[]>([]);
  const [body, setBody] = useState("");

  const loadNotes = useCallback(async () => {
    if (!photo) return;
    const { data } = await supabase.rpc("list_guest_notes_public", { _token: token, _photo_id: photo.id });
    setNotes((data ?? []) as { id: string; guest_name: string; body: string; created_at: string }[]);
  }, [photo, token]);

  useEffect(() => {
    if (!photo) return;
    setUrl(null); setBody("");
    let alive = true;
    (async () => {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-photo-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photo_id: photo.id }),
      });
      const json = await res.json();
      if (alive && json.url) setUrl(json.url);
    })();
    loadNotes();
    return () => { alive = false; };
  }, [photo, token, loadNotes]);

  const submitNote = async () => {
    if (!body.trim()) return;
    const { error } = await supabase.rpc("add_guest_note_public", {
      _token: token, _photo_id: photo.id, _name: guest.name, _email: guest.email, _body: body.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setBody(""); loadNotes(); onNotesChanged?.(); toast.success("Note added");
  };

  const prev = () => { const ni = (i - 1 + photos.length) % photos.length; setI(ni); onIndexChange(ni); };
  const next = () => { const ni = (i + 1) % photos.length; setI(ni); onIndexChange(ni); };

  if (!photo) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl border-0 bg-background p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px]">
          <div className="relative flex min-h-[50vh] items-center justify-center bg-black md:min-h-[70vh]">
            {url && <img src={url} alt={photo.caption || ""} className="max-h-[70vh] w-full object-contain" />}
            {photos.length > 1 && (
              <>
                <Button size="icon" variant="secondary" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full opacity-90"><ChevronLeft className="h-5 w-5" /></Button>
                <Button size="icon" variant="secondary" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full opacity-90"><ChevronRight className="h-5 w-5" /></Button>
              </>
            )}
            <Button size="icon" variant="secondary" onClick={onClose} className="absolute right-3 top-3 rounded-full opacity-90 md:hidden"><X className="h-5 w-5" /></Button>
          </div>
          <aside className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto border-l bg-card p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Photo</p>
              {photo.caption ? (
                <p className="mt-1 text-sm">{photo.caption}</p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground">No caption</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
              {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border bg-background p-3 text-sm">
                  <p className="text-xs font-medium">{n.guest_name}</p>
                  <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t pt-3">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Leave a note as ${guest.name}…`} rows={3} maxLength={2000} />
              <Button size="sm" className="w-full text-white" style={{ backgroundColor: TEAL }} onClick={submitNote} disabled={!body.trim()}>Add note</Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePage;
