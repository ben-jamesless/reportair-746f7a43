import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ShareV2Day, ShareV2Meta } from "./types";
import { isoToday } from "./tokens";

type State = {
  meta: ShareV2Meta | null;
  day: ShareV2Day | null;
  loading: boolean;
  needPassword: boolean;
  passwordError: boolean;
  activeDate: string | null;
};

/** Fetches share_meta once (polled every 60s) and share_day for the active date. */
export function useShareV2(token: string | undefined) {
  const [state, setState] = useState<State>({
    meta: null,
    day: null,
    loading: true,
    needPassword: false,
    passwordError: false,
    activeDate: null,
  });
  const pwdRef = useRef<string | null>(null);

  const pickDefaultDate = (meta: ShareV2Meta): string | null => {
    const days = (meta.days ?? []).map((d) => d.date).sort();
    if (days.length === 0) return null;
    const today = isoToday();
    if (days.includes(today)) return today;
    const past = days.filter((d) => d <= today);
    return past.length ? past[past.length - 1] : days[days.length - 1];
  };

  const loadMeta = useCallback(
    async (password: string | null, isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setState((s) => ({ ...s, loading: true }));
      const { data, error } = await supabase.rpc("share_meta" as never, {
        _token: token,
        _password: password,
      } as never);
      const meta = (data ?? null) as unknown as ShareV2Meta | null;

      if (error || !meta || !meta.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          needPassword: true,
          passwordError: password !== null,
          meta: isRefresh ? s.meta : null,
        }));
        return;
      }
      pwdRef.current = password;
      setState((s) => ({
        ...s,
        meta,
        loading: false,
        needPassword: false,
        passwordError: false,
        activeDate: s.activeDate ?? pickDefaultDate(meta),
      }));
    },
    [token]
  );

  const loadDay = useCallback(
    async (date: string) => {
      if (!token) return;
      const { data } = await supabase.rpc("share_day" as never, {
        _token: token,
        _password: pwdRef.current,
        _date: date,
      } as never);
      const day = (data ?? null) as unknown as ShareV2Day | null;
      if (day?.ok) setState((s) => ({ ...s, day }));
    },
    [token]
  );

  useEffect(() => {
    void loadMeta(null);
  }, [loadMeta]);

  useEffect(() => {
    if (state.activeDate) void loadDay(state.activeDate);
  }, [state.activeDate, loadDay]);

  // Live: 60s poll of the meta RPC (no anon realtime).
  useEffect(() => {
    if (!state.meta?.ok) return;
    const id = window.setInterval(() => {
      void loadMeta(pwdRef.current, true);
      if (state.activeDate) void loadDay(state.activeDate);
    }, 60000);
    return () => window.clearInterval(id);
  }, [state.meta?.ok, state.activeDate, loadMeta, loadDay]);

  const submitPassword = useCallback((pwd: string) => loadMeta(pwd), [loadMeta]);
  const setActiveDate = useCallback((d: string) => setState((s) => ({ ...s, activeDate: d, day: null })), []);

  return { ...state, submitPassword, setActiveDate };
}
