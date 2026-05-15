import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Plan types ────────────────────────────────────────────────────────────────
export type PlanName = "solo" | "pro" | "studio";

export interface PlanLimits {
  maxProjects:     number;   // -1 = unlimited
  maxMembers:      number;   // -1 = unlimited
  maxExportsMonth: number;   // -1 = unlimited (all plans now unlimited)
  shareLinks:      boolean;
  shareLinkEmail:  boolean;
  passwordLinks:   boolean;
  customLogo:      boolean;
  whiteLabelHeader:boolean;
  projectFolders:  boolean;
  planIncludesInvites: boolean;  // external project invites
}

const LIMITS: Record<PlanName, PlanLimits> = {
  solo: {
    maxProjects:      1,
    maxMembers:       1,
    maxExportsMonth:  -1,  // unlimited
    shareLinks:       false,
    shareLinkEmail:   false,
    passwordLinks:    false,
    customLogo:       false,
    whiteLabelHeader: false,
    projectFolders:   false,
    planIncludesInvites: false,
  },
  pro: {
    maxProjects:      5,
    maxMembers:       5,
    maxExportsMonth:  -1,
    shareLinks:       true,
    shareLinkEmail:   true,
    passwordLinks:    true,
    customLogo:       false,
    whiteLabelHeader: false,
    projectFolders:   true,
    planIncludesInvites: true,
  },
  studio: {
    maxProjects:      -1,
    maxMembers:       -1,
    maxExportsMonth:  -1,
    shareLinks:       true,
    shareLinkEmail:   true,
    passwordLinks:    true,
    customLogo:       true,
    whiteLabelHeader: true,
    projectFolders:   true,
    planIncludesInvites: true,
  },
};

// ── Legacy plan name normaliser (handles rows not yet migrated) ───────────────
function normalisePlan(raw: string | null | undefined): PlanName {
  switch (raw) {
    case "pro":        return "pro";
    case "team":       return "pro";       // legacy → new pro
    case "studio":     return "studio";
    case "enterprise": return "studio";    // legacy → studio
    case "solo":       return "solo";
    case "free":
    default:           return "solo";      // legacy free → solo
  }
}

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
  canUseShareLinkEmail: boolean;
  canUsePasswordLinks: boolean;
  canUseCustomLogo: boolean;
  canUseWhiteLabel: boolean;
  canUseFolders:    boolean;
  planIncludesInvites: boolean;
  refetch?:         () => void;
}

export const usePlan = (): PlanState => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<Omit<PlanState, "refetch">>({
    plan: "solo", limits: LIMITS.solo, teamId: null,
    projectCount: 0, memberCount: 0, exportsThisMonth: 0,
    subscriptionStatus: null, trialEndsAt: null, currentPeriodEnd: null,
    loading: true,
    canCreateProject: false, canInviteMember: false,
    canExportPdf: true,   // all plans — unlimited
    canUseShareLink: false, canUseShareLinkEmail: false,
    canUsePasswordLinks: false, canUseCustomLogo: false,
    canUseWhiteLabel: false, canUseFolders: false,
    planIncludesInvites: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setState(s => ({ ...s, loading: false })); return; }

      const [{ data: team }, { data: ownedCount }, { data: members }] = await Promise.all([
        supabase.from("teams").select(
          "id, plan, subscription_status, trial_ends_at, current_period_end, exports_this_month, exports_reset_at"
        ).eq("billing_owner_user_id", user.id).maybeSingle(),
        supabase.rpc("my_owned_projects_count"),
        supabase.from("team_members").select("id"),
      ]);

      if (cancelled) return;

      const planName = normalisePlan(team?.plan);
      const limits   = LIMITS[planName];

      // Only events on teams the user belongs to (and not archived) count toward
      // the plan quota. Invited-only events on other teams are excluded.
      const projectCount = typeof ownedCount === "number" ? ownedCount : 0;
      const memberCount  = members?.length  ?? 1;

      setState({
        plan:             planName,
        limits,
        teamId:           team?.id ?? null,
        projectCount,
        memberCount,
        exportsThisMonth: team?.exports_this_month ?? 0,
        subscriptionStatus: team?.subscription_status ?? null,
        trialEndsAt:      team?.trial_ends_at ?? null,
        currentPeriodEnd: team?.current_period_end ?? null,
        loading:          false,
        canCreateProject: limits.maxProjects === -1 || projectCount < limits.maxProjects,
        canInviteMember:  limits.maxMembers  === -1 || memberCount  < limits.maxMembers,
        canExportPdf:     true,   // unlimited on all plans
        canUseShareLink:  limits.shareLinks,
        canUseShareLinkEmail: limits.shareLinkEmail,
        canUsePasswordLinks:  limits.passwordLinks,
        canUseCustomLogo: limits.customLogo,
        canUseWhiteLabel: limits.whiteLabelHeader,
        canUseFolders:    limits.projectFolders,
        planIncludesInvites: limits.planIncludesInvites,
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
        () => setRefreshKey(k => k + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state.teamId]);

  return { ...state, refetch: () => setRefreshKey(k => k + 1) };
};
