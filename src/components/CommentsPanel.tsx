import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

export type GuestNote = {
  id: string;
  photo_id: string;
  guest_name: string;
  guest_email: string | null;
  body: string;
  created_at: string;
};

type PhotoLite = { id: string; storage_path: string; file_name: string };

interface Props {
  projectId: string;
  visiblePhotos: PhotoLite[];
  onOpenPhoto: (photoId: string) => void;
  className?: string;
}

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const CommentsPanel = ({ projectId, visiblePhotos, onOpenPhoto, className }: Props) => {
  const [notes, setNotes] = useState<GuestNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("guest_notes")
      .select("id, photo_id, guest_name, guest_email, body, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    setNotes((data ?? []) as GuestNote[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visibleIds = useMemo(() => new Set(visiblePhotos.map((p) => p.id)), [visiblePhotos]);
  const photoById = useMemo(() => {
    const m = new Map<string, PhotoLite>();
    visiblePhotos.forEach((p) => m.set(p.id, p));
    return m;
  }, [visiblePhotos]);

  const filtered = useMemo(
    () => notes.filter((n) => visibleIds.has(n.photo_id)),
    [notes, visibleIds]
  );

  return (
    <aside className={cn("flex flex-col rounded-lg border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Client comments</h3>
          <span className="text-xs text-muted-foreground">{filtered.length}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} aria-label="Refresh comments">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            No client comments yet for this view. Comments left on shared galleries will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((n) => {
              const photo = photoById.get(n.photo_id);
              if (!photo) return null;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => onOpenPhoto(n.photo_id)}
                    className="flex w-full gap-3 rounded-md border border-border bg-background p-2.5 text-left transition-colors hover:bg-secondary/50"
                  >
                    <CommentThumb path={photo.storage_path} alt={photo.file_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs font-medium">{n.guest_name}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {TIME_FMT.format(new Date(n.created_at))}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{photo.file_name}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs">{n.body}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};

const CommentThumb = ({ path, alt }: { path: string; alt: string }) => {
  const url = useSignedUrl(path);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
      {url && <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />}
    </div>
  );
};
