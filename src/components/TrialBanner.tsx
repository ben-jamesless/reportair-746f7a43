import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { subscriptionStatus, plan, trialEndsAt } = usePlan();

  if (subscriptionStatus !== "trialing" || !trialEndsAt) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "free";

  return (
    <div
      className="w-full sticky top-0 z-40 shrink-0 border-b border-[#1A6EFF]/20 bg-[#EBF0FF]"
      onClick={() => {
        if (window.innerWidth < 768) {
          window.location.href = "/billing";
        }
      }}
    >
      <div className="flex h-10 items-center justify-between px-4">
        {/* Left spacer */}
        <div className="hidden w-40 md:block" />

        {/* Centre */}
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#0F1724]">
          <Zap className="h-4 w-4 shrink-0 text-[#1A6EFF]" />
          <span className="hidden sm:inline">
            <span className="font-medium">{daysLeft} days remaining</span>{" "}
            in your {planLabel} trial.
          </span>
          <span className="sm:hidden">
            <span className="font-medium">{daysLeft}d left</span> in trial
          </span>
          <Link
            to="/billing"
            className="ml-1 font-medium text-[#1A6EFF] underline underline-offset-2 hover:opacity-80"
          >
            See Plans
          </Link>
        </div>

        {/* Right */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/billing"
            className="inline-flex items-center gap-1 rounded-md border border-[#1A6EFF] px-3 py-1 text-xs font-medium text-[#1A6EFF] transition-colors hover:bg-[#1A6EFF]/10"
          >
            Upgrade now →
          </Link>
        </div>
      </div>
    </div>
  );
}
