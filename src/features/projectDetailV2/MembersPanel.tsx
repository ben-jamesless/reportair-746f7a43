import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CompanyInvites } from "@/features/members/CompanyInvites";
import { useProjectPlan } from "@/hooks/useProjectPlan";
import { InvitesManager } from "@/components/InvitesManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TeamSeatStrip } from "./TeamSeatStrip";
import { ApprovalsInbox } from "./ApprovalsInbox";
import { UnclassifiedMembersPanel } from "./UnclassifiedMembersPanel";
import { PanelBar, SectionLabel } from "@/features/projectSettings/settingsUi";

/**
 * Members panel (v2). Wraps the existing InvitesManager and adds the
 * team-scoped seat summary + external-approvals inbox above it so owners
 * see counters and pending requests at a glance.
 */



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
  const { plan } = useProjectPlan(projectId);
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
        className="w-full p-0 shadow-elegant sm:max-w-[520px] overflow-y-auto"
      >
        <PanelBar title="Members" />
        <SheetHeader className="space-y-1 px-6 pt-5 text-left">
          <SheetTitle className="sr-only">Members</SheetTitle>
          <SheetDescription>
            Invite teammates, change roles, and remove access. Internal team
            only — client sharing lives in Share &amp; deliver.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-6 pb-8">
          {plan !== "beta" && <><TeamSeatStrip teamId={teamId} /><ApprovalsInbox teamId={teamId} canManage={canManage} /><UnclassifiedMembersPanel teamId={teamId} canManage={canManage} /></>}
          {plan === "beta" && teamId && <CompanyInvites teamId={teamId} initialProjectId={projectId} />}


          <SectionLabel>Event access</SectionLabel>
          <InvitesManager projectId={projectId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
