import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { toast } from "sonner";
import { Loader2, Crown, Mail, X, Check, FileText, Tent, Store, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { event as gaEvent } from "@/lib/analytics";
import {
  EVENT_TEMPLATE_DEFS,
  RECOMMENDED_LAYOUT_KEY,
  TEMPLATE_ID_KEY,
  type EventTemplateId,
} from "@/lib/eventTemplates";

// UI catalog pairing each event template with a lucide icon for the picker tiles.
const TEMPLATE_TILES: { id: EventTemplateId; title: string; description: string; icon: React.ReactNode; areas: string[] }[] =
  EVENT_TEMPLATE_DEFS.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    icon:
      t.id === "blank" ? <FileText className="h-5 w-5" /> :
      t.id === "pop_up" ? <Tent className="h-5 w-5" /> :
      t.id === "exhibition" ? <Store className="h-5 w-5" /> :
      <Sparkles className="h-5 w-5" />,
    areas: t.areas,
  }));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  onCreated?: () => void;
}

type InviteRow = { email: string; role: "editor" | "viewer" };
const emailSchema = z.string().trim().email().max(255);

export function NewEventPanel({ open, onOpenChange, teamId, onCreated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan } = usePlan();
  const [step, setStep] = useState(1);

  const [template, setTemplate] = useState<EventTemplateId>("blank");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [eventType, setEventType] = useState("");
  const [description, setDescription] = useState("");

  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(1);
    setTemplate("blank");
    setName("");
    setClientName("");
    setEventType("");
    setDescription("");
    setEventDate("");
    setLocation("");
    setInvites([]);
    setInviteEmail("");
    setBusy(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const addInvite = () => {
    const parsed = emailSchema.safeParse(inviteEmail);
    if (!parsed.success) return toast.error("Enter a valid email");
    const email = parsed.data.toLowerCase();
    if (invites.some((i) => i.email === email)) return toast.error("Already added");
    setInvites((s) => [...s, { email, role: "viewer" }]);
    setInviteEmail("");
  };

  const create = async () => {
    if (!user || !teamId) return toast.error("No team available");
    setBusy(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        team_id: teamId,
        name,
        description: description || null,
        client_name: clientName || null,
        event_type: eventType || null,
        event_date: eventDate || null,
        event_location: location || null,
        created_by: user.id,
        template,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed to create");
    }

    // Seed template areas (skipped for Blank). Falls back gracefully if the insert
    // partially fails — the user can always add areas from the project page.
    const tpl = EVENT_TEMPLATE_DEFS.find((t) => t.id === template);
    if (tpl && tpl.areas.length > 0) {
      const rows = tpl.areas.map((a, idx) => ({
        project_id: data.id,
        name: a,
        sort_order: idx,
        created_by: user.id,
      }));
      const { error: aErr } = await supabase.from("areas").insert(rows);
      if (aErr) console.warn("Area seeding failed (non-fatal):", aErr.message);
    }

    // Persist template id + recommended layout to localStorage so the export
    // dialog and timeline phase grouping can read them without an extra DB round trip.
    try {
      if (typeof window !== "undefined" && tpl) {
        window.localStorage.setItem(TEMPLATE_ID_KEY(data.id), tpl.id);
        window.localStorage.setItem(RECOMMENDED_LAYOUT_KEY(data.id), tpl.recommendedLayout);
      }
    } catch {
      // localStorage may be unavailable (private mode); non-fatal.
    }

    // invites
    if (plan !== "solo" && invites.length > 0) {
      for (const i of invites) {
        const { data: inserted } = await supabase
          .from("project_invites")
          .insert({ project_id: data.id, email: i.email, role: i.role, invited_by: user.id })
          .select("id")
          .single();
        if (inserted?.id) {
          supabase.functions.invoke("send-invite-email", { body: { inviteId: inserted.id } }).catch(() => {});
        }
      }
    }
    setBusy(false);
    gaEvent("create_event", { type: eventType || template || "blank" });
    toast.success("Event created");
    onCreated?.();
    handleOpenChange(false);
    navigate(`/projects/${data.id}`);
  };

  const canNext2 = !!name.trim();
  const TOTAL_STEPS = 4;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-foreground">New Event</SheetTitle>
          <div className="flex items-center gap-2 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "bg-[#D94F2A] w-8" : i < step ? "bg-[#D94F2A]/40 w-4" : "bg-[#D4D1CA] w-4"
                )}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick a starting template. Areas can be edited any time.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATE_TILES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "relative rounded-lg border p-3 text-left transition-all hover:border-[#D94F2A]/60 hover:bg-secondary/40",
                      template === t.id
                        ? "border-[#D94F2A] bg-[#D94F2A]/5 ring-2 ring-[#D94F2A]/20"
                        : "border-border",
                    )}
                  >
                    {template === t.id && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#D94F2A] text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-[#D94F2A]/10 text-[#D94F2A]">
                      {t.icon}
                    </div>
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    {t.areas.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                        {t.areas.slice(0, 3).map((a) => (
                          <li key={a} className="truncate">· {a}</li>
                        ))}
                        {t.areas.length > 3 && (
                          <li className="text-muted-foreground/70">+{t.areas.length - 3} more</li>
                        )}
                      </ul>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ev-name">Event name</Label>
                <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Gala 2026" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-client">Client name</Label>
                <Input id="ev-client" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-type">Event type</Label>
                <Input id="ev-type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Conference, gala, festival…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-desc">Description (optional)</Label>
                <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ev-date">Event date</Label>
                <Input id="ev-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-loc">Location</Label>
                <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Convention Center, HK" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {plan === "solo" ? (
                <div className="rounded-xl border border-[#D94F2A]/30 bg-[#D94F2A]/5 p-5 text-center">
                  <Crown className="h-8 w-8 mx-auto mb-3 text-[#D94F2A]" />
                  <h3 className="text-base font-semibold text-foreground mb-1">Invite your team</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Team collaboration is available on Pro and Studio plans.
                  </p>
                  <Button
                    onClick={() => { handleOpenChange(false); navigate("/billing"); }}
                    className="bg-[#D94F2A] hover:bg-[#D94F2A]/90 text-white"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="mb-2 block">Invite team members</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                      />
                      <Button type="button" onClick={addInvite}>
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {invites.length > 0 && (
                    <ul className="divide-y rounded-md border border-border">
                      {invites.map((i) => (
                        <li key={i.email} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="truncate">{i.email}</span>
                          <button
                            onClick={() => setInvites((s) => s.filter((x) => x.email !== i.email))}
                            className="rounded p-1 hover:bg-muted/40"
                            aria-label={`Remove ${i.email}`}
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? handleOpenChange(false) : setStep((s) => s - 1))}
            disabled={busy}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={busy || (step === 2 && !canNext2)}
              className="bg-[#D94F2A] hover:bg-[#D94F2A]/90 text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={create}
              disabled={busy || !canNext2}
              className="bg-[#D94F2A] hover:bg-[#D94F2A]/90 text-white"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create event
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
