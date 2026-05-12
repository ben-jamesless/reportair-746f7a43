import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { ProjectEditForm } from "./ProjectEditForm";
import type { ProjectStatus } from "@/lib/projectStatus";

export interface EditProjectInitial {
  name: string;
  description: string | null;
  color: string | null;
  event_date: string | null;
  build_start_date?: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
}

interface Props extends EditProjectInitial {
  projectId: string;
  onChanged?: () => void;
  /** When true, hides the built-in trigger button and uses controlled open. */
  openControlled?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export const EditProjectDialog = ({
  projectId,
  name,
  description,
  color,
  event_date,
  event_location,
  overall_status,
  event_type,
  client_name,
  onChanged,
  openControlled,
  open: openProp,
  onOpenChange,
}: Props) => {
  const [internalOpen, setInternalOpen] = useState(openControlled ? true : false);
  const open = openControlled ? (openProp ?? internalOpen) : internalOpen;
  const setOpen = (next: boolean) => {
    if (openControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!openControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update project details and event information.</DialogDescription>
        </DialogHeader>

        <ProjectEditForm
          projectId={projectId}
          name={name}
          description={description}
          color={color}
          event_date={event_date}
          event_location={event_location}
          overall_status={overall_status}
          event_type={event_type}
          client_name={client_name}
          onSaved={onChanged}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
