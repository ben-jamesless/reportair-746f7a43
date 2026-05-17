import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";

export function TrialBanner() {
  const { subscriptionStatus, plan, trialEndsAt } = usePlan();

  if (subscriptionStatus !== "trialing" || !trialEndsAt) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "free";

  return (
    <div
      className="w-full sticky top-0 z-40 shrink-0 border-b border-[#E0A82E]/40 bg-[#F2C14E] text-[#0F1417]"
      onClick={() => {
        if (window.innerWidth < 768) {
          window.location.href = "/billing";
        }
      }}
    >
      <div className="flex h-10 items-center justify-between px-4">
        <div className="hidden w-40 md:block" />

        <div className="flex flex-1 items-center justify-center gap-2 text-sm">
          <AlertTriangle size={14} strokeWidth={1.5} className="shrink-0" />
          <span
            className="hidden sm:inline font-mono uppercase tracking-wider text-[11px]"
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            <span className="font-medium">{daysLeft} days remaining</span> in your {planLabel} trial.
          </span>
          <span className="sm:hidden font-mono text-[11px] uppercase tracking-wider">
            <span className="font-medium">{daysLeft}d left</span> in trial
          </span>
          <Link
            to="/billing"
            className="ml-1 font-medium underline underline-offset-2 hover:opacity-80"
          >
            See Plans
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/billing"
            className="inline-flex items-center gap-1 rounded-full border border-[#0F1417] px-3 py-1 text-xs font-medium text-[#0F1417] transition-colors hover:bg-[#0F1417]/10"
          >
            Upgrade now →
          </Link>
        </div>
      </div>
    </div>
  );
}
