import { useCallback, useEffect, useState } from "react";
import { Copy, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

export function CompanyInvites({ teamId, initialProjectId, onAccepted }: { teamId: string; initialProjectId?: string; onAccepted?: () => void }) {
  const { user } = useAuth();
  const [owner, setOwner] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [invites, setInvites] = useState<Tables<"company_invites">[]>([]);
  const [selected, setSelected] = useState<string[]>(initialProjectId ? [initialProjectId] : []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "crew" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data: team } = await supabase.from("teams").select("billing_owner_user_id").eq("id", teamId).maybeSingle();
    const isOwner = team?.billing_owner_user_id === user?.id;
    setOwner(isOwner);
    if (!isOwner) return;
    const [{ data: ps, error: pe }, { data: rows, error: ie }] = await Promise.all([
      supabase.from("projects").select("id,name").eq("team_id", teamId).is("archived_at", null).order("name"),
      supabase.from("company_invites").select("*").eq("team_id", teamId).order("created_at", { ascending: false }),
    ]);
    if (pe || ie) toast.error("Couldn’t load colleague invitations.");
    setProjects(ps ?? []); setInvites(rows ?? []);
  }, [teamId, user?.id]);
  useEffect(() => { void load(); }, [load]);
  const sendEmail = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("send-transactional-email", { body: { templateName: "company-invite", inviteId: id } });
    if (error || !data?.success) toast.error("Invitation saved, but the email was not sent. You can copy the link or retry.");
    else toast.success("Invitation email queued.");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_company_invite", { _team_id: teamId, _email: email, _project_ids: selected, _role: role });
      if (error) throw error;
      if (!data?.id) throw new Error("Couldn’t save the invitation.");
      setEmail(""); await sendEmail(data.id); await load(); onAccepted?.();
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn’t invite this colleague."); }
    finally { setBusy(false); }
  };
  const cancel = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_company_invite", { _id: id });
    if (error) toast.error(error.message); else { toast.success("Invitation cancelled."); await load(); }
    setBusy(false);
  };
  if (!owner) return null;
  return <section className="space-y-5 border-y border-border py-5">
    <h2 className="text-sm font-semibold">Invite colleague</h2>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor={`colleague-${teamId}`}>Email</Label><Input id={`colleague-${teamId}`} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" /></div>
      <div className="space-y-2"><Label>Projects</Label><div className="max-h-44 space-y-2 overflow-y-auto">{projects.map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(p.id)} onCheckedChange={checked => setSelected(ids => checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} /><span className="break-words">{p.name}</span></label>)}</div></div>
      <div className="space-y-2"><Label>Project role</Label><Select value={role} onValueChange={v => { if (v === "editor" || v === "crew" || v === "viewer") setRole(v); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">Editor</SelectItem><SelectItem value="crew">Crew</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select></div>
      <Button type="submit" disabled={busy || !selected.length}><UserPlus />{busy ? "Sending…" : "Send invitation"}</Button>
    </form>
    {invites.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">Invitations</h3>{invites.map(i => {
      const status = i.accepted_at ? "Accepted" : i.cancelled_at ? "Cancelled" : new Date(i.expires_at).getTime() <= Date.now() ? "Expired" : "Pending";
      return <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm"><div className="min-w-0"><p className="break-all font-medium">{i.email}</p><p className="text-xs text-muted-foreground">{status} · {i.role} · {i.delivery_status === "queued" ? "Email queued" : i.delivery_status === "failed" ? "Email failed" : i.delivery_status === "sent" ? "Email sent" : "Email not sent"}</p></div>{status === "Pending" && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" aria-label="Copy colleague invitation" title="Copy invitation link" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/company-invite/${i.token}`); toast.success("Invitation link copied."); } catch { toast.error("Couldn’t copy the link."); } }}><Copy /></Button><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Resend colleague invitation" title="Resend invitation" onClick={async () => { setBusy(true); await sendEmail(i.id); await load(); setBusy(false); }}><Mail /></Button><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Cancel colleague invitation" title="Cancel invitation" onClick={() => cancel(i.id)}><X /></Button></div>}</div>;
    })}</div>}
  </section>;
}