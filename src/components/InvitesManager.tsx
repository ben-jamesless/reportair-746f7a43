import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, Mail, Copy, Send, LogOut, Crown, UserPlus } from "lucide-react";
import { z } from "zod";
import type { ProjectRole } from "@/lib/projectPermissions";
import { usePlan } from "@/hooks/usePlan";

type Invite = {
  id: string;
  email: string;
  role: ProjectRole;
  
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

type Member = {
  user_id: string;
  role: ProjectRole;
  full_name: string | null;
  email: string | null;
  last_active_at: string | null;
  created_at: string | null;
};

const fmtDate = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const emailSchema = z.string().trim().email().max(255);

const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  owner: "Full access — manage members, edit, and delete the project.",
  editor: "Can upload photos and edit project content.",
  viewer: "Read-only access to the project and reports.",
  commenter: "Can view photos and leave comments.",
  crew: "Capture-only — can upload photos and add area notes. Cannot view reports, share links, or project settings.",
};

export const InvitesManager = ({ projectId }: { projectId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canInviteMember, planIncludesInvites } = usePlan();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  // "Add from your team" picker state
  type TeamCandidate = { user_id: string; full_name: string | null; email: string | null };
  const [teamCandidates, setTeamCandidates] = useState<TeamCandidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateId, setCandidateId] = useState<string>("");
  const [candidateRole, setCandidateRole] = useState<ProjectRole>("viewer");
  const [addingCandidate, setAddingCandidate] = useState(false);

  // Confirmation state
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [projectName, setProjectName] = useState<string>("");

  const currentUserRole: ProjectRole | null =
    members.find((m) => m.user_id === user?.id)?.role ?? null;
  const canManage = currentUserRole === "owner" || isAppAdmin;
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const load = useCallback(async () => {
    const [{ data: inv }, { data: pm }, { data: proj }] = await Promise.all([
      supabase.from("project_invites").select("id,email,role,accepted_at,accepted_by,created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id,role").eq("project_id", projectId),
      supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    ]);
    const invRows = (inv ?? []) as Invite[];
    setProjectName((proj as { name?: string } | null)?.name ?? "");
    const pmRows = (pm ?? []) as { user_id: string; role: ProjectRole }[];

    // Hide ghost accepted invites whose user profile no longer exists.
    const acceptedUserIds = invRows
      .filter((i) => i.accepted_at && i.accepted_by)
      .map((i) => i.accepted_by as string);
    const allIds = Array.from(new Set([...pmRows.map((m) => m.user_id), ...acceptedUserIds]));

    let profMap = new Map<string, { full_name: string | null; email: string | null; last_active_at: string | null; created_at: string | null }>();
    let existingIds = new Set<string>();
    if (allIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email,last_active_at,created_at").in("id", allIds);
      const profRows = (profs ?? []) as { id: string; full_name: string | null; email: string | null; last_active_at: string | null; created_at: string | null }[];
      profMap = new Map(profRows.map((p) => [p.id, { full_name: p.full_name, email: p.email, last_active_at: p.last_active_at, created_at: p.created_at }]));
      existingIds = new Set(profRows.map((p) => p.id));
    }
    setInvites(invRows.filter((i) => !i.accepted_at || (i.accepted_by && existingIds.has(i.accepted_by))));
    setMembers(
      pmRows.map((m) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name ?? null,
        email: profMap.get(m.user_id)?.email ?? null,
        last_active_at: profMap.get(m.user_id)?.last_active_at ?? null,
        created_at: profMap.get(m.user_id)?.created_at ?? null,
      })),
    );
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Detect app-level admin (in addition to project owner) for management UI gating.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setIsAppAdmin(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAppAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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
    if (inserted?.id) {
      // Fire-and-forget: in-app notification (works even if email fails).
      void supabase.rpc("notify_user_of_invite", { _invite_id: inserted.id });
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

  const copyInviteLink = async (inviteId: string) => {
    const { data: token, error } = await supabase.rpc("get_invite_token", { _invite_id: inviteId });
    if (error || !token) { toast.error("Could not load invite link"); return; }
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const changeRole = async (m: Member, newRole: ProjectRole) => {
    if (m.role === newRole) return;
    // Guard: never allow demoting the last remaining owner.
    if (m.role === "owner" && newRole !== "owner" && ownerCount <= 1) {
      toast.error("Promote another member to Owner before changing this role.");
      return;
    }
    // Optimistic UI
    setMembers((prev) => prev.map((p) => p.user_id === m.user_id ? { ...p, role: newRole } : p));
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole })
      .eq("project_id", projectId)
      .eq("user_id", m.user_id);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(`Role updated to ${newRole}`);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", target.user_id);
    if (error) { toast.error(error.message); return; }
    // Also clean up any accepted invite row for this user so they don't reappear.
    await supabase
      .from("project_invites")
      .delete()
      .eq("project_id", projectId)
      .eq("accepted_by", target.user_id);
    toast.success(`${target.full_name || target.email || "Member"} removed`);
    load();
  };

  const confirmLeave = async () => {
    if (!user?.id) return;
    setLeaveOpen(false);
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("You left the project");
    navigate("/projects");
  };

  const pendingInvites = invites.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h4 className="text-sm font-semibold">Invite someone to this project</h4>
            <p className="text-xs text-muted-foreground">
              They&apos;ll get an email with a link. New users are auto-added when they sign up.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="commenter">Commenter — Can view photos and leave comments</SelectItem>
                <SelectItem value="crew">Crew — Upload photos only, no report access</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addInvite} disabled={loading || !canInviteMember || !planIncludesInvites}>
              {(!canInviteMember || !planIncludesInvites) && <Crown className="mr-1.5 h-3.5 w-3.5 text-amber-400" />}
              <Mail className="mr-2 h-4 w-4" />Send invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          {!planIncludesInvites && (
            <p className="text-xs text-muted-foreground">
              External project invites are available on the <strong>Pro</strong> plan and above.{" "}
              <a href="/billing" className="underline">Upgrade</a> to invite collaborators.
            </p>
          )}
          {planIncludesInvites && !canInviteMember && (
            <p className="text-xs text-muted-foreground">
              Member limit reached. <a href="/billing" className="underline">Upgrade your plan</a> to invite more.
            </p>
          )}
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Current access ({members.length})</h4>
        <div className="space-y-1">
          {members.map((m) => {
            const isSelf = m.user_id === user?.id;
            const isOwnerRow = m.role === "owner";
            const isLastOwner = isOwnerRow && ownerCount <= 1;
            // Owners can edit any non-self member's role (including other owners),
            // unless that would demote the last remaining owner.
            const showRoleSelect = canManage && !isSelf && !isLastOwner;
            // Owners cannot remove other owners (transfer/demote first), and never themselves.
            const showRemove = canManage && !isSelf && !isOwnerRow;
            return (
              <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.full_name || m.email || m.user_id.slice(0, 8)}
                    {isSelf && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[
                      m.full_name && m.email ? m.email : null,
                      m.last_active_at
                        ? `Last active: ${fmtDate(m.last_active_at)}`
                        : m.created_at
                        ? `Signed up: ${fmtDate(m.created_at)}`
                        : null,
                    ].filter(Boolean).join(" · ") || "Active"}
                  </div>
                </div>
                {showRoleSelect ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => changeRole(m, v as ProjectRole)}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="commenter">Commenter</SelectItem>
                      <SelectItem value="crew">Crew</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                )}
                {showRemove ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemoveTarget(m)}
                    title="Remove member"
                    aria-label={`Remove ${m.full_name || "member"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="w-10" aria-hidden />
                )}
              </div>
            );
          })}
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{inv.email}</div>
                <div className="text-xs text-muted-foreground">Pending invite</div>
              </div>
              <Badge variant="outline" className="capitalize">{inv.role}</Badge>
              {canManage && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => copyInviteLink(inv.id)} title="Copy invite link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => sendInviteEmail(inv.id)} title="Resend invite email">
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => revokeInvite(inv.id)} title="Revoke invite">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {currentUserRole && currentUserRole !== "owner" && (
          <div className="mt-3 flex justify-end border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Leave project
            </Button>
          </div>
        )}
      </section>

      {/* Remove member confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.full_name || removeTarget?.email || "this member"} from this project? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave project?</AlertDialogTitle>
            <AlertDialogDescription>
              Leave {projectName || "this project"}? You will lose access immediately and will need to be re-invited to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
