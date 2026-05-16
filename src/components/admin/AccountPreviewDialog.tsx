import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string | null;
  plan: string | null;
  userEmail: string | null;
};

type Project = {
  id: string;
  name: string;
  overall_status: string | null;
  phase: string | null;
  last_activity_at: string | null;
  created_at: string;
  archived_at: string | null;
};

type Member = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

const PLAN_LABELS: Record<string, string> = { solo: "Solo", pro: "Pro", studio: "Studio" };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function AccountPreviewDialog({
  open, onOpenChange, teamId, teamName, plan, userEmail,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [projRes, memRes] = await Promise.all([
        supabase.rpc("admin_list_projects" as never, { _team_id: teamId } as never),
        supabase.rpc("admin_list_team_members" as never, { _team_id: teamId } as never),
      ]);
      if (cancelled) return;
      setProjects(((projRes.data as Project[]) ?? []));
      setMembers(((memRes.data as Member[]) ?? []));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, teamId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account preview</DialogTitle>
          <DialogDescription>
            Read-only summary of {userEmail ?? "this user"}'s account.
          </DialogDescription>
        </DialogHeader>

        {!teamId ? (
          <p className="text-sm text-muted-foreground py-4">This user has no team.</p>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Team</h3>
              <div className="flex items-center gap-3">
                <span className="font-medium">{teamName ?? "—"}</span>
                <Badge variant="secondary">{PLAN_LABELS[plan ?? ""] ?? plan ?? "—"}</Badge>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Events ({projects.length})
              </h3>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="rounded-md border divide-y">
                  {projects.map((p) => (
                    <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.phase ? `${p.phase} · ` : ""}Updated {fmtDate(p.last_activity_at ?? p.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.archived_at && <Badge variant="outline">Archived</Badge>}
                        {p.overall_status && (
                          <Badge variant="secondary" className="capitalize">
                            {p.overall_status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Members ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members.</p>
              ) : (
                <div className="rounded-md border divide-y">
                  {members.map((m) => (
                    <div key={m.user_id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.email ?? "—"}</div>
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0">{m.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
