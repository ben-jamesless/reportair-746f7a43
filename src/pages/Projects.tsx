import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { NewEventPanel } from "@/components/NewEventPanel";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Camera, Plus, MoreVertical, Pencil, Trash2, Search, X, Archive, ArchiveRestore, FolderInput, LogOut, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import { ProjectGridSkeleton } from "@/components/Skeletons";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";
import { projectStatusMeta, type ProjectStatus } from "@/lib/projectStatus";
import { projectStaticMapUrl } from "@/lib/projectStaticMap";
import { StatusTypographic } from "@/components/StatusTypographic";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchAccessibleProjects, isProjectInFolderView, type AccessibleProject } from "@/lib/accessibleProjects";
import { canDeleteProject, canEditProject, canArchiveProject, canMoveProjectToFolder, canLeaveProject, type ProjectRole } from "@/lib/projectPermissions";
import { usePlan } from "@/hooks/usePlan";
import { formatDistanceToNow } from "date-fns";

type FolderRow = { id: string; name: string; color: string | null };
const FOLDER_ALL = "__all__";
const FOLDER_UNFOLDERED = "__unfoldered__";

type Project = Omit<AccessibleProject, "overall_status"> & { overall_status: ProjectStatus | null };

type ActiveTab = "All Events" | "Active" | "Archived";

