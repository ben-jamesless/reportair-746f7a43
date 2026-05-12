import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, X } from "lucide-react";
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

  // Open without auto-marking — user controls read/delete per item.
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const stamp = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: stamp })));
    await supabase.rpc("mark_notifications_read", { _ids: unreadIds });
  }, [items]);

  const toggleRead = useCallback(async (n: Enriched) => {
    if (!n.read_at) {
      const stamp = new Date().toISOString();
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: stamp } : x)));
      await supabase.rpc("mark_notifications_read", { _ids: [n.id] });
    } else {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: null } : x)));
      await supabase.from("notifications").update({ read_at: null }).eq("id", n.id);
    }
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  const handleClick = (n: Enriched) => {
    setOpen(false);
    // Mark read on navigate.
    if (!n.read_at) {
      const stamp = new Date().toISOString();
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: stamp } : x)));
      supabase.rpc("mark_notifications_read", { _ids: [n.id] });
    }
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
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">{unreadCount} new</span>
            )}
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group/item relative transition-colors hover:bg-accent/50",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 pr-16 text-left focus-visible:outline-none"
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
                  <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); toggleRead(n); }}
                          aria-label={n.read_at ? "Mark as unread" : "Mark as read"}
                        >
                          <Check className={cn("h-3.5 w-3.5", n.read_at && "text-muted-foreground")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{n.read_at ? "Mark as unread" : "Mark as read"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                          aria-label="Delete notification"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
