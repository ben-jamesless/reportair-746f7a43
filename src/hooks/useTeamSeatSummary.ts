import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalisePlan, type PlanName } from "@/hooks/planLimits";

/**
 * Single counter surface for the membership model — backed by the
 * `team_seat_summary` RPC. All UI showing seat counts, caps, or ratio
 * status should read from this hook rather than counting `team_members`
 * client-side (which under-counts for non-owners and drifts from the
 * server-enforced trigger).
 */
export interface TeamSeatSummary {
  plan: PlanName;
  coreCount: number;
  coreCap: number;                    // effective cap (base + add-on seats)
  addonSeats: number;
  externalCount: number;
  externalCap: number;                // 0 on Free/Solo
  domainMatchingEnabled: boolean;
  underRatio: boolean;                // externalCount > coreCount * 5
  loading: boolean;
  refetch: () => void;
}

const empty: Omit<TeamSeatSummary, "refetch"> = {
  plan: "free",
  coreCount: 0,
  coreCap: 1,
  addonSeats: 0,
  externalCount: 0,
  externalCap: 0,
  domainMatchingEnabled: true,
  underRatio: false,
  loading: true,
};

export function useTeamSeatSummary(teamId: string | null | undefined): TeamSeatSummary {
  const [state, setState] = useState<Omit<TeamSeatSummary, "refetch">>(empty);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!teamId) { setState({ ...empty, loading: false }); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("team_seat_summary", { _team_id: teamId });
      if (cancelled) return;
      if (error || !data || typeof data !== "object") {
        setState({ ...empty, loading: false });
        return;
      }
      const d = data as Record<string, unknown>;
      const coreCount = Number(d.core_count ?? 0);
      const externalCount = Number(d.external_count ?? 0);
      setState({
        plan: normalisePlan(d.plan as string),
        coreCount,
        coreCap: Number(d.core_cap ?? 1),
        addonSeats: Number(d.addon_seats ?? 0),
        externalCount,
        externalCap: Number(d.external_cap ?? 0),
        domainMatchingEnabled: Boolean(d.domain_matching_enabled ?? true),
        underRatio: externalCount > coreCount * 5,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [teamId, tick]);

  // Live refresh when the roster or the team row changes.
  useEffect(() => {
    if (!teamId) return;
    const suffix = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`team-seat-${teamId}-${suffix}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "team_members", filter: `team_id=eq.${teamId}` },
        () => setTick(t => t + 1))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${teamId}` },
        () => setTick(t => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId]);

  const refetch = useCallback(() => setTick(t => t + 1), []);
  return { ...state, refetch };
}
