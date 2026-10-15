import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { FileDown, Loader2, Download, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectPlan } from "@/hooks/useProjectPlan";
import { ensureProjectTimeZone } from "@/hooks/useProjectTimeZone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AvailableDay = { key: string; label: string; date: Date; photoCount: number };
type Props = {
  projectId: string; photoCount: number; dayKey?: string | null; dayLabel?: string | null;
  availableDays?: AvailableDay[]; lockMode?: "single" | null; trigger?: React.ReactNode;
  shareToken?: string | null; open?: boolean; onOpenChange?: (open: boolean) => void;
};
const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
const normalizeKey = (key: string) => key.split("-").map((part, index) => index ? part.padStart(2, "0") : part).join("-");
const toDate = (key: string) => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); };

export function ExportPdfDialog({ projectId, photoCount, dayKey, dayLabel, availableDays = [], trigger, shareToken, open: controlledOpen, onOpenChange }: Props) {
  const { canExportPdf, loading: planLoading } = useProjectPlan(projectId);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => onOpenChange ? onOpenChange(value) : setInternalOpen(value);
  const [mode, setMode] = useState("single");
  const [quality, setQuality] = useState("compressed");
  const [currentDay, setCurrentDay] = useState(dayKey ? normalizeKey(dayKey) : dateKey(new Date()));
  const [days, setDays] = useState<AvailableDay[]>(availableDays);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<Blob | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!open) { generation.current += 1; return; }
    let cancelled = false;
    setError(""); setFile(null); setReadyUrl(null); setBusy(false); setMode("single");
    setLoadingDays(true);
    (async () => {
      let list = availableDays.map(day => ({ ...day, key: normalizeKey(day.key) }));
      let today = dateKey(new Date());
      if (!shareToken) {
        const tz = await ensureProjectTimeZone(projectId);
        today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const counts = new Map<string, number>();
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("photos").select("captured_at").eq("project_id", projectId).not("captured_at", "is", null).range(offset, offset + 999);
          if (error) throw error;
          for (const photo of data ?? []) {
            if (!photo.captured_at) continue;
            const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(photo.captured_at));
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          if (!data || data.length < 1000) break;
        }
        list = [...counts].map(([key, count]) => ({ key, date: toDate(key), label: key, photoCount: count }));
      }
      if (cancelled) return;
      list.sort((a,b) => a.key.localeCompare(b.key));
      setDays(list); setCurrentDay(dayKey ? normalizeKey(dayKey) : today);
      setFrom(list[0]?.key ?? today); setTo(list[list.length - 1]?.key ?? today);
    })().catch(() => { if (!cancelled) setError("Couldn’t load report dates. Close and try again."); }).finally(() => { if (!cancelled) setLoadingDays(false); });
    return () => { cancelled = true; };
  }, [open, projectId, dayKey, shareToken]);

  const count = useMemo(() => mode === "range" ? days.filter(day => from && to && day.key >= from && day.key <= to).reduce((sum, day) => sum + day.photoCount, 0) : days.find(day => day.key === currentDay)?.photoCount ?? (dayKey ? photoCount : 0), [mode, days, from, to, currentDay, dayKey, photoCount]);
  const overCap = count > 300;
  const start = async () => {
    setBusy(true); setError(""); setFile(null); setReadyUrl(null);
    const run = ++generation.current;
    try {
      const options = { template: "portrait_v1", orientation: "portrait", quality, ...(mode === "range" ? { date_from: from, date_to: to } : { day_key: currentDay, day_label: dayLabel ?? currentDay }) };
      let id: string;
      if (shareToken) {
        const { data, error } = await supabase.functions.invoke("share-create-export", { body: { token: shareToken, mode, day_key: currentDay, date_from: from, date_to: to, options } });
        if (error || !data?.export_id) throw new Error(data?.error ?? "Couldn’t start the export.");
        id = data.export_id;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Please sign in again to export.");
        const { data, error } = await supabase.from("project_exports").insert({ project_id: projectId, created_by: auth.user.id, status: "queued", options }).select("id").single();
        if (error || !data) throw new Error("Couldn’t start the export.");
        id = data.id;
        void supabase.functions.invoke("generate-pdf", { body: { export_id: id } }).then(({ error }) => {
          if (error && generation.current === run) { setError("The report generator couldn’t complete the request. Please try again."); }
        });
      }
      const deadline = Date.now() + 5 * 60 * 1000;
      let url: string | null = null;
      while (Date.now() < deadline && generation.current === run) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (shareToken) {
          const { data, error } = await supabase.functions.invoke("share-export-url", { body: { token: shareToken, export_id: id } });
          if (error) throw new Error("Couldn’t check the export. Please try again.");
          if (data?.status === "failed") throw new Error(data.error_message ?? "Export failed.");
          if (data?.status === "ready" && data.url) { url = data.url; break; }
        } else {
          const { data, error } = await supabase.from("project_exports").select("status,output_path,error_message").eq("id", id).single();
          if (error) throw new Error("Couldn’t check the export. Please try again.");
          if (data.status === "failed") throw new Error(data.error_message ?? "Export failed.");
          if (data.status === "ready" && data.output_path) {
            const { data: signed, error } = await supabase.storage.from("exports").createSignedUrl(data.output_path, 3600, { download: "buildfolder-report.pdf" });
            if (error || !signed) throw new Error("Couldn’t prepare the download.");
            url = signed.signedUrl; break;
          }
        }
      }
      if (generation.current !== run) return;
      if (!url) throw new Error("Export timed out. Please try a smaller date range.");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Couldn’t prepare the download.");
      const blob = await response.blob();
      if (generation.current !== run) return;
      setFile(blob); setReadyUrl(url); setError("");
    } catch (error) { if (generation.current === run) setError(error instanceof Error ? error.message : "Export failed. Please try again."); }
    finally { if (generation.current === run) setBusy(false); }
  };
  const download = async () => {
    if (!file) return;
    const report = new File([file], "buildfolder-report.pdf", { type: "application/pdf" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [report] })) {
      try { await navigator.share({ files: [report], title: "BuildFolder report" }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = report.name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline" size="sm"><FileDown />Export PDF</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-none border-border bg-background p-0 shadow-none">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2"><FileDown className="h-5 w-5" />Export PDF</DialogTitle>
          <DialogDescription>Portrait report</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="export-date-mode" className="font-mono text-xs uppercase text-muted-foreground">Report date</Label>
            <Select value={mode} onValueChange={value => { setMode(value); setFile(null); }} disabled={busy}>
              <SelectTrigger id="export-date-mode" className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="single">Current date</SelectItem><SelectItem value="range">Date range</SelectItem></SelectContent>
            </Select>
            {mode === "single" ? <p className="flex items-center gap-2 py-2 text-sm"><CalendarIcon className="h-4 w-4 text-muted-foreground" />{format(toDate(currentDay), "d MMMM yyyy")}</p> : (
              <div className="grid grid-cols-2 gap-3 pt-2"><DateField label="From" value={from} onChange={setFrom} max={to} disabled={busy} /><DateField label="To" value={to} onChange={setTo} min={from} disabled={busy} /></div>
            )}
            <p className="text-xs text-muted-foreground">{loadingDays ? "Loading dates…" : `${count} photos`}</p>
          </div>
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="font-mono text-xs uppercase text-muted-foreground">File size</legend>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "compressed", label: "Compressed", detail: "Smaller file" }, { value: "high_res", label: "Large", detail: "Higher image detail" }].map(option => (
                <label key={option.value} className={cn("flex cursor-pointer items-start gap-2 border p-3", quality === option.value ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="radio" name="export-quality" value={option.value} checked={quality === option.value} onChange={() => { setQuality(option.value); setFile(null); }} className="mt-1 accent-primary" />
                  <span><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {overCap && <p role="alert" className="text-sm text-destructive">This selection exceeds 300 photos. Choose a smaller date range.</p>}
          {!shareToken && !planLoading && !canExportPdf && <p className="text-sm text-destructive">PDF export isn’t available on your current plan or you’ve reached its export limit.</p>}
          {error && <p role="alert" className="break-words border-t border-border pt-4 text-sm text-destructive">{error}</p>}
          {file ? <div className="space-y-2 border-t border-border pt-4"><p role="status" className="text-sm">Your report is ready.</p><Button onClick={download} className="w-full rounded-none"><Download />Download PDF</Button>{readyUrl && <a href={readyUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-muted-foreground underline">Open PDF</a>}</div> : <Button onClick={start} disabled={busy || loadingDays || overCap || (!shareToken && (planLoading || !canExportPdf)) || (mode === "range" && (!from || !to))} className="w-full rounded-none">{busy ? <Loader2 className="animate-spin" /> : <FileDown />}{busy ? "Generating report…" : "Generate PDF"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function DateField({ label, value, onChange, min, max, disabled }: { label: string; value: string | null; onChange: (value: string) => void; min?: string | null; max?: string | null; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" disabled={disabled} aria-label={label} className="w-full justify-start rounded-none px-2 font-normal"><CalendarIcon />{value ? format(toDate(value), "d MMM yyyy") : "Pick a date"}</Button></PopoverTrigger><PopoverContent className="w-auto rounded-none p-0" align="start"><Calendar mode="single" selected={value ? toDate(value) : undefined} defaultMonth={value ? toDate(value) : undefined} onSelect={date => { if (date) { onChange(dateKey(date)); setOpen(false); } }} disabled={date => !!((min && dateKey(date) < min) || (max && dateKey(date) > max))} initialFocus className="pointer-events-auto p-3" /></PopoverContent></Popover></div>;
}
