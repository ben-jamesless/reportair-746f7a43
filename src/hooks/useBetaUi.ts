import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Reads and writes `profiles.beta_ui` for the current user. Controls whether
 * `/projects/:id` renders the new v2 shell (Overview · Daily Report · Library ·
 * Map) or the classic single-page shell.
 */
export function useBetaUi() {
  const { user } = useAuth();
  const [betaUi, setBetaUiState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setBetaUiState(false);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("beta_ui")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setBetaUiState(Boolean(data?.beta_ui));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setBetaUi = useCallback(
    async (next: boolean) => {
      if (!user) return { error: new Error("Not signed in") };
      const prev = betaUi;
      setBetaUiState(next);
      const { error } = await supabase
        .from("profiles")
        .update({ beta_ui: next })
        .eq("id", user.id);
      if (error) {
        setBetaUiState(prev);
      }
      return { error };
    },
    [user, betaUi]
  );

  return { betaUi, loading, setBetaUi };
}
