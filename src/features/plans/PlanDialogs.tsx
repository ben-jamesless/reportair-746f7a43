import { useRef, useState } from "react";

// Brand terracotta accent — matches the photo background-upload card.
const TERRACOTTA = "#D4573A";
import { Upload, X, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createPlanFile, createPlanLink, uploadRevision, type PlanCategory } from "./usePlans";
import { formatBytes, prefillCategoryName, typeTile, fileExt, validatePlanFile, ACCEPTED_EXTS } from "./planRules";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const NONE = "__none__";
type AreaOpt = { id: string; name: string };

export function TypeTile({ ext, kind, className }: { ext?: string | null; kind?: string; className?: string }) {
  const t = typeTile(ext, kind);
  return (
    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-wide text-[hsl(var(--plan-tile-fg))]", t.cls, className)}>
      {t.label}
    </span>
  );
}

function CategorySelect({ value, onChange, categories }: { value: string | null; onChange: (v: string | null) => void; categories: PlanCategory[] }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-10"><SelectValue placeholder="Choose…" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Choose…</SelectItem>
        {categories.filter((c) => !c.is_hidden).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function AreaSelect({ value, onChange, areas }: { value: string; onChange: (v: string) => void; areas: AreaOpt[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All areas</SelectItem>
        {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

type Row = { key: string; file: File; categoryId: string | null; area: string; revision: string; status: "ready" | "uploading" | "done" | "failed"; error?: string };

export function AddFilesDialog({ open, onOpenChange, projectId, userId, categories, areas, onAdded }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; userId: string;
  categories: PlanCategory[]; areas: AreaOpt[]; onAdded: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const minimizedRef = useRef(false);
  const minimize = (v: boolean) => { minimizedRef.current = v; setMinimized(v); };
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = () => { setRows([]); setRejected([]); setBusy(false); minimize(false); };
  // Closing mid-upload sends it to the background instead of cancelling.
  const close = (o: boolean) => { if (busy && !o) { minimize(true); return; } if (!o) reset(); onOpenChange(o); };

  const addFiles = (list: File[]) => {
    const ok: Row[] = []; const bad: { name: string; reason: string }[] = [];
    list.forEach((f) => {
      const err = validatePlanFile(f);
      if (err) { bad.push({ name: f.name, reason: err }); return; }
      const pre = prefillCategoryName(f.name);
      const cat = pre ? categories.find((c) => c.name === pre && !c.is_hidden)?.id ?? null : null;
      ok.push({ key: crypto.randomUUID(), file: f, categoryId: cat, area: ALL, revision: "", status: "ready" });
    });
    setRows((r) => [...r, ...ok]); setRejected((r) => [...r, ...bad]);
  };

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const setAll = (p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.status === "done" ? r : { ...r, ...p })));

  const run = async (targets: Row[]) => {
    setBusy(true);
    let failures = 0;
    for (const r of targets) {
      patch(r.key, { status: "uploading", error: undefined });
      try {
        await createPlanFile({ projectId, userId, file: r.file, categoryId: r.categoryId, areaIds: r.area === ALL ? [] : [r.area], revision: r.revision });
        patch(r.key, { status: "done" });
      } catch (e: any) {
        failures++;
        patch(r.key, { status: "failed", error: e?.message ?? "Upload failed" });
      }
    }
    setBusy(false);
    onAdded();
    // Finished in the background with nothing to fix: tidy away.
    if (minimizedRef.current && failures === 0) { reset(); onOpenChange(false); }
  };

  const pending = rows.filter((r) => r.status !== "done");
  const failed = rows.filter((r) => r.status === "failed");
  const unsorted = pending.filter((r) => !r.categoryId).length;
  const allDone = rows.length > 0 && pending.length === 0;
  const batch = rows.filter((r) => r.status !== "ready" || busy);
  const batchDone = batch.filter((r) => r.status === "done" || r.status === "failed").length;
  const pct = batch.length ? Math.round((batchDone / batch.length) * 100) : 0;
  const inFlight = busy || (minimized && failed.length > 0);

  return (
    <>
    {open && minimized && inFlight && (
      <button type="button" onClick={() => minimize(false)} aria-label="Plans upload in progress — click to view"
        className="fixed bottom-4 right-4 z-50 w-64 border border-border bg-background p-3 text-left shadow-lg transition-colors hover:bg-muted/50">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Upload className="h-4 w-4" style={{ color: TERRACOTTA }} />
            {busy ? `Uploading plans ${batchDone} of ${batch.length}` : `${failed.length} plan${failed.length === 1 ? "" : "s"} failed`}
          </span>
          {busy && <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden bg-muted">
          <div className="h-full transition-[width] duration-300 ease-out" style={{ backgroundColor: TERRACOTTA, width: `${Math.max(4, pct)}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{busy ? "Click to view upload" : "Click to retry"}</p>
      </button>
    )}
    <Dialog open={open && !minimized} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto overflow-x-hidden">
        <DialogHeader><DialogTitle>Add files</DialogTitle></DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files)); }}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center", drag && "border-foreground bg-muted")}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm">Drop plans, renders and documents here</p>
          <p className="text-xs text-muted-foreground">PDF, DWG, DXF, Word, Excel, CSV, JPG, PNG, HEIC · up to 200 MB each</p>
          <Button type="button" variant="outline" className="h-10" onClick={() => inputRef.current?.click()}>Browse files</Button>
          <input ref={inputRef} type="file" multiple hidden accept={ACCEPTED_EXTS.map((e) => `.${e}`).join(",")}
            onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </div>

        {rejected.length > 0 && (
          <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
            {rejected.map((r, i) => <li key={i}><span className="font-medium">{r.name}</span> — {r.reason}</li>)}
          </ul>
        )}

        {rows.length > 0 && (
          <>
            {pending.length > 1 && (
              <div className="grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-[1fr_1fr_1fr_0.7fr] sm:items-center">
                <span className="text-sm font-medium">Set for all files</span>
                <CategorySelect value={null} onChange={(v) => setAll({ categoryId: v })} categories={categories} />
                <AreaSelect value={ALL} onChange={(v) => setAll({ area: v })} areas={areas} />
              </div>
            )}
            <div className="hidden grid-cols-[1fr_1fr_1fr_0.7fr] gap-2 px-3 text-xs font-medium text-muted-foreground sm:grid">
              <span>File</span><span>Category</span><span>Area</span><span>Revision</span>
            </div>
            <div className="space-y-2">
              {rows.map((r) => {
                const toSort = !r.categoryId;
                const locked = r.status === "done" || r.status === "uploading";
                return (
                  <div key={r.key} className={cn("grid min-w-0 gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_0.7fr] sm:items-center", toSort && r.status !== "done" && "border-warning/40 bg-warning/10")}>
                    <div className="flex min-w-0 items-center gap-2">
                      <TypeTile ext={fileExt(r.file.name)} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={r.file.name}>{r.file.name}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatBytes(r.file.size)}
                          {toSort && r.status !== "done" && <span className="ml-2 font-medium text-warning">To sort</span>}
                          {r.status === "uploading" && " · Uploading…"}
                          {r.status === "done" && <span className="ml-2 text-success">Added</span>}
                          {r.status === "failed" && <span className="ml-2 text-destructive">{r.error}</span>}
                        </p>
                      </div>
                      {r.status === "ready" && !busy && (
                        <button className="ml-auto text-muted-foreground sm:hidden" aria-label="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><X className="h-4 w-4" /></button>
                      )}
                    </div>
                    <fieldset disabled={locked} className="contents">
                      <CategorySelect value={r.categoryId} onChange={(v) => patch(r.key, { categoryId: v })} categories={categories} />
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <AreaSelect value={r.area} onChange={(v) => patch(r.key, { area: v })} areas={areas} />
                        <Input className="h-10" placeholder="e.g. Rev A" value={r.revision} onChange={(e) => patch(r.key, { revision: e.target.value })} />
                      </div>
                    </fieldset>
                  </div>
                );
              })}
            </div>
            {!allDone && (
              <p className="flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", unsorted ? "bg-warning" : "bg-success")} />
                {pending.length} file{pending.length === 1 ? "" : "s"} ·{" "}
                {unsorted ? `${unsorted} without a category will go to To sort` : "All files have a category"}
              </p>
            )}
          </>
        )}

        {busy && (
          <div>
            <div className="mb-1 flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>Uploading {batchDone} of {batch.length}</span><span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden bg-muted">
              <div className="h-full transition-[width] duration-300 ease-out" style={{ backgroundColor: TERRACOTTA, width: `${Math.max(4, pct)}%` }} />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <p className="mr-auto text-xs text-muted-foreground">All files are added as Internal</p>
          {allDone ? (
            <Button className="h-10" onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              {busy ? (
                <Button variant="outline" className="h-10" onClick={() => minimize(true)}>Continue in background</Button>
              ) : (
                <Button variant="outline" className="h-10" onClick={() => close(false)}>Cancel</Button>
              )}
              {failed.length > 0 && !busy && (
                <Button variant="outline" className="h-10" onClick={() => run(failed)}><RotateCw className="mr-2 h-4 w-4" />Retry {failed.length}</Button>
              )}
              <Button className="h-10" disabled={busy || !pending.some((r) => r.status === "ready")}
                onClick={() => run(pending.filter((r) => r.status === "ready"))}>
                {busy ? "Adding…" : `Add ${pending.filter((r) => r.status === "ready").length} files`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function AddLinkDialog({ open, onOpenChange, projectId, userId, categories, areas, onAdded }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; userId: string;
  categories: PlanCategory[]; areas: AreaOpt[]; onAdded: () => void;
}) {
  const [url, setUrl] = useState(""); const [name, setName] = useState("");
  const [cat, setCat] = useState<string | null>(null); const [area, setArea] = useState(ALL);
  const [busy, setBusy] = useState(false); const { toast } = useToast();
  const valid = /^https:\/\/[^\s]+\.[^\s]+/.test(url.trim()) && name.trim().length > 0;
  const save = async () => {
    setBusy(true);
    try {
      await createPlanLink({ projectId, userId, url: url.trim(), name: name.trim(), categoryId: cat, areaIds: area === ALL ? [] : [area] });
      onAdded(); onOpenChange(false); setUrl(""); setName(""); setCat(null); setArea(ALL);
    } catch (e: any) { toast({ title: "Couldn't add link", description: e?.message, variant: "destructive" }); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogHeader><DialogTitle>Add link</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>URL</Label><Input className="h-10" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div className="space-y-1"><Label>Display name</Label><Input className="h-10" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Category</Label><CategorySelect value={cat} onChange={setCat} categories={categories} /></div>
          <div className="space-y-1"><Label>Area</Label><AreaSelect value={area} onChange={setArea} areas={areas} /></div>
          <p className="text-xs text-muted-foreground">Only https links. Access depends on the other service's own sharing settings.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-10" disabled={!valid || busy} onClick={save}>Add link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevisionDialog({ open, onOpenChange, projectId, fileId, userId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; fileId: string; userId: string; onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null); const [label, setLabel] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!file) return;
    const v = validatePlanFile(file); if (v) { setErr(v); return; }
    setBusy(true); setErr(null);
    try {
      await uploadRevision({ projectId, fileId, userId, file, label, note });
      onSaved(); onOpenChange(false); setFile(null); setLabel(""); setNote("");
    } catch (e: any) { setErr(e?.message ?? "Upload failed. Try again."); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogHeader><DialogTitle>Upload new revision</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>File</Label>
            <Input type="file" className="h-10" accept={ACCEPTED_EXTS.map((e) => `.${e}`).join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1"><Label>Revision label</Label><Input className="h-10" placeholder="e.g. Rev D" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="space-y-1"><Label>What changed (optional)</Label><Input className="h-10" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">The new file becomes current. Category, areas and client visibility stay the same.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-10" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-10" disabled={!file || !label.trim() || busy} onClick={save}>{busy ? "Uploading…" : "Save revision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
