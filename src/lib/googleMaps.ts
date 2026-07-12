/// <reference types="google.maps" />
// Shared async loader for Google Maps JS API. Loads once per page.
// Uses the referrer-restricted browser key from the Google Maps connector.

let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    google?: typeof google;
    __lovableInitGoogleMaps?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps browser key missing"));

  loadPromise = new Promise((resolve, reject) => {
    window.__lovableInitGoogleMaps = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to init"));
    };
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key,
      v: "weekly",
      libraries: "places,marker,geometry",
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
