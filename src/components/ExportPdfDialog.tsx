import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, Upload, AlertTriangle, Download, X, Calendar } from "lucide-react";
import { toast } from "sonner";

const PHOTO_CAP = 300;

type ExportRow = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  output_path: string | null;
  error_message: string | null;
  photo_count: number | null;
};

type Sections = {
  cover: boolean; grid: boolean; captions: boolean; exif: boolean; notes: boolean; activity: boolean;
};

const DEFAULT_SECTIONS: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false };

type Props = {
  projectId: string;
  photoCount: number;
  /** When set, scope export to this single day (YYYY-M-D, matches edge function dayKey) and label. */
  dayKey?: string | null;
  dayLabel?: string | null;
  /** Render a custom trigger instead of the default "Export PDF" button. */
  trigger?: React.ReactNode;
  /** Controlled open (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ExportPdfDialog = ({
  projectId,
  photoCount,
  dayKey = null,
  dayLabel = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  const [sections, setSections] = useState<Sections>(DEFAULT_SECTIONS);
  const [accent, setAccent] = useState("#01696F");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentExport, setCurrentExport] = useState<ExportRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const overCap = photoCount > PHOTO_CAP;

  // Reset session state whenever the dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentExport(null);
      setSubmitting(false);
    }
  }, [open]);

  // Poll the active export until it resolves
  useEffect(() => {
    if (!open || !currentExport) return;
    if (currentExport.status === "ready" || currentExport.status === "failed") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("project_exports")
        .select("id,status,output_path,error_message,photo_count")
        .eq("id", currentExport.id).maybeSingle();
      if (data) setCurrentExport(data as ExportRow);
    }, 3000);
    return () => clearInterval(t);
  }, [open, currentExport]);

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
    setCurrentExport(null);
    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("project_exports").insert({
      project_id: projectId,
      created_by: auth.user!.id,
      status: "queued",
      options: { sections, day_key: dayKey ?? null, day_label: dayLabel ?? null },
      logo_path: logoPath,
      accent_color: accent,
    }).select("id,status,output_path,error_message,photo_count").single();
    if (error || !row) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    setCurrentExport(row as ExportRow);
    supabase.functions.invoke("generate-pdf", { body: { export_id: row.id } }).catch(() => { /* polling will catch failure */ });
    setSubmitting(false);
  };

  const downloadExport = async (path: string) => {
    const { data, error } = await supabase.storage.from("exports").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not get download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const inProgress = currentExport && (currentExport.status === "queued" || currentExport.status === "processing");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dayKey ? "Export day as PDF" : "Export project as PDF"}</DialogTitle>
          <DialogDescription>
            {dayKey
              ? `Only photos from ${dayLabel ?? "this day"} will be included, grouped by area.`
              : "Generate a branded PDF of your project. Photos are grouped by date."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2">
          {dayKey && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-2 pt-4 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Scoped to <span className="font-medium">{dayLabel}</span> · {photoCount} photo{photoCount === 1 ? "" : "s"}</span>
              </CardContent>
            </Card>
          )}

          {overCap && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex gap-3 pt-4 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Too many photos for a single export</p>
                  <p className="mt-1 text-muted-foreground">
                    {dayKey
                      ? `This day has ${photoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Remove some photos or split across more days before exporting.`
                      : `This project has ${photoCount} photos. The PDF export is capped at ${PHOTO_CAP}. Export day-by-day from the navigation, or remove photos before exporting.`}
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

          <Button className="w-full" onClick={startExport} disabled={submitting || overCap || !!inProgress}>
            {(submitting || inProgress) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {inProgress ? "Generating…" : "Generate PDF"}
          </Button>

          {currentExport && (
            <Card>
              <CardContent className="flex items-center justify-between gap-2 pt-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={currentExport.status === "ready" ? "default" : currentExport.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                      {(currentExport.status === "processing" || currentExport.status === "queued") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {currentExport.status}
                    </Badge>
                    {currentExport.photo_count != null && (
                      <span className="text-xs text-muted-foreground">{currentExport.photo_count} photos</span>
                    )}
                  </div>
                  {currentExport.error_message && <p className="mt-1 text-xs text-destructive">{currentExport.error_message}</p>}
                </div>
                {currentExport.status === "ready" && currentExport.output_path && (
                  <Button size="sm" variant="outline" onClick={() => downloadExport(currentExport.output_path!)}>
                    <Download className="mr-2 h-4 w-4" />Download
                  </Button>
                )}
              </CardContent>
            </Card>
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
