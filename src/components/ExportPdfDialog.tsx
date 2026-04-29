import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, Upload, AlertTriangle, Download, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const PHOTO_CAP = 300;

type ExportRow = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  output_path: string | null;
  error_message: string | null;
  photo_count: number | null;
  created_at: string;
  completed_at: string | null;
  options: any;
};

type Sections = {
  cover: boolean; grid: boolean; captions: boolean; exif: boolean; notes: boolean; activity: boolean;
};

const DEFAULT_SECTIONS: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false };

export const ExportPdfDialog = ({ projectId, photoCount }: { projectId: string; photoCount: number }) => {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [accent, setAccent] = useState("#01696F");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const overCap = photoCount > PHOTO_CAP;

  const loadExports = async () => {
    const { data } = await supabase.from("project_exports")
      .select("id,status,output_path,error_message,photo_count,created_at,completed_at,options")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(10);
    setExports((data ?? []) as ExportRow[]);
  };

  useEffect(() => { if (open) loadExports(); }, [open, projectId]);

  // Poll while any export is in progress
  useEffect(() => {
    if (!open) return;
    const inFlight = exports.some((e) => e.status === "queued" || e.status === "processing");
    if (!inFlight) return;
    const t = setInterval(loadExports, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exports]);

  const handleLogoSelect = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setLogoFile(file);
    const path = `${projectId}/logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("export-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setLogoFile(null); return; }
    setLogoPath(path);
  };

  const startExport = async () => {
    if (overCap) { toast.error(`Photo cap exceeded (${PHOTO_CAP}). Split per album first.`); return; }
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("project_exports").insert({
      project_id: projectId,
      created_by: auth.user!.id,
      status: "queued",
      options: { sections },
      logo_path: logoPath,
      accent_color: accent,
    }).select().single();
    if (error || !row) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    // Fire and forget — edge function processes async
    supabase.functions.invoke("generate-pdf", { body: { export_id: row.id } }).catch(() => { /* polling will catch failure */ });

    toast.success("Export started");
    setSubmitting(false);
    loadExports();
  };

  const downloadExport = async (path: string) => {
    const { data, error } = await supabase.storage.from("exports").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not get download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export project as PDF</DialogTitle>
          <DialogDescription>Generate a branded PDF of your project. Photos are grouped by date.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2">
          {overCap && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex gap-3 pt-4 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Too many photos for a single export</p>
                  <p className="mt-1 text-muted-foreground">
                    This project has {photoCount} photos. The PDF export is capped at {PHOTO_CAP}. Tip: open a single album tab and export from there once we add per-album export, or remove photos before exporting.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium">Sections to include</h3>
            <div className="grid grid-cols-2 gap-2">
              <SectionToggle label="Cover page" checked={sections.cover} onChange={(v) => setSections((s) => ({ ...s, cover: v }))} />
              <SectionToggle label="Photo grid" checked={sections.grid} onChange={(v) => setSections((s) => ({ ...s, grid: v }))} />
              <SectionToggle label="Captions under photos" checked={sections.captions} onChange={(v) => setSections((s) => ({ ...s, captions: v }))} />
              <SectionToggle label="EXIF table" checked={sections.exif} onChange={(v) => setSections((s) => ({ ...s, exif: v }))} />
              <SectionToggle label="Guest notes" checked={sections.notes} onChange={(v) => setSections((s) => ({ ...s, notes: v }))} />
              <SectionToggle label="Activity log" checked={sections.activity} onChange={(v) => setSections((s) => ({ ...s, activity: v }))} />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <Label>Accent colour</Label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label>Logo (optional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />{logoFile ? "Replace" : "Upload"}</Button>
                {logoFile && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {logoFile.name}
                    <button onClick={() => { setLogoFile(null); setLogoPath(null); }}><X className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            </div>
          </section>

          <Button className="w-full" onClick={startExport} disabled={submitting || overCap}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate PDF
          </Button>

          {exports.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium">Recent exports</h3>
              <div className="space-y-2">
                {exports.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="flex items-center justify-between gap-2 pt-4 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={e.status === "ready" ? "default" : e.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                            {e.status === "processing" || e.status === "queued" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                            {e.status}
                          </Badge>
                          {e.photo_count != null && <span className="text-xs text-muted-foreground">{e.photo_count} photos</span>}
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                        </div>
                        {e.error_message && <p className="mt-1 truncate text-xs text-destructive">{e.error_message}</p>}
                      </div>
                      {e.status === "ready" && e.output_path && (
                        <Button size="sm" variant="outline" onClick={() => downloadExport(e.output_path!)}>
                          <Download className="mr-2 h-4 w-4" />Download
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SectionToggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-secondary/40">
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    {label}
  </label>
);
