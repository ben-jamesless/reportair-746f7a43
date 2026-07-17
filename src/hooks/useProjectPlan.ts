import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ProjectPlanName = "free" | "solo" | "pro" | "studio";

export interface ProjectPlanLimits {
  maxUpdateDays: number; // -1 = unlimited
}

const LIMITS: Record<ProjectPlanName, ProjectPlanLimits> = {
  free:   { maxUpdateDays: 3 },
  solo:   { maxUpdateDays: -1 },
  pro:    { maxUpdateDays: -1 },
  studio: { maxUpdateDays: -1 },
};

function normalisePlan(raw: string | null | undefined): ProjectPlanName {
  switch (raw) {
    case "free":       return "free";
    case "solo":       return "solo";
    case "pro":        return "pro";
    case "team":       return "pro";
    case "studio":     return "studio";
    case "enterprise": return "studio";
    default:           return "free";
  }
}

interface ProjectPlanState {
  loading: boolean;
  plan: ProjectPlanName;
  limits: ProjectPlanLimits;
  teamId: string | null;
  teamName: string | null;
  billingOwnerUserId: string | null;
  billingOwnerName: string | null;
  isBillingOwner: boolean;
}

/**
 * Resolves the effective plan for a given project by walking
 * project → team → plan. Also tells the caller whether the current
 * viewer is that team's billing owner (so we know if we can show them
 * an actionable upgrade CTA, vs. a "contact your owner" notice).
 */
export function useProjectPlan(projectId: string | null): ProjectPlanState {
  const { user } = useAuth();
  const [state, setState] = useState<ProjectPlanState>({
    loading: true,
    plan: "free",
    limits: LIMITS.free,
    teamId: null,
    teamName: null,
    billingOwnerUserId: null,
    billingOwnerName: null,
    isBillingOwner: false,
  });

  useEffect(() => {
    if (!projectId) { setState((s) => ({ ...s, loading: false })); return; }
    let cancelled = false;

    (async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("team_id")
        .eq("id", projectId)
        .maybeSingle();

      const teamId = proj?.team_id ?? null;
      if (!teamId) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        return;
      }

      const { data: team } = await supabase
        .from("teams")
        .select("id, name, plan, billing_owner_user_id")
        .eq("id", teamId)
        .maybeSingle();

      const planName = normalisePlan(team?.plan);
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

      if (cancelled) return;
      setState({
        loading: false,
        plan: planName,
        limits: LIMITS[planName],
        teamId,
        teamName: team?.name ?? null,
        billingOwnerUserId,
        billingOwnerName,
        isBillingOwner: !!user?.id && billingOwnerUserId === user.id,
      });
    })();

    return () => { cancelled = true; };
  }, [projectId, user?.id]);

  return state;
}
