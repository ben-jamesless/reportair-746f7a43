import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageSquare, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

type GuestNote = {
  id: string;
  photo_id: string;
  guest_name: string;
  guest_email: string | null;
  body: string;
  created_at: string;
};

type InternalComment = {
  id: string;
  photo_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

type PhotoLite = { id: string; storage_path: string; file_name: string };

interface Props {
  projectId: string;
  visiblePhotos: PhotoLite[];
  allPhotos: PhotoLite[];
  onOpenPhoto: (photoId: string) => void;
  className?: string;
}

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Tab = "all" | "client" | "internal";

export const FeedbackPanel = ({ projectId, visiblePhotos, allPhotos, onOpenPhoto, className }: Props) => {
  const storageKey = `feedback-tab-${projectId}`;
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "all";
    const v = window.localStorage.getItem(storageKey);
    return v === "client" || v === "internal" || v === "all" ? v : "all";
  });
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, tab); } catch { /* noop */ }
  }, [tab, storageKey]);

  const [guestNotes, setGuestNotes] = useState<GuestNote[]>([]);
  const [internalComments, setInternalComments] = useState<InternalComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: gn }, { data: cm }] = await Promise.all([
      supabase
        .from("guest_notes")
        .select("id, photo_id, guest_name, guest_email, body, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("comments")
        .select("id, photo_id, author_id, body, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setGuestNotes((gn ?? []) as GuestNote[]);

    const baseComments = (cm ?? []) as Omit<InternalComment, "author_name">[];
    const authorIds = Array.from(new Set(baseComments.map((c) => c.author_id))).filter(Boolean);
    let nameById = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      nameById = new Map((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Teammate"]));
    }
    setInternalComments(
      baseComments.map((c) => ({ ...c, author_name: nameById.get(c.author_id) ?? "Teammate" })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const photoById = useMemo(() => {
    const m = new Map<string, PhotoLite>();
    allPhotos.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPhotos]);

  type Entry = {
    id: string;
    kind: "client" | "internal";
    photo_id: string;
    author: string;
    body: string;
    created_at: string;
  };

  const allEntries: Entry[] = useMemo(() => {
    const fromClient: Entry[] = guestNotes.map((n) => ({
      id: `g-${n.id}`,
      kind: "client",
      photo_id: n.photo_id,
      author: n.guest_name,
      body: n.body,
      created_at: n.created_at,
    }));
    const fromInternal: Entry[] = internalComments.map((c) => ({
      id: `c-${c.id}`,
      kind: "internal",
      photo_id: c.photo_id,
      author: c.author_name ?? "Teammate",
      body: c.body,
      created_at: c.created_at,
    }));
    return [...fromClient, ...fromInternal].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [guestNotes, internalComments]);

  const clientEntries: Entry[] = useMemo(
    () =>
      guestNotes.map((n) => ({
        id: `g-${n.id}`,
        kind: "client",
        photo_id: n.photo_id,
        author: n.guest_name,
        body: n.body,
        created_at: n.created_at,
      })),
    [guestNotes],
  );

  const total =
    tab === "all" ? allEntries.length : tab === "client" ? clientEntries.length : internalComments.length;

  return (
    <aside className={cn("flex flex-col rounded-lg border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Feedback</h3>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} aria-label="Refresh feedback">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 py-3">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 px-2.5 text-xs">All</TabsTrigger>
            <TabsTrigger value="client" className="h-7 px-2.5 text-xs">Client</TabsTrigger>
            <TabsTrigger value="internal" className="h-7 px-2.5 text-xs">Internal</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <EntryList
            loading={loading}
            entries={allEntries}
            photoById={photoById}
            onOpenPhoto={onOpenPhoto}
            emptyText="No feedback yet."
          />
        </TabsContent>

        <TabsContent value="client" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <EntryList
            loading={loading}
            entries={clientEntries}
            photoById={photoById}
            onOpenPhoto={onOpenPhoto}
            emptyText="No client feedback yet."
          />
        </TabsContent>

        <TabsContent value="internal" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <EntryList
            loading={loading}
            entries={internalComments.map((c) => ({
              id: `c-${c.id}`,
              kind: "internal",
              photo_id: c.photo_id,
              author: c.author_name ?? "Teammate",
              body: c.body,
              created_at: c.created_at,
            }))}
            photoById={photoById}
            onOpenPhoto={onOpenPhoto}
            emptyText="No internal team comments yet."
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
};

const ChipKind = ({ kind }: { kind: "client" | "internal" }) => (
  <span
    className={cn(
      "ml-2 shrink-0 rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide",
      kind === "client"
        ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    )}
  >
    {kind === "client" ? "Client" : "Team"}
  </span>
);

const EntryList = ({
  loading,
  entries,
  photoById,
  onOpenPhoto,
  emptyText,
}: {
  loading: boolean;
  entries: Array<{ id: string; kind: "client" | "internal"; photo_id: string; author: string; body: string; created_at: string }>;
  photoById: Map<string, PhotoLite>;
  onOpenPhoto: (photoId: string) => void;
  emptyText: string;
}) => {
  if (loading && entries.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-muted-foreground">Loading…</p>;
  }
  if (entries.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {entries.map((e) => {
        const photo = photoById.get(e.photo_id);
        return (
          <li key={e.id}>
            <button
              onClick={() => onOpenPhoto(e.photo_id)}
              className="flex w-full gap-3 rounded-md border border-border bg-background p-2.5 text-left transition-colors hover:bg-secondary/50"
            >
              {photo ? <Thumb path={photo.storage_path} alt={photo.file_name} /> : <div className="h-10 w-10 shrink-0 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-xs font-medium">{e.author}</p>
                  <ChipKind kind={e.kind} />
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {TIME_FMT.format(new Date(e.created_at))}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs">{e.body}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const Thumb = ({ path, alt }: { path: string; alt: string }) => {
  const url = useSignedUrl(path);
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
      {url && <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />}
    </div>
  );
};
