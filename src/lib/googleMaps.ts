/// <reference types="google.maps" />
// Shared async loader for Google Maps JS API. Loads once per page.
//
// Two browser keys, so each surface can be locked to the minimum API set:
//   - share page  → VITE_GOOGLE_MAPS_SHARE_KEY, Maps JavaScript API only
//   - app routes  → VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY, Maps JS + Places
// The share page must NOT request the Places library — it never uses it, and
// pulling it would force its key to allow Places.

import { event as trackEvent } from "@/lib/analytics";

let loadPromise: Promise<typeof google> | null = null;
let loadedSignature: string | null = null;

declare global {
  interface Window {
    google?: typeof google;
    __lovableInitGoogleMaps?: () => void;
  }
}

export type MapsSurface = "app" | "share";

const APP_LIBRARIES = ["places", "marker", "geometry"];
const SHARE_LIBRARIES = ["marker", "geometry"];

function keyFor(surface: MapsSurface): string | undefined {
  const appKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (surface === "share") {
    const shareKey = import.meta.env.VITE_GOOGLE_MAPS_SHARE_KEY;
    if (!shareKey) {
      // Never silent: falling back means a Places-authorised key is being used
      // on a public page, which is exactly what the key split exists to stop.
      console.error(
        "[maps] VITE_GOOGLE_MAPS_SHARE_KEY is not set — the public share page is falling back to the app browser key (Places-authorised)."
      );
      trackEvent("maps_share_key_fallback", { surface, has_app_key: Boolean(appKey) });
    }
    return shareKey || appKey;
  }
  return appKey;
}


export function loadGoogleMaps(surface: MapsSurface = "app"): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));

  const libraries = (surface === "share" ? SHARE_LIBRARIES : APP_LIBRARIES).join(",");
  const key = keyFor(surface);
  if (!key) return Promise.reject(new Error("Google Maps browser key missing"));
  const signature = `${key}|${libraries}`;

  // The Maps JS API can only be loaded once per document. If a different
  // surface already loaded it, reuse that instance rather than double-loading.
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;
  loadedSignature = signature;

  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  loadPromise = new Promise((resolve, reject) => {
    window.__lovableInitGoogleMaps = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to init"));
    };
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key,
      v: "weekly",
      libraries,
      loading: "async",
      callback: "__lovableInitGoogleMaps",
    });
    if (channel) params.set("channel", String(channel));
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

/** Which key/library set actually loaded — useful when diagnosing key failures. */
export function loadedMapsSignature(): string | null {
  return loadedSignature;
}

