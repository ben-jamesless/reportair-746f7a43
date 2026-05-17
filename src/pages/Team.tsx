import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Send, Copy, ChevronDown, ChevronUp, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────
type ProjectRef = { id: string; name: string; role: string };

type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  joined_at: string | null;
  last_active_at: string | null;
  projects: ProjectRef[];
};

type PendingInvite = {
  invite_id: string;
  project_id: string;
  project_name: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const initials = (name: string | null, email: string | null) => {
  if (name) return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (email ?? "?")[0].toUpperCase();
};

const ROLE_COLORS: Record<string, string> = {
  owner:     "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  editor:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  viewer:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  commenter: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

// ── Seat bar ──────────────────────────────────────────────────────────────────
function SeatBar({ used, max, plan }: { used: number; max: number; plan: string }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min(100, (used / max) * 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {used} {unlimited ? "collaborators" : `of ${max} seats used`}
        </p>
        {!unlimited && (
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${nearLimit ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <Badge variant="secondary" className="capitalize shrink-0">{plan}</Badge>
      {nearLimit && (
        <Link to="/billing" className="text-xs text-amber-600 dark:text-amber-400 underline shrink-0">
          Upgrade
        </Link>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { plan, limits, memberCount, teamId, loading: planLoading } = usePlan();

  const [members, setMembers]         = useState<TeamMember[]>([]);
  const [pendingInvites, setPending]  = useState<PendingInvite[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(false);

  // Remove dialog state
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  // ── Load roster & pending invites ─────────────────────────────────────────
  const load = useCallback(async () => {
    setLoadingData(true);
    const [{ data: roster, error: rErr }, { data: invites, error: iErr }] = await Promise.all([
      supabase.rpc("get_team_roster" as never),
      supabase.rpc("get_team_pending_invites" as never),
    ]);
    if (rErr) toast.error(rErr.message);
    if (iErr) toast.error(iErr.message);
    setMembers(
      ((roster ?? []) as TeamMember[]).map((m) => ({
        ...m,
        projects: Array.isArray(m.projects) ? m.projects : [],
      }))
    );
    setPending((invites ?? []) as PendingInvite[]);
    setLoadingData(false);
  }, []);

  useEffect(() => { if (!planLoading) load(); }, [planLoading, load]);

  // ── Remove handler ────────────────────────────────────────────────────────
  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    const { error } = await supabase.rpc("remove_team_member" as never, {
      _user_id: target.user_id,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`${target.full_name || target.email || "Member"} removed from all projects`);
    load();
  };

  // ── Pending invite actions ────────────────────────────────────────────────
  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success("Invite link copied");
  };

  const resendInvite = async (inviteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-invite-email", {
        body: { inviteId },
      });
      if (error || data?.ok === false) {
        toast.error("Could not resend invite");
        return;
      }
      toast.success("Invite resent");
    } catch {
      toast.error("Could not resend invite");
    }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("project_invites").delete().eq("id", inviteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite revoked");
    load();
  };

  // ── Non-billing-owner view ────────────────────────────────────────────────
  const isBillingOwner = !!teamId; // usePlan sets teamId only for billing owners
  if (!planLoading && !isBillingOwner) {
    return (
      <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
        <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Team management is handled by your account's billing owner. Contact them to add or remove collaborators.
          </p>
        </div>
      </AppShell>
    );
  }

  const isLoading = planLoading || loadingData;

  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
      <div className="mx-auto max-w-3xl space-y-6 py-6 px-4">

        {/* Seat bar */}
        {!planLoading && (
          <SeatBar
            used={members.length}
            max={limits.maxMembers}
            plan={plan}
          />
        )}

        {/* Active members */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Active members{!isLoading && ` (${members.length})`}
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No collaborators yet. Invite someone to a project and they'll appear here once they accept.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  {/* Avatar */}
                  <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs">
                      {initials(m.full_name, m.email)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {m.full_name || m.email || m.user_id.slice(0, 8)}
                      </span>
                      {m.full_name && m.email && (
                        <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                      )}
                    </div>

                    {/* Meta */}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        m.joined_at    ? `Joined ${fmtDate(m.joined_at)}` : null,
                        m.last_active_at ? `Last active ${fmtDate(m.last_active_at)}` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>

                    {/* Project pills */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.projects.map((proj) => (
                        <Link
                          key={proj.id}
                          to={`/projects/${proj.id}`}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors"
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${ROLE_COLORS[proj.role] ? "" : "bg-slate-400"}`}
                          />
                          {proj.name}
                          <span className="text-muted-foreground capitalize">· {proj.role}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveTarget(m)}
                    title="Remove from all projects"
                    aria-label={`Remove ${m.full_name || "member"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending invites */}
        {!isLoading && pendingInvites.length > 0 && (
          <Collapsible open={pendingOpen} onOpenChange={setPendingOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                <span>Pending invites ({pendingInvites.length})</span>
                {pendingOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.invite_id}
                    className="flex items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.project_name} · <span className="capitalize">{inv.role}</span> · Sent {fmtDate(inv.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
                        onClick={() => resendInvite(inv.invite_id)}
                        title="Resend invite email"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => revokeInvite(inv.invite_id)}
                        title="Revoke invite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.full_name || removeTarget?.email || "This person"}</strong> will
              be removed from{" "}
              {removeTarget && removeTarget.projects.length > 0 ? (
                <>
                  {removeTarget.projects.length === 1
                    ? `the project "${removeTarget.projects[0].name}"`
                    : `${removeTarget.projects.length} projects: ${removeTarget.projects.map((p) => p.name).join(", ")}`}
                </>
              ) : (
                "all projects"
              )}{" "}
              and will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
