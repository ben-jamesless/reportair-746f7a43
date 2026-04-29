import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ProjectGridSkeleton } from "@/components/Skeletons";
import { DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";

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
              <Link key={p.id} to={`/projects/${p.id}`} className="group">
                <Card
                  className="relative h-full cursor-pointer overflow-hidden border-l-4 transition-all hover:shadow-soft group-hover:border-primary/40"
                  style={{ borderLeftColor: color }}
                >
                  <div className="p-5">
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
            );
          })}
        </div>
      )}
    </AppShell>
  );
};

export default Projects;
