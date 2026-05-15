import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Archive, CalendarIcon, Check, ImageIcon, Loader2, Trash2, Upload, X, Crown } from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROJECT_COLOR_PALETTE, DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/projectStatus";
import { usePlan } from "@/hooks/usePlan";

export type ProjectDefaultView = "report" | "gallery";

export interface ProjectEditValues {
  name: string;
  description: string | null;
  color: string | null;
  event_date: string | null; // ISO yyyy-mm-dd
  build_start_date?: string | null; // ISO yyyy-mm-dd
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  default_view?: ProjectDefaultView | null;
}

interface Props extends ProjectEditValues {
  projectId: string;
  onSaved?: () => void;
  /** Called after successful save / cancel. Used by container dialogs to close themselves. */
  onClose?: () => void;
  /** When true, hides the danger zone (used in places where deletion isn't appropriate). */
  hideDangerZone?: boolean;
}

const toIsoDate = (d: Date | undefined): string | null => {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fromIsoDate = (s: string | null): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

export const ProjectEditForm = ({
  projectId,
  name: initialName,
  description: initialDescription,
  color: initialColor,
  event_date: initialEventDate,
  build_start_date: initialBuildStartDate,
  event_location: initialEventLocation,
  overall_status: initialStatus,
  event_type: initialEventType,
  client_name: initialClient,
  default_view: initialDefaultView,
  onSaved,
  onClose,
  hideDangerZone,
}: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canUseCustomLogo } = usePlan();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [color, setColor] = useState(initialColor || DEFAULT_PROJECT_COLOR);
  const [eventDate, setEventDate] = useState<Date | undefined>(fromIsoDate(initialEventDate));
  const [buildStartDate, setBuildStartDate] = useState<Date | undefined>(fromIsoDate(initialBuildStartDate ?? null));
  const [eventLocation, setEventLocation] = useState(initialEventLocation ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initialStatus ?? "no_status");
  const [eventType, setEventType] = useState(initialEventType ?? "");
  const [clientName, setClientName] = useState(initialClient ?? "");
  const [defaultView, setDefaultView] = useState<ProjectDefaultView>(initialDefaultView ?? "report");

  const [busy, setBusy] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Logo
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Archive state
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Sync when the project changes externally
  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription ?? "");
    setColor(initialColor || DEFAULT_PROJECT_COLOR);
    setEventDate(fromIsoDate(initialEventDate));
    setBuildStartDate(fromIsoDate(initialBuildStartDate ?? null));
    setEventLocation(initialEventLocation ?? "");
    setStatus(initialStatus ?? "no_status");
    setEventType(initialEventType ?? "");
    setClientName(initialClient ?? "");
    setDefaultView(initialDefaultView ?? "report");
  }, [initialName, initialDescription, initialColor, initialEventDate, initialBuildStartDate, initialEventLocation, initialStatus, initialEventType, initialClient, initialDefaultView]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [{ data: pm }, { data: ar }] = await Promise.all([
        supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      setIsOwner(pm?.role === "owner");
      setIsAdmin(!!ar);
    })();
  }, [user, projectId]);

  // Self-fetch build_start_date so callers that don't pass it (e.g. Projects list) still see the saved value.
  useEffect(() => {
    if (initialBuildStartDate !== undefined && initialBuildStartDate !== null) return;
    (async () => {
      const { data } = await supabase.from("projects").select("build_start_date").eq("id", projectId).maybeSingle();
      const v = (data as { build_start_date?: string | null } | null)?.build_start_date ?? null;
      if (v) setBuildStartDate(fromIsoDate(v));
    })();
  }, [projectId, initialBuildStartDate]);

  // Load existing logo + signed preview URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("projects").select("logo_path").eq("id", projectId).maybeSingle();
      if (cancelled) return;
      const path = (data as { logo_path?: string | null } | null)?.logo_path ?? null;
      setLogoPath(path);
      if (path) {
        const { data: signed } = await supabase.storage.from("export-assets").createSignedUrl(path, 600);
        if (!cancelled) setLogoUrl(signed?.signedUrl ?? null);
      } else {
        setLogoUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const onLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setLogoUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${projectId}/project-logo-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("export-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) { toast.error(upErr.message); return; }
      const { error: updErr } = await supabase.from("projects").update({ logo_path: path }).eq("id", projectId);
      if (updErr) { toast.error(updErr.message); return; }
      // Best-effort cleanup of previous logo
      if (logoPath && logoPath !== path) {
        await supabase.storage.from("export-assets").remove([logoPath]).catch(() => undefined);
      }
      setLogoPath(path);
      const { data: signed } = await supabase.storage.from("export-assets").createSignedUrl(path, 600);
      setLogoUrl(signed?.signedUrl ?? null);
      toast.success("Logo updated");
      onSaved?.();
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!logoPath) return;
    setLogoUploading(true);
    try {
      const prev = logoPath;
      const { error } = await supabase.from("projects").update({ logo_path: null }).eq("id", projectId);
      if (error) { toast.error(error.message); return; }
      await supabase.storage.from("export-assets").remove([prev]).catch(() => undefined);
      setLogoPath(null);
      setLogoUrl(null);
      toast.success("Logo removed");
      onSaved?.();
    } finally {
      setLogoUploading(false);
    }
  };


  const canChangeDefaultView = isOwner || isAdmin;

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    const update = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      event_date: toIsoDate(eventDate),
      build_start_date: toIsoDate(buildStartDate),
      event_location: eventLocation.trim() || null,
      overall_status: status,
      event_type: eventType.trim() || null,
      client_name: clientName.trim() || null,
      ...(canChangeDefaultView ? { default_view: defaultView } : {}),
    };
    const { error } = await supabase
      .from("projects")
      .update(update)
      .eq("id", projectId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project updated");
    onSaved?.();
    onClose?.();
  };

  const confirmDelete = async () => {
    if (confirmText.trim() !== initialName.trim()) {
      toast.error("Project name doesn't match");
      return;
    }
    setDeleting(true);
    const { error } = await supabase.rpc("delete_project", { _project_id: projectId });
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    onSaved?.();
    onClose?.();
    navigate("/projects");
  };

  const confirmArchive = async () => {
    setArchiving(true);
    const { error } = await supabase
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", projectId);
    setArchiving(false);
    if (error) { toast.error(error.message); return; }
    setConfirmingArchive(false);
    toast.success("Project archived");
    onSaved?.();
    onClose?.();
    navigate("/projects");
  };

  if (confirmingDelete) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">This action is permanent.</p>
          <p className="mt-1 text-muted-foreground">
            All albums, areas, photos, comments, share links, and history for this project will be deleted.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            Type <span className="font-mono font-semibold">{initialName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={initialName}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setConfirmingDelete(false); setConfirmText(""); }} disabled={deleting}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={deleting || confirmText.trim() !== initialName.trim()}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="edit-name">Project name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-client">Client</Label>
          <Input id="edit-client" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Acme Corp" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-event-type">Event type</Label>
          <Input id="edit-event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="e.g. Conference, Wedding" />
        </div>

        <div className="space-y-2">
          <Label>Event date</Label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {eventDate && (
              <Button type="button" variant="ghost" size="icon" onClick={() => setEventDate(undefined)} aria-label="Clear date">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Build start date</Label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !buildStartDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {buildStartDate ? format(buildStartDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={buildStartDate}
                  onSelect={setBuildStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {buildStartDate && (
              <Button type="button" variant="ghost" size="icon" onClick={() => setBuildStartDate(undefined)} aria-label="Clear date">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Day 1 of build for "Build Day N" labels in reports.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-location">Event location</Label>
          <Input id="edit-location" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="e.g. London, UK" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Overall status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", s.dotClass)} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canChangeDefaultView && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Default project view</Label>
            <p className="text-xs text-muted-foreground">
              Which layout opens first when this project is loaded. Owners and admins can change this.
            </p>
            <div className="inline-flex rounded-md border bg-background p-1" role="radiogroup" aria-label="Default project view">
              {(["report", "gallery"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={defaultView === v}
                  onClick={() => setDefaultView(v)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    defaultView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {v === "report" ? "Report view" : "Gallery view"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>Accent colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {PROJECT_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
                className={cn(
                  "relative h-7 w-7 rounded-full border transition-transform hover:scale-110",
                  color === c && "ring-2 ring-offset-2 ring-foreground/40",
                )}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />}
              </button>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border"
                aria-label="Custom color picker"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-28 font-mono text-xs" />
            </div>
          </div>
        </div>

        {canUseCustomLogo ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>Project logo</Label>
            <p className="text-xs text-muted-foreground">
              Used on every PDF report exported from this project. PNG or JPG, under 2MB.
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLogoFile(f);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                {logoUrl ? (
                  <img src={logoUrl} alt="Project logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {logoPath ? "Replace logo" : "Upload logo"}
                </Button>
                {logoPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    disabled={logoUploading}
                  >
                    <X className="mr-2 h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 sm:col-span-2">
            <Label>Project logo <Crown className="ml-1 h-3 w-3 text-amber-400 inline" /></Label>
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Custom logos are available on the Studio plan.{" "}
              <a href="/billing" className="underline font-medium">Upgrade</a>
            </div>
          </div>
        )}
      </div>

      {!hideDangerZone && isOwner && (
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-start gap-2">
            <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Archive project</p>
              <p className="text-xs text-muted-foreground">
                Hide this project from your Projects page. Nothing is deleted and you can restore it at any time.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirmingArchive(true)}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </Button>
          </div>
        </div>
      )}

      {!hideDangerZone && isOwner && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Danger zone</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this project and all of its photos, areas, comments, and history. This cannot be undone.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmingArchive} onOpenChange={(o) => !archiving && setConfirmingArchive(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this project?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from your Projects page but nothing will be deleted. You can restore it at any time from the archived view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={(e) => { e.preventDefault(); confirmArchive(); }}
            >
              {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        )}
        <Button onClick={save} disabled={busy || !name.trim()}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
};
