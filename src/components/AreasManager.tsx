import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { MONO, T } from "@/features/projectSettings/settingsUi";

export type Area = { id: string; project_id: string; name: string; sort_order: number };

interface Props {
  projectId: string;
  onChanged?: () => void;
}

export const AreasManager = ({ projectId, onChanged }: Props) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: photos }] = await Promise.all([
      supabase
        .from("areas")
        .select("id, project_id, name, sort_order")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("sort_order"),
      supabase.from("photos").select("area_id").eq("project_id", projectId),
    ]);
    setAreas((data ?? []) as Area[]);
    const next: Record<string, number> = {};
    for (const p of photos ?? []) {
      if (p.area_id) next[p.area_id] = (next[p.area_id] ?? 0) + 1;
    }
    setCounts(next);
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

  const softDelete = async (area: Area) => {
    const { error } = await supabase
      .from("areas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", area.id);
    if (error) { toast.error(error.message); return; }
    setAreas((cur) => cur.filter((a) => a.id !== area.id));
    onChanged?.();
    toast(`Area "${area.name}" deleted`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: e } = await supabase
            .from("areas")
            .update({ deleted_at: null })
            .eq("id", area.id);
          if (e) { toast.error(e.message); return; }
          await load();
          onChanged?.();
        },
      },
    });
  };

  /** Persist the current visual order as 0..n-1 so drag results survive reload. */
  const persistOrder = async (ordered: Area[]) => {
    await Promise.all(
      ordered.map((a, idx) =>
        a.sort_order === idx
          ? Promise.resolve({ error: null })
          : supabase.from("areas").update({ sort_order: idx }).eq("id", a.id),
      ),
    );
    await load();
    onChanged?.();
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const from = areas.findIndex((a) => a.id === dragId);
    const to = areas.findIndex((a) => a.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const next = [...areas];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setAreas(next);
    setDragId(null);
    void persistOrder(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. 18th Hospitality Suite"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="rounded-none"
        />
        <Button onClick={add} disabled={busy || !newName.trim()} className="rounded-none">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No areas yet. Add one above.</p>
      ) : (
        <ul className="divide-y rounded-none border" style={{ borderColor: T.rule }}>
          {areas.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 p-2"
              style={{ opacity: dragId === a.id ? 0.4 : 1 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(a.id)}
            >
              <span
                draggable
                onDragStart={() => setDragId(a.id)}
                onDragEnd={() => setDragId(null)}
                className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
                aria-label={`Reorder ${a.name}`}
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              {editingId === a.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded-none" autoFocus
                    onKeyDown={(e) => e.key === "Enter" && rename(a.id)} />
                  <Button size="icon" variant="ghost" className="rounded-none" onClick={() => rename(a.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="rounded-none" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{a.name}</span>
                  {/* A count is never rendered without a label. */}
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: T.muted }}>
                    {counts[a.id] ?? 0} {(counts[a.id] ?? 0) === 1 ? "photo" : "photos"}
                  </span>
                  <Button size="icon" variant="ghost" className="rounded-none" onClick={() => { setEditingId(a.id); setEditName(a.name); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-none" onClick={() => softDelete(a)} aria-label={`Delete ${a.name}`}>
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

