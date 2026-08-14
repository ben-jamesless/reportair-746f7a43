import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { event as trackEvent } from "@/lib/analytics";
import { ShareMapLive } from "./ShareMapLive";
import { ShareMapStatic } from "./ShareMapStatic";
import type { ShareV2DayArea } from "../types";

/**
 * Site map for the v2 share page.
 *
 * Prefers a live, interactive Google map. The share page is a public artifact,
 * so if the script (or the referrer-restricted share key) fails we fall back to
 * the static satellite tile + SVG overlay renderer — but never silently: every
 * degrade emits `share_map_static_fallback` and a console error, so a broken
 * production key surfaces instead of serving static maps forever.
 */
function reportFallback(reason: string, detail?: string) {
  console.error(`[share-map] falling back to static map — ${reason}`, detail ?? "");
  trackEvent("share_map_static_fallback", { reason, detail: detail?.slice(0, 200) });
}

export function ShareMapV2(props: {
  token: string;
  areas: ShareV2DayArea[];
  onAreaClick?: (areaId: string, featureLabel?: string) => void;
  /** Pulsing marker for a photo located from the lightbox. */
  focusPoint?: { lat: number; lng: number; photoId: string; label?: string } | null;
  onFocusClick?: (photoId: string) => void;
  onFocusClear?: () => void;
}) {
  const [mode, setMode] = useState<"pending" | "live" | "static">("pending");

  useEffect(() => {
    let alive = true;
    loadGoogleMaps("share").then(
      () => alive && setMode("live"),
      (err) => {
        reportFallback("sdk_load_failed", err instanceof Error ? err.message : String(err));
        if (alive) setMode("static");
      }
    );
    // Google surfaces auth/referrer failures only via this global hook.
    const prev = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      prev?.();
      reportFallback("gm_auth_failure", "key rejected for this referrer");
      if (alive) setMode("static");
    };
    return () => {
      alive = false;
    };
  }, []);

  if (mode === "pending") return null;
  if (mode === "live")
    return (
      <ShareMapLive
        {...props}
        onFailure={() => {
          reportFallback("live_render_failed");
          setMode("static");
        }}
      />
    );
  return <ShareMapStatic {...props} />;
}

