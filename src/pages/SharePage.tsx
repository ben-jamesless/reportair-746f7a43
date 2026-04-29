import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MapPinned, Lock, X, ChevronLeft, ChevronRight } from "lucide-react";
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
type Area = { id: string; name: string; sort_order: number; notes: string | null };
type DayNote = { date: string; notes: string | null };
type AreaDayStatus = { area_id: string; date: string; status: string };
type Resolved = {
  ok: boolean;
  error?: string;
  share_link_id?: string;
  project?: { id: string; name: string; description: string | null };
  albums?: Album[];
  areas?: Area[];
  day_notes?: DayNote[];
  area_day_status?: AreaDayStatus[];
  photos?: SharePhoto[];
};

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  on_track: { label: "On Track", dot: "bg-blue-500", chip: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  requires_discussion: { label: "Requires Discussion", dot: "bg-orange-500", chip: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  concern: { label: "Concern / Behind Schedule", dot: "bg-red-500", chip: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
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

  const photos = data?.photos ?? [];
  const albums = data?.albums ?? [];
  const areas = data?.areas ?? [];
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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared gallery</p>
            <h1 className="text-2xl font-semibold">{data?.project?.name}</h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Viewing as</p>
            <p className="font-medium text-foreground">{guest.name}</p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {data?.project?.description && <p className="mb-6 max-w-2xl text-muted-foreground">{data.project.description}</p>}

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

            {grouped.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No photos in this view.</p>
            ) : (
              <div className="space-y-8">
                {grouped.map((group) => {
                  const dateKey = isoDateKey(group.date);
                  const dayNote = dayNotesMap.get(dateKey);
                  const statusKey = activeAreaObj ? statusMap.get(`${activeAreaObj.id}|${dateKey}`) : undefined;
                  const statusMeta = statusKey ? STATUS_META[statusKey] : undefined;
                  return (
                    <section key={group.key}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">
                          {group.label}{" "}
                          <span className="text-muted-foreground/70">· {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}</span>
                        </h3>
                      </div>
                      {dayNote && (
                        <div className="mb-3 rounded-md border border-border bg-background p-3 text-sm">
                          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Day comment</p>
                          <p className="whitespace-pre-wrap">{dayNote}</p>
                        </div>
                      )}
                      {activeAreaObj && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{activeAreaObj.name}</span>
                          {statusMeta && (
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs", statusMeta.chip)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                              {statusMeta.label}
                            </span>
                          )}
                        </div>
                      )}
                      {activeAreaObj?.notes && activeAreaObj.notes.trim() && (
                        <div className="mb-3 rounded-md border border-border bg-background p-3 text-sm">
                          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Area comment</p>
                          <p className="whitespace-pre-wrap">{activeAreaObj.notes}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {group.photos.map((p) => (
                          <SharePhotoThumb key={p.id} token={token!} photo={p} onClick={() => setLightboxIndex(indexById.get(p.id) ?? 0)} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
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
    <button onClick={onClick} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
      {url ? <img src={url} alt={photo.caption || photo.file_name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /> : null}
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

  useEffect(() => {
    if (!photo) return;
    setUrl(null); setBody("");
    (async () => {
      const res = await fetch(`https://asasikikrapixgznhmzl.supabase.co/functions/v1/share-photo-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photo_id: photo.id }),
      });
      const json = await res.json();
      if (json.url) setUrl(json.url);
    })();
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  const loadNotes = async () => {
    if (!photo) return;
    const { data } = await supabase.rpc("list_guest_notes_public", { _token: token, _photo_id: photo.id });
    setNotes((data ?? []) as any);
  };

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
            {url && <img src={url} alt={photo.caption || photo.file_name} className="max-h-[70vh] w-full object-contain" />}
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
              <h3 className="mt-1 break-all text-sm font-semibold">{photo.file_name}</h3>
              {photo.caption && <p className="mt-2 text-sm">{photo.caption}</p>}
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
