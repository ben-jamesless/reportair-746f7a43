import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Eye, Lock, ExternalLink, Download, Trash2, Loader2, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { cn } from "@/lib/utils";
import { usePlans, updatePlanFile, signedPlanUrl, attachPreview, type PlanFile, type PlanVersion, type PlanCategory } from "./usePlans";
import { AddFilesDialog, AddLinkDialog, RevisionDialog, TypeTile } from "./PlanDialogs";
import { canShareWithClient, canStillRestore, formatBytes, isPdf, isPreviewableImage } from "./planRules";

const ALL = "__all__";
const TO_SORT = "__tosort__";
const NONE = "__none__";
const SHORT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function PlansTab({ projectId, canEdit, isOwner }: { projectId: string; canEdit: boolean; isOwner: boolean }) {
  const { user } = useAuth();
  const { areas } = useProjectDetail(projectId);
  const { categories, files, versionsByFile, names, loading, reload } = usePlans(projectId);
  const [chip, setChip] = useState<string>(ALL);
  const [areaFilter, setAreaFilter] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const isMobile = useIsMobile();
  const areaOpts = areas.map((a) => ({ id: a.id, name: a.name }));
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "Area";

  // Hidden categories fall back to "Other" so files never disappear.
  const other = categories.find((c) => c.name === "Other" && !c.is_hidden) ?? null;
  const effectiveCat = (f: PlanFile): PlanCategory | null => {
    const c = categories.find((x) => x.id === f.category_id);
    if (!c) return null;
    return c.is_hidden ? other ?? { id: "__other__", name: "Other", sort_order: 999, is_hidden: false } : c;
  };

  const live = files.filter((f) => !f.deleted_at);
  const deleted = files.filter((f) => f.deleted_at && canStillRestore(f.deleted_at));
  const areaMatch = (f: PlanFile) => areaFilter === ALL || f.area_ids.length === 0 || f.area_ids.includes(areaFilter);
  const scoped = live.filter(areaMatch);

  // Counts and list come from the same array so they always agree.
  const counts = useMemo(() => {
    const m = new Map<string, number>(); let toSort = 0;
    scoped.forEach((f) => { const c = effectiveCat(f); if (!c) toSort++; else m.set(c.id, (m.get(c.id) ?? 0) + 1); });
    return { m, toSort };
  }, [scoped, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleCats = categories.filter((c) => !c.is_hidden);
  const shown = scoped.filter((f) => chip === ALL || (chip === TO_SORT ? !effectiveCat(f) : effectiveCat(f)?.id === chip));
  const groups = [
    { id: TO_SORT, name: "To sort", items: shown.filter((f) => !effectiveCat(f)) },
    ...visibleCats.map((c) => ({ id: c.id, name: c.name, items: shown.filter((f) => effectiveCat(f)?.id === c.id) })),
  ].filter((g) => g.items.length > 0);

  useEffect(() => { if (chip === TO_SORT && counts.toSort === 0) setChip(ALL); }, [chip, counts.toSort]);

  const selected = files.find((f) => f.id === selectedId) ?? null;
  const current = (f: PlanFile) => versionsByFile.get(f.id)?.find((v) => v.id === f.current_version_id) ?? null;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const detail = selected && (
    <PlanDetail
      key={selected.id}
      file={selected} versions={versionsByFile.get(selected.id) ?? []} current={current(selected)}
      categories={visibleCats} areas={areaOpts} names={names} canEdit={canEdit} isOwner={isOwner}
      userId={user?.id ?? ""} projectId={projectId} onChanged={reload} onClose={() => setSelectedId(null)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {counts.toSort > 0 && (
          <Chip active={chip === TO_SORT} onClick={() => setChip(TO_SORT)} tone="amber">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />To sort <Count n={counts.toSort} />
          </Chip>
        )}
        <Chip active={chip === ALL} onClick={() => setChip(ALL)}>All files <Count n={scoped.length} /></Chip>
        {visibleCats.map((c) => (
          <Chip key={c.id} active={chip === c.id} onClick={() => setChip(c.id)}>{c.name} <Count n={counts.m.get(c.id) ?? 0} /></Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="h-10 w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All areas</SelectItem>
            {areaOpts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canEdit && <Button variant="outline" className="h-10" onClick={() => setLinkOpen(true)}>Add link</Button>}
        {canEdit && <Button className="h-10" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add files</Button>}
        {isOwner && deleted.length > 0 && (
          <button className="ml-auto text-xs text-muted-foreground underline" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "Hide deleted" : `Recently deleted (${deleted.length})`}
          </button>
        )}
      </div>

      {showDeleted && isOwner && (
        <div className="rounded-lg border border-border">
          {deleted.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
              <TypeTile ext={current(f)?.file_ext} kind={f.kind} />
              <span className="min-w-0 flex-1 truncate text-sm" title={f.name}>{f.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">Deleted {SHORT.format(new Date(f.deleted_at!))}</span>
              <Button variant="outline" size="sm" onClick={async () => { await updatePlanFile(f.id, { deleted_at: null, deleted_by: null }); reload(); }}>
                <ArchiveRestore className="mr-1 h-4 w-4" />Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {live.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Keep the event's CAD layouts, renders, schedules, permits and supplier documents in one place, with older revisions kept out of the way.</p>
          {canEdit && <Button className="mt-4 h-10" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add files</Button>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            {groups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No files match this filter.</p>}
            {groups.map((g) => {
              const sort = g.id === TO_SORT;
              return (
                <section key={g.id} className={cn("overflow-hidden rounded-lg border", sort ? "border-warning/40" : "border-[hsl(var(--section-border,240_6%_84%))]")}>
                  <header className={cn("flex items-center gap-3 px-4 py-3 text-sm font-medium", sort ? "bg-warning/10 text-warning" : "bg-muted")}>
                    <span>{g.name}</span>
                    {sort && <span className="hidden font-normal sm:inline">No category chosen yet. Pick one to file them.</span>}
                    <span className="ml-auto tabular-nums">{g.items.length}</span>
                  </header>
                  {g.items.map((f) => {
                    const v = current(f);
                    return (
                      <button key={f.id} onClick={() => setSelectedId(f.id)}
                        className={cn("flex w-full items-center gap-3 border-t border-border bg-card px-4 py-3 text-left hover:bg-muted/50", selectedId === f.id && "shadow-[inset_3px_0_0_hsl(var(--foreground))]")}>
                        <Thumb file={f} version={v} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted-foreground">
                            {v?.revision_label && <span className="rounded border border-border px-1.5 font-medium text-foreground">{v.revision_label}</span>}
                            <span>{f.kind === "link" ? "Link" : (v?.file_ext ?? "").toUpperCase()}{v?.preview_storage_path ? " + PDF" : ""}</span>
                            <span>{SHORT.format(new Date(v?.uploaded_at ?? f.created_at))} · {names[v?.uploaded_by ?? f.created_by ?? ""] ?? "Team"}</span>
                          </p>
                        </div>
                        <div className="hidden max-w-[40%] flex-wrap justify-end gap-1 sm:flex">
                          {(f.area_ids.length ? f.area_ids.map(areaName) : ["All areas"]).map((n) => (
                            <span key={n} className="max-w-[160px] truncate rounded border border-border px-2 py-0.5 text-xs text-muted-foreground" title={n}>{n}</span>
                          ))}
                        </div>
                        {sort ? (
                          <span className="shrink-0 rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Needs sorting</span>
                        ) : f.client_visible ? (
                          <span className="flex w-20 shrink-0 items-center gap-1 text-xs font-medium text-success"><Eye className="h-3.5 w-3.5" />Client</span>
                        ) : (
                          <span className="flex w-20 shrink-0 items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Internal</span>
                        )}
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
          {!isMobile && (
            <aside className="hidden lg:block">
              {detail ?? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Select a file to see its details and history.</div>}
            </aside>
          )}
        </div>
      )}

      {/* Narrow screens: detail opens as a full-height sheet. */}
      <Sheet open={!!selected && (isMobile || (typeof window !== "undefined" && window.innerWidth < 1024))} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md lg:hidden">
          <SheetHeader><SheetTitle className="sr-only">File details</SheetTitle></SheetHeader>
          {detail}
        </SheetContent>
      </Sheet>

      {canEdit && user && (
        <>
          <AddFilesDialog open={addOpen} onOpenChange={setAddOpen} projectId={projectId} userId={user.id} categories={categories} areas={areaOpts} onAdded={reload} />
          <AddLinkDialog open={linkOpen} onOpenChange={setLinkOpen} projectId={projectId} userId={user.id} categories={categories} areas={areaOpts} onAdded={reload} />
        </>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) { return <span className="ml-1 tabular-nums opacity-70">{n}</span>; }

function Chip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone?: "amber"; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm",
        active ? "border-foreground bg-foreground text-background" : tone === "amber" ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-card hover:bg-muted")}>
      {children}
    </button>
  );
}

function useSigned(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let c = false; setUrl(null); if (path) signedPlanUrl(path).then((u) => !c && setUrl(u)).catch(() => {}); return () => { c = true; }; }, [path]);
  return url;
}

function Thumb({ file, version }: { file: PlanFile; version: PlanVersion | null }) {
  const img = file.kind === "file" && isPreviewableImage(version?.file_ext);
  const url = useSigned(img ? version?.storage_path : null);
  if (url) return <img src={url} alt="" className="h-10 w-14 shrink-0 rounded border border-border object-cover" loading="lazy" />;
  return <span className="flex h-10 w-14 shrink-0 items-center justify-center"><TypeTile ext={version?.file_ext} kind={file.kind} /></span>;
}

function PlanDetail({ file, versions, current, categories, areas, names, canEdit, isOwner, userId, projectId, onChanged, onClose }: {
  file: PlanFile; versions: PlanVersion[]; current: PlanVersion | null; categories: PlanCategory[];
  areas: { id: string; name: string }[]; names: Record<string, string>; canEdit: boolean; isOwner: boolean;
  userId: string; projectId: string; onChanged: () => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(file.name);
  const [revOpen, setRevOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [sortCat, setSortCat] = useState<string | null>(null);
  const [sortArea, setSortArea] = useState<string>(ALL);
  const pdfRef = useRef<HTMLInputElement>(null);
  const toSort = file.category_id == null;
  const previewPath = isPdf(current?.file_ext) || isPreviewableImage(current?.file_ext) ? current?.storage_path : current?.preview_storage_path;
  const previewUrl = useSigned(file.kind === "file" ? previewPath : null);
  const previewIsImg = isPreviewableImage(current?.file_ext);
  const cad = ["dwg", "dxf"].includes((current?.file_ext ?? "").toLowerCase());

  const save = async (p: Partial<PlanFile>) => {
    try { await updatePlanFile(file.id, p); onChanged(); }
    catch (e: any) { toast({ title: "Couldn't save", description: e?.message, variant: "destructive" }); }
  };
  const download = async (path: string) => {
    try { window.open(await signedPlanUrl(path, true), "_blank", "noopener"); }
    catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4">
      {toSort && canEdit && (
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm font-medium text-warning">Needs sorting</p>
          <Select value={sortCat ?? NONE} onValueChange={(v) => setSortCat(v === NONE ? null : v)}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Choose…</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <AreaPick value={sortArea} onChange={setSortArea} areas={areas} />
          <Button className="h-10 w-full" disabled={!sortCat} onClick={() => save({ category_id: sortCat, area_ids: sortArea === ALL ? [] : [sortArea] })}>File it</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-muted">
        {file.kind === "link" ? (
          <div className="p-6 text-center text-sm text-muted-foreground"><TypeTile kind="link" className="mx-auto mb-2" />External link — access depends on the other service's own sharing settings.</div>
        ) : previewUrl ? (
          previewIsImg ? <img src={previewUrl} alt={file.name} className="max-h-72 w-full object-contain" />
            : <iframe src={previewUrl} title={file.name} className="h-72 w-full bg-card" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <TypeTile ext={current?.file_ext} />
            {cad ? "DWG kept for download. Add a PDF to preview it." : "No preview for this file type. Download to open it."}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {canEdit ? (
          <Input className="h-10 text-base font-semibold" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== file.name && save({ name: name.trim() })} aria-label="File name" />
        ) : <h3 className="text-base font-semibold">{file.name}</h3>}
        <p className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
          {current?.revision_label && <span className="rounded border border-border px-1.5 font-medium text-foreground">{current.revision_label} · Current</span>}
          <span>{file.kind === "link" ? "Link" : (current?.file_ext ?? "").toUpperCase()}{current?.preview_storage_path ? " + PDF preview" : ""}</span>
          <span>{formatBytes(current?.size_bytes)}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {file.kind === "link" ? (
          <Button className="h-10" onClick={() => window.open(file.url!, "_blank", "noopener")}><ExternalLink className="mr-2 h-4 w-4" />Open link</Button>
        ) : (
          <>
            {canEdit && <Button className="h-10" onClick={() => setRevOpen(true)}>Upload new revision</Button>}
            {current && <Button variant="outline" className="h-10" onClick={() => download(current.storage_path)}><Download className="mr-2 h-4 w-4" />Download</Button>}
            {canEdit && cad && current && !current.preview_storage_path && (
              <>
                <Button variant="outline" className="h-10" onClick={() => pdfRef.current?.click()}>Attach PDF preview</Button>
                <input ref={pdfRef} type="file" accept=".pdf" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                  try { await attachPreview(projectId, file.id, current.id, f); onChanged(); } catch (err: any) { toast({ title: "Couldn't attach", description: err?.message, variant: "destructive" }); }
                }} />
              </>
            )}
          </>
        )}
      </div>

      {!toSort && (
        <Field label="Category">
          {canEdit ? (
            <Select value={file.category_id ?? NONE} onValueChange={(v) => save({ category_id: v === NONE ? null : v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-sm">{categories.find((c) => c.id === file.category_id)?.name ?? "Other"}</p>}
        </Field>
      )}

      <Field label="Linked areas">
        <div className="flex flex-wrap gap-1.5">
          {canEdit ? (
            <>
              <AreaToggle active={file.area_ids.length === 0} onClick={() => save({ area_ids: [] })}>All areas</AreaToggle>
              {areas.map((a) => {
                const on = file.area_ids.includes(a.id);
                return <AreaToggle key={a.id} active={on} onClick={() => save({ area_ids: on ? file.area_ids.filter((x) => x !== a.id) : [...file.area_ids, a.id] })}>{a.name}</AreaToggle>;
              })}
            </>
          ) : (file.area_ids.length ? file.area_ids.map((id) => areas.find((a) => a.id === id)?.name ?? "Area") : ["All areas"]).map((n) => (
            <span key={n} className="rounded border border-border px-2 py-0.5 text-xs">{n}</span>
          ))}
        </div>
      </Field>

      {canEdit && (
        <Field label="Who can see this">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">Visible on client link</p>
              <p className="text-xs text-muted-foreground">{canShareWithClient(file) ? "Current revision only" : "File it into a category first"}</p>
            </div>
            <Switch checked={file.client_visible} disabled={!canShareWithClient(file)} onCheckedChange={(v) => save({ client_visible: v })} aria-label="Visible on client link" />
          </div>
        </Field>
      )}

      {file.kind === "file" && versions.length > 0 && (
        <Field label="Version history">
          <ul className="divide-y divide-border">
            {versions.map((v) => {
              const cur = v.id === file.current_version_id;
              return (
                <li key={v.id} className="flex gap-3 py-2.5">
                  <span className={cn("w-12 shrink-0 text-sm font-medium", !cur && "text-muted-foreground")}>{v.revision_label ?? "—"}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    {v.change_note && <p className={cn(!cur && "text-muted-foreground")}>{v.change_note}</p>}
                    <p className="text-xs tabular-nums text-muted-foreground">{SHORT.format(new Date(v.uploaded_at))} · {names[v.uploaded_by ?? ""] ?? "Team"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("text-xs", cur ? "font-medium text-success" : "text-muted-foreground")}>{cur ? "Current" : "Superseded"}</span>
                    {!cur && <button className="text-xs underline" onClick={() => download(v.storage_path)}>Download</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Field>
      )}

      {canEdit && (
        <Button variant="ghost" className="h-10 text-destructive hover:text-destructive" onClick={() => setConfirmDel(true)}>
          <Trash2 className="mr-2 h-4 w-4" />Delete
        </Button>
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>It and all its revisions are removed from the event and the client link straight away. An event owner can restore it for 30 days.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await save({ deleted_at: new Date().toISOString(), deleted_by: userId } as any); onClose(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RevisionDialog open={revOpen} onOpenChange={setRevOpen} projectId={projectId} fileId={file.id} userId={userId} onSaved={onChanged} />
      {isOwner && null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2 border-t border-border pt-4"><p className="text-sm font-medium">{label}</p>{children}</div>;
}

function AreaToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("max-w-full truncate rounded border px-2 py-1 text-xs", active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
      {children}
    </button>
  );
}

function AreaPick({ value, onChange, areas }: { value: string; onChange: (v: string) => void; areas: { id: string; name: string }[] }) {
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
