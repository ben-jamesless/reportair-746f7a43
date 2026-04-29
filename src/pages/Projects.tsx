import { useEffect, useState } from "react";
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
import { Camera, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ProjectGridSkeleton } from "@/components/Skeletons";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";
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

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
  color: string | null;
};

const Projects = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

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
      .select("id, name, description, template, created_at, color")
      .eq("team_id", team.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    setProjects((projs ?? []) as Project[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => {
            const color = p.color || DEFAULT_PROJECT_COLOR;
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
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <h3 className="truncate text-base font-semibold tracking-tight">{p.name}</h3>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      ) : (
                        <p className="mt-1 text-sm italic text-muted-foreground/60">No description</p>
                      )}
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
          initialName={editingProject.name}
          initialDescription={editingProject.description}
          initialColor={editingProject.color}
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