const Projects = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastUploads, setLastUploads] = useState<Map<string, string>>(new Map());
  const [mapMeta, setMapMeta] = useState<Map<string, { lat: number; lng: number; zoom: number | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteOwnerCount, setDeleteOwnerCount] = useState<number>(1);

  // Toolbar state
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("All Events");
  const [filterClient, setFilterClient] = useState<string>("__all__");
  const [filterEventType, setFilterEventType] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ count: number; firstToken: string | null }>({ count: 0, firstToken: null });
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [searchParams] = useSearchParams();
  const selectedFolder = searchParams.get("folder") ?? FOLDER_ALL;
  const [ownedProjectIds, setOwnedProjectIds] = useState<Set<string>>(new Set());
  const [projectRoles, setProjectRoles] = useState<Map<string, ProjectRole>>(new Map());
  const [moveProject, setMoveProject] = useState<Project | null>(null);
  const [leavingProject, setLeavingProject] = useState<Project | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [newEventPanelOpen, setNewEventPanelOpen] = useState(false);
  const [creatingNewFolder, setCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolderBusy, setCreatingFolderBusy] = useState(false);

  const handleCreateAndMove = async () => {
    if (!user || !moveProject) return;
    const n = newFolderName.trim();
    if (!n) return;
    setCreatingFolderBusy(true);
    const nextSortOrder = folders.length;
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: n, color: "#D94F2A", owner_id: user.id, sort_order: nextSortOrder })
      .select("id, name, color")
      .single();
    if (error || !data) {
      setCreatingFolderBusy(false);
      toast.error(error?.message ?? "Failed to create folder");
      return;
    }
    await assignProjectToFolder(moveProject.id, data.id);
    setCreatingFolderBusy(false);
    setCreatingNewFolder(false);
    setNewFolderName("");
    setMoveProject(null);
  };

  const { plan, projectCount, limits, refetch: refetchPlan } = usePlan();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();

      const { data: pmAny } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id)
        .limit(1);
      const hasInvitedProjects = (pmAny?.length ?? 0) > 0;

      if (!profile?.onboarded_at && !hasInvitedProjects) {
        navigate("/onboarding", { replace: true });
        return;
      }

      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .order("created_at", { ascending: true })
        .limit(1);

      const team = memberships?.[0]?.teams as { id: string; name: string } | undefined;
      if (team) setTeamId(team.id);
      else setTeamId(null);

      const list = (await fetchAccessibleProjects(user.id)) as Project[];
      setProjects(list);

      const { data: fdata } = await supabase
        .from("folders")
        .select("id, name, color, sort_order")
        .order("sort_order", { ascending: true });
      setFolders((fdata ?? []) as FolderRow[]);

      const ids = list.map((p) => p.id);
      if (ids.length > 0) {
        const { data: pm } = await supabase
          .from("project_members")
          .select("project_id, role")
          .eq("user_id", user.id)
          .in("project_id", ids);
        const roleMap = new Map<string, ProjectRole>();
        const owned = new Set<string>();
        for (const row of (pm ?? []) as { project_id: string; role: ProjectRole }[]) {
          roleMap.set(row.project_id, row.role);
          if (row.role === "owner") owned.add(row.project_id);
        }
        setProjectRoles(roleMap);
        setOwnedProjectIds(owned);
      } else {
        setProjectRoles(new Map());
        setOwnedProjectIds(new Set());
      }

      const projectIds = list.map((p) => p.id);
      const uploads = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: ph } = await supabase
          .from("photos")
          .select("project_id, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(1000);
        for (const row of (ph ?? []) as { project_id: string; created_at: string }[]) {
          if (!uploads.has(row.project_id)) uploads.set(row.project_id, row.created_at);
        }
      }
      setLastUploads(uploads);

      // Map thumbnails: prefer the project's saved default view; fall back
      // to the Places-autocomplete geocode (geo_lat/lng) if none saved.
      const meta = new Map<string, { lat: number; lng: number; zoom: number | null }>();
      if (projectIds.length > 0) {
        const { data: geo } = await supabase
          .from("projects")
          .select("id, geo_lat, geo_lng, map_default_center_lat, map_default_center_lng, map_default_zoom" as any)
          .in("id", projectIds);
        for (const row of ((geo ?? []) as any[])) {
          const lat = row.map_default_center_lat ?? row.geo_lat;
          const lng = row.map_default_center_lng ?? row.geo_lng;
          if (lat != null && lng != null) {
            meta.set(row.id, { lat, lng, zoom: row.map_default_zoom ?? null });
          }
        }
      }
      setMapMeta(meta);

      if (user.email) {
        const { data: inv } = await supabase
          .from("project_invites")
          .select("id, project_id")
          .is("accepted_at", null)
          .ilike("email", user.email)
          .order("created_at", { ascending: false });
        let firstToken: string | null = null;
        if (inv && inv.length > 0) {
          const { data: tok } = await supabase.rpc("get_my_pending_invite_token", { _project_id: inv[0].project_id });
          firstToken = (tok as string | null) ?? null;
        }
        setPendingInvites({ count: inv?.length ?? 0, firstToken });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load projects. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => { if (p.client_name) set.add(p.client_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const eventTypeOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => { if (p.event_type) set.add(p.event_type); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const archivedCount = useMemo(
    () => projects.filter((p) => p.archived_at).length,
    [projects],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const folderIds = new Set(folders.map((f) => f.id));
    let arr = projects.filter((p) => {
      if (activeTab === "Active" && p.archived_at) return false;
      if (activeTab === "Archived" && !p.archived_at) return false;
      if (activeTab === "All Events" && p.archived_at) return false;
      if (!isProjectInFolderView(p, selectedFolder, folderIds, FOLDER_ALL, FOLDER_UNFOLDERED)) return false;
      if (filterClient !== "__all__" && (p.client_name ?? "") !== filterClient) return false;
      if (filterEventType !== "__all__" && (p.event_type ?? "") !== filterEventType) return false;
      if (filterStatus !== "__all__" && (p.overall_status ?? "no_status") !== filterStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.event_type ?? "").toLowerCase().includes(q) ||
        (p.event_location ?? "").toLowerCase().includes(q)
      );
    });
    arr = [...arr].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return arr;
  }, [projects, search, activeTab, filterClient, filterEventType, filterStatus, selectedFolder, folders]);

  const assignProjectToFolder = async (projectId: string, folderId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); return; }
    let error;
    if (folderId) {
      ({ error } = await supabase
        .from("user_project_folders")
        .upsert({ user_id: user.id, project_id: projectId, folder_id: folderId }, { onConflict: "user_id,project_id" }));
    } else {
      ({ error } = await supabase
        .from("user_project_folders")
        .delete()
        .eq("user_id", user.id)
        .eq("project_id", projectId));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(folderId ? "Moved to folder" : "Removed from folder");
    window.dispatchEvent(new Event("projects:changed"));
    load();
  };

  const setProjectArchived = async (p: Project, archived: boolean) => {
    if (!archived && limits.maxProjects !== -1 && projectCount >= limits.maxProjects) {
      toast.error(
        `You've reached your ${limits.maxProjects}-project limit. Archive or delete a project before restoring this one.`
      );
      return;
    }
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(archived ? "Project archived" : "Project restored");
    refetchPlan?.();
    load();
  };

  const showSkeleton = authLoading || loading;
  const hasAnyVisibleSource = projects.filter((p) => !p.archived_at).length > 0 || activeTab === "Archived";
  const atLimit = limits.maxProjects !== -1 && projectCount >= limits.maxProjects;

  const tabs: ActiveTab[] = ["All Events", "Active", "Archived"];

  return (
    <AppShell crumbs={[{ label: "Events" }]}>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-foreground">Events</h1>
        <NewEventButton
          onOpen={() => setNewEventPanelOpen(true)}
          atLimit={atLimit}
          projectCount={projectCount}
          maxProjects={limits.maxProjects}
        />
      </div>

      {/* Pending invites banner */}
      {!showSkeleton && pendingInvites.count > 0 && pendingInvites.firstToken && (
        <div className="mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span>
            You have <strong>{pendingInvites.count}</strong> pending project invitation{pendingInvites.count === 1 ? "" : "s"}.
          </span>
          <Link to={`/invite/${pendingInvites.firstToken}`} className="font-medium text-primary hover:underline">
            View invite{pendingInvites.count === 1 ? "" : "s"} →
          </Link>
        </div>
      )}

      {/* ── Filter toolbar ── */}
      {!showSkeleton && hasAnyVisibleSource && (
        <div className="flex flex-col gap-3 px-4 sm:px-6 pb-4 border-b border-border sm:flex-row sm:items-center sm:gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search events…"
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D94F2A]/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="-mx-4 sm:mx-0 flex items-center gap-1 overflow-x-auto px-4 sm:px-0 sm:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 h-9 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0",
                  activeTab === tab
                    ? "text-[#D94F2A] bg-[#D94F2A]/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab}
                {tab === "Archived" && archivedCount > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({archivedCount})</span>
                )}
              </button>
            ))}
          </div>

          {/* Solo counter */}
          {plan === "solo" && limits.maxProjects > 0 && (
            <span className="sm:ml-auto text-xs text-muted-foreground">
              {projectCount} / {limits.maxProjects} events used
            </span>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {showSkeleton ? (
        <ProjectGridSkeleton />
      ) : !hasAnyVisibleSource ? (
        <EmptyState
          className="mx-auto max-w-xl"
          icon={<Camera className="h-6 w-6" />}
          title="Your first event starts here"
          description="Create an event to start uploading site photos, tracking area progress, and sharing daily reports with your team."
          action={
            <NewEventButton
              onOpen={() => setNewEventPanelOpen(true)}
              atLimit={atLimit}
              projectCount={projectCount}
              maxProjects={limits.maxProjects}
              primary
            />
          }
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D94F2A]/10 flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-[#D94F2A]" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            {activeTab === "Archived" ? "No archived events" : "No matching events"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            {activeTab === "Archived"
              ? "Events you archive will appear here."
              : "Try changing your search or filters."}
          </p>
          {activeTab !== "Archived" && (
            <button
              onClick={() => { setSearch(""); setActiveTab("All Events"); }}
              className="px-4 h-9 rounded-lg bg-[#D94F2A] text-white text-sm font-medium hover:bg-[#D94F2A]/90"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4 sm:px-6 py-4">
          {filtered.map((p) => {
            const color = p.color || DEFAULT_PROJECT_COLOR;
            const lastUpload = lastUploads.get(p.id);
            const isArchived = !!p.archived_at;
            const isOwner = ownedProjectIds.has(p.id);
            const role = projectRoles.get(p.id) ?? null;
            const canEdit = canEditProject(role);
            const canArchive = canArchiveProject(role);
            const canMove = canMoveProjectToFolder(role);
            const canDelete = canDeleteProject(role);
            const canLeave = canLeaveProject(role);
            const hasAnyAction = canEdit || canArchive || canMove || canDelete || canLeave;
            const geo = mapMeta.get(p.id);
            const thumbUrl = geo ? projectStaticMapUrl({ lat: geo.lat, lng: geo.lng, zoom: geo.zoom, width: 600, height: 300 }) : null;

            return (
              <div
                key={p.id}
                className="group relative flex flex-col border border-[#E3DFD4] bg-card cursor-pointer transition-colors hover:border-[#0F1417]/30"
                onClick={() => navigate(`/projects/${p.id}`)}
                draggable={isOwner}
                onDragStart={(e) => {
                  if (!isOwner) return;
                  e.dataTransfer.setData("application/x-project-id", p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                {/* Static map thumbnail */}
                <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[#E3DFD4] bg-[#FAF8F2]">
                  {/* Placeholder always present — the thumbnail sits on top and hides itself if it fails to load. */}
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.14em] text-foreground/30"
                    style={{
                      background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  {thumbUrl && (
                    <img
                      src={thumbUrl}
                      alt=""
                      loading="lazy"
                      className="relative h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}


                  {hasAnyAction && (
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex h-8 w-8 items-center justify-center border border-[#E3DFD4] bg-card/95 backdrop-blur hover:bg-muted/40"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            aria-label="Event actions"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <DropdownMenuItem onSelect={() => setEditingProject(p)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {canMove && (
                            <DropdownMenuItem onSelect={() => setMoveProject(p)}>
                              <FolderInput className="mr-2 h-4 w-4" /> Move to folder
                            </DropdownMenuItem>
                          )}
                          {canArchive && (
                            isArchived ? (
                              <DropdownMenuItem onSelect={() => setProjectArchived(p, false)}>
                                <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => setProjectArchived(p, true)}>
                                <Archive className="mr-2 h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={async () => {
                                  setDeletingProject(p);
                                  setDeleteConfirm("");
                                  setDeleteOwnerCount(1);
                                  const { count } = await supabase
                                    .from("project_members")
                                    .select("user_id", { count: "exact", head: true })
                                    .eq("project_id", p.id)
                                    .eq("role", "owner");
                                  setDeleteOwnerCount(count ?? 1);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {canLeave && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setLeavingProject(p)}
                              >
                                <LogOut className="mr-2 h-4 w-4" /> Leave
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {p.name}
                    </h3>
                    {!isOwner && (
                      <span
                        className="shrink-0 border border-[#E3DFD4] bg-[#FAF8F2] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground leading-none"
                        style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                      >
                        Invited
                      </span>
                    )}
                  </div>

                  {(p.event_location || p.event_date) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {p.event_location}
                      {p.event_location && p.event_date && <span className="mx-1.5 text-[#D4D1CA]">·</span>}
                      {p.event_date && new Date(p.event_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <StatusTypographic
                      statusKey={p.overall_status ?? "no_status"}
                      showCaption={false}
                    />
                    <span
                      className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                    >
                      {lastUpload ? formatDistanceToNow(new Date(lastUpload), { addSuffix: true }) : "No updates"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* ── Dialogs (preserved) ── */}
      {editingProject && (
        <EditProjectDialog
          key={editingProject.id}
          projectId={editingProject.id}
          name={editingProject.name}
          description={editingProject.description}
          color={editingProject.color}
          event_date={editingProject.event_date}
          event_location={editingProject.event_location}
          overall_status={editingProject.overall_status}
          event_type={editingProject.event_type}
          client_name={editingProject.client_name}
          openControlled
          onOpenChange={(o) => { if (!o) setEditingProject(null); }}
          onChanged={load}
        />
      )}

      <AlertDialog
        open={!!deletingProject}
        onOpenChange={(o) => { if (!o) { setDeletingProject(null); setDeleteConfirm(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteOwnerCount > 1 ? "Delete or leave this event?" : "Delete this event?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOwnerCount > 1 ? (
                <>
                  <span className="font-semibold text-foreground">{deletingProject?.name}</span> has{" "}
                  {deleteOwnerCount} owners. Deleting it removes it for everyone —
                  including the other {deleteOwnerCount - 1} owner{deleteOwnerCount > 2 ? "s" : ""}.
                  You can also just remove it from your own account and leave it intact for the others.
                </>
              ) : (
                <>
                  All albums, areas, photos, comments, share links, and history for{" "}
                  <span className="font-semibold text-foreground">{deletingProject?.name}</span> will be permanently deleted.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-project-name">
              Type <span className="font-mono font-semibold">{deletingProject?.name}</span> to confirm deletion for everyone
            </Label>
            <Input
              id="confirm-project-name"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deletingProject?.name}
              autoFocus
            />
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            {deleteOwnerCount > 1 && (
              <Button
                variant="outline"
                disabled={deleting || !deletingProject}
                onClick={async () => {
                  if (!deletingProject) return;
                  setDeleting(true);
                  const { error } = await supabase.rpc("owner_leave_project", {
                    _project_id: deletingProject.id,
                  });
                  setDeleting(false);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Removed from your account");
                  setDeletingProject(null);
                  setDeleteConfirm("");
                  refetchPlan?.();
                  load();
                }}
              >
                Just remove me
              </Button>
            )}
            <AlertDialogAction
              disabled={deleting || !deletingProject || deleteConfirm.trim() !== deletingProject.name.trim()}
              onClick={async (e) => {
                e.preventDefault();
                if (!deletingProject) return;
                setDeleting(true);
                const { error } = await supabase.rpc("delete_project", { _project_id: deletingProject.id });
                setDeleting(false);
                if (error) { toast.error(error.message); return; }
                toast.success("Event deleted");
                setDeletingProject(null);
                setDeleteConfirm("");
                refetchPlan?.();
                load();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : deleteOwnerCount > 1 ? "Delete for everyone" : "Delete event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!leavingProject}
        onOpenChange={(o) => { if (!o) setLeavingProject(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this event?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to{" "}
              <span className="font-semibold text-foreground">{leavingProject?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaving || !leavingProject}
              onClick={async (e) => {
                e.preventDefault();
                if (!leavingProject) return;
                setLeaving(true);
                const { error } = await supabase.rpc("leave_project", {
                  _project_id: leavingProject.id,
                });
                setLeaving(false);
                if (error) { toast.error(error.message); return; }
                toast.success("Left event");
                setLeavingProject(null);
                load();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? "Leaving…" : "Leave event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to folder dialog */}
      {moveProject && (
        <Dialog open onOpenChange={() => setMoveProject(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Move to folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { assignProjectToFolder(moveProject.id, f.id); setMoveProject(null); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color || "#ccc" }} />
                  {f.name}
                </button>
              ))}
              <button
                onClick={() => { assignProjectToFolder(moveProject.id, null); setMoveProject(null); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                Uncategorised
              </button>

              {folders.length === 0 && (
                <p className="px-3 pt-2 text-xs text-muted-foreground">
                  No folders yet. Create one to organise your events.
                </p>
              )}

              <div className="border-t pt-3 mt-2">
                {creatingNewFolder ? (
                  <div className="flex items-center gap-2 px-1">
                    <Input
                      autoFocus
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleCreateAndMove(); }
                        if (e.key === "Escape") { setCreatingNewFolder(false); setNewFolderName(""); }
                      }}
                      disabled={creatingFolderBusy}
                    />
                    <Button size="sm" onClick={handleCreateAndMove} disabled={creatingFolderBusy || !newFolderName.trim()}>
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setCreatingNewFolder(false); setNewFolderName(""); }}
                      disabled={creatingFolderBusy}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingNewFolder(true)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#D94F2A] hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Add a new folder
                  </button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <NewEventPanel
        open={newEventPanelOpen}
        onOpenChange={setNewEventPanelOpen}
        teamId={teamId}
        onCreated={() => { refetchPlan?.(); load(); }}
      />
    </AppShell>
  );
};

/* ── New Event button with Solo plan gate ── */
function NewEventButton({
  onOpen,
  atLimit,
  projectCount,
  maxProjects,
  primary = false,
}: {
  onOpen: () => void;
  atLimit: boolean;
  projectCount: number;
  maxProjects: number;
  primary?: boolean;
}) {
  if (atLimit) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled
            className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[#D94F2A]/30 text-white/50 text-sm font-medium cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Event
            <span className="ml-1 text-xs opacity-70">{projectCount}/{maxProjects}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>You've used all {maxProjects} event{maxProjects > 1 ? "s" : ""} on your current plan.</p>
          <Link to="/billing" className="text-[#D94F2A] underline text-xs">Upgrade →</Link>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-colors",
        primary
          ? "bg-[#D94F2A] text-white hover:bg-[#D94F2A]/90"
          : "bg-[#D94F2A] text-white hover:bg-[#D94F2A]/90"
      )}
    >
      <Plus className="w-4 h-4" />
      New Event
    </button>
  );
}

export default Projects;
