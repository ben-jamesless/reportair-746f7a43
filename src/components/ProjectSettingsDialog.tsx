import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { AreasManager } from "./AreasManager";
import { InvitesManager } from "./InvitesManager";
import { ShareLinksManager } from "./ShareLinksManager";

interface Props {
  projectId: string;
  onChanged?: () => void;
}

export const ProjectSettingsDialog = ({ projectId, onChanged }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Manage areas, members, and sharing for this project.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="areas">
          <TabsList>
            <TabsTrigger value="areas">Areas</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
          <TabsContent value="areas" className="mt-4 max-h-[60vh] overflow-y-auto">
            <AreasManager projectId={projectId} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="members" className="mt-4 max-h-[60vh] overflow-y-auto">
            <InvitesManager projectId={projectId} />
          </TabsContent>
          <TabsContent value="share" className="mt-4 max-h-[60vh] overflow-y-auto">
            <ShareLinksManager projectId={projectId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
