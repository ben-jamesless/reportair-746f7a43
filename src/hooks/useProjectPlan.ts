import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LIMITS, normalisePlan, type PlanName, type PlanLimits } from "@/hooks/planLimits";

export type ProjectPlanName = PlanName;
export type ProjectPlanLimits = PlanLimits;

interface ProjectPlanState {
  loading:                  boolean;
  plan:                     PlanName;
  limits:                   PlanLimits;
  teamId:                   string | null;
  teamName:                 string | null;
  billingOwnerUserId:       string | null;
  billingOwnerName:         string | null;
  isBillingOwner:           boolean;
  memberCount:              number;
  projectCount:             number;
  exportsThisMonth:         number;
  subscriptionStatus:       string | null;
  trialEndsAt:              string | null;
  currentPeriodEnd:         string | null;
  paymentFailedAt:          string | null;
  canCreateProject:         boolean;
  canInviteMember:          boolean;
  canExportPdf:             boolean;
  canUseShareLink:          boolean;
  canUseShareLinkEmail:     boolean;
  canUsePasswordLinks:      boolean;
  canUseCustomLogo:         boolean;
  canUseWhiteLabel:         boolean;
  canUseFolders:            boolean;
  planIncludesInvites:      boolean;
  showBuildSlidesBranding:  boolean;
  isFree:                   boolean;
  refetch:                  () => void;
}

const initialState: Omit<ProjectPlanState, "refetch"> = {
  loading: true,
  plan: "free",
  limits: LIMITS.free,
  teamId: null,
  teamName: null,
  billingOwnerUserId: null,
  billingOwnerName: null,
  isBillingOwner: false,
  memberCount: 0,
  projectCount: 0,
  exportsThisMonth: 0,
  subscriptionStatus: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  paymentFailedAt: null,
  canCreateProject: false,
  canInviteMember: false,
  canExportPdf: false,
  canUseShareLink: true,
  canUseShareLinkEmail: false,
  canUsePasswordLinks: false,
  canUseCustomLogo: false,
  canUseWhiteLabel: false,
  canUseFolders: false,
  planIncludesInvites: false,
  showBuildSlidesBranding: true,
  isFree: true,
};

/**
 * Resolves the effective plan for a given project by walking
 * project → team → plan. Returns full parity with usePlan(): plan, limits,
 * all `canX` gates, plus billing-owner context so callers can decide whether
 * to show an actionable upgrade CTA vs. a "contact your owner" notice.
 *
 * Use this instead of usePlan() for anything scoped to a project — otherwise
 * invited members (who are not the team's billing owner) get mis-tiered as free.
 */
export function useProjectPlan(projectId: string | null | undefined): ProjectPlanState {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<Omit<ProjectPlanState, "refetch">>(initialState);

  useEffect(() => {
    if (!projectId) {
      setState({ ...initialState, loading: false });
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("team_id")
        .eq("id", projectId)
        .maybeSingle();

      const teamId = proj?.team_id ?? null;
      if (!teamId) {
        if (!cancelled) setState({ ...initialState, loading: false });
        return;
      }

      const { data: team } = await supabase
        .from("teams")
        .select("id, name, plan, billing_owner_user_id, subscription_status, trial_ends_at, current_period_end, exports_this_month, exports_reset_at, payment_failed_at")
        .eq("id", teamId)
        .maybeSingle();

      const planName = normalisePlan(team?.plan);
      const limits = LIMITS[planName];
      const billingOwnerUserId = team?.billing_owner_user_id ?? null;

      let billingOwnerName: string | null = null;
      if (billingOwnerUserId) {
        const { data: owner } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", billingOwnerUserId)
          .maybeSingle();
        billingOwnerName = owner?.full_name || owner?.email || null;
      }

      const { data: countData } = await supabase.rpc("team_member_count", { _team_id: teamId });
      const memberCount = typeof countData === "number" ? countData : 0;

      if (cancelled) return;
      const teamRow = team as {
        id?: string;
        name?: string;
        subscription_status?: string | null;
        trial_ends_at?: string | null;
        current_period_end?: string | null;
        exports_this_month?: number | null;
        payment_failed_at?: string | null;
      } | null;

      setState({
        loading: false,
        plan: planName,
        limits,
        teamId,
        teamName: teamRow?.name ?? null,
        billingOwnerUserId,
        billingOwnerName,
        isBillingOwner: !!user?.id && billingOwnerUserId === user.id,
        memberCount,
        projectCount: 0,
        exportsThisMonth: teamRow?.exports_this_month ?? 0,
        subscriptionStatus: teamRow?.subscription_status ?? null,
        trialEndsAt: teamRow?.trial_ends_at ?? null,
        currentPeriodEnd: teamRow?.current_period_end ?? null,
        paymentFailedAt: teamRow?.payment_failed_at ?? null,
        canCreateProject: limits.maxProjects === -1,
        canInviteMember: limits.maxMembers === -1 || memberCount < limits.maxMembers,
        canExportPdf: limits.pdfExport,
        canUseShareLink: limits.shareLinks,
        canUseShareLinkEmail: limits.shareLinkEmail,
        canUsePasswordLinks: limits.passwordLinks,
        canUseCustomLogo: limits.allowCustomLogo,
        canUseWhiteLabel: limits.whiteLabelFull,
        canUseFolders: limits.projectFolders,
        planIncludesInvites: limits.planIncludesInvites,
        showBuildSlidesBranding: limits.showBuildSlidesBranding,
        isFree: planName === "free",
      });
    })();

    return () => { cancelled = true; };
  }, [projectId, user?.id, refreshKey]);

  // Realtime: refresh when the team's plan/subscription row changes.
  useEffect(() => {
    if (!state.teamId) return;
    const channel = supabase
      .channel(`project-plan-${state.teamId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${state.teamId}` },
        () => setRefreshKey((k) => k + 1),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state.teamId]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { ...state, refetch };
}
