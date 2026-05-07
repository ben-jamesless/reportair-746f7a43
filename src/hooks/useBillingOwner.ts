import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current authenticated user is the billing owner of
 * the given team. Billing ownership is intentionally separate from
 * project_members.role — only one user per team manages the subscription
 * and payment method.
 */
export const useIsBillingOwner = (teamId: string | null | undefined) => {
  const { user } = useAuth();
  const [isBillingOwner, setIsBillingOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !teamId) {
        setIsBillingOwner(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("teams")
        .select("billing_owner_user_id")
        .eq("id", teamId)
        .maybeSingle();
      if (cancelled) return;
      setIsBillingOwner(data?.billing_owner_user_id === user.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, teamId]);

  return { isBillingOwner, loading };
};

/**
 * Returns the first team where the current user is the billing owner
 * (most users have exactly one). Used to gate the /billing route.
 */
export const useMyBillingTeam = () => {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setTeamId(null); setLoading(false); return; }
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("billing_owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setTeamId(data?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { teamId, loading };
};
