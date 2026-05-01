import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Mail, Copy, Send } from "lucide-react";
import { z } from "zod";

type Invite = {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  token: string;
  accepted_at: string | null;
  created_at: string;
};

type Member = {
  user_id: string;
  role: string;
  full_name: string | null;
};

const emailSchema = z.string().trim().email().max(255);

export const InvitesManager = ({ projectId }: { projectId: string }) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: inv }, { data: pm }] = await Promise.all([
      supabase.from("project_invites").select("id,email,role,token,accepted_at,created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id,role").eq("project_id", projectId),
    ]);
    setInvites((inv ?? []) as Invite[]);
    const pmRows = (pm ?? []) as { user_id: string; role: string }[];
    if (pmRows.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", pmRows.map((m) => m.user_id));
      const profRows = (profs ?? []) as { id: string; full_name: string | null }[];
      const map = new Map(profRows.map((p) => [p.id, p.full_name]));
      setMembers(pmRows.map((m) => ({ ...m, full_name: map.get(m.user_id) ?? null })));
    } else {
      setMembers([]);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const addInvite = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("project_invites")
      .insert({
        project_id: projectId, email: parsed.data.toLowerCase(), role, invited_by: auth.user?.id,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setEmail("");
    toast.success(`Invite created for ${parsed.data}`);
    // Fire-and-forget: never block the user's invite flow on email delivery.
    if (inserted?.id) {
      void sendInviteEmail(inserted.id, { silent: true });
    }
    load();
  };

  const sendInviteEmail = async (
    inviteId: string,
    opts: { silent?: boolean } = {},
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-invite-email", {
        body: { inviteId },
      });
      if (error) {
        console.error("send-invite-email invoke error", error);
        if (!opts.silent) toast.error("Could not send invite email");
        return;
      }
      if (data && data.ok === false) {
        console.error("send-invite-email returned error", data);
        if (!opts.silent) toast.error(data.error || "Email send failed");
        return;
      }
      if (!opts.silent) toast.success("Invite email sent");
    } catch (e) {
      console.error("send-invite-email threw", e);
      if (!opts.silent) toast.error("Could not send invite email");
    }
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("project_invites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-medium">Members ({members.length})</h4>
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{m.full_name || m.user_id.slice(0, 8)}</span>
              <Badge variant="secondary" className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">Invite by email</h4>
        <div className="flex gap-2">
          <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addInvite} disabled={loading}><Mail className="mr-2 h-4 w-4" />Invite</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Invite is auto-accepted when they sign up. Existing users can use the link.</p>
      </div>

      {invites.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Pending & accepted invites</h4>
          <div className="space-y-1">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.accepted_at ? `Accepted ${new Date(inv.accepted_at).toLocaleDateString()}` : "Pending"} · {inv.role}
                  </div>
                </div>
                {!inv.accepted_at && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyInviteLink(inv.token)}
                      title="Copy invite link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => sendInviteEmail(inv.id)}
                      title="Resend invite email"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeInvite(inv.id)}
                      title="Revoke invite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
