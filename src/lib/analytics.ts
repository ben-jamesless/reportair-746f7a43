// GA4 analytics utility with Consent Mode v2.
//
// This app is Vite + React (not Next.js), so the measurement ID is read from
// `import.meta.env.VITE_GA_MEASUREMENT_ID`. In production, GA loads by default
// unless the user explicitly opts out in the cookie banner. In dev the script
// is skipped entirely to keep development data clean.

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

/** Implicit-consent defaults: analytics granted by default; ad signals denied.
 * Users can opt out via the banner, which switches analytics_storage to denied. */
export function initConsentDefaults() {
  ensureGtagStub();
  window.gtag("consent", "default", {
    analytics_storage: "granted",
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

/** Called when the user explicitly accepts (opt-in confirmation). */
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

/** Called when the user opts out. Revokes consent and prevents further events. */
export function denyConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "denied");
  } catch {
    /* ignore */
  }
  ensureGtagStub();
  window.gtag("consent", "update", { analytics_storage: "denied" });
}

export function getConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** Implicit consent: load GA unless the user has explicitly opted out. */
export function bootstrapIfConsented() {
  ensureGtagStub();
  initConsentDefaults();
  if (getConsent() === "denied") return;
  if (IS_PROD && GA_ID) {
    injectScript();
    window.gtag("consent", "update", { analytics_storage: "granted" });
  }
}

export function pageview(url: string) {
  if (!IS_PROD || !GA_ID || getConsent() === "denied") return;
  ensureGtagStub();
  injectScript();
  window.gtag("event", "page_view", {
    send_to: GA_ID,
    page_path: url,
    page_location: window.location.origin + url,
    page_title: document.title,
  });
}


export function event(action: string, params?: Record<string, unknown>) {
  if (!IS_PROD || !GA_ID || getConsent() === "denied") return;
  ensureGtagStub();
  window.gtag("event", action, params ?? {});
}

