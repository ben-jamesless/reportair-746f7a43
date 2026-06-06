import { BuildSlidesMark } from "@/components/brand/BuildSlidesMark";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  FileText,
  Share2,
  Users,
  CreditCard,
  Settings,
  LogOut,
  User as UserIcon,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Folder,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyBillingTeam } from "@/hooks/useBillingOwner";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { usePlan } from "@/hooks/usePlan";
import { NotificationsSection } from "@/components/NotificationsSection";
import { toast } from "sonner";
import { fetchAccessibleProjects } from "@/lib/accessibleProjects";

type FolderRow = { id: string; name: string; color: string | null; sort_order: number };

const FOLDER_COLOR_PRESETS = [
  "#01696F", "#D94F2A", "#F59E0B", "#EF4444", "#10B981", "#64748B",
];

interface Props {
  mobile?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const navItems = [
  { label: "Events", icon: CalendarDays, href: "/projects" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Share Links", icon: Share2, href: "/share-links" },
];

const bottomNavItems = [
  { label: "Team", icon: Users, href: "/team" },
  { label: "Billing", icon: CreditCard, href: "/billing" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export const AppSidebar = ({ mobile = false, onNavigate, collapsed = false, onToggleCollapsed }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [counts, setCounts] = useState<{ all: number; unfoldered: number; byFolder: Record<string, number> }>({
    all: 0, unfoldered: 0, byFolder: {},
  });
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FolderRow | null>(null);
  const dragFolderId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const activeFolder = searchParams.get("folder");
  const onProjects = pathname === "/projects" || pathname.startsWith("/projects?");
  const { teamId: billingTeamId } = useMyBillingTeam();
  const { isAdmin } = usePlatformAdmin();
  const { subscriptionStatus, trialEndsAt, plan } = usePlan();

  // Days left in trial
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;
  const isTrialing = subscriptionStatus === "trialing" && daysLeft !== null && !isAdmin;

  // Profile load + realtime
  useEffect(() => {
    if (!user?.id) { setAvatarUrl(null); setFullName(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      setAvatarUrl(data?.avatar_url ?? null);
      setFullName(data?.full_name ?? null);
    })();
    const channel = supabase
      .channel(`sidebar-profile-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { full_name?: string | null; avatar_url?: string | null };
          if (typeof row.avatar_url !== "undefined") setAvatarUrl(row.avatar_url ?? null);
          if (typeof row.full_name !== "undefined") setFullName(row.full_name ?? null);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  const loadFolders = useCallback(async () => {
    if (!user?.id) { setFolders([]); setCounts({ all: 0, unfoldered: 0, byFolder: {} }); return; }
    const { data: fdata } = await supabase
      .from("folders").select("id, name, color, sort_order").order("sort_order", { ascending: true });
    setFolders((fdata ?? []) as FolderRow[]);
    const folderIds = new Set((fdata ?? []).map((f) => f.id));

    const pdata = await fetchAccessibleProjects(user.id);
    const byFolder: Record<string, number> = {};
    let unfoldered = 0;
    let all = 0;
    for (const p of pdata) {
      if (p.archived_at) continue;
      all += 1;
      if (p.folder_id && folderIds.has(p.folder_id)) {
        byFolder[p.folder_id] = (byFolder[p.folder_id] ?? 0) + 1;
      } else {
        unfoldered += 1;
      }
    }
    setCounts({ all, unfoldered, byFolder });
  }, [user?.id]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    const handler = () => loadFolders();
    window.addEventListener("projects:changed", handler);
    return () => window.removeEventListener("projects:changed", handler);
  }, [loadFolders]);

  const initials = (() => {
    if (fullName && fullName.trim()) {
      const parts = fullName.trim().split(/\s+/);
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
    }
    return (user?.email ?? "?").slice(0, 2).toUpperCase();
  })();

  const handleSignOut = async () => {
    await signOut();
    onNavigate?.();
    navigate("/auth", { replace: true });
  };

  const goToFolder = (folderKey: string | null) => {
    onNavigate?.();
    if (!onProjects) {
      navigate(folderKey ? `/projects?folder=${encodeURIComponent(folderKey)}` : "/projects");
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (folderKey) next.set("folder", folderKey); else next.delete("folder");
    setSearchParams(next, { replace: false });
  };

  const handleDropOnFolder = async (targetId: string) => {
    const sourceId = dragFolderId.current;
    dragFolderId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const reordered = [...folders];
    const sIdx = reordered.findIndex((f) => f.id === sourceId);
    const tIdx = reordered.findIndex((f) => f.id === targetId);
    if (sIdx < 0 || tIdx < 0) return;
    const [moved] = reordered.splice(sIdx, 1);
    reordered.splice(tIdx, 0, moved);
    setFolders(reordered);
    await Promise.all(
      reordered.map((f, i) => supabase.from("folders").update({ sort_order: i }).eq("id", f.id)),
    );
    loadFolders();
  };

  const expanded = mobile || !collapsed;
  const labelCls = expanded ? "inline" : "hidden";
  const folderSectionCls = expanded ? "block" : "hidden";

  const isActive = (href: string) => {
    if (href === "/projects") return onProjects;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col bg-[#0F1417] text-white transition-[width] duration-200",
          mobile
            ? "h-full w-full"
            : "hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:border-r md:border-white/10",
          collapsed ? "md:w-16" : "md:w-56"
        )}
      >
        {/* ── Logo area ── */}
        <div className={cn("flex h-14 items-center", expanded ? "px-3" : "justify-center px-2")}>
          <Link to="/projects" onClick={onNavigate} className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <img src="/buildfolder-lockup-dark.svg" alt="BuildFolder" className="h-6 w-auto shrink-0" />
            ) : (
              <img src="/brand-mark.svg" alt="BuildFolder" className="h-8 w-8 shrink-0" />
            )}
          </Link>
        </div>

        {/* ── Floating collapse toggle ── */}
        {!mobile && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute right-0 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0F1417] text-white/70 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className={cn("h-3 w-3 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}

        {/* ── Main scrollable area ── */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Notifications (kept, styled for dark) */}
          <div className="px-2 pt-2 lg:px-3">
            <NotificationsSection compactLabel={!expanded} onNavigate={onNavigate} />
          </div>

          {/* ── Primary nav ── */}
          <nav className="mt-2 space-y-0.5 px-2 lg:px-3">
            {navItems.filter((item) => {
              if ((item.href === "/reports" || item.href === "/share-links") && plan !== "pro" && plan !== "studio") return false;
              return true;
            }).map((item) => {

              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                        expanded ? "justify-start" : "justify-center",
                        active
                          ? "bg-[#D94F2A] font-medium text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn(labelCls)}>{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={expanded ? "hidden" : ""}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* ── Divider ── */}
          <div className="my-2 border-t border-white/10 mx-2 lg:mx-3" />

          {/* ── Bottom nav (Team / Billing / Settings) ── */}
          <nav className="space-y-0.5 px-2 lg:px-3">
            {bottomNavItems.filter((item) => {
              if (item.href === "/team" && plan !== "pro" && plan !== "studio") return false;
              return true;
            }).map((item) => {

              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                        expanded ? "justify-start" : "justify-center",
                        active
                          ? "bg-[#D94F2A] font-medium text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn(labelCls)}>{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={expanded ? "hidden" : ""}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Admin — kept but less prominent; only visible to admins */}
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin"
                    onClick={onNavigate}
                    className={cn(
                      "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                      expanded ? "justify-start" : "justify-center",
                      pathname.startsWith("/admin")
                        ? "bg-[#D94F2A] font-medium text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span className={cn(labelCls)}>Admin</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className={expanded ? "hidden" : ""}>
                  Admin
                </TooltipContent>
              </Tooltip>
            )}
          </nav>

          {/* ── Folders section (preserved, styled for dark) ── */}
          <div className={cn("mt-4 flex-1 px-2 lg:px-3", folderSectionCls)}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Folders
            </div>
            {folders.map((f) => {
              const isFolderActive = onProjects && activeFolder === f.id;
              return (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => { dragFolderId.current = f.id; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(f.id); }}
                  onDragLeave={() => setDragOver((v) => (v === f.id ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const projectId = e.dataTransfer.getData("application/x-project-id");
                    if (projectId) {
                      (async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) { toast.error("Not signed in"); return; }
                        const { error } = await supabase
                          .from("user_project_folders")
                          .upsert({ user_id: user.id, project_id: projectId, folder_id: f.id }, { onConflict: "user_id,project_id" });
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Moved to folder");
                          window.dispatchEvent(new Event("projects:changed"));
                        }
                      })();
                    } else if (dragFolderId.current) {
                      handleDropOnFolder(f.id);
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isFolderActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                    dragOver === f.id && "ring-2 ring-[#D94F2A]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goToFolder(f.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: f.color || "rgba(255,255,255,0.4)" }}
                    />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-white/40">{counts.byFolder[f.id] ?? 0}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100"
                        aria-label={`Folder options for ${f.name}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-white/60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(f)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onSelect={() => setDeleting(f)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {counts.unfoldered > 0 && (
              <button
                type="button"
                onClick={() => goToFolder("__unfoldered__")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  onProjects && activeFolder === "__unfoldered__"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Folder className="h-3.5 w-3.5 shrink-0 text-white/60" />
                <span className="flex-1 truncate text-left">Uncategorised</span>
                <span className="text-xs text-white/40">{counts.unfoldered}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/50 hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> New folder
            </button>
          </div>
        </div>

        {/* ── Bottom section: user + trial pill ── */}
        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 px-3 pb-3 pt-2">
          {/* Trial pill */}
          {isTrialing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/billing"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-[#D94F2A] bg-[#D94F2A]/10 px-2.5 py-1 text-xs text-[#D94F2A]",
                    expanded ? "w-fit" : "mx-auto w-fit justify-center"
                  )}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  {expanded && <span>Trial ends in {daysLeft} days</span>}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className={expanded ? "hidden" : ""}>
                Trial ends in {daysLeft} days
              </TooltipContent>
            </Tooltip>
          )}

          {/* Theme toggle */}
          <ThemeToggle expanded={expanded} />

          {/* User row */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10",
                  expanded ? "" : "justify-center"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-[#D94F2A]/20 text-xs text-white">{initials}</AvatarFallback>
                </Avatar>
                {expanded && (
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-white">{fullName || user?.email}</p>
                    <p className="truncate text-xs text-white/50">{user?.email}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={mobile ? "top" : "right"} className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Signed in as</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/profile"); }} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Folder editor dialog ── */}
      {(creating || editing) && (
        <FolderEditor
          folder={editing}
          ownerId={user?.id ?? ""}
          nextSortOrder={folders.length}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            loadFolders();
            window.dispatchEvent(new Event("projects:changed"));
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be removed. The projects inside it will not be deleted —
              they'll just become uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                const { error } = await supabase.from("folders").delete().eq("id", deleting.id);
                if (error) toast.error(error.message);
                else toast.success("Folder deleted");
                if (activeFolder === deleting.id) goToFolder(null);
                setDeleting(null);
                loadFolders();
                window.dispatchEvent(new Event("projects:changed"));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

const ThemeToggle = ({ expanded }: { expanded: boolean }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10 text-white/70 hover:text-white",
        expanded ? "" : "justify-center"
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {expanded && (
        <span className="text-sm">{isDark ? "Dark mode" : "Light mode"}</span>
      )}
    </button>
  );
};

const FolderEditor = ({
  folder, ownerId, nextSortOrder, onClose, onSaved,
}: {
  folder: FolderRow | null;
  ownerId: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState(folder?.color ?? FOLDER_COLOR_PRESETS[0]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) { toast.error("Folder name is required"); return; }
    setBusy(true);
    if (folder) {
      const { error } = await supabase.from("folders").update({ name: n, color }).eq("id", folder.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Folder updated");
    } else {
      const { error } = await supabase
        .from("folders").insert({ name: n, color, owner_id: ownerId, sort_order: nextSortOrder });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Folder created");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Golf"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
            />
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {FOLDER_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                    color === c && "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0F1417]",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{folder ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
