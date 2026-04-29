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
import { Camera, Plus, MoreVertical, Pencil, Trash2, Search, X, ArrowUpDown, Archive, ArchiveRestore } from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
      .select("id, name, description, template, created_at, color, event_date, event_location, overall_status, event_type, client_name, archived_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });

    const list = (projs ?? []) as Project[];
    setProjects(list);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = projects.filter((p) => {
      if (!showArchived && p.archived_at) return false;
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
  }, [projects, search, filterClient, filterEventType, filterStatus, sortKey, lastUploads, showArchived]);

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

  const showSkeleton = authLoading || loading;

  return (
    <AppShell crumbs={[{ label: "Projects" }]}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
        <div>
          {teamName && <p className="text-sm text-muted-foreground">{teamName}</p>}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
        </div>
        {!showSkeleton && projects.length > 0 && (
          <NewProjectDialog teamId={teamId} onCreated={load} />
        )}
      </div>

      {!showSkeleton && projects.length > 0 && (
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

          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by client">
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
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by event type">
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
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
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
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sort projects">
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
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      )}

      {showSkeleton ? (
        <ProjectGridSkeleton />
      ) : projects.length === 0 ? (
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
            return (
              <div key={p.id} className="group relative">
                <Link to={`/projects/${p.id}`} className="block">
                  <Card
                    className="relative h-full cursor-pointer overflow-hidden border-l-4 transition-all hover:shadow-soft group-hover:border-primary/40"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="p-5 pr-12">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          {p.template === "event_production" ? "Event" : "Project"}
                        </Badge>
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
    </AppShell>
  );
};

export default Projects;
