import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InvitesManager } from "@/components/InvitesManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TeamSeatStrip } from "./TeamSeatStrip";
import { ApprovalsInbox } from "./ApprovalsInbox";
import { UnclassifiedMembersPanel } from "./UnclassifiedMembersPanel";

/**
 * Members panel (v2). Wraps the existing InvitesManager and adds the
 * team-scoped seat summary + external-approvals inbox above it so owners
 * see counters and pending requests at a glance.
 */

const LABEL_INK = "#5C5850";

export function MembersPanel({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    (async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("team_id")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      const tid = (proj as { team_id?: string | null } | null)?.team_id ?? null;
      setTeamId(tid);

      if (tid && user?.id) {
        const { data: pm } = await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();
        const role = (pm as { role?: string } | null)?.role ?? null;
        setCanManage(role === "owner");
      } else {
        setCanManage(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId, user?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Members</SheetTitle>
          <SheetDescription>
            Invite teammates, change roles, and remove access. Internal team
            only — client sharing lives in Share &amp; deliver.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <TeamSeatStrip teamId={teamId} />
          <ApprovalsInbox teamId={teamId} canManage={canManage} />
          <UnclassifiedMembersPanel teamId={teamId} canManage={canManage} />


          <div className="mb-4 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block shrink-0 rounded-full"
              style={{ width: 9, height: 9, backgroundColor: "#3A6EA5" }}
            />
            <span
              className="font-semibold uppercase"
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                color: LABEL_INK,
              }}
            >
              Project access
            </span>
          </div>
          <InvitesManager projectId={projectId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
