import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { outlineButtonClass, SectionLabel } from "@/features/projectSettings/settingsUi";



const MONO = "'Inter Variable', Inter, system-ui, sans-serif";

/**
 * Ops-side Finalise / Unfile.
 * Setting projects.finalised_at flips event_lifecycle_mode() to `filed`,
 * which the share link picks up on its next meta poll — no re-render of data.
 */
export function FinaliseEventBlock({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalisedAt, setFinalisedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("finalised_at,event_summary_text")
      .eq("id", projectId)
      .maybeSingle();
    const row = data as { finalised_at: string | null; event_summary_text: string | null } | null;
    setFinalisedAt(row?.finalised_at ?? null);
    setSummary(row?.event_summary_text ?? "");
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalise = async () => {
    setConfirmOpen(false);
    setSaving(true);
    const stamp = new Date().toISOString();
    const { error } = await supabase
      .from("projects")
      .update({ finalised_at: stamp, event_summary_text: summary.trim() })
      .eq("id", projectId);
    setSaving(false);
    if (error) return toast.error(error.message);
    setFinalisedAt(stamp);
    toast.success("Event filed — the client link now shows the event record");
  };

  const unfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("projects").update({ finalised_at: null }).eq("id", projectId);
    setSaving(false);
    if (error) return toast.error(error.message);
    setFinalisedAt(null);
    toast.success("Event reopened — the client link is live again");
  };

  const saveSummary = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ event_summary_text: summary.trim() })
      .eq("id", projectId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Event summary saved");
  };

  if (loading) return null;

  return (
    <section className="mb-6">
      <SectionLabel>Finalise event</SectionLabel>

      {finalisedAt ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Filed{" "}
            {new Date(finalisedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} —
            the client link renders the event record.
          </p>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Event summary shown on the client record"
            className="mb-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={saveSummary} disabled={saving}>
              Save summary
            </Button>
            <Button size="sm" variant="ghost" onClick={unfile} disabled={saving}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Unfile
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Filing closes the live report and switches the client link to a retrospective event record. Reversible.
          </p>
          <Button
            size="sm"
            variant="outline"
            className={`w-full ${outlineButtonClass}`}
            disabled={saving}
            onClick={() => setConfirmOpen(true)}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            Finalise event…
          </Button>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalise this event?</AlertDialogTitle>
            <AlertDialogDescription>
              The client link will immediately switch from the live build report to the filed event record. You can
              unfile it again if this was a mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={finalise}>Finalise</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
