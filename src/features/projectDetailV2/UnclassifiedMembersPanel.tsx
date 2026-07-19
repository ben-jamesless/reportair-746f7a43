import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamSeatSummary } from "@/hooks/useTeamSeatSummary";
import { toast } from "sonner";

const LABEL_INK = "#5C5850";

/**
 * Surfaces members with team-project access but no core/external classification
 * (project-only invites that predate the team-seat migration, or team_members
 * rows with a NULL member_type). Owners can classify in one tap; the DB
 * `classify_unclassified_member` RPC inserts into team_members so the
 * enforce_team_member_caps trigger validates seat availability.
 */
export function UnclassifiedMembersPanel({
  teamId,
  canManage,
}: {
  teamId: string | null;
  canManage: boolean;
}) {
  const s = useTeamSeatSummary(teamId);
  const [busy, setBusy] = useState<string | null>(null);

  if (!teamId || s.loading || s.unclassifiedCount === 0) return null;

  async function classify(userId: string, type: "core" | "external") {
    if (!teamId) return;
    setBusy(userId + type);
    try {
      const { error } = await supabase.rpc("classify_unclassified_member", {
        _team_id: teamId,
        _user_id: userId,
        _member_type: type,
      });
      if (error) throw error;
      toast.success(`Assigned as ${type}`);
      s.refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.split(":").slice(-1)[0].trim() || "Failed to classify");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 border" style={{ borderColor: "#E3DFD4", background: "#FAF8F2" }}>
      <div
        className="border-b px-3 py-2 font-semibold uppercase"
        style={{ borderColor: "#E3DFD4", fontSize: 10, letterSpacing: "0.08em", color: LABEL_INK }}
      >
        Unclassified members ({s.unclassifiedCount})
      </div>
      <ul className="divide-y" style={{ borderColor: "#E3DFD4" }}>
        {s.unclassifiedMembers.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate">{m.full_name || m.email || m.user_id}</div>
              {m.full_name && m.email && (
                <div className="truncate text-xs" style={{ color: LABEL_INK }}>{m.email}</div>
              )}
              <div
                className="font-mono uppercase"
                style={{ fontSize: 9, letterSpacing: "0.08em", color: LABEL_INK }}
              >
                {m.source === "team_member_null" ? "team row · no type" : "project only · no team seat"}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-1">
                <button
                  className="border px-2 py-1 text-xs disabled:opacity-50"
                  style={{ borderColor: "#E3DFD4" }}
                  disabled={busy !== null}
                  onClick={() => classify(m.user_id, "core")}
                >
                  {busy === m.user_id + "core" ? "…" : "Core"}
                </button>
                <button
                  className="border px-2 py-1 text-xs disabled:opacity-50"
                  style={{ borderColor: "#E3DFD4" }}
                  disabled={busy !== null}
                  onClick={() => classify(m.user_id, "external")}
                >
                  {busy === m.user_id + "external" ? "…" : "External"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
