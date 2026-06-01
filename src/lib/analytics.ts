// GA4 analytics utility with Consent Mode v2.
//
// This app is Vite + React (not Next.js), so the measurement ID is read from
// `import.meta.env.VITE_GA_MEASUREMENT_ID`. The GA script is NOT loaded until
// the user accepts cookies (see CookieConsentBanner). In dev the script is
// skipped entirely to keep development data clean.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || "G-68MGP78M5X";
const IS_PROD = import.meta.env.PROD;
const CONSENT_KEY = "analytics_consent";

let loaded = false;

function ensureGtagStub() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
  }
}

/** Push the default-denied Consent Mode v2 signal. Safe to call before the
 * gtag.js script is loaded — the queue replays once the script attaches. */
export function initConsentDefaults() {
  ensureGtagStub();
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

function injectScript() {
  if (loaded || !GA_ID) return;
  loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
}

/** Called after the user clicks Accept. Loads gtag.js and grants consent. */
export function grantConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {
    /* ignore */
  }
  if (!IS_PROD || !GA_ID) return;
  ensureGtagStub();
  injectScript();
  window.gtag("consent", "update", { analytics_storage: "granted" });
}

export function denyConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "denied");
  } catch {
    /* ignore */
  }
}

export function getConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** If consent was already granted in a previous session, attach gtag now. */
export function bootstrapIfConsented() {
  ensureGtagStub();
  initConsentDefaults();
  if (getConsent() === "granted" && IS_PROD && GA_ID) {
    injectScript();
    window.gtag("consent", "update", { analytics_storage: "granted" });
  }
}

export function pageview(url: string) {
  if (!IS_PROD || !GA_ID || getConsent() !== "granted") return;
  ensureGtagStub();
  window.gtag("config", GA_ID, { page_path: url });
}

export function event(action: string, params?: Record<string, unknown>) {
  if (!IS_PROD || !GA_ID || getConsent() !== "granted") return;
  ensureGtagStub();
  window.gtag("event", action, params ?? {});
}
