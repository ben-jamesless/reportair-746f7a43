import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V2 } from "@/features/sharePageV2/tokens";
import { PanelHeader } from "@/features/sharePageV2/components/Primitives";
import { TypeTile } from "./PlanDialogs";
import { isPdf, isPreviewableImage } from "./planRules";

type SharedPlan = {
  id: string; name: string; kind: string; url: string | null; category: string; category_order: number;
  area_ids: string[]; revision_label: string | null; file_ext: string | null; has_preview: boolean; updated_at: string;
};
const SHORT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

async function signedUrl(token: string, id: string, opts: { preview?: boolean; download?: boolean } = {}) {
  const { data } = await supabase.functions.invoke("share-plan-url", { body: { token, plan_file_id: id, ...opts } });
  return (data as { url?: string } | null)?.url ?? null;
}

/** Client-link card listing files the team has explicitly shared. Hidden when none are. */
export function SharePlansCard({ token, areas }: { token: string; areas: { id: string; name: string }[] }) {
  const [plans, setPlans] = useState<SharedPlan[]>([]);
  const [open, setOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(false);
  const [viewing, setViewing] = useState<SharedPlan | null>(null);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("share_plan_files" as never, { _token: token } as never).then(({ data }) => setPlans((data as SharedPlan[] | null) ?? []));
  }, [token]);

  if (plans.length === 0) return null;

  const openPlan = (p: SharedPlan) => (p.kind === "link" && p.url ? window.open(p.url, "_blank", "noopener") : setViewing(p));

  return (
    <div className="overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport, marginBottom: open ? 28 : 8 }}>
      <PanelHeader title="Plans and visuals" open={open} onToggle={() => setOpen((v) => !v)} right={<span style={{ opacity: 0.75 }}>{plans.length}</span>} />
      {open && (
        <div style={{ backgroundColor: V2.white }}>
          {plans.slice(0, 5).map((p) => <PlanRow key={p.id} p={p} onClick={() => openPlan(p)} />)}
          <button type="button" onClick={() => setAllOpen(true)} className="w-full px-3.5 py-2.5 text-left"
            style={{ borderTop: `1px solid ${V2.rule}`, fontSize: 12.5, fontWeight: 600, color: V2.ink }}>
            View all plans ({plans.length}) →
          </button>
        </div>
      )}
      <AllPlansDialog open={allOpen} onOpenChange={setAllOpen} plans={plans} areas={areas} onPick={(p) => { setAllOpen(false); openPlan(p); }} />
      <PlanViewer token={token} plan={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function PlanRow({ p, onClick }: { p: SharedPlan; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left" style={{ borderTop: `1px solid ${V2.rule}` }}>
      <TypeTile ext={p.file_ext} kind={p.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate" title={p.name} style={{ fontSize: 12.5, fontWeight: 600, color: V2.ink }}>{p.name}</span>
        <span className="block truncate tabular-nums" style={{ fontSize: 11, color: V2.muted }}>
          {[p.revision_label, p.category, SHORT.format(new Date(p.updated_at))].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

function AllPlansDialog({ open, onOpenChange, plans, areas, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; plans: SharedPlan[]; areas: { id: string; name: string }[]; onPick: (p: SharedPlan) => void;
}) {
  const [area, setArea] = useState("__all__");
  const list = plans.filter((p) => area === "__all__" || p.area_ids.length === 0 || p.area_ids.includes(area));
  const cats = Array.from(new Map(list.map((p) => [p.category, p.category_order])).entries()).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Plans and visuals</DialogTitle></DialogHeader>
        {areas.length > 0 && (
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All areas</SelectItem>
              {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {cats.map((c) => (
          <section key={c} className="overflow-hidden rounded-md border border-border">
            <header className="bg-muted px-3.5 py-2 text-sm font-medium">{c}</header>
            {list.filter((p) => p.category === c).map((p) => <PlanRow key={p.id} p={p} onClick={() => onPick(p)} />)}
          </section>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No shared plans for this area.</p>}
      </DialogContent>
    </Dialog>
  );
}

function PlanViewer({ token, plan, onClose }: { token: string; plan: SharedPlan | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const img = isPreviewableImage(plan?.file_ext);
  const pdf = isPdf(plan?.file_ext);
  const usePreview = !img && !pdf && !!plan?.has_preview;
  useEffect(() => {
    setUrl(null);
    if (plan && (img || pdf || usePreview)) signedUrl(token, plan.id, { preview: usePreview }).then(setUrl);
  }, [plan, token, img, pdf, usePreview]);
  const download = async () => { if (!plan) return; const u = await signedUrl(token, plan.id, { download: true }); if (u) window.open(u, "_blank", "noopener"); };
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle className="truncate pr-6">{plan?.name}{plan?.revision_label ? ` · ${plan.revision_label}` : ""}</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-md border border-border bg-muted">
          {url ? (img ? <img src={url} alt={plan?.name} className="max-h-[70dvh] w-full object-contain" /> : <iframe src={url} title={plan?.name} className="h-[70dvh] w-full bg-card" />)
            : <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted-foreground"><TypeTile ext={plan?.file_ext} />No preview for this file. Download to open it.</div>}
        </div>
        <div className="flex justify-end gap-2">
          {plan?.kind === "link" && plan.url && <Button variant="outline" className="h-10" onClick={() => window.open(plan.url!, "_blank", "noopener")}><ExternalLink className="mr-2 h-4 w-4" />Open</Button>}
          <Button className="h-10" onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
