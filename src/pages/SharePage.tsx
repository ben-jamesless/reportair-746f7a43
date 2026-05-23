import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, X, ChevronLeft, ChevronRight, ChevronDown, Download, Calendar, Layers, ImagePlus, MessageSquare, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { groupPhotosByDate } from "@/lib/photoUtils";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

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
// geo_lat and geo_lng are intentionally excluded — stripped at the DB layer
type ShareProject = {
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

import type { GuestNote as GuestNoteRow } from "@/lib/types";

// BuildSlides share-page design tokens — themed via CSS variables on root wrapper.
// Switch between light/dark by toggling --bg, --surface, --ink, --body, --muted, --border on the root.
const TEAL = "#c84b2f"; // BuildSlides red-orange accent (used as fallback when brand colour absent)
const NEAR_BLACK = "var(--ink)";
const BODY = "var(--body)";
const MUTED = "var(--muted)";
const DIVIDER = "var(--border)";
const SURFACE = "var(--surface-2)";

// Status meta — pill backgrounds & dot colors
const STATUS_META: Record<string, { label: string; bg: string }> = {
  on_track: { label: "On track", bg: "#437a22" },
  at_risk: { label: "Delayed", bg: "#d19900" },
  requires_discussion: { label: "Discuss", bg: "#d19900" },
  delayed: { label: "Delayed", bg: "#d19900" },
  concern: { label: "Delayed", bg: "#d19900" },
  behind_schedule: { label: "Delayed", bg: "#d19900" },
  complete: { label: "Complete", bg: "#006494" },
  no_status: { label: "No status", bg: "#9C9A93" },
};

// Fixed 6-colour palette for area dots
const AREA_PALETTE = ["#437a22", "#006494", "#da7101", "#7a39bb", "#01696f", "#a13544"];
const colourForArea = (id: string, idx: number) => AREA_PALETTE[idx % AREA_PALETTE.length];

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
  const isMobile = useIsMobile();
  const [data, setData] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<string>(ALL_DAYS); // ALL_DAYS | dateKey | __album_<id>
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [guest, setGuest] = useState<{ name: string; email: string }>({ name: "", email: "" });
  
  const [feedback, setFeedback] = useState<GuestNoteRow[]>([]);
  const [weather, setWeather] = useState<Record<string, { tmin: number; tmax: number; condition: string; wind: number }>>({});
  const [brandColour, setBrandColour] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [dark, setDark] = useState(false); // Per-session only — preference NOT persisted
  const accent = brandColour ?? TEAL;

  // Load Inter font once
  useEffect(() => {
    if (document.getElementById("share-inter-font")) return;
    const l = document.createElement("link");
    l.id = "share-inter-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    if (!token) return;
    const stored = localStorage.getItem(guestKey(token));
    if (stored) try { setGuest(JSON.parse(stored)); } catch { /* ignore */ }
    resolve(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resolve = async (pwd: string | null) => {
    if (lockedUntil && Date.now() < lockedUntil) return;
    setLoading(true);
    const { data: res, error } = await supabase.rpc("resolve_share_link", { _token: token, _password: pwd });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const r = res as unknown as Resolved;
    if (!r.ok) {
      if (r.error === "password_required") { setNeedPassword(true); return; }
      // Server-side rate limit hit — lock the UI for 10 minutes to match server window.
      if (r.error === "rate_limited") {
        setLockedUntil(Date.now() + 10 * 60 * 1000);
        setAttempts(0);
        setData(r);
        return;
      }
      // Treat any non-ok response when a password was supplied as a wrong-password attempt.
      if (pwd) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockedUntil(Date.now() + 60 * 1000);
          setAttempts(0);
        }
      }
      setData(r);
      return;
    }
    setNeedPassword(false);
    setAttempts(0);
    setLockedUntil(null);
    setData(r);
    if (r.project?.name) {
      document.title = `${r.project.name} — BuildSlides`;
    }
    // Fetch the team's brand colour for the share page accent.
    try {
      const { data: bc } = await supabase.rpc("get_share_brand_colour", { _token: token });
      if (typeof bc === "string" && /^#[0-9a-fA-F]{6}$/.test(bc)) setBrandColour(bc);
      else setBrandColour(null);
    } catch { /* silent — fall back to default accent */ }
    // Fetch project logo (signed URL via edge function so the private bucket stays private).
    try {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-logo-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const j = await res.json();
        setLogoUrl(typeof j?.url === "string" ? j.url : null);
      } else {
        setLogoUrl(null);
      }
    } catch { setLogoUrl(null); }
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

  // ============ Share-side PDF export (portrait only) ============
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"single" | "range">("single");
  const [exportFrom, setExportFrom] = useState<string | null>(null);
  const [exportTo, setExportTo] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "creating" | "processing" | "ready" | "failed">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  // Days available for export: derived from photos grouped by date.
  const exportDaysAsc = useMemo(
    () =>
      [...allDayGroups]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((g) => ({ key: isoDateKey(g.date), label: DATE_FMT.format(g.date), date: g.date })),
    [allDayGroups],
  );
  const lastDay = exportDaysAsc[exportDaysAsc.length - 1] ?? null;

  // Seed range pickers when dialog opens
  useEffect(() => {
    if (!exportOpen) return;
    if (exportDaysAsc.length > 0) {
      setExportFrom(exportDaysAsc[0].key);
      setExportTo(exportDaysAsc[exportDaysAsc.length - 1].key);
    }
    setExportStatus("idle");
    setExportError(null);
    setExportMode("single");
  }, [exportOpen, exportDaysAsc]);

  const downloadFromUrl = async (url: string, filename = "site-story.pdf") => {
    const fileRes = await fetch(url);
    if (!fileRes.ok) throw new Error(`http ${fileRes.status}`);
    const blob = await fileRes.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.rel = "noopener"; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const runShareExport = async () => {
    if (!token) return;
    if (exportMode === "range" && (!exportFrom || !exportTo)) {
      toast.error("Pick a from and to date");
      return;
    }
    if (exportMode === "single" && !lastDay) {
      toast.error("No dated photos to export");
      return;
    }
    setExportStatus("creating");
    setExportError(null);
    try {
      const body: Record<string, unknown> = { token, mode: exportMode };
      if (exportMode === "single" && lastDay) {
        body.day_key = lastDay.key;
        body.day_label = lastDay.label;
      } else if (exportMode === "range" && exportFrom && exportTo) {
        const lo = exportFrom <= exportTo ? exportFrom : exportTo;
        const hi = exportFrom <= exportTo ? exportTo : exportFrom;
        body.date_from = lo;
        body.date_to = hi;
      }
      const createRes = await fetch(
        `https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-create-export`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.export_id) {
        throw new Error(createJson.error || "Could not start export");
      }
      const exportId: string = createJson.export_id;
      setExportStatus("processing");

      // Poll status
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500));
        const statusRes = await fetch(
          `https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-export-url`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, export_id: exportId }) },
        );
        const sj = await statusRes.json();
        if (sj.status === "ready" && sj.url) {
          setExportStatus("ready");
          await downloadFromUrl(sj.url);
          setExportOpen(false);
          return;
        }
        if (sj.status === "failed") {
          throw new Error(sj.error_message || "Export failed");
        }
      }
      throw new Error("Export timed out");
    } catch (e) {
      setExportStatus("failed");
      setExportError(e instanceof Error ? e.message : "Export failed");
      toast.error(e instanceof Error ? e.message : "Export failed");
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
      <div className="flex min-h-screen items-center justify-center bg-card p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6">
            <div className="text-center">
              <Lock className="mx-auto h-8 w-8" style={{ color: MUTED }} />
              <h1 className="mt-2 text-lg font-semibold" style={{ color: NEAR_BLACK }}>Password required</h1>
              <p className="text-sm" style={{ color: MUTED }}>Enter the password to view this gallery.</p>
            </div>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button
              className="w-full text-white"
              style={{ backgroundColor: accent }}
              onClick={() => resolve(password)}
              disabled={!!(lockedUntil && Date.now() < lockedUntil)}
            >
              Unlock
            </Button>
            {lockedUntil && Date.now() < lockedUntil && (
              <p className="text-center text-sm" style={{ color: "#FF3B30" }}>
                Too many attempts — please try again later
              </p>
            )}
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
      <div className="flex min-h-screen items-center justify-center bg-card p-4">
        <Card className="max-w-md"><CardContent className="pt-6 text-center"><p className="text-sm" style={{ color: MUTED }}>{msg}</p></CardContent></Card>
      </div>
    );
  }




  const overallStatus = project?.overall_status ?? null;
  const subtitleBits = [project?.client_name, project?.event_location, project?.event_type].filter(Boolean) as string[];
  

  // Latest day header data
  const latestDayPhotos = latestDayKey ? (allDayGroups[0]?.photos ?? []) : [];
  const latestDayAreaIds = Array.from(new Set(latestDayPhotos.map((p) => p.area_id).filter(Boolean) as string[]));

  const latestUpdatePanel = (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: DIVIDER, backgroundColor: SURFACE }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        Latest update
      </p>
      {latestDayKey ? (() => {
        const dn = dayNoteByDate.get(latestDayKey);
        const sections: { label: string; text: string | null | undefined }[] = [
          { label: "Today's objectives", text: dn?.today_objectives },
          { label: "Today's achievements", text: dn?.today_achievements },
          { label: "Tomorrow's objectives", text: dn?.tomorrow_objectives },
          { label: "Open issues", text: dn?.open_issues },
        ];
        const hasAny = sections.some((s) => s.text && s.text.trim());
        return (
          <>
            <p className="mt-2 text-lg font-bold" style={{ color: NEAR_BLACK }}>
              {DATE_FMT.format(allDayGroups[0].date)}
            </p>
            <div className="mt-2">
              <StatusPill statusKey={overallStatus} />
            </div>
            {weather[latestDayKey] && (
              <p className="mt-3 text-xs" style={{ color: MUTED }}>
                {weather[latestDayKey].tmin}°C – {weather[latestDayKey].tmax}°C · {weather[latestDayKey].condition} · {weather[latestDayKey].wind} km/h wind
              </p>
            )}
            {hasAny ? (
              <ul className="mt-5 space-y-5">
                {sections.map((s) => {
                  if (!s.text || !s.text.trim()) return null;
                  return (
                    <li key={s.label}>
                      <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: MUTED }}
                      >
                        {s.label}
                      </p>
                      <div className="mt-1.5 text-base leading-relaxed" style={{ color: BODY }}>
                        <RichNotes text={s.text} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm italic" style={{ color: MUTED }}>
                No daily summary yet.
              </p>
            )}
          </>
        );
      })() : (
        <p className="mt-2 text-sm italic" style={{ color: MUTED }}>No updates yet.</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#ffffff", color: BODY }}>
      {/* HEADER */}
      <header className="border-b" style={{ borderColor: DIVIDER, backgroundColor: "#ffffff" }}>
        <div className="mx-auto w-full px-6 py-6 2xl:px-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={project?.name ?? "Project logo"}
                  className="h-10 w-auto max-w-[280px] object-contain md:h-12"
                />
              ) : (
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: NEAR_BLACK }}>
                  {project?.name}
                </h1>
              )}
              {subtitleBits.length > 0 && (
                <p className="mt-1.5 text-sm" style={{ color: MUTED }}>
                  {subtitleBits.join(" · ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusPill statusKey={overallStatus} size="md" />
              {exportDaysAsc.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  className="text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* EXPORT PDF DIALOG */}
      <Dialog open={exportOpen} onOpenChange={(o) => { if (exportStatus === "creating" || exportStatus === "processing") return; setExportOpen(o); }}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: NEAR_BLACK }}>Export PDF</h2>
              <p className="text-sm" style={{ color: MUTED }}>Generate a portrait PDF report of this project.</p>
            </div>

            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-md p-1" style={{ backgroundColor: SURFACE }}>
              <button
                type="button"
                onClick={() => setExportMode("single")}
                disabled={exportStatus === "creating" || exportStatus === "processing"}
                className={cn("rounded px-3 py-2 text-sm font-medium transition", exportMode === "single" ? "bg-white shadow" : "")}
                style={{ color: exportMode === "single" ? NEAR_BLACK : MUTED }}
              >
                Last day
              </button>
              <button
                type="button"
                onClick={() => setExportMode("range")}
                disabled={exportStatus === "creating" || exportStatus === "processing"}
                className={cn("rounded px-3 py-2 text-sm font-medium transition", exportMode === "range" ? "bg-white shadow" : "")}
                style={{ color: exportMode === "range" ? NEAR_BLACK : MUTED }}
              >
                Select a range
              </button>
            </div>

            {exportMode === "single" ? (
              <div className="rounded-md border p-3 text-sm" style={{ borderColor: DIVIDER, backgroundColor: SURFACE, color: BODY }}>
                <Calendar className="mr-2 inline h-4 w-4" style={{ color: accent }} />
                {lastDay ? <>Scoped to <span className="font-medium">{lastDay.label}</span></> : "No dated photos yet"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: MUTED }}>From</Label>
                  <Input
                    type="date"
                    value={exportFrom ?? ""}
                    min={exportDaysAsc[0]?.key}
                    max={exportTo ?? exportDaysAsc[exportDaysAsc.length - 1]?.key}
                    onChange={(e) => setExportFrom(e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: MUTED }}>To</Label>
                  <Input
                    type="date"
                    value={exportTo ?? ""}
                    min={exportFrom ?? exportDaysAsc[0]?.key}
                    max={exportDaysAsc[exportDaysAsc.length - 1]?.key}
                    onChange={(e) => setExportTo(e.target.value || null)}
                  />
                </div>
              </div>
            )}

            {exportError && (
              <p className="text-sm" style={{ color: "#C7382A" }}>{exportError}</p>
            )}

            <Button
              onClick={runShareExport}
              disabled={exportStatus === "creating" || exportStatus === "processing"}
              className="w-full text-white hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {(exportStatus === "creating" || exportStatus === "processing") ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{exportStatus === "creating" ? "Starting…" : "Generating PDF…"}</>
              ) : (
                <><Download className="mr-2 h-4 w-4" />Generate PDF</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* THREE-COLUMN LAYOUT */}
      <div className="mx-auto w-full px-6 py-6 2xl:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,4fr)_minmax(0,3fr)]">
          {/* LEFT: Date navigation */}
          <aside className="hidden lg:block space-y-1">
            <button
              onClick={() => setActiveKey(ALL_DAYS)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
              )}
              style={
                activeKey === ALL_DAYS
                  ? { backgroundColor: accent, color: "#ffffff" }
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
                  style={active ? { backgroundColor: accent, color: "#ffffff" } : { color: BODY }}
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
                      style={active ? { backgroundColor: accent, color: "#ffffff" } : { color: BODY }}
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
                      style={active ? { backgroundColor: accent, color: "#ffffff" } : { color: BODY }}
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

            {/* MOBILE: collapsible latest update */}
            <details className="group mb-4 rounded-xl border xl:hidden" style={{ borderColor: DIVIDER, backgroundColor: SURFACE }}>
              <summary
                className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold"
                style={{ color: NEAR_BLACK }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    Latest update
                  </span>
                  {latestDayKey && (
                    <span style={{ color: NEAR_BLACK }}>· {SHORT_FMT.format(allDayGroups[0].date)}</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" style={{ color: MUTED }} />
              </summary>
              <div className="px-2 pb-2">
                {latestUpdatePanel}
              </div>
            </details>

            {visibleGroups.length === 0 ? (
              <div
                className="rounded-xl border p-12 text-center text-sm"
                style={{ borderColor: DIVIDER, backgroundColor: SURFACE, color: MUTED }}
              >
                No photos have been added for this date yet.
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
                    <details
                      key={group.key}
                      ref={(el) => {
                        dayAnchorRefs.current.set(dateKey, el);
                        if (el && !isMobile && el.dataset.init !== "1") {
                          el.open = true;
                          el.dataset.init = "1";
                        }
                      }}
                      className="group/day"
                    >
                      {/* Day header strip — full width, flush; collapsible at all breakpoints */}
                      <summary
                        className="sticky top-0 z-20 flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 list-none [&::-webkit-details-marker]:hidden"
                        style={{
                          backgroundColor: "#ffffff",
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
                        <div className="flex items-center gap-2">
                          {dominantDayStatus && <StatusPill statusKey={dominantDayStatus} />}
                          <ChevronDown
                            className="h-4 w-4 transition-transform group-open/day:rotate-180"
                            style={{ color: MUTED }}
                          />
                        </div>
                      </summary>
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
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: Latest Update + Feedback */}
          <aside className="hidden xl:block">
            <div className="sticky top-6 space-y-4">
              {latestUpdatePanel}

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
    <div className="flex min-h-screen items-center justify-center bg-card p-4">
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
  // Promote inline " * x" / " - x" runs to their own lines so bullets render
  // properly even when the source text was flattened during paste/sync.
  const normalised = (text || "").replace(/([^\n])\s+(?=[*\-]\s+\S)/g, "$1\n");
  const lines = normalised.split("\n");
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
  const [guestName, setGuestName] = useState(guest.name);

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
    if (!body.trim() || !guestName.trim()) return;
    const { error } = await supabase.rpc("add_guest_note_public", {
      _token: token, _photo_id: photo.id, _name: guestName.trim(), _email: guest.email, _body: body.trim(),
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
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" maxLength={80} />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a note…" rows={3} maxLength={2000} />
              <Button size="sm" className="w-full text-white" style={{ backgroundColor: TEAL }} onClick={submitNote} disabled={!body.trim() || !guestName.trim()}>Add note</Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePage;
