import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Plus, MoreVertical, Pencil, Trash2, Search, X, ArrowUpDown, Archive, ArchiveRestore, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import { ProjectGridSkeleton } from "@/components/Skeletons";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";
import { PROJECT_STATUSES, projectStatusMeta, type ProjectStatus } from "@/lib/projectStatus";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ProjectFolders,
  FOLDER_ALL,
  FOLDER_UNFOLDERED,
  type FolderRow,
  type FolderSelection,
} from "@/components/ProjectFolders";
import { FolderInput } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
  color: string | null;
  event_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  archived_at: string | null;
  folder_id: string | null;
};

type SortKey = "alpha" | "created" | "event_date" | "last_upload";

const ALL = "__all__";

const Projects = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastUploads, setLastUploads] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Toolbar state
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>(ALL);
  const [filterEventType, setFilterEventType] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<string>(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ count: number; firstToken: string | null }>({ count: 0, firstToken: null });
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>(FOLDER_ALL);
  const [ownedProjectIds, setOwnedProjectIds] = useState<Set<string>>(new Set());
  const [moveProject, setMoveProject] = useState<Project | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarded_at) {
      navigate("/onboarding", { replace: true });
      return;
    }

    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, teams(id, name)")
      .order("created_at", { ascending: true })
      .limit(1);

    const team = memberships?.[0]?.teams as { id: string; name: string } | undefined;
    if (!team) {
      navigate("/onboarding", { replace: true });
      return;
    }
    setTeamId(team.id);
    setTeamName(team.name);

    const { data: projs } = await supabase
      .from("projects")
      .select("id, name, description, template, created_at, color, event_date, event_location, overall_status, event_type, client_name, archived_at, folder_id")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });

    const list = (projs ?? []) as Project[];
    setProjects(list);

    // Folders (owner-only via RLS)
    const { data: fdata } = await supabase
      .from("folders")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true });
    setFolders((fdata ?? []) as FolderRow[]);

    // Determine which projects current user owns (for showing folder controls per card)
    const ids = list.map((p) => p.id);
    if (ids.length > 0) {
      const { data: pm } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id)
        .in("project_id", ids)
        .eq("role", "owner");
      setOwnedProjectIds(new Set((pm ?? []).map((r) => r.project_id as string)));
    } else {
      setOwnedProjectIds(new Set());
    }

    // Fetch last upload timestamp per project (single page, ordered desc; reduce client-side).
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

    // Pending invites for this user's email
    if (user.email) {
      const { data: inv } = await supabase
        .from("project_invites")
        .select("token")
        .is("accepted_at", null)
        .ilike("email", user.email)
        .order("created_at", { ascending: false });
      setPendingInvites({ count: inv?.length ?? 0, firstToken: inv?.[0]?.token ?? null });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // Distinct option lists for filter dropdowns
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

  const folderCounts = useMemo(() => {
    const byFolder: Record<string, number> = {};
    let unfoldered = 0;
    let all = 0;
    for (const p of projects) {
      if (!showArchived && p.archived_at) continue;
      all += 1;
      if (p.folder_id && folders.some((f) => f.id === p.folder_id)) {
        byFolder[p.folder_id] = (byFolder[p.folder_id] ?? 0) + 1;
      } else {
        unfoldered += 1;
      }
    }
    return { all, unfoldered, byFolder };
  }, [projects, folders, showArchived]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const folderIds = new Set(folders.map((f) => f.id));
    let arr = projects.filter((p) => {
      if (!showArchived && p.archived_at) return false;
      if (selectedFolder === FOLDER_UNFOLDERED) {
        if (p.folder_id && folderIds.has(p.folder_id)) return false;
      } else if (selectedFolder !== FOLDER_ALL) {
        if (p.folder_id !== selectedFolder) return false;
      }
      if (filterClient !== ALL && (p.client_name ?? "") !== filterClient) return false;
      if (filterEventType !== ALL && (p.event_type ?? "") !== filterEventType) return false;
      if (filterStatus !== ALL && (p.overall_status ?? "no_status") !== filterStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.event_type ?? "").toLowerCase().includes(q)
      );
    });
    arr = [...arr].sort((a, b) => {
      switch (sortKey) {
        case "alpha":
          return a.name.localeCompare(b.name);
        case "event_date": {
          const av = a.event_date ?? "";
          const bv = b.event_date ?? "";
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return bv.localeCompare(av); // newest first
        }
        case "last_upload": {
          const av = lastUploads.get(a.id) ?? "";
          const bv = lastUploads.get(b.id) ?? "";
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return bv.localeCompare(av);
        }
        case "created":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return arr;
  }, [projects, search, filterClient, filterEventType, filterStatus, sortKey, lastUploads, showArchived, selectedFolder, folders]);

  const assignProjectToFolder = async (projectId: string, folderId: string | null) => {
    const { error } = await supabase
      .from("projects")
      .update({ folder_id: folderId })
      .eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success(folderId ? "Moved to folder" : "Removed from folder");
    load();
  };

  const filtersActive =
    !!search.trim() ||
    filterClient !== ALL ||
    filterEventType !== ALL ||
    filterStatus !== ALL ||
    sortKey !== "created";

  const clearFilters = () => {
    setSearch("");
    setFilterClient(ALL);
    setFilterEventType(ALL);
    setFilterStatus(ALL);
    setSortKey("created");
  };

  const setProjectArchived = async (p: Project, archived: boolean) => {
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(archived ? "Project archived" : "Project restored");
    load();
  };

  const showSkeleton = authLoading || loading;
  const nonArchivedCount = projects.length - archivedCount;
  const hasAnyVisibleSource = (showArchived ? projects.length : nonArchivedCount) > 0;

  return (
    <AppShell crumbs={[{ label: "Projects" }]}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          {teamName && <p className="text-sm text-muted-foreground">{teamName}</p>}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
        </div>
        {!showSkeleton && nonArchivedCount > 0 && (
          <NewProjectDialog teamId={teamId} onCreated={load} />
        )}
      </div>

      {!showSkeleton && pendingInvites.count > 0 && pendingInvites.firstToken && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span>
            You have <strong>{pendingInvites.count}</strong> pending project invitation{pendingInvites.count === 1 ? "" : "s"}.
          </span>
          <Link to={`/invite/${pendingInvites.firstToken}`} className="font-medium text-primary hover:underline">
            View invite{pendingInvites.count === 1 ? "" : "s"} →
          </Link>
        </div>
      )}

      <div className="flex gap-6">
        {!showSkeleton && hasAnyVisibleSource && (
          <ProjectFolders
            folders={folders}
            selected={selectedFolder}
            onSelect={setSelectedFolder}
            counts={folderCounts}
            onChanged={load}
            onDropProject={(projectId, folderId) => assignProjectToFolder(projectId, folderId)}
            ownerId={user?.id ?? ""}
          />
        )}
        <div className="min-w-0 flex-1">
      {!showSkeleton && hasAnyVisibleSource && (
        <div className="mb-5 flex flex-col gap-3 rounded-lg border bg-card/50 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, client, or type…"
              className="pl-8"
              aria-label="Search projects"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile: collapsed Filter sheet */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative w-full justify-center">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filter
                  {(filterClient !== ALL || filterEventType !== ALL || filterStatus !== ALL || sortKey !== "created") && (
                    <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>Filter projects</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Client</Label>
                    <Select value={filterClient} onValueChange={setFilterClient}>
                      <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All clients</SelectItem>
                        {clientOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Event type</Label>
                    <Select value={filterEventType} onValueChange={setFilterEventType}>
                      <SelectTrigger><SelectValue placeholder="Event type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All types</SelectItem>
                        {eventTypeOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <span className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sort by</Label>
                    <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created">Date added</SelectItem>
                        <SelectItem value="alpha">Alphabetical</SelectItem>
                        <SelectItem value="event_date">Event date</SelectItem>
                        <SelectItem value="last_upload">Last upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter className="mt-5 flex-row gap-2">
                  <Button variant="outline" className="flex-1" onClick={clearFilters}>
                    Clear
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">Done</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop: original inline filter selects */}
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="hidden sm:w-[160px] md:flex" aria-label="Filter by client">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterEventType} onValueChange={setFilterEventType}>
            <SelectTrigger className="hidden sm:w-[160px] md:flex" aria-label="Filter by event type">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {eventTypeOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="hidden sm:w-[180px] md:flex" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="hidden sm:w-[180px] md:flex" aria-label="Sort projects">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Date added</SelectItem>
              <SelectItem value="alpha">Alphabetical</SelectItem>
              <SelectItem value="event_date">Event date</SelectItem>
              <SelectItem value="last_upload">Last upload</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="hidden md:inline-flex">
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          )}

          {archivedCount > 0 && (
            <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                aria-label="Show archived projects"
              />
              <span>
                Show archived
                <span className="ml-1 text-muted-foreground/70">({archivedCount})</span>
              </span>
            </label>
          )}
        </div>
      )}

      {showSkeleton ? (
        <ProjectGridSkeleton />
      ) : !hasAnyVisibleSource ? (
        <EmptyState
          className="mx-auto max-w-xl"
          icon={<Camera className="h-6 w-6" />}
          title="No projects yet"
          description="Spin up your first project to start uploading and organising photos."
          action={
            <NewProjectDialog
              teamId={teamId}
              onCreated={load}
              trigger={
                <Button size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first project
                </Button>
              }
            />
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mx-auto max-w-md"
          icon={<Search className="h-5 w-5" />}
          title="No matching projects"
          description="Try changing your search or filters."
          action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p) => {
            const color = p.color || DEFAULT_PROJECT_COLOR;
            const lastUpload = lastUploads.get(p.id);
            const statusMeta = projectStatusMeta(p.overall_status);
            const showStatus = (p.overall_status ?? "no_status") !== "no_status";
            const isArchived = !!p.archived_at;
            const isOwner = ownedProjectIds.has(p.id);
            return (
              <div
                key={p.id}
                className={cn("group relative", isArchived && "opacity-70 saturate-[0.4] hover:opacity-100")}
                draggable={isOwner}
                onDragStart={(e) => {
                  if (!isOwner) return;
                  e.dataTransfer.setData("application/x-project-id", p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <Link to={`/projects/${p.id}`} className="block">
                  <Card
                    className={cn(
                      "relative h-full cursor-pointer overflow-hidden border-l-4 transition-all hover:shadow-soft group-hover:border-primary/40",
                      isArchived && "bg-muted/30",
                    )}
                    style={{ borderLeftColor: color }}
                  >
                    <div className="p-5 pr-12">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            {p.template === "event_production" ? "Event" : "Project"}
                          </Badge>
                          {isArchived && (
                            <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
                              <Archive className="h-2.5 w-2.5" />
                              Archived
                            </Badge>
                          )}
                        </div>
                        {showStatus && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className={cn("h-2 w-2 rounded-full", statusMeta.dotClass)} />
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                      <h3 className="truncate text-base font-semibold tracking-tight">{p.name}</h3>
                      {p.client_name && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.client_name}</p>
                      )}
                      {p.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {p.event_type && <span>{p.event_type}</span>}
                        {p.event_date && (
                          <span>
                            {new Date(p.event_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                        {p.event_location && <span className="truncate">{p.event_location}</span>}
                        {lastUpload && (
                          <span>Last upload {new Date(lastUpload).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-70 hover:opacity-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        aria-label={`Project options for ${p.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => setEditingProject(p)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      {isOwner && (
                        <DropdownMenuItem onSelect={() => setMoveProject(p)}>
                          <FolderInput className="mr-2 h-4 w-4" /> Move to folder
                        </DropdownMenuItem>
                      )}
                      {isArchived ? (
                        <DropdownMenuItem onSelect={() => setProjectArchived(p, false)}>
                          <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setProjectArchived(p, true)}>
                          <Archive className="mr-2 h-4 w-4" /> Archive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => { setDeletingProject(p); setDeleteConfirm(""); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      </div>


      {/* Edit dialog (controlled, opens for any selected project) */}
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

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingProject}
        onOpenChange={(o) => { if (!o) { setDeletingProject(null); setDeleteConfirm(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              All albums, areas, photos, comments, share links, and history for{" "}
              <span className="font-semibold text-foreground">{deletingProject?.name}</span> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-project-name">
              Type <span className="font-mono font-semibold">{deletingProject?.name}</span> to confirm
            </Label>
            <Input
              id="confirm-project-name"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deletingProject?.name}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !deletingProject || deleteConfirm.trim() !== deletingProject.name.trim()}
              onClick={async (e) => {
                e.preventDefault();
                if (!deletingProject) return;
                setDeleting(true);
                const { error } = await supabase.rpc("delete_project", { _project_id: deletingProject.id });
                setDeleting(false);
                if (error) { toast.error(error.message); return; }
                toast.success("Project deleted");
                setDeletingProject(null);
                setDeleteConfirm("");
                load();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Move to folder dialog */}
      <Dialog open={!!moveProject} onOpenChange={(o) => !o && setMoveProject(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
          </DialogHeader>
          <RadioGroup
            value={moveProject?.folder_id ?? "__none__"}
            onValueChange={async (val) => {
              if (!moveProject) return;
              const folderId = val === "__none__" ? null : val;
              await assignProjectToFolder(moveProject.id, folderId);
              setMoveProject(null);
            }}
            className="max-h-[60vh] overflow-y-auto"
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <RadioGroupItem value="__none__" id="move-none" />
              <span className="text-sm">No folder</span>
            </label>
            {folders.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <RadioGroupItem value={f.id} id={`move-${f.id}`} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color || "hsl(var(--muted-foreground))" }} />
                <span className="text-sm">{f.name}</span>
              </label>
            ))}
            {folders.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">No folders yet. Create one from the sidebar.</p>
            )}
          </RadioGroup>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
};

export default Projects;
