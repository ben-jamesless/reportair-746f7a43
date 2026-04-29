import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { AreasManager } from "./AreasManager";

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Manage areas for this project. Areas are spatial locations independent of albums.</DialogDescription>
        </DialogHeader>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Areas</h3>
          <AreasManager projectId={projectId} onChanged={onChanged} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
