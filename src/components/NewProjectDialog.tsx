import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Template = "event_production" | "blank";

interface Props {
  teamId: string | null;
  trigger?: React.ReactNode;
  onCreated?: () => void;
}

export const NewProjectDialog = ({ teamId, trigger, onCreated }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<Template>("event_production");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!user || !teamId) return toast.error("No team available");
    setBusy(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({ team_id: teamId, name, description: description || null, template, created_by: user.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setOpen(false);
    setName("");
    setDescription("");
    onCreated?.();
    if (data?.id) navigate(`/projects/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>Pick a template and give it a name.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TemplateCard
              icon={<Calendar className="h-5 w-5" />}
              title="Event production"
              description="Pre-built albums for an event lifecycle."
              selected={template === "event_production"}
              onClick={() => setTemplate("event_production")}
            />
            <TemplateCard
              icon={<FileText className="h-5 w-5" />}
              title="Blank"
              description="Start from scratch."
              selected={template === "blank"}
              onClick={() => setTemplate("blank")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proj-name">Project name</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Gala 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-desc">Description (optional)</Label>
            <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TemplateCard = ({
  icon, title, description, selected, onClick,
}: { icon: React.ReactNode; title: string; description: string; selected: boolean; onClick: () => void; }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/40",
      selected && "border-primary bg-secondary/60 ring-2 ring-primary/20"
    )}
  >
    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
      {icon}
    </div>
    <p className="text-sm font-medium">{title}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </button>
);
