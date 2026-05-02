import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MapPinned, Lock, X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { groupPhotosByDate } from "@/lib/photoUtils";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type SharePhoto = {
  id: string; storage_path: string; file_name: string; caption: string | null;
  captured_at: string | null; created_at: string;
  album_id: string | null; area_id: string | null;
};
type Album = { id: string; name: string; position: number };
type Area = { id: string; name: string; sort_order: number };
type DayNote = { date: string; notes: string | null };
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

// Status pill spec: rounded-full px-2 py-0.5 text-xs font-semibold text-white,
// background = status colour. Null/missing → render nothing.
const STATUS_META: Record<string, { label: string; bg: string }> = {
  on_track: { label: "On Track", bg: "#16a34a" },
  at_risk: { label: "At Risk", bg: "#d97706" },
  requires_discussion: { label: "Requires Discussion", bg: "#d97706" },
  delayed: { label: "Delayed", bg: "#dc2626" },
  complete: { label: "Complete", bg: "#01696F" },
  // Legacy values map to closest equivalents:
  concern: { label: "Delayed", bg: "#dc2626" },
  behind_schedule: { label: "Delayed", bg: "#dc2626" },
};

const StatusPill = ({ statusKey }: { statusKey: string | null | undefined }) => {
  if (!statusKey) return null;
  const meta = STATUS_META[statusKey];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
};

const isoDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ALL = "__all__";
const ALL_AREAS = "__all_areas__";
const NO_AREA = "__no_area__";

const guestKey = (token: string) => `guest_identity_${token}`;

