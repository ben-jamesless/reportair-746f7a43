import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { ShareMapLive } from "./ShareMapLive";
import { ShareMapStatic } from "./ShareMapStatic";
import type { ShareV2DayArea } from "../types";

/**
 * Site map for the v2 share page.
 *
 * Prefers a live, interactive Google map. The share page is a public artifact
 * and the managed browser key is referrer-restricted to *.lovable.app, so if
 * the script (or the key) fails on a custom domain we silently fall back to the
 * static satellite tile + SVG overlay renderer.
 */
export function ShareMapV2(props: {
  token: string;
  areas: ShareV2DayArea[];
  onAreaClick?: (areaId: string, featureLabel?: string) => void;
}) {
  const [mode, setMode] = useState<"pending" | "live" | "static">("pending");

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then(
      () => alive && setMode("live"),
      () => alive && setMode("static")
    );
    // Google surfaces auth/referrer failures only via this global hook.
    const prev = (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      prev?.();
      if (alive) setMode("static");
    };
    return () => {
      alive = false;
    };
  }, []);

  if (mode === "pending") return null;
  if (mode === "live") return <ShareMapLive {...props} onFailure={() => setMode("static")} />;
  return <ShareMapStatic {...props} />;
}
