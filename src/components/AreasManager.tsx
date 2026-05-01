import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

export type Area = { id: string; project_id: string; name: string; sort_order: number };

interface Props {
  projectId: string;
  onChanged?: () => void;
}

export const AreasManager = ({ projectId, onChanged }: Props) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("areas")
      .select("id, project_id, name, sort_order")
      .eq("project_id", projectId)
      .order("sort_order");
    setAreas((data ?? []) as Area[]);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const nextOrder = areas.length ? Math.max(...areas.map((a) => a.sort_order)) + 1 : 0;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("areas").insert({
      project_id: projectId, name, sort_order: nextOrder, created_by: user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewName("");
    await load();
    onChanged?.();
  };

  const rename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase.from("areas").update({ name }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    await load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this area? Photos tagged with it will become untagged.")) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
    onChanged?.();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= areas.length) return;
    const a = areas[idx], b = areas[j];
    const updates = [
      supabase.from("areas").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("areas").update({ sort_order: a.sort_order }).eq("id", b.id),
    ];
    await Promise.all(updates);
    await load();
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. 18th Hospitality Suite"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={busy || !newName.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No areas yet. Add one above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {areas.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2 p-2">
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === areas.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              {editingId === a.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" autoFocus
                    onKeyDown={(e) => e.key === "Enter" && rename(a.id)} />
                  <Button size="icon" variant="ghost" onClick={() => rename(a.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{a.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(a.id); setEditName(a.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
