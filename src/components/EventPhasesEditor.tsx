import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

export type PhaseKind = "pre_build" | "build" | "on_show" | "takedown";

const KIND_LABEL: Record<PhaseKind, string> = {
  pre_build: "Pre-build",
  build: "Build",
  on_show: "On show",
  takedown: "Takedown",
};

type PhaseRow = {
  id: string;
  kind: PhaseKind;
  label: string;
  start_date: string;
  end_date: string;
  sort_order: number;
};

/**
 * Edits the event lifecycle phases (build / on show / takedown) plus the
 * build-window end date. Phases drive the client report's lifecycle mode:
 * once every phase has finished, the report switches to "filed".
 */
export const EventPhasesEditor = ({ projectId }: { projectId: string }) => {
  const [rows, setRows] = useState<PhaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /** Keeps projects.build_end_date in sync with the last phase end date. */
  const syncBuildEnd = async (list: PhaseRow[]) => {
    const last = list.map((r) => r.end_date).filter(Boolean).sort().pop() ?? null;
    await supabase.from("projects").update({ build_end_date: last }).eq("id", projectId);
  };

  const load = async () => {
    const { data: phases } = await supabase
      .from("event_phases")
      .select("id, kind, label, start_date, end_date, sort_order")
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });
    const list = ((phases ?? []) as PhaseRow[]).map((p) => ({ ...p, kind: p.kind as PhaseKind }));
    setRows(list);
    setLoading(false);
    void syncBuildEnd(list);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addPhase = async (kind: PhaseKind) => {
    const today = new Date().toISOString().slice(0, 10);
    setBusy(true);
    const { error } = await supabase.from("event_phases").insert({
      project_id: projectId,
      kind,
      label: KIND_LABEL[kind],
      start_date: today,
      end_date: today,
      sort_order: rows.length,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const patch = async (id: string, changes: Partial<PhaseRow>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...changes } : r));
    setRows(next);
    const { error } = await supabase.from("event_phases").update(changes).eq("id", id);
    if (error) { toast.error(error.message); void load(); return; }
    if (changes.end_date) void syncBuildEnd(next);
  };

  const remove = async (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    const { error } = await supabase.from("event_phases").delete().eq("id", id);
    if (error) { toast.error(error.message); void load(); return; }
    void syncBuildEnd(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold">Event timeline</Label>
        <p className="text-xs text-muted-foreground">
          Add the phases that make up this event. The build window and the client report's
          lifecycle (live → filed) follow these dates automatically.
        </p>
      </div>


      {loading ? (
        <p className="text-xs text-muted-foreground">Loading phases…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No phases yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-end gap-2 border-t border-dashed border-border pt-2">
              <div className="w-[130px]">
                <Label className="text-[11px] text-muted-foreground">Phase</Label>
                <Select value={r.kind} onValueChange={(v) => void patch(r.id, { kind: v as PhaseKind, label: KIND_LABEL[v as PhaseKind] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABEL) as PhaseKind[]).map((k) => (
                      <SelectItem key={k} value={k} disabled={k !== r.kind && rows.some((x) => x.kind === k)}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[120px] flex-1">
                <Label className="text-[11px] text-muted-foreground">Label</Label>
                <Input value={r.label} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} onBlur={(e) => void patch(r.id, { label: e.target.value.trim() || KIND_LABEL[r.kind] })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Starts</Label>
                <Input type="date" value={r.start_date} onChange={(e) => void patch(r.id, { start_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Ends</Label>
                <Input type="date" value={r.end_date} onChange={(e) => void patch(r.id, { end_date: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => void remove(r.id)} aria-label={`Remove ${r.label}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as PhaseKind[]).map((k) => {
          const used = rows.some((r) => r.kind === k);
          return (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || used}
              onClick={() => void addPhase(k)}
              title={used ? `${KIND_LABEL[k]} already added` : undefined}
            >
              {used ? <Check className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              {KIND_LABEL[k]}
              {used && <span className="ml-1 text-[11px] text-muted-foreground">added</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
