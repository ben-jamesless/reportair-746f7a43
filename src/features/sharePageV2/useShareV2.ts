import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ShareV2Day, ShareV2Meta } from "./types";
import { isoToday } from "./tokens";
import { pickDefaultDate as pick } from "./pickDefaultDate";

type State = {
  meta: ShareV2Meta | null;
  day: ShareV2Day | null;
  loading: boolean;
  activeDate: string | null;
  /** Today is empty, so the page opened on the latest earlier update. */
  fallbackFrom: string | null;
};

/** Fetches share_meta once (polled every 60s) and share_day for the active date. */
export function useShareV2(token: string | undefined) {
  const [state, setState] = useState<State>({
    meta: null,
    day: null,
    loading: true,
    activeDate: null,
    fallbackFrom: null,
  });

  const loadMeta = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setState((s) => ({ ...s, loading: true }));
      // ?preview=<signed token> is appended only by the app's own team-facing
      // Open/Copy actions. It attributes the view to "Team previews" even when
      // the member is signed out or on a preview origin — session state alone
      // used to decide this, which inflated the client-facing number.
      const previewToken = new URLSearchParams(window.location.search).get("preview");
      const { data, error } = await supabase.rpc("share_meta" as never, {
        _token: token,
        _password: null,
        _preview: previewToken,
      } as never);
      const meta = (data ?? null) as unknown as ShareV2Meta | null;

      if (error || !meta || !meta.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          meta: isRefresh ? s.meta : null,
        }));
        return;
      }
      setState((s) => ({
        ...s,
        meta,
        loading: false,
        ...(s.activeDate
          ? {}
          : (() => {
              const p = pick(meta.days ?? [], isoToday());
              return { activeDate: p.date, fallbackFrom: p.isFallback ? isoToday() : null };
            })()),
      }));
    },
    [token]
  );

  const loadDay = useCallback(
    async (date: string) => {
      if (!token) return;
      const { data } = await supabase.rpc("share_day" as never, {
        _token: token,
        _password: null,
        _date: date,
      } as never);
      const day = (data ?? null) as unknown as ShareV2Day | null;
      if (day?.ok) setState((s) => ({ ...s, day }));
    },
    [token]
  );

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (state.activeDate) void loadDay(state.activeDate);
  }, [state.activeDate, loadDay]);

  // Live: 60s poll of the meta RPC (no anon realtime).
  useEffect(() => {
    if (!state.meta?.ok) return;
    const id = window.setInterval(() => {
      void loadMeta(true);
      if (state.activeDate) void loadDay(state.activeDate);
    }, 60000);
    return () => window.clearInterval(id);
  }, [state.meta?.ok, state.activeDate, loadMeta, loadDay]);

  const setActiveDate = useCallback(
    (d: string) => setState((s) => (s.activeDate === d ? s : { ...s, activeDate: d, day: null, fallbackFrom: null })),
    []
  );

  return { ...state, setActiveDate };
}
