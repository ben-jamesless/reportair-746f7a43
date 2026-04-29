import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderPlus, FolderOpen, ImagePlus, Trash2, Activity, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ActivityFeedSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";

type EventMetadata = {
  name?: string;
  file_name?: string;
  guest_name?: string;
  body?: string;
  [key: string]: unknown;
};

type Event = {
  id: string;
  actor_id: string | null;
  verb: string;
  target_type: string;
  target_id: string | null;
  metadata: EventMetadata;
  created_at: string;
};

type GuestNoteRow = {
  id: string;
  photo_id: string;
  guest_name: string;
  body: string;
  created_at: string;
};

type ActorMap = Record<string, { full_name: string | null; avatar_url: string | null }>;

interface Props {
  projectId: string;
}

export const ActivityFeed = ({ projectId }: Props) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [actors, setActors] = useState<ActorMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: ev }, { data: notes }] = await Promise.all([
        supabase
          .from("activity_events")
          .select("id, actor_id, verb, target_type, target_id, metadata, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("guest_notes")
          .select("id, photo_id, guest_name, body, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (cancel) return;
      const evList = (ev ?? []) as Event[];
      const noteEvents: Event[] = ((notes ?? []) as GuestNoteRow[]).map((n) => ({
        id: `gn-${n.id}`,
        actor_id: null,
        verb: "guest.note",
        target_type: "photo",
        target_id: n.photo_id,
        metadata: { guest_name: n.guest_name, body: n.body },
        created_at: n.created_at,
      }));
      const merged = [...evList, ...noteEvents].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setEvents(merged);
      setLoading(false);

      const ids = Array.from(new Set(evList.map((e) => e.actor_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", ids);
        if (cancel) return;
        const map: ActorMap = {};
        for (const p of profs ?? []) map[p.id as string] = { full_name: p.full_name, avatar_url: p.avatar_url };
        setActors(map);
      }
    })();

    const channel = supabase
      .channel(`activity:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setEvents((prev) => [payload.new as Event, ...prev].slice(0, 200));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guest_notes", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const n = payload.new as GuestNoteRow;
          const ev: Event = {
            id: `gn-${n.id}`,
            actor_id: null,
            verb: "guest.note",
            target_type: "photo",
            target_id: n.photo_id,
            metadata: { guest_name: n.guest_name, body: n.body },
            created_at: n.created_at,
          };
          setEvents((prev) => [ev, ...prev].slice(0, 200));
        },
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (loading) {
    return <ActivityFeedSkeleton />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Activity className="h-5 w-5" />}
        title="No activity yet"
        description="Uploads, edits, and team actions will appear here as they happen."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((e) => {
        const isGuest = e.verb === "guest.note";
        const actor = isGuest
          ? (e.metadata?.guest_name ?? "A guest")
          : e.actor_id ? actors[e.actor_id]?.full_name ?? "Someone" : "Someone";
        return (
          <li key={e.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <VerbIcon verb={e.verb} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{actor}</span>{" "}
                <span className="text-muted-foreground">{describe(e)}</span>
              </p>
              {isGuest && e.metadata?.body && (
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm">
                  {e.metadata.body}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

function describe(e: Event): string {
  const m = e.metadata ?? {};
  switch (e.verb) {
    case "project.created":
      return `created the project${m.name ? ` "${m.name}"` : ""}`;
    case "album.created":
      return `created album${m.name ? ` "${m.name}"` : ""}`;
    case "photo.uploaded":
      return `uploaded ${m.file_name ?? "a photo"}`;
    case "photo.deleted":
      return `deleted ${m.file_name ?? "a photo"}`;
    case "guest.note":
      return "left a comment on a photo";
    default:
      return e.verb;
  }
}

function VerbIcon({ verb }: { verb: string }) {
  const cls = "h-3.5 w-3.5";
  if (verb === "guest.note") return <MessageSquare className={cls} />;
  if (verb.startsWith("project.")) return <FolderOpen className={cls} />;
  if (verb.startsWith("album.")) return <FolderPlus className={cls} />;
  if (verb === "photo.uploaded") return <ImagePlus className={cls} />;
  if (verb === "photo.deleted") return <Trash2 className={cls} />;
  return <Activity className={cls} />;
}
