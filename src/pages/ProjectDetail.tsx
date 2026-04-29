import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImagePlus, Loader2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, description, template")
        .eq("id", id)
        .maybeSingle();
      setProject(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container py-10">
          <p className="text-muted-foreground">Project not found.</p>
          <Link to="/projects" className="mt-4 inline-block text-sm text-primary underline">Back to projects</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-10">
        <Link to="/projects" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All projects
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">
              {project.template === "event_production" ? "Event production" : "Blank"}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>

        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImagePlus className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Photos coming soon</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload, EXIF parsing, AI captions, comments, and sharing arrive in Phase 2.
            </p>
            <Button disabled variant="outline">Upload photos</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProjectDetail;
