// GA4 analytics utility with Consent Mode v2.
//
// Vite + React. Measurement ID comes from `import.meta.env.VITE_GA_MEASUREMENT_ID`.
// Analytics is enabled implicitly; users can opt out via the cookie banner.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export const GA_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || "G-68MGP78M5X";
const IS_PROD = import.meta.env.PROD;
const CONSENT_KEY = "analytics_consent";

let scriptInjected = false;
let scriptReady = false;
const pendingEvents: Array<() => void> = [];

function ensureGtagStub() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
}

function flushPending() {
  scriptReady = true;
  while (pendingEvents.length) {
    const fn = pendingEvents.shift();
    try {
      fn?.();
    } catch {
      /* ignore */
    }
  }
}

function runWhenReady(fn: () => void) {
  if (scriptReady) {
    fn();
  } else {
    pendingEvents.push(fn);
  }
}

/** Consent Mode defaults. Analytics granted by default; ads denied. */
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
  if (scriptInjected || !GA_ID) return;
  scriptInjected = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  s.onload = () => {
    // Initialize once the library is actually loaded so config + events go through.
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false });
    flushPending();
  };
  s.onerror = () => {
    // Don't keep queuing forever if the script is blocked.
    scriptReady = true;
    pendingEvents.length = 0;
  };
  document.head.appendChild(s);
}

/** User explicitly accepts. */
export function grantConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {
    /* ignore */
  }
  ensureGtagStub();
  window.gtag("consent", "update", { analytics_storage: "granted" });
  if (IS_PROD && GA_ID) {
    injectScript();
    // Send a pageview for the current page now that consent is granted.
    pageview(window.location.pathname + window.location.search);
  }
}

/** User opts out. */
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

/** Implicit consent: load GA unless user explicitly opted out. */
export function bootstrapIfConsented() {
  ensureGtagStub();
  initConsentDefaults();
  if (getConsent() === "denied") return;
  if (IS_PROD && GA_ID) {
    injectScript();
  }
}

export function pageview(url: string) {
  if (!IS_PROD || !GA_ID || getConsent() === "denied") return;
  ensureGtagStub();
  injectScript();
  runWhenReady(() => {
    window.gtag("event", "page_view", {
      send_to: GA_ID,
      page_path: url,
      page_location: window.location.origin + url,
      page_title: document.title,
    });
  });
}

export function event(action: string, params?: Record<string, unknown>) {
  if (!IS_PROD || !GA_ID || getConsent() === "denied") return;
  ensureGtagStub();
  injectScript();
  runWhenReady(() => {
    window.gtag("event", action, params ?? {});
  });
}
