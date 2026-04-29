import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, FolderOpen, Loader2, Plus } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
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
      .select("id, name, description, template, created_at")
      .eq("team_id", team.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    setProjects(projs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{teamName}</p>
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          </div>
          {projects.length > 0 && <NewProjectDialog teamId={teamId} onCreated={load} />}
        </div>

        {projects.length === 0 ? (
          <Card className="mx-auto max-w-xl border-dashed text-center shadow-none">
            <CardContent className="flex flex-col items-center gap-4 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Camera className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">No projects yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Spin up your first project to start uploading and organising photos.
                </p>
              </div>
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
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className="h-full cursor-pointer transition-all hover:border-primary/40 hover:shadow-soft">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {p.template === "event_production" ? "Event" : "Blank"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.description && (
                      <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Projects;
