import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, FileText, Flag, Loader2, Mail, MapPinned, Music, Plus, PartyPopper, Presentation, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROJECT_COLOR_PALETTE, DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";
import { z } from "zod";

type Template = "blank" | "golf_day" | "corporate_event" | "music_festival" | "conference" | "wedding";

const TEMPLATE_DEFS: { id: Template; title: string; description: string; icon: React.ReactNode; areas: string[] }[] = [
  { id: "blank", title: "Blank", description: "Start from scratch.", icon: <FileText className="h-5 w-5" />, areas: [] },
  { id: "golf_day", title: "Golf Day", description: "Hospitality, tees, greens & more.", icon: <Flag className="h-5 w-5" />,
    areas: ["Hospitality Suite", "Driving Range", "1st Tee", "18th Green", "Clubhouse", "Media Zone", "Sponsor Activation"] },
  { id: "corporate_event", title: "Corporate Event", description: "Stage, registration, breakouts.", icon: <Presentation className="h-5 w-5" />,
    areas: ["Main Stage", "Registration", "Catering", "Breakout Rooms", "Networking Area", "Sponsor Wall", "Green Room"] },
  { id: "music_festival", title: "Music Festival", description: "Multi-stage festival areas.", icon: <Music className="h-5 w-5" />,
    areas: ["Main Stage", "Second Stage", "Artist Village", "Food & Beverage", "Entry & Security", "Sponsor Zone", "Merchandise"] },
  { id: "conference", title: "Conference", description: "Halls, breakouts, exhibitors.", icon: <Trophy className="h-5 w-5" />,
    areas: ["Main Hall", "Registration Desk", "Breakout Room A", "Breakout Room B", "Exhibitor Floor", "Media Room", "Catering"] },
  { id: "wedding", title: "Wedding", description: "Ceremony to reception.", icon: <PartyPopper className="h-5 w-5" />,
    areas: ["Ceremony", "Reception", "Cocktail Hour", "Bridal Suite", "Catering", "Photography Zone", "Guest Entrance"] },
];
type InviteRow = { email: string; role: "editor" | "viewer" };

interface Props {
  teamId: string | null;
  trigger?: React.ReactNode;
  onCreated?: () => void;
}

const emailSchema = z.string().trim().email().max(255);
const TOTAL_STEPS = 4;

