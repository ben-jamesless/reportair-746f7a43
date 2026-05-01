import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { AreasManager } from "./AreasManager";
import { AlbumsManager } from "./AlbumsManager";
import { InvitesManager } from "./InvitesManager";
import { ShareLinksManager } from "./ShareLinksManager";
import { ProjectEditForm } from "./ProjectEditForm";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectStatus } from "@/lib/projectStatus";

interface ProjectForEdit {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  event_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  default_view?: "report" | "gallery" | null;
}

interface Props {
  projectId: string;
  /** Current project values — required so the Details tab can edit them. */
  project: ProjectForEdit;
  onChanged?: () => void;
  /** Optional default tab to open on. */
  defaultTab?: "details" | "areas" | "albums" | "members" | "share";
}

export const ProjectSettingsDialog = ({ projectId, project, onChanged, defaultTab = "details" }: Props) => {
  const [open, setOpen] = useState(false);
  const [canManageAlbums, setCanManageAlbums] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: pm }, { data: ar }] = await Promise.all([
        supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCanManageAlbums(pm?.role === "owner" || !!ar);
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Edit details, areas, members, and sharing for this project.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="areas">Areas</TabsTrigger>
            {canManageAlbums && <TabsTrigger value="albums">Albums</TabsTrigger>}
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <ProjectEditForm
              projectId={projectId}
              name={project.name}
              description={project.description}
              color={project.color}
              event_date={project.event_date}
              event_location={project.event_location}
              overall_status={project.overall_status}
              event_type={project.event_type}
              client_name={project.client_name}
              onSaved={onChanged}
              onClose={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="areas" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <AreasManager projectId={projectId} onChanged={onChanged} />
          </TabsContent>
          {canManageAlbums && (
            <TabsContent value="albums" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <AlbumsManager projectId={projectId} onChanged={onChanged} />
            </TabsContent>
          )}
          <TabsContent value="members" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <InvitesManager projectId={projectId} />
          </TabsContent>
          <TabsContent value="share" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <ShareLinksManager projectId={projectId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
