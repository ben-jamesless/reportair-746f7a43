import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NotificationType = "mention" | "reply" | "guest_comment" | "project_invite";

type Notification = {
  id: string;
  user_id: string;
  project_id: string;
  photo_id: string | null;
  comment_id: string | null;
  type: NotificationType;
  body: string | null;
  actor_id: string | null;
  actor_name: string | null;
  read_at: string | null;
  created_at: string;
};

type Enriched = Notification & { project_name?: string; invite_token?: string | null };

const verbFor = (n: Notification) => {
  switch (n.type) {
    case "mention": return "mentioned you";
    case "reply": return "replied to your thread";
    case "guest_comment": return "left a comment";
    case "project_invite": return n.body ?? "invited you to a project";
  }
};

interface Props {
  /** Hide labels when sidebar is in icon-only mode (md not lg). */
  compactLabel?: boolean;
  onNavigate?: () => void;
}

export const NotificationsSection = ({ compactLabel = false, onNavigate }: Props) => {
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

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-sec:${user.id}:${Math.random().toString(36).slice(2)}`)
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

  const handleOpenChange = useCallback(async (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      const stamp = new Date().toISOString();
      setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: stamp })));
      await supabase.rpc("mark_notifications_read", { _ids: unreadIds });
    }
  }, [items, unreadCount]);

  const handleClick = async (n: Enriched) => {
    onNavigate?.();
    if (n.type === "project_invite") {
      // Look up the latest unaccepted invite for this project + current user's email.
      const { data: { user: cur } } = await supabase.auth.getUser();
      const email = cur?.email;
      if (email) {
        const { data: tok } = await supabase.rpc("get_my_pending_invite_token", { _project_id: n.project_id });
        if (tok) { navigate(`/invite/${tok as string}`); return; }
      }
      navigate(`/projects/${n.project_id}`);
      return;
    }
    const params = new URLSearchParams();
    if (n.photo_id) {
      params.set("photo", n.photo_id);
      params.set("comments", "1");
    }
    const qs = params.toString();
    navigate(`/projects/${n.project_id}${qs ? `?${qs}` : ""}`);
  };

  const labelCls = compactLabel ? "hidden" : "inline";

  const listContent = (
    items.length === 0 ? (
      <div className="px-3 py-3 text-xs text-muted-foreground">You're all caught up.</div>
    ) : (
      <ScrollArea className="max-h-80">
        <ul className="mt-1 space-y-0.5">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => { handleClick(n); setOpen(false); }}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60 lg:px-3",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-1.5">
                  {!n.read_at && (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium text-foreground">{n.actor_name ?? "Someone"}</span>{" "}
                      <span className="text-muted-foreground">{verbFor(n)}</span>
                    </p>
                    {n.project_name && (
                      <p className="truncate text-[11px] text-muted-foreground">{n.project_name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    )
  );

  const triggerInner = (
    <>
      <span className="relative inline-flex">
        <Bell className="h-4 w-4 shrink-0" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </span>
      <span className={cn("flex-1 text-left", labelCls)}>Notifications</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform",
          open && "rotate-180",
          labelCls,
        )}
      />
    </>
  );

  const triggerCls = cn(
    "group flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-slate-50 transition-colors lg:px-3",
    "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    compactLabel && "justify-center",
  );

  if (compactLabel) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              className={triggerCls}
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
            >
              {triggerInner}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Notifications</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="start" className="w-80 p-1">
          {listContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        className={triggerCls}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        {triggerInner}
      </CollapsibleTrigger>
      <CollapsibleContent>{listContent}</CollapsibleContent>
    </Collapsible>
  );
};
