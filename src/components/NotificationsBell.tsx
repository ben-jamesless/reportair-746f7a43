import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NotificationType = "mention" | "reply" | "guest_comment";

type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  project_id: string;
  photo_id: string | null;
  comment_id: string | null;
  type: NotificationType;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

type Enriched = Notification & { project_name?: string };

const verbFor = (n: Notification) => {
  switch (n.type) {
    case "mention": return "mentioned you";
    case "reply": return "replied to your thread";
    case "guest_comment": return "left a comment";
  }
};

export const NotificationsBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Enriched[]>([]);
  const [open, setOpen] = useState(false);
  const projectsCache = useRef<Map<string, string>>(new Map());

  const enrich = useCallback(async (rows: Notification[]): Promise<Enriched[]> => {
    const missing = Array.from(
      new Set(rows.map((r) => r.project_id).filter((id) => !projectsCache.current.has(id))),
    );
    if (missing.length) {
      const { data } = await supabase.from("projects").select("id, name").in("id", missing);
      for (const p of data ?? []) projectsCache.current.set(p.id, p.name);
    }
    return rows.map((r) => ({ ...r, project_name: projectsCache.current.get(r.project_id) }));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!data) return;
    setItems(await enrich(data as Notification[]));
  }, [user, enrich]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription on inserts + updates for this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as Notification;
          const [enriched] = await enrich([row]);
          setItems((cur) => [enriched, ...cur].slice(0, 30));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notification;
          setItems((cur) => cur.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, enrich]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  // Mark all unread as read when opening
  const handleOpenChange = useCallback(async (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      // optimistic
      const stamp = new Date().toISOString();
      setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: stamp })));
      await supabase.rpc("mark_notifications_read", { _ids: unreadIds });
    }
  }, [items, unreadCount]);

  const handleClick = (n: Enriched) => {
    setOpen(false);
    const params = new URLSearchParams();
    if (n.photo_id) {
      params.set("photo", n.photo_id);
      params.set("comments", "1");
    }
    const qs = params.toString();
    navigate(`/projects/${n.project_id}${qs ? `?${qs}` : ""}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
              className="relative h-auto w-full justify-start gap-3 px-2 py-2 text-muted-foreground hover:text-foreground lg:px-3"
            >
              <span className="relative inline-flex">
                <Bell className="h-4 w-4 shrink-0" />
                {unreadCount > 0 && (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground",
                    )}
                    aria-hidden
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="hidden text-sm lg:inline">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" className="lg:hidden">
          Notifications{unreadCount ? ` (${unreadCount})` : ""}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="right" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} new</span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{n.actor_name ?? "Someone"}</span>{" "}
                          <span className="text-muted-foreground">{verbFor(n)}</span>
                          {n.project_name && (
                            <>
                              {" "}
                              <span className="text-muted-foreground">in</span>{" "}
                              <span className="font-medium">{n.project_name}</span>
                            </>
                          )}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
