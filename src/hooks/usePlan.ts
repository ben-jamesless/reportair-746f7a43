import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanName = "free" | "pro" | "team" | "enterprise";

export interface PlanLimits {
  maxProjects:      number;   // -1 = unlimited
  maxMembers:       number;   // -1 = unlimited
  maxExportsMonth:  number;   // -1 = unlimited
  shareLinks:       boolean;
  customLogo:       boolean;
}

const LIMITS: Record<PlanName, PlanLimits> = {
  free:       { maxProjects: 2,  maxMembers: 1,  maxExportsMonth: 14, shareLinks: false, customLogo: false },
  pro:        { maxProjects: 5,  maxMembers: 5,  maxExportsMonth: -1, shareLinks: true,  customLogo: false },
  team:       { maxProjects: 20, maxMembers: 15, maxExportsMonth: -1, shareLinks: true,  customLogo: true  },
  enterprise: { maxProjects: -1, maxMembers: -1, maxExportsMonth: -1, shareLinks: true,  customLogo: true  },
};

interface PlanState {
  plan:             PlanName;
  limits:           PlanLimits;
  teamId:           string | null;
  projectCount:     number;
  memberCount:      number;
  exportsThisMonth: number;
  subscriptionStatus: string | null;
  trialEndsAt:      string | null;
  currentPeriodEnd: string | null;
  loading:          boolean;
  canCreateProject: boolean;
  canInviteMember:  boolean;
  canExportPdf:     boolean;
  canUseShareLink:  boolean;
  canUseCustomLogo: boolean;
  refetch?:         () => void;
}

export const usePlan = (): PlanState => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<Omit<PlanState, "refetch">>({
    plan: "free", limits: LIMITS.free, teamId: null,
    projectCount: 0, memberCount: 0, exportsThisMonth: 0,
    subscriptionStatus: null, trialEndsAt: null, currentPeriodEnd: null,
    loading: true,
    canCreateProject: false, canInviteMember: false,
    canExportPdf: false, canUseShareLink: false, canUseCustomLogo: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setState(s => ({ ...s, loading: false })); return; }

      const [{ data: team }, { data: projects }, { data: members }] = await Promise.all([
        supabase.from("teams").select(
          "id, plan, subscription_status, trial_ends_at, current_period_end, exports_this_month, exports_reset_at"
        ).eq("billing_owner_user_id", user.id).maybeSingle(),
        supabase.rpc("my_accessible_projects"),
        supabase.from("team_members").select("id"),
      ]);

      if (cancelled) return;

      const planName = ((team?.plan as PlanName) ?? "free") as PlanName;
      const limits   = LIMITS[planName] ?? LIMITS.free;

      let exportsCount = team?.exports_this_month ?? 0;
      if (team?.exports_reset_at) {
        const resetMonth = new Date(team.exports_reset_at);
        const thisMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (resetMonth < thisMonth) exportsCount = 0;
      }

      const projectCount = projects?.length ?? 0;
      const memberCount  = members?.length  ?? 1;

      setState({
        plan:             planName,
        limits,
        teamId:           team?.id ?? null,
        projectCount,
        memberCount,
        exportsThisMonth: exportsCount,
        subscriptionStatus: team?.subscription_status ?? null,
        trialEndsAt:      team?.trial_ends_at ?? null,
        currentPeriodEnd: team?.current_period_end ?? null,
        loading:          false,
        canCreateProject: limits.maxProjects === -1 || projectCount < limits.maxProjects,
        canInviteMember:  limits.maxMembers  === -1 || memberCount  < limits.maxMembers,
        canExportPdf:     limits.maxExportsMonth === -1 || exportsCount < limits.maxExportsMonth,
        canUseShareLink:  limits.shareLinks,
        canUseCustomLogo: limits.customLogo,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]);

  useEffect(() => {
    if (!state.teamId) return;

    const channel = supabase
      .channel(`team-plan-${state.teamId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${state.teamId}` },
        () => {
          setRefreshKey(k => k + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [state.teamId]);

  return { ...state, refetch: () => setRefreshKey(k => k + 1) };
};
