import { ReportAirMark } from "@/components/brand/ReportAirMark";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  FolderKanban,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Folder,
  CreditCard,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useMyBillingTeam } from "@/hooks/useBillingOwner";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { NotificationsSection } from "@/components/NotificationsSection";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { fetchAccessibleProjects } from "@/lib/accessibleProjects";

type FolderRow = { id: string; name: string; color: string | null; sort_order: number };

const FOLDER_COLOR_PRESETS = [
  "#01696F", "#1A6EFF", "#F59E0B", "#EF4444", "#10B981", "#64748B",
];

interface Props {
  /** When true, render content for a mobile sheet (no fixed positioning, full width). */
  mobile?: boolean;
  /** Called when a nav action is performed — used to close the mobile sheet. */
  onNavigate?: () => void;
  /** Desktop collapsed state (icon-only). Ignored when `mobile` is true. */
  collapsed?: boolean;
  /** Toggle desktop collapsed state. */
  onToggleCollapsed?: () => void;
}

export const AppSidebar = ({ mobile = false, onNavigate, collapsed = false, onToggleCollapsed }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
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
  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile/");
  const isBillingActive = pathname === "/billing" || pathname.startsWith("/billing/");
  const { teamId: billingTeamId } = useMyBillingTeam();
  const { isAdmin } = usePlatformAdmin();
  const isAdminActive = pathname === "/admin" || pathname.startsWith("/admin/");

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

    // Count the same accessible projects shown by the Projects page.
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

  // Refresh counts when projects/folders change anywhere in the app
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

  // Desktop expanded = not collapsed; mobile sheet always shows full content
  const expanded = mobile || !collapsed;

  const containerCls = mobile
    ? "flex h-full w-full flex-col bg-background"
    : cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 md:border-r md:bg-background transition-[width] duration-200",
        collapsed ? "md:w-16" : "md:w-56",
      );

  const labelCls = expanded ? "inline" : "hidden";
  const folderSectionCls = expanded ? "block" : "hidden";
  // Tooltip only shown for icon-only (collapsed desktop)
  const tooltipCls = expanded ? "hidden" : "";

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={containerCls}>
        {/* Logo */}
        <div className={cn("flex h-14 items-center border-b", expanded ? "px-3 lg:px-4" : "px-2 justify-center")}>
          <Link
            to="/projects"
            onClick={onNavigate}
            className="flex items-center gap-2 min-w-0"
          >
            <ReportAirMark variant="light" className="h-7 w-7 shrink-0 dark:hidden" />
            <ReportAirMark variant="dark" className="hidden h-7 w-7 shrink-0 dark:inline-block" />
            <span className={cn("wordmark text-sm text-foreground truncate", labelCls)}>REPORTAIR</span>
          </Link>
        </div>

        {/* Floating collapse/expand toggle on the right edge */}
        {!mobile && onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="absolute right-0 top-7 z-10 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"}</TooltipContent>
          </Tooltip>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 pt-4 lg:p-3 lg:pt-5">
          {/* Notifications (top, above folders) */}
          <NotificationsSection compactLabel={!expanded} onNavigate={onNavigate} />

          <Separator className="my-2" />

          {/* All Projects */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => goToFolder(null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-3",
                  onProjects && !activeFolder
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <FolderKanban className="h-4 w-4 shrink-0" />
                <span className={cn("flex-1 text-left", labelCls)}>All Projects</span>
                <span className={cn("text-xs text-muted-foreground", labelCls)}>{counts.all}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className={tooltipCls}>
              All Projects
            </TooltipContent>
          </Tooltip>

          {/* Folders section — only shown when nav has room (lg+) or on mobile sheet */}
          <div className={folderSectionCls}>
            <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Folders
            </div>
            {folders.map((f) => {
              const isActive = onProjects && activeFolder === f.id;
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
                      supabase.from("projects").update({ folder_id: f.id }).eq("id", projectId).then(({ error }) => {
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Moved to folder");
                          window.dispatchEvent(new Event("projects:changed"));
                        }
                      });
                    } else if (dragFolderId.current) {
                      handleDropOnFolder(f.id);
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors lg:px-3",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    dragOver === f.id && "ring-2 ring-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goToFolder(f.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: f.color || "hsl(var(--muted-foreground))" }}
                    />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{counts.byFolder[f.id] ?? 0}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                        aria-label={`Folder options for ${f.name}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(f)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
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
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors lg:px-3",
                  onProjects && activeFolder === "__unfoldered__"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">Uncategorised</span>
                <span className="text-xs text-muted-foreground">{counts.unfoldered}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary/80 hover:bg-secondary/60 hover:text-primary lg:px-3"
            >
              <Plus className="h-3.5 w-3.5" /> New folder
            </button>
          </div>

        </nav>

        {/* User */}
        <div className="space-y-1 border-t p-2 lg:p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="h-auto w-full justify-start gap-3 px-2 py-2 text-muted-foreground hover:text-foreground lg:px-3"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                <span className={cn("text-sm", labelCls)}>
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className={tooltipCls}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>

          {billingTeamId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/billing"
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors lg:px-3",
                    isBillingActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className={cn(labelCls)}>Billing</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className={tooltipCls}>
                Billing
              </TooltipContent>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/admin"
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors lg:px-3",
                    isAdminActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className={cn(labelCls)}>Admin</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className={tooltipCls}>
                Admin
              </TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 lg:px-3">
                <Avatar className="h-7 w-7">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className={cn("min-w-0 flex-1 truncate text-left text-xs text-muted-foreground", labelCls)}>
                  {fullName || user?.email}
                </span>
              </Button>
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
              {billingTeamId && (
                <DropdownMenuItem onClick={() => { onNavigate?.(); navigate("/billing"); }} className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Folder editor */}
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
                    color === c && "ring-2 ring-foreground/40 ring-offset-2",
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
