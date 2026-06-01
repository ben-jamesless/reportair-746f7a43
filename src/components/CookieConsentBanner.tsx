import { useEffect, useState } from "react";
import { denyConsent, getConsent, grantConsent } from "@/lib/analytics";

/**
 * Minimal GDPR/PDPO cookie consent banner. Renders only when the user has
 * not yet made a choice. Uses ReportAir brand tokens (INK background, SKY
 * CTA) per spec. No exclamation marks in copy.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    grantConsent();
    setVisible(false);
  };
  const decline = () => {
    denyConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100]"
      style={{ background: "#0F1724", borderTop: "1px solid #1E3050" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-sm text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="text-white/90">
          We use analytics to improve Build Slides. Accept to help us.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-md border border-white/20 px-4 py-2 text-white/80 transition hover:bg-white/10"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-md px-4 py-2 font-medium text-white transition hover:opacity-90"
            style={{ background: "#1A6EFF" }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
