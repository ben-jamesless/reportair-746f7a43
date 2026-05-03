import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderOpen, Folder, Plus, Pencil, Trash2, MoreHorizontal, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FolderRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
};

export const FOLDER_COLOR_PRESETS = [
  "#01696F", // teal
  "#1A6EFF", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#10B981", // green
  "#64748B", // slate
];

const ALL_KEY = "__all__";
const UNFOLDERED_KEY = "__unfoldered__";

export type FolderSelection = typeof ALL_KEY | typeof UNFOLDERED_KEY | string;

export const FOLDER_ALL: FolderSelection = ALL_KEY;
export const FOLDER_UNFOLDERED: FolderSelection = UNFOLDERED_KEY;

interface Props {
  folders: FolderRow[];
  selected: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  counts: { all: number; unfoldered: number; byFolder: Record<string, number> };
  onChanged: () => void;
  onDropProject: (projectId: string, folderId: string | null) => void;
  ownerId: string;
}

export const ProjectFolders = ({
  folders,
  selected,
  onSelect,
  counts,
  onChanged,
  onDropProject,
  ownerId,
}: Props) => {
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FolderRow | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragFolderId = useRef<string | null>(null);

  const handleFolderDragStart = (id: string) => {
    dragFolderId.current = id;
  };

  const handleFolderDropOnFolder = async (targetId: string) => {
    const sourceId = dragFolderId.current;
    dragFolderId.current = null;
    if (!sourceId || sourceId === targetId) return;
    // Reorder: place source before target
    const reordered = [...folders];
    const sIdx = reordered.findIndex((f) => f.id === sourceId);
    const tIdx = reordered.findIndex((f) => f.id === targetId);
    if (sIdx < 0 || tIdx < 0) return;
    const [moved] = reordered.splice(sIdx, 1);
    reordered.splice(tIdx, 0, moved);
    const updates = reordered.map((f, i) =>
      supabase.from("folders").update({ sort_order: i }).eq("id", f.id),
    );
    await Promise.all(updates);
    onChanged();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-4 space-y-1">
          <SidebarItem
            active={selected === ALL_KEY}
            onClick={() => onSelect(ALL_KEY)}
            icon={<FolderOpen className="h-4 w-4" />}
            label="All Projects"
            count={counts.all}
          />
          <div className="mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Folders
          </div>
          {folders.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => handleFolderDragStart(f.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(f.id);
              }}
              onDragLeave={() => setDragOver((v) => (v === f.id ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const projectId = e.dataTransfer.getData("application/x-project-id");
                if (projectId) {
                  onDropProject(projectId, f.id);
                } else if (dragFolderId.current) {
                  handleFolderDropOnFolder(f.id);
                }
              }}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                selected === f.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent",
                dragOver === f.id && "ring-2 ring-primary",
              )}
            >
              <GripVertical className="h-3 w-3 cursor-grab text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: f.color || "hsl(var(--muted-foreground))" }}
                />
                <span className="truncate">{f.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {counts.byFolder[f.id] ?? 0}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                    aria-label={`Folder options for ${f.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(f)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleting(f)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {counts.unfoldered > 0 && (
            <SidebarItem
              active={selected === UNFOLDERED_KEY}
              onClick={() => onSelect(UNFOLDERED_KEY)}
              icon={<Folder className="h-4 w-4 text-muted-foreground" />}
              label="Uncategorised"
              count={counts.unfoldered}
              muted
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-muted-foreground"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> New folder
          </Button>
        </div>
      </aside>

      {/* Mobile chips */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        <Chip active={selected === ALL_KEY} onClick={() => onSelect(ALL_KEY)}>
          All ({counts.all})
        </Chip>
        {folders.map((f) => (
          <Chip key={f.id} active={selected === f.id} onClick={() => onSelect(f.id)} color={f.color}>
            {f.name} ({counts.byFolder[f.id] ?? 0})
          </Chip>
        ))}
        {counts.unfoldered > 0 && (
          <Chip
            active={selected === UNFOLDERED_KEY}
            onClick={() => onSelect(UNFOLDERED_KEY)}
            muted
          >
            Uncategorised ({counts.unfoldered})
          </Chip>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {(creating || editing) && (
        <FolderEditor
          folder={editing}
          ownerId={ownerId}
          nextSortOrder={folders.length}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onChanged();
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be removed. The projects inside it will not be deleted —
              they'll just become uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                const { error } = await supabase.from("folders").delete().eq("id", deleting.id);
                if (error) toast.error(error.message);
                else toast.success("Folder deleted");
                setDeleting(null);
                if (selected === deleting.id) onSelect(ALL_KEY);
                onChanged();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const SidebarItem = ({
  active,
  onClick,
  icon,
  label,
  count,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  muted?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
      active ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent",
      muted && !active && "text-muted-foreground",
    )}
  >
    {icon}
    <span className="flex-1 truncate text-left">{label}</span>
    <span className="text-xs text-muted-foreground">{count}</span>
  </button>
);

const Chip = ({
  active,
  onClick,
  children,
  color,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string | null;
  muted?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
      active
        ? "border-primary bg-primary/10 text-primary"
        : muted
          ? "border-muted bg-background text-muted-foreground hover:bg-accent"
          : "border-border bg-background hover:bg-accent",
    )}
  >
    {color && (
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    )}
    {children}
  </button>
);

const FolderEditor = ({
  folder,
  ownerId,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  folder: FolderRow | null;
  ownerId: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState(folder?.color ?? FOLDER_COLOR_PRESETS[0]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) {
      toast.error("Folder name is required");
      return;
    }
    setBusy(true);
    if (folder) {
      const { error } = await supabase
        .from("folders")
        .update({ name: n, color })
        .eq("id", folder.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Folder updated");
    } else {
      const { error } = await supabase
        .from("folders")
        .insert({ name: n, color, owner_id: ownerId, sort_order: nextSortOrder });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Folder created");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Golf"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {FOLDER_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                    color === c && "ring-2 ring-foreground/40 ring-offset-2",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {folder ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
