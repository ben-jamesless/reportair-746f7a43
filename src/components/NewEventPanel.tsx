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
import { Loader2, Crown, Mail, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

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
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed to create");
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
    toast.success("Event created");
    onCreated?.();
    handleOpenChange(false);
    navigate(`/projects/${data.id}`);
  };

  const canNext1 = !!name.trim();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-foreground">New Event</SheetTitle>
          <div className="flex items-center gap-2 mt-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "bg-[#1A6EFF] w-8" : i < step ? "bg-[#1A6EFF]/40 w-4" : "bg-[#D4D1CA] w-4"
                )}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">Step {step} of 3</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
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

          {step === 2 && (
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

          {step === 3 && (
            <div className="space-y-4">
              {plan === "solo" ? (
                <div className="rounded-xl border border-[#1A6EFF]/30 bg-[#1A6EFF]/5 p-5 text-center">
                  <Crown className="h-8 w-8 mx-auto mb-3 text-[#1A6EFF]" />
                  <h3 className="text-base font-semibold text-foreground mb-1">Invite your team</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Team collaboration is available on Pro and Studio plans.
                  </p>
                  <Button
                    onClick={() => { handleOpenChange(false); navigate("/billing"); }}
                    className="bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
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
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={busy || (step === 1 && !canNext1)}
              className="bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={create}
              disabled={busy || !canNext1}
              className="bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
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
