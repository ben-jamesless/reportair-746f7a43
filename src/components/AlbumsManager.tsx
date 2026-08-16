import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { inkButtonClass } from "@/features/projectSettings/settingsUi";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
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

export type Album = {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  position: number;
};

interface Props {
  projectId: string;
  onChanged?: () => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "album";

export const AlbumsManager = ({ projectId, onChanged }: Props) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("albums")
      .select("id, project_id, name, slug, position")
      .eq("project_id", projectId)
      .order("position");
    setAlbums((data ?? []) as Album[]);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const isDuplicate = (name: string, ignoreId?: string) =>
    albums.some(
      (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase() && a.id !== ignoreId,
    );

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (isDuplicate(name)) {
      toast.error("An album with that name already exists.");
      return;
    }
    setBusy(true);
    const nextPosition = albums.length ? Math.max(...albums.map((a) => a.position)) + 1 : 0;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Make slug unique per project by appending a short suffix on collision.
    let slug = slugify(name);
    if (albums.some((a) => a.slug === slug)) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { error } = await supabase.from("albums").insert({
      project_id: projectId,
      name,
      slug,
      position: nextPosition,
      created_by: user?.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewName("");
    toast.success("Album added");
    await load();
    onChanged?.();
  };

  const rename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    if (isDuplicate(name, id)) {
      toast.error("An album with that name already exists.");
      return;
    }
    const { error } = await supabase.from("albums").update({ name }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    toast.success("Album renamed");
    await load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("albums").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingDeleteId(null);
    toast.success("Album deleted");
    await load();
    onChanged?.();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= albums.length) return;
    const a = albums[idx],
      b = albums[j];
    await Promise.all([
      supabase.from("albums").update({ position: b.position }).eq("id", a.id),
      supabase.from("albums").update({ position: a.position }).eq("id", b.id),
    ]);
    await load();
    onChanged?.();
  };

  const pendingDeleteAlbum = pendingDeleteId
    ? albums.find((a) => a.id === pendingDeleteId) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Pre-event, Show day, Bump-out"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={busy || !newName.trim()} className={inkButtonClass}>
          <Plus className="mr-1 h-4 w-4" /> Add album
        </Button>
      </div>

      {albums.length === 0 ? (
        <p className="text-sm text-muted-foreground">No albums yet. Add one above.</p>
      ) : (
        <ul className="divide-y border">
          {albums.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2 p-2">
              <div className="flex flex-col">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => move(i, 1)}
                  disabled={i === albums.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              {editingId === a.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onBlur={() => rename(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(a.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => rename(a.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-sm hover:underline"
                    onClick={() => {
                      setEditingId(a.id);
                      setEditName(a.name);
                    }}
                  >
                    {a.name}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(a.id);
                      setEditName(a.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPendingDeleteId(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDeleteAlbum ? `"${pendingDeleteAlbum.name}"` : "album"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Photos in this album will become unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDeleteId && remove(pendingDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete album
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
