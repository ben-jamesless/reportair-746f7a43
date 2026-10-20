import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { PlanCategory } from "./usePlans";

const db = supabase as any;

/** Company-owner settings for the Plans categories every event inherits. */
export function PlanCategoriesManager({ teamId }: { teamId: string }) {
  const [cats, setCats] = useState<PlanCategory[]>([]);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();
  const load = useCallback(async () => {
    const { data } = await db.from("plan_categories").select("id,name,sort_order,is_hidden").eq("team_id", teamId).order("sort_order");
    setCats(data ?? []);
  }, [teamId]);
  useEffect(() => { load(); }, [load]);

  const upd = async (id: string, p: Partial<PlanCategory>) => {
    const { error } = await db.from("plan_categories").update(p).eq("id", id);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    load();
  };
  const move = async (i: number, d: -1 | 1) => {
    const a = cats[i], b = cats[i + d]; if (!a || !b) return;
    await Promise.all([db.from("plan_categories").update({ sort_order: b.sort_order }).eq("id", a.id), db.from("plan_categories").update({ sort_order: a.sort_order }).eq("id", b.id)]);
    load();
  };
  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await db.from("plan_categories").insert({ team_id: teamId, name: newName.trim(), sort_order: (cats.at(-1)?.sort_order ?? 0) + 1 });
    if (error) toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    setNewName(""); load();
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-base font-semibold">Plans categories</h2>
      <p className="mb-3 text-sm text-muted-foreground">Every event uses this list. Hiding a category keeps its files, shown under Other.</p>
      <div className="divide-y divide-border rounded-md border border-border">
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-2">
            <Input className="h-9" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && upd(c.id, { name: e.target.value.trim() })} />
            <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === cats.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => upd(c.id, { is_hidden: !c.is_hidden })}>
              {c.is_hidden ? <><EyeOff className="mr-1 h-4 w-4" />Hidden</> : <><Eye className="mr-1 h-4 w-4" />Shown</>}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input className="h-10" placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button className="h-10" onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
    </div>
  );
}
