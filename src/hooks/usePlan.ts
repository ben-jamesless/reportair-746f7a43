import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Plan types ────────────────────────────────────────────────────────────────
export type PlanName = "free" | "solo" | "pro" | "studio";

export interface PlanLimits {
  maxProjects:            number;   // -1 = unlimited
  maxMembers:             number;   // -1 = unlimited
  maxUpdateDays:          number;   // max distinct photo-upload dates per project; -1 = unlimited
  maxExportsMonth:        number;   // -1 = unlimited (kept for future use, all paid plans unlimited)
  pdfExport:              boolean;  // can generate/download PDF exports
  shareLinks:             boolean;  // can create share links
  shareLinkEmail:         boolean;  // can send share link by email
  passwordLinks:          boolean;  // can password-protect share links
  showBuildSlidesBranding:boolean;  // BuildFolder wordmark shown on share pages & PDFs
  allowCustomLogo:        boolean;  // can upload their own team/client logo
  whiteLabelFull:         boolean;  // removes ALL BuildFolder branding (Studio only)
  projectFolders:         boolean;
  planIncludesInvites:    boolean;  // external project invites
}

const LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    maxProjects:             1,
    maxMembers:              1,
    maxUpdateDays:           3,    // 3 distinct photo-upload dates per project
    maxExportsMonth:         0,
    pdfExport:               false,
    shareLinks:              true, // core value — share link always on
    shareLinkEmail:          false,
    passwordLinks:           false,
    showBuildSlidesBranding: true,
    allowCustomLogo:         false,
    whiteLabelFull:          false,
    projectFolders:          false,
    planIncludesInvites:     false,
  },
  solo: {
    maxProjects:             1,
    maxMembers:              1,
    maxUpdateDays:           -1,   // unlimited
    maxExportsMonth:         -1,
    pdfExport:               false,
    shareLinks:              true,
    shareLinkEmail:          false,
    passwordLinks:           false,
    showBuildSlidesBranding: true,
    allowCustomLogo:         false,
    whiteLabelFull:          false,
    projectFolders:          false,
    planIncludesInvites:     false,
  },
  pro: {
    maxProjects:             5,
    maxMembers:              5,
    maxUpdateDays:           -1,
    maxExportsMonth:         -1,
    pdfExport:               true,
    shareLinks:              true,
    shareLinkEmail:          true,
    passwordLinks:           true,
    showBuildSlidesBranding: true,  // BuildFolder shown alongside client logo
    allowCustomLogo:         true,
    whiteLabelFull:          false,
    projectFolders:          true,
    planIncludesInvites:     true,
  },
  studio: {
    maxProjects:             -1,
    maxMembers:              -1,
    maxUpdateDays:           -1,
    maxExportsMonth:         -1,
    pdfExport:               true,
    shareLinks:              true,
    shareLinkEmail:          true,
    passwordLinks:           true,
    showBuildSlidesBranding: false, // BuildFolder removed entirely
    allowCustomLogo:         true,
    whiteLabelFull:          true,
    projectFolders:          true,
    planIncludesInvites:     true,
  },
};

// ── Legacy plan name normaliser ───────────────────────────────────────────────
// "free" now stays as "free" — it is a real plan, not a fallback.
function normalisePlan(raw: string | null | undefined): PlanName {
  switch (raw) {
    case "free":       return "free";
    case "solo":       return "solo";
    case "pro":        return "pro";
    case "team":       return "pro";        // legacy → pro
    case "studio":     return "studio";
    case "enterprise": return "studio";     // legacy → studio
    default:           return "free";       // any unknown → free (most restrictive)
  }
}

interface PlanState {
  plan:                     PlanName;
  limits:                   PlanLimits;
  teamId:                   string | null;
  projectCount:             number;
  memberCount:              number;
  exportsThisMonth:         number;
  subscriptionStatus:       string | null;
  trialEndsAt:              string | null;
  currentPeriodEnd:         string | null;
  paymentFailedAt:          string | null;
  loading:                  boolean;
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
  refetch?:                 () => void;
}

export const usePlan = (): PlanState => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<Omit<PlanState, "refetch">>({
    plan: "free", limits: LIMITS.free, teamId: null,
    projectCount: 0, memberCount: 0, exportsThisMonth: 0,
    subscriptionStatus: null, trialEndsAt: null, currentPeriodEnd: null, paymentFailedAt: null,
    loading: true,
    canCreateProject: false, canInviteMember: false,
    canExportPdf: false,
    canUseShareLink: true,
    canUseShareLinkEmail: false, canUsePasswordLinks: false,
    canUseCustomLogo: false, canUseWhiteLabel: false,
    canUseFolders: false, planIncludesInvites: false,
    showBuildSlidesBranding: true,
    isFree: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setState(s => ({ ...s, loading: false })); return; }

      const [{ data: team }, { data: ownedCount }, { data: members }] = await Promise.all([
        supabase.from("teams").select(
          "id, plan, subscription_status, trial_ends_at, current_period_end, exports_this_month, exports_reset_at, payment_failed_at"
        ).eq("billing_owner_user_id", user.id).maybeSingle(),
        supabase.rpc("my_owned_projects_count"),
        supabase.from("team_members").select("id"),
      ]);

      if (cancelled) return;

      const planName = normalisePlan(team?.plan);
      const limits   = LIMITS[planName];
      const projectCount = typeof ownedCount === "number" ? ownedCount : 0;
      const memberCount  = members?.length ?? 1;

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
        paymentFailedAt:  (team as { payment_failed_at?: string | null })?.payment_failed_at ?? null,
        loading:          false,
        canCreateProject: limits.maxProjects === -1 || projectCount < limits.maxProjects,
        canInviteMember:  limits.maxMembers  === -1 || memberCount  < limits.maxMembers,
        canExportPdf:     limits.pdfExport,
        canUseShareLink:  limits.shareLinks,
        canUseShareLinkEmail: limits.shareLinkEmail,
        canUsePasswordLinks:  limits.passwordLinks,
        canUseCustomLogo: limits.allowCustomLogo,
        canUseWhiteLabel: limits.whiteLabelFull,
        canUseFolders:    limits.projectFolders,
        planIncludesInvites: limits.planIncludesInvites,
        showBuildSlidesBranding: limits.showBuildSlidesBranding,
        isFree:           planName === "free",
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
