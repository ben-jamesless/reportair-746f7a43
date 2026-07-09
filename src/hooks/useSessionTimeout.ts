import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const IDLE_MS = 12 * 60 * 60 * 1000; // 12 hours
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WARN_BEFORE_MS = 2 * 60 * 1000; // 2 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // 30s
const LAST_ACTIVITY_KEY = "bf.session.lastActivity";
const SESSION_START_KEY = "bf.session.startedAt";

const now = () => Date.now();

function readNum(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function writeNum(key: string, val: number) {
  try { localStorage.setItem(key, String(val)); } catch { /* ignore */ }
}

export function useSessionTimeout(enabled: boolean) {
  const navigate = useNavigate();
  const warnedRef = useRef(false);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Initialize timestamps if missing
    if (readNum(LAST_ACTIVITY_KEY) == null) writeNum(LAST_ACTIVITY_KEY, now());
    if (readNum(SESSION_START_KEY) == null) writeNum(SESSION_START_KEY, now());

    const bump = () => {
      warnedRef.current = false;
      writeNum(LAST_ACTIVITY_KEY, now());
    };

    const events: (keyof WindowEventMap)[] = [
      "mousedown", "keydown", "touchstart", "scroll", "visibilitychange",
    ];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const forceSignOut = async (reason: "idle" | "absolute") => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        localStorage.removeItem(SESSION_START_KEY);
        await supabase.auth.signOut();
      } finally {
        navigate(`/auth?reason=timeout&kind=${reason}`, { replace: true });
      }
    };

    const tick = () => {
      const last = readNum(LAST_ACTIVITY_KEY) ?? now();
      const start = readNum(SESSION_START_KEY) ?? now();
      const t = now();

      if (t - start >= ABSOLUTE_MS) {
        void forceSignOut("absolute");
        return;
      }
      if (t - last >= IDLE_MS) {
        void forceSignOut("idle");
        return;
      }
      if (!warnedRef.current && IDLE_MS - (t - last) <= WARN_BEFORE_MS) {
        warnedRef.current = true;
        toast("You'll be signed out soon due to inactivity", {
          duration: WARN_BEFORE_MS,
          action: { label: "Stay signed in", onClick: bump },
        });
      }
    };

    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);
    tick();

    return () => {
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [enabled, navigate]);
}

/** Call on successful sign-in to reset the absolute-lifetime clock. */
export function markSessionStart() {
  const t = now();
  writeNum(SESSION_START_KEY, t);
  writeNum(LAST_ACTIVITY_KEY, t);
}