export const NewProjectDialog = ({ teamId, trigger, onCreated }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1+2 fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<Template>("blank");
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);

  // Step 3: areas (collected locally; inserted after project create)
  const [areas, setAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState("");

  // Step 4: invites (collected locally; inserted after project create)
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");

  const [busy, setBusy] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const selectTemplate = (id: Template) => {
    setTemplate(id);
    const tplAreas = TEMPLATE_DEFS.find((t) => t.id === id)?.areas ?? [];
    setAreas(tplAreas);
  };

  const reset = () => {
    setStep(1);
    setName("");
    setDescription("");
    setTemplate("blank");
    setColor(DEFAULT_PROJECT_COLOR);
    setAreas([]);
    setAreaInput("");
    setInvites([]);
    setInviteEmail("");
    setInviteRole("viewer");
    setCreatedProjectId(null);
    setBusy(false);
  };

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  };

  const addArea = () => {
    const n = areaInput.trim();
    if (!n) return;
    if (areas.includes(n)) { toast.error("Area already added"); return; }
    setAreas((a) => [...a, n]);
    setAreaInput("");
  };
  const removeArea = (n: string) => setAreas((a) => a.filter((x) => x !== n));

  const addInvite = () => {
    const parsed = emailSchema.safeParse(inviteEmail);
    if (!parsed.success) { toast.error("Enter a valid email"); return; }
    const email = parsed.data.toLowerCase();
    if (invites.some((i) => i.email === email)) { toast.error("Already added"); return; }
    setInvites((s) => [...s, { email, role: inviteRole }]);
    setInviteEmail("");
  };
  const removeInvite = (email: string) => setInvites((s) => s.filter((i) => i.email !== email));

  // Persist areas
  const persistAreas = async (projectId: string, list: string[]) => {
    if (list.length === 0) return;
    const rows = list.map((name, i) => ({
      project_id: projectId, name, sort_order: i, created_by: user?.id ?? null,
    }));
    const { error } = await supabase.from("areas").insert(rows);
    if (error) toast.error(`Areas: ${error.message}`);
  };

  // Persist invites
  const persistInvites = async (projectId: string, list: InviteRow[]) => {
    if (list.length === 0) return;
    const rows = list.map((i) => ({
      project_id: projectId, email: i.email, role: i.role, invited_by: user?.id ?? null,
    }));
    const { error } = await supabase.from("project_invites").insert(rows);
    if (error) toast.error(`Invites: ${error.message}`);
  };

  const goNext = () => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goSkip = () => {
    if (step === 3) { setAreas([]); setStep(4); return; }
    if (step === 4) { finish(true); return; }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const finish = async (skipInvites = false) => {
    if (!user || !teamId) { toast.error("No team available"); return; }
    setBusy(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({ team_id: teamId, name, description: description || null, color, created_by: user.id })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to create project");
      return;
    }
    const projectId = data.id;
    setCreatedProjectId(projectId);
    const tplAreas = TEMPLATE_DEFS.find((t) => t.id === template)?.areas ?? [];
    const combinedAreas = [...tplAreas, ...areas.filter((a) => !tplAreas.includes(a))];
    await persistAreas(projectId, combinedAreas);
    if (!skipInvites) await persistInvites(projectId, invites);
    setBusy(false);
    onCreated?.();
    toast.success("Project ready");
    handleClose(false);
    navigate(`/projects/${projectId}`);
  };

  const canAdvanceStep1 = !!name.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>Step {step} of {TOTAL_STEPS}</DialogDescription>
          <Stepper step={step} total={TOTAL_STEPS} />
        </DialogHeader>

        {/* STEP 1: Template */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pick a starting template. You can edit, add or remove areas any time.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TEMPLATE_DEFS.map((t) => (
                <TemplateCard
                  key={t.id}
                  icon={t.icon}
                  title={t.title}
                  description={t.description}
                  areas={t.areas}
                  selected={template === t.id}
                  onClick={() => setTemplate(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project name</Label>
              <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Gala 2026" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description (optional)</Label>
              <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Project colour</Label>
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
          </div>
        )}

        {/* STEP 3: Areas */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Areas help you organise photos within each event day (e.g. "Main Stage", "VIP Lounge"). You can always add more later.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 18th Hospitality Suite"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
              />
              <Button onClick={addArea} disabled={!areaInput.trim()} type="button">
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {areas.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {areas.map((a) => (
                  <li key={a} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><MapPinned className="h-3.5 w-3.5 text-muted-foreground" />{a}</span>
                    <Button size="icon" variant="ghost" onClick={() => removeArea(a)} aria-label={`Remove ${a}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No areas added yet. You can skip this step.</p>
            )}
          </div>
        )}

        {/* STEP 4: Invites */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Invite team members by email. They'll get access as soon as they sign up.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "editor" | "viewer")}>
                <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addInvite} type="button"><Mail className="mr-2 h-4 w-4" />Add</Button>
            </div>
            {invites.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {invites.map((inv) => (
                  <li key={inv.email} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="truncate">{inv.email}</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{inv.role}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeInvite(inv.email)} aria-label={`Remove ${inv.email}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No invites added yet. You can skip this step.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>Back</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>Cancel</Button>
            {(step === 3 || step === 4) && (
              <Button variant="ghost" onClick={goSkip} disabled={busy}>Skip</Button>
            )}
            {step < TOTAL_STEPS && (
              <Button
                onClick={goNext}
                disabled={busy || (step === 2 && !canAdvanceStep1)}
              >
                Next
              </Button>
            )}
            {step === TOTAL_STEPS && (
              <Button onClick={() => finish(false)} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create project
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Stepper = ({ step, total }: { step: number; total: number }) => (
  <div className="mt-2 flex gap-1.5">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "h-1 flex-1 rounded-full transition-colors",
          i + 1 <= step ? "bg-primary" : "bg-secondary",
        )}
      />
    ))}
  </div>
);

const TemplateCard = ({
  icon, title, description, areas = [], selected, onClick,
}: { icon: React.ReactNode; title: string; description: string; areas?: string[]; selected: boolean; onClick: () => void; }) => {
  const shown = areas.slice(0, 5);
  const extra = areas.length - shown.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/40",
        selected && "border-primary bg-secondary/60 ring-2 ring-primary/20"
      )}
    >
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </div>
      )}
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {areas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {shown.map((a) => (
            <li key={a} className="truncate">· {a}</li>
          ))}
          {extra > 0 && <li className="text-muted-foreground/70">+{extra} more</li>}
        </ul>
      )}
    </button>
  );
};