const SharePage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<string>(ALL);
  const [activeArea, setActiveArea] = useState<string>(ALL_AREAS);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [guest, setGuest] = useState<{ name: string; email: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  const photos = useMemo(() => data?.photos ?? [], [data?.photos]);
  const albums = useMemo(() => data?.albums ?? [], [data?.albums]);
  const areas = useMemo(() => data?.areas ?? [], [data?.areas]);
  const project = data?.project;
  const accentColor = project?.color || "#01696F";
  const dayNotesMap = useMemo(() => {
    const m = new Map<string, string>();
    (data?.day_notes ?? []).forEach((d) => { if (d.notes && d.notes.trim()) m.set(d.date, d.notes); });
    return m;
  }, [data?.day_notes]);
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
  const activeAreaObj = useMemo(
    () => (activeArea !== ALL_AREAS && activeArea !== NO_AREA ? areas.find((a) => a.id === activeArea) ?? null : null),
    [areas, activeArea]
  );

  const albumFiltered = useMemo(() => {
    if (activeAlbum === ALL) return photos;
    return photos.filter((p) => p.album_id === activeAlbum);
  }, [photos, activeAlbum]);
  const visiblePhotos = useMemo(() => {
    if (activeArea === ALL_AREAS) return albumFiltered;
    if (activeArea === NO_AREA) return albumFiltered.filter((p) => !p.area_id);
    return albumFiltered.filter((p) => p.area_id === activeArea);
  }, [albumFiltered, activeArea]);
  const grouped = useMemo(() => groupPhotosByDate(visiblePhotos), [visiblePhotos]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>(); visiblePhotos.forEach((p, i) => m.set(p.id, i)); return m;
  }, [visiblePhotos]);

  // Coverage: % of distinct project days that have a photo in each area
  const coverage = useMemo(() => {
    const allDayKeys = new Set<string>();
    photos.forEach((p) => {
      const raw = p.captured_at || p.created_at;
      try { allDayKeys.add(isoDateKey(new Date(raw))); } catch { /* skip */ }
    });
    const totalDays = allDayKeys.size;
    const rows = areas.map((a) => {
      const photosInArea = photos.filter((p) => p.area_id === a.id);
      const dayKeys = new Set<string>();
      photosInArea.forEach((p) => {
        const raw = p.captured_at || p.created_at;
        try { dayKeys.add(isoDateKey(new Date(raw))); } catch { /* skip */ }
      });
      const pct = totalDays > 0 ? Math.round((dayKeys.size / totalDays) * 100) : 0;
      return { id: a.id, name: a.name, photoCount: photosInArea.length, pct };
    });
    const areasWithAny = rows.filter((r) => r.photoCount > 0).length;
    const overallPct = areas.length > 0 ? Math.round((areasWithAny / areas.length) * 100) : 0;
    return { rows, totalDays, overallPct, totalPhotos: photos.length, totalAreas: areas.length };
  }, [photos, areas]);

  const lastUpdated = useMemo(() => {
    if (photos.length === 0) return null;
    let max = 0;
    for (const p of photos) {
      const t = new Date(p.created_at).getTime();
      if (t > max) max = t;
    }
    return max ? new Date(max) : null;
  }, [photos]);

  // Latest area-day status per area (most recent date) — must stay above early returns.
  const latestAreaStatus = useMemo(() => {
    const m = new Map<string, string>();
    const latestDate = new Map<string, string>();
    (data?.area_day_status ?? []).forEach((s) => {
      const prev = latestDate.get(s.area_id);
      if (!prev || s.date > prev) {
        latestDate.set(s.area_id, s.date);
        m.set(s.area_id, s.status);
      }
    });
    return m;
  }, [data?.area_day_status]);

  // Most recent area-day note for the active area (across all dates)
  const activeAreaLatestNote = useMemo(() => {
    if (!activeAreaObj) return null;
    let bestDate = "";
    let bestNote: string | null = null;
    (data?.area_day_notes ?? []).forEach((n) => {
      if (n.area_id !== activeAreaObj.id) return;
      if (!n.notes || !n.notes.trim()) return;
      if (n.date > bestDate) { bestDate = n.date; bestNote = n.notes; }
    });
    return bestNote;
  }, [data?.area_day_notes, activeAreaObj]);

  const downloadLatestReport = async () => {
    if (!token || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-export-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        toast.error("Could not get download link");
        return;
      }
      const a = document.createElement("a");
      a.href = json.url; a.rel = "noopener"; a.target = "_self";
      a.download = "site-story.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !data) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (needPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6">
            <div className="text-center">
              <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
              <h1 className="mt-2 text-lg font-semibold">Password required</h1>
              <p className="text-sm text-muted-foreground">Enter the password to view this gallery.</p>
            </div>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button className="w-full" onClick={() => resolve(password)}>Unlock</Button>
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md"><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">{msg}</p></CardContent></Card>
      </div>
    );
  }

  if (!guest) {
    return <GuestIdentityPrompt onSubmit={(g) => { localStorage.setItem(guestKey(token!), JSON.stringify(g)); setGuest(g); }} />;
  }

  const status = project?.overall_status ?? null;

  // Subtitle per spec: client · location · event_type
  const subtitleBits = [project?.client_name, project?.event_location, project?.event_type].filter(Boolean) as string[];

  const hasLatestExport = !!data?.latest_export;

  // Coverage helpers for new section
  const areasCovered = coverage.rows.filter((r) => r.photoCount > 0).length;
  // Latest area-day status per area (most recent date)
  const latestAreaStatus = useMemo(() => {
    const m = new Map<string, string>();
    const latestDate = new Map<string, string>();
    (data?.area_day_status ?? []).forEach((s) => {
      const prev = latestDate.get(s.area_id);
      if (!prev || s.date > prev) {
        latestDate.set(s.area_id, s.date);
        m.set(s.area_id, s.status);
      }
    });
    return m;
  }, [data?.area_day_status]);

  // Most recent area-day note for the active area (across all dates)
  const activeAreaLatestNote = useMemo(() => {
    if (!activeAreaObj) return null;
    let bestDate = "";
    let bestNote: string | null = null;
    (data?.area_day_notes ?? []).forEach((n) => {
      if (n.area_id !== activeAreaObj.id) return;
      if (!n.notes || !n.notes.trim()) return;
      if (n.date > bestDate) { bestDate = n.date; bestNote = n.notes; }
    });
    return bestNote;
  }, [data?.area_day_notes, activeAreaObj]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Top accent strip */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
      <header className="border-b bg-background">
        <div className="container py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Left: logo or project name */}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: accentColor }}>
                {project?.name}
              </h1>
            </div>
            {/* Right: status + download */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center md:items-center">
              <StatusPill statusKey={status} />
              {hasLatestExport && (
                <Button
                  size="sm"
                  onClick={downloadLatestReport}
                  disabled={downloading}
                  className="w-full text-sm font-medium text-white sm:w-auto"
                  style={{ backgroundColor: accentColor }}
                >
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download latest report
                </Button>
              )}
            </div>
          </div>
          {subtitleBits.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {subtitleBits.join(" · ")}
            </p>
          )}
          <div className="mt-4 border-t" />
          <p className="mt-3 text-xs text-muted-foreground">
            Viewing as <span className="font-medium text-foreground">{guest.name}</span>
          </p>
        </div>
      </header>

      <main className="container py-8">
        {project?.description && <p className="mb-6 max-w-2xl text-muted-foreground">{project.description}</p>}

        {/* Coverage section — hide on default Event Gallery view */}
        {areas.length > 0 && activeAlbum !== ALL && (
          <section className="mb-8 rounded-lg border bg-background p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-base font-bold">Site Coverage</h2>
              <span className="text-xs text-muted-foreground sm:text-sm">
                {areasCovered} of {coverage.totalAreas} area{coverage.totalAreas === 1 ? "" : "s"} covered · {coverage.totalPhotos} photo{coverage.totalPhotos === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-3">
              {coverage.rows.map((r) => {
                const sKey = latestAreaStatus.get(r.id);
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[1fr_2fr_auto] sm:gap-3"
                  >
                    <span className="truncate font-medium">{r.name}</span>
                    <div className="relative h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#e5e7eb" }}>
                      <div
                        className="h-full transition-all"
                        style={{ width: `${r.pct}%`, backgroundColor: accentColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      {r.photoCount === 0 ? (
                        <span className="text-xs italic text-muted-foreground">No photos yet</span>
                      ) : (
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {r.photoCount} photo{r.photoCount === 1 ? "" : "s"}
                        </span>
                      )}
                      <StatusPill statusKey={sKey} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Tabs value={activeAlbum} onValueChange={setActiveAlbum} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value={ALL} className="data-[state=active]:bg-secondary">Event Gallery <span className="ml-2 text-xs text-muted-foreground">{photos.length}</span></TabsTrigger>
            {albums.map((a) => (
              <TabsTrigger key={a.id} value={a.id} className="data-[state=active]:bg-secondary">
                {a.name} <span className="ml-2 text-xs text-muted-foreground">{photos.filter((p) => p.album_id === a.id).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeAlbum} className="mt-6">
            {areas.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><MapPinned className="h-3 w-3" /> Area</span>
                <AreaChip active={activeArea === ALL_AREAS} onClick={() => setActiveArea(ALL_AREAS)} label="All" count={albumFiltered.length} />
                {areas.map((ar) => (
                  <AreaChip key={ar.id} active={activeArea === ar.id} onClick={() => setActiveArea(ar.id)} label={ar.name} count={albumFiltered.filter((p) => p.area_id === ar.id).length} />
                ))}
              </div>
            )}

            <div className={cn("grid gap-6", activeAreaObj ? "lg:grid-cols-[1fr_20%]" : "grid-cols-1")}>
              <div className="min-w-0">
                {grouped.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">No photos in this view.</p>
                ) : (
                  <div className="space-y-8">
                    {grouped.map((group) => {
                      const dateKey = isoDateKey(group.date);
                      const dayNote = dayNotesMap.get(dateKey);
                      const statusKey = activeAreaObj ? statusMap.get(`${activeAreaObj.id}|${dateKey}`) : undefined;
                      const areaDayNote = activeAreaObj ? areaDayNotesMap.get(`${activeAreaObj.id}|${dateKey}`) : undefined;
                      return (
                        <section key={group.key}>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium text-foreground">
                              {group.label}{" "}
                              <span className="text-muted-foreground/70">· {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}</span>
                            </h3>
                            {activeAreaObj && statusKey && (
                              <StatusPill statusKey={statusKey} />
                            )}
                          </div>
                          {dayNote && (
                            <div className="mb-3 rounded-md border border-border bg-background p-3 text-sm">
                              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Day comment</p>
                              <RichNotes text={dayNote} />
                            </div>
                          )}
                          {areaDayNote && (
                            <div className="mb-3 rounded-md border border-border bg-background p-3 text-sm">
                              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Daily updates</p>
                              <RichNotes text={areaDayNote} />
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
                            {group.photos.map((p) => (
                              <SharePhotoThumb key={p.id} token={token!} photo={p} onClick={() => setLightboxIndex(indexById.get(p.id) ?? 0)} />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {lastUpdated && (
                  <p className="mt-8 text-center text-xs text-muted-foreground">
                    Last updated {lastUpdated.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>

              {/* Area context panel — only when a specific area is selected */}
              {activeAreaObj && (
                <aside className="order-last space-y-3 rounded-lg border bg-background p-4 text-sm lg:sticky lg:top-4 lg:self-start">
                  <p className="font-bold">{activeAreaObj.name}</p>
                  {(() => {
                    const sKey = latestAreaStatus.get(activeAreaObj.id);
                    return sKey ? <StatusPill statusKey={sKey} /> : null;
                  })()}
                  <div className="border-t" />
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Latest update</p>
                    {activeAreaLatestNote ? (
                      <RichNotes text={activeAreaLatestNote} />
                    ) : (
                      <p className="italic text-muted-foreground">No notes for this area</p>
                    )}
                  </div>
                  {(() => {
                    const captions = visiblePhotos
                      .map((p) => p.caption?.trim())
                      .filter((c): c is string => !!c);
                    if (captions.length === 0) return null;
                    return (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Captions</p>
                        <ul className="space-y-1">
                          {captions.map((c, i) => (
                            <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{c}</span></li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </aside>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {lightboxIndex !== null && (
          <ShareLightbox
            token={token!}
            photos={visiblePhotos}
            index={lightboxIndex}
            guest={guest}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        )}
      </main>
    </div>
  );
};

const AreaChip = ({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) => (
  <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-secondary")}>
    {label} <span className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
  </button>
);

const GuestIdentityPrompt = ({ onSubmit }: { onSubmit: (g: { name: string; email: string }) => void }) => {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-lg font-semibold">Welcome</h1>
            <p className="text-sm text-muted-foreground">Tell us who you are so the team knows whose notes are whose.</p>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <Button className="w-full" disabled={!name.trim() || !email.trim()} onClick={() => onSubmit({ name: name.trim(), email: email.trim() })}>Continue</Button>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Lightweight markdown-ish renderer for share-page notes ---
const renderInline = (line: string, keyPrefix: string) => {
  // Handle **bold** and *italic*
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
          return <p key={idx} className="mt-2 text-sm font-bold">{renderInline(line.slice(2), `h-${idx}`)}</p>;
        }
        const bulletStripped = line.startsWith("- ") || line.startsWith("* ") ? line.slice(2) : line;
        return (
          <p key={idx} className="flex gap-2">
            <span aria-hidden className="select-none text-muted-foreground">•</span>
            <span className="min-w-0">{renderInline(bulletStripped, `l-${idx}`)}</span>
          </p>
        );
      })}
    </div>
  );
};

const SharePhotoThumb = ({ token, photo, onClick }: { token: string; photo: SharePhoto; onClick: () => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-photo-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photo_id: photo.id }),
      });
      const json = await res.json();
      if (alive && json.url) setUrl(json.url);
    })();
    return () => { alive = false; };
  }, [token, photo.id]);
  return (
    <button onClick={onClick} className="group relative aspect-[4/3] w-full overflow-hidden rounded-sm" title={photo.caption || undefined}>
      {url ? <img src={url} alt={photo.caption || ""} className="h-full w-full object-cover" loading="lazy" /> : null}
      {photo.caption && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {photo.caption}
        </span>
      )}
    </button>
  );
};

const ShareLightbox = ({ token, photos, index, guest, onClose, onIndexChange }: {
  token: string; photos: SharePhoto[]; index: number; guest: { name: string; email: string };
  onClose: () => void; onIndexChange: (i: number) => void;
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
    setBody(""); loadNotes(); toast.success("Note added");
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
              <Button size="sm" className="w-full" onClick={submitNote} disabled={!body.trim()}>Add note</Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePage;
