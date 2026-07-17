import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

const LABEL_INK = "#5C5850";

type Approval = {
  id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  use_case_note: string | null;
  invited_by_user_id: string | null;
  origin_project_id: string | null;
  origin_project_role: string | null;
  project_name?: string | null;
};


/**
 * Approvals inbox — surfaces pending `team_external_approvals` rows so an
 * owner can approve or deny external members before a project invite is
 * created. When empty (which will be the common case until domain-based
 * invite routing is wired in the next slice), the whole card hides.
 */
export function ApprovalsInbox({
  teamId,
  canManage,
}: {
  teamId: string | null;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<Approval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) { setRows([]); return; }
    const { data, error } = await supabase
      .from("team_external_approvals")
      .select("id,invitee_email,status,created_at,use_case_note,invited_by_user_id,origin_project_id,origin_project_role,projects:origin_project_id(name)")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) return;
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as Omit<Approval, "project_name">),
      project_name: (r.projects as { name?: string } | null)?.name ?? null,
    })) as Approval[];
    setRows(mapped);
  }, [teamId]);

  useEffect(() => { void load(); }, [load]);


  useEffect(() => {
    if (!teamId) return;
    const ch = supabase
      .channel(`approvals-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "team_external_approvals", filter: `team_id=eq.${teamId}` },
        () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, load]);

  if (!teamId || rows.length === 0) return null;

  const act = async (row: Approval, next: "approved" | "denied") => {
    setBusyId(row.id);
    const { data: auth } = await supabase.auth.getUser();
    const nowIso = new Date().toISOString();
    const patch =
      next === "approved"
        ? { status: next, updated_at: nowIso, approved_at: nowIso, approved_by_user_id: auth.user?.id ?? null }
        : { status: next, updated_at: nowIso };
    const { error } = await supabase.from("team_external_approvals").update(patch).eq("id", row.id);
    if (error) { setBusyId(null); toast.error(error.message); return; }

    // B3.2 — approve + assign to originating project in a single step.
    // If the approval was raised from a project invite, create the
    // corresponding project_invite so the approved user gets access immediately
    // when they accept. Skipped for denials or approvals with no origin.
    if (next === "approved" && row.origin_project_id) {
      const { error: inviteErr } = await supabase.from("project_invites").insert({
        project_id: row.origin_project_id,
        email: row.invitee_email,
        role: (row.origin_project_role ?? "viewer") as never,
        invited_by: auth.user?.id ?? null,
      } as never);
      if (inviteErr && !/duplicate|already/i.test(inviteErr.message)) {
        toast.warning(`Approved, but project invite failed: ${inviteErr.message}`);
      }
    }

    setBusyId(null);
    toast.success(next === "approved" ? "External access approved" : "Request denied");
    void load();
  };


  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block shrink-0 rounded-full"
          style={{ width: 9, height: 9, backgroundColor: "#D4A017" }}
        />
        <span
          className="font-semibold uppercase"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: LABEL_INK }}
        >
          External access requests ({rows.length})
        </span>
      </div>
      <div className="border" style={{ borderColor: "#E3DFD4", background: "#FAF8F2" }}>
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${i > 0 ? "border-t" : ""}`}
            style={{ borderColor: "#E3DFD4" }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.invitee_email}</div>
              {r.project_name && (
                <div className="truncate text-xs" style={{ color: LABEL_INK }}>
                  Requested access to: {r.project_name}
                </div>
              )}
              {r.use_case_note && (
                <div className="truncate text-xs" style={{ color: LABEL_INK }}>
                  {r.use_case_note}
                </div>
              )}
            </div>
            {canManage && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void act(r, "approved")}
                  disabled={busyId === r.id}
                  title={r.origin_project_id ? "Approve & add to project" : "Approve"}
                >
                  <Check className="h-4 w-4" /> {r.origin_project_id ? "Approve & add" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void act(r, "denied")}
                  disabled={busyId === r.id}
                  title="Deny"
                >
                  <X className="h-4 w-4" /> Deny
                </Button>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
