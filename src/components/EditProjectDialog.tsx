import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROJECT_COLOR_PALETTE, DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";

interface Props {
  projectId: string;
  initialName: string;
  initialDescription: string | null;
  initialColor: string | null;
  onChanged?: () => void;
  /** When true, hides the built-in trigger button and uses controlled open. */
  openControlled?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export const EditProjectDialog = ({
  projectId, initialName, initialDescription, initialColor, onChanged,
  openControlled, open: openProp, onOpenChange,
}: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(openControlled ? true : false);
  const open = openControlled ? (openProp ?? internalOpen) : internalOpen;
  const setOpen = (next: boolean) => {
    if (openControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [color, setColor] = useState(initialColor || DEFAULT_PROJECT_COLOR);
  const [busy, setBusy] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Delete state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription ?? "");
    setColor(initialColor || DEFAULT_PROJECT_COLOR);
    setConfirmingDelete(false);
    setConfirmText("");
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsOwner(data?.role === "owner");
    })();
  }, [open, user, projectId, initialName, initialDescription, initialColor]);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({ name: name.trim(), description: description.trim() || null, color })
      .eq("id", projectId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project updated");
    onChanged?.();
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (confirmText.trim() !== initialName.trim()) {
      toast.error("Project name doesn't match");
      return;
    }
    setDeleting(true);
    const { error } = await supabase.rpc("delete_project", { _project_id: projectId });
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    setOpen(false);
    navigate("/projects");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update the name, description, and accent colour.</DialogDescription>
        </DialogHeader>

        {!confirmingDelete ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Accent colour</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PROJECT_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Select color ${c}`}
                    className={cn(
                      "relative h-7 w-7 rounded-full border transition-transform hover:scale-110",
                      color === c && "ring-2 ring-offset-2 ring-foreground/40",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />}
                  </button>
                ))}
                <div className="ml-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                    aria-label="Custom color picker"
                  />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-28 font-mono text-xs" />
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Danger zone</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete this project and all of its photos, areas, comments, and history. This cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={save} disabled={busy || !name.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">This action is permanent.</p>
              <p className="mt-1 text-muted-foreground">
                All albums, areas, photos, comments, share links, and history for this project will be deleted.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type <span className="font-mono font-semibold">{initialName}</span> to confirm
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={initialName}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setConfirmingDelete(false); setConfirmText(""); }} disabled={deleting}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting || confirmText.trim() !== initialName.trim()}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete project
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
