import { Link } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

export function TrialBanner() {
  const { subscriptionStatus, plan, trialEndsAt } = usePlan();
  const { isAdmin } = usePlatformAdmin();

  if (isAdmin) return null;
  if (subscriptionStatus !== "trialing" || !trialEndsAt) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Free";
  const urgent = daysLeft <= 3;

  // Treatment B (accent) for last 3 days, Treatment A (quiet) otherwise.
  const wrapClass = urgent
    ? "w-full sticky top-0 z-40 shrink-0 border-b border-[#0F1417]/10 bg-[#D94F2A] text-white"
    : "w-full sticky top-0 z-40 shrink-0 border-b border-[#C9C5BC] bg-[#F4F1EA] text-[#0F1417]";

  const mutedColor = urgent ? "rgba(255,255,255,0.85)" : "#6B6B66";
  const linkColor = urgent ? "#FFFFFF" : "#D94F2A";
  const ctaClass = urgent
    ? "inline-flex items-center gap-1 rounded-md border border-white/70 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/10"
    : "inline-flex items-center gap-1 rounded-md bg-[#0F1417] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0F1417]/90";

  return (
    <div
      className={wrapClass}
      onClick={() => {
        if (window.innerWidth < 768) {
          window.location.href = "/billing";
        }
      }}
    >
      <div className="flex h-10 items-center justify-between px-4">
        <div className="hidden w-40 md:block" />

        <div className="flex flex-1 items-center justify-center gap-2 text-sm">
          <span
            className="hidden sm:inline uppercase tracking-wider text-[11px]"
            style={{
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              color: mutedColor,
            }}
          >
            <span style={{ color: urgent ? "#FFFFFF" : "#0F1417", fontWeight: 500 }}>
              {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining
            </span>{" "}
            in your {planLabel} trial.
          </span>
          <span
            className="sm:hidden uppercase tracking-wider text-[11px]"
            style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", color: mutedColor }}
          >
            <span style={{ color: urgent ? "#FFFFFF" : "#0F1417", fontWeight: 500 }}>
              {daysLeft}d left
            </span>{" "}
            in trial
          </span>
          <Link
            to="/billing"
            className="ml-1 font-medium underline underline-offset-2 hover:opacity-80"
            style={{ color: linkColor }}
          >
            See plans
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/billing" className={ctaClass}>
            Upgrade now →
          </Link>
        </div>
      </div>
    </div>
  );
}
