import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Copy, Mail, Trash2, Users, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type ProjectPill = { id: string; name: string; role: string };

interface RosterRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  joined_at: string | null;
  last_active_at: string | null;
  projects: ProjectPill[];
}

interface PendingInvite {
  invite_id: string;
  project_id: string;
  project_name: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : "—";

const initialsFor = (r: { full_name?: string | null; email?: string | null }) => {
  const src = (r.full_name ?? "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }
  return (r.email?.[0] ?? "?").toUpperCase();
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { plan, limits, teamId, loading: planLoading } = usePlan();

  const [loading, setLoading]   = useState(true);
  const [roster,  setRoster]    = useState<RosterRow[]>([]);
  const [invites, setInvites]   = useState<PendingInvite[]>([]);
  const [target,  setTarget]    = useState<RosterRow | null>(null);
  const [invitesOpen, setInvitesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r, error: rErr }, { data: i, error: iErr }] = await Promise.all([
      supabase.rpc("get_team_roster"),
      supabase.rpc("get_team_pending_invites"),
    ]);
    if (rErr) toast.error(rErr.message);
    if (iErr) toast.error(iErr.message);
    setRoster((r as RosterRow[] | null) ?? []);
    setInvites((i as PendingInvite[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (planLoading) return;
    if (!teamId) { setLoading(false); return; }
    load();
  }, [planLoading, teamId, load]);

  const seatCount = roster.length;
  const unlimited = limits.maxMembers === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((seatCount / Math.max(1, limits.maxMembers)) * 100));
  const nearLimit = !unlimited && pct >= 80;

  const planLabel = useMemo(
    () => plan.charAt(0).toUpperCase() + plan.slice(1),
    [plan]
  );

  // ── Actions ─────────────────────────────────────────────────────────────────
  const copyInvite = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const resendInvite = async (inviteId: string) => {
    const { error } = await supabase.functions.invoke("send-invite-email", {
      body: { inviteId },
    });
    if (error) toast.error(error.message);
    else toast.success("Invite resent");
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("project_invites").delete().eq("id", inviteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite revoked");
    load();
  };

  const confirmRemove = async () => {
    if (!target) return;
    const { error } = await supabase.rpc("remove_team_member", { _user_id: target.user_id });
    if (error) { toast.error(error.message); return; }
    toast.success(`${target.full_name ?? target.email ?? "Member"} removed`);
    setTarget(null);
    load();
  };

  // ── Non-billing-owner fallback ──────────────────────────────────────────────
  if (!planLoading && !teamId) {
    return (
      <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold text-foreground">Team</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Team management is handled by your account's billing owner.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground">
            Everyone collaborating across your projects.
          </p>
        </div>

        {/* A. Seat bar */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">
              {unlimited
                ? `${seatCount} collaborators`
                : `${seatCount} of ${limits.maxMembers} seats used`}
            </div>
            <Badge variant="secondary" className="ml-auto">{planLabel}</Badge>
            {nearLimit && (
              <Button asChild size="sm" variant="outline">
                <Link to="/billing">Upgrade</Link>
              </Button>
            )}
          </div>
          {!unlimited && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  nearLimit ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* B. Active members */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active members ({seatCount})
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : roster.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/50 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No collaborators yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a project and use the Share menu to invite people. They'll show up here once they join.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {roster.map((m) => (
                <div
                  key={m.user_id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border bg-card p-4"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initialsFor(m)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">
                      {m.full_name?.trim() || m.email || "Unknown user"}
                    </div>
                    {m.full_name && m.email && (
                      <div className="text-sm text-muted-foreground">{m.email}</div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Joined {fmtDate(m.joined_at)} · Last active {fmtDate(m.last_active_at)}
                    </div>

                    {m.projects?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.projects.map((p) => (
                          <Link
                            key={p.id}
                            to={`/projects/${p.id}`}
                            className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
                          >
                            {p.name} · {p.role}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setTarget(m)}
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* C. Pending invites */}
        {invites.length > 0 && (
          <Collapsible open={invitesOpen} onOpenChange={setInvitesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Pending invites ({invites.length})</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    invitesOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.invite_id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-dashed bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.project_name} · {inv.role} · Sent {fmtDate(inv.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyInvite(inv.token)}
                      aria-label="Copy invite link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => resendInvite(inv.invite_id)}
                      aria-label="Resend invite"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => revokeInvite(inv.invite_id)}
                      aria-label="Revoke invite"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* D. Remove confirmation */}
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">
                    {target?.full_name?.trim() || target?.email || "This member"}
                  </span>{" "}
                  will lose access to the following projects:
                </p>
                {target?.projects?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {target.projects.map((p) => (
                      <li key={p.id}>
                        {p.name} <span className="text-muted-foreground">({p.role})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No active projects.</p>
                )}
              </div>
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
