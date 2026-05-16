import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { withTimeout, NETWORK_TIMEOUT_MS, NETWORK_HELP } from "@/lib/network";

type PlanKey = "solo" | "pro" | "studio";

const PLANS: {
  key: PlanKey;
  name: string;
  monthly: string;
  annualMonthly: string;
  description: string;
  features: string[];
  recommended?: boolean;
}[] = [
  {
    key: "solo",
    name: "Solo",
    monthly: "HK$128",
    annualMonthly: "HK$102",
    description: "For solo operators running events.",
    features: ["1 active event", "Unlimited PDF exports", "14-day free trial"],
  },
  {
    key: "pro",
    name: "Pro",
    monthly: "HK$298",
    annualMonthly: "HK$238",
    description: "For growing event teams.",
    features: ["5 active events", "5 team members", "Share & client links", "Project folders", "14-day free trial"],
    recommended: true,
  },
  {
    key: "studio",
    name: "Studio",
    monthly: "HK$688",
    annualMonthly: "HK$550",
    description: "For agencies and large organisations.",
    features: ["Unlimited events", "Unlimited members", "Custom logo on PDF", "White-label header", "14-day free trial"],
  },
];

export default function Plan() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const autoLaunched = useRef(false);

  const startTrial = async (planKey: PlanKey, intervalOverride?: "annual" | "monthly") => {
    setLoading(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const interval = intervalOverride ?? (annual ? "annual" : "monthly");
      const { data, error } = await withTimeout(
        supabase.functions.invoke("stripe-checkout", {
          body: { plan: planKey, interval },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        NETWORK_TIMEOUT_MS,
        "Checkout"
      );
      if (error || !data?.url) {
        toast.error("Could not start checkout", {
          description: error?.message ?? NETWORK_HELP,
        });
        setLoading(null);
        return;
      }
      // Clear pending plan metadata so we don't auto-launch again
      await supabase.auth.updateUser({ data: { pending_plan_choice: null, pending_plan_interval: null } }).catch(() => {});
      window.location.href = data.url;
    } catch (err) {
      setLoading(null);
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error(msg, { description: NETWORK_HELP });
    }
  };

  const [skipping, setSkipping] = useState(false);

  const handleSkip = async () => {
    if (skipping || loading) return;
    setSkipping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/projects", { replace: true });
        return;
      }
      // Find the team this user owns (created during onboarding)
      const { data: team } = await supabase
        .from("teams")
        .select("id, trial_ends_at, subscription_status")
        .eq("billing_owner_user_id", user.id)
        .maybeSingle();

      if (team) {
        const trialEnds = team.trial_ends_at
          ? team.trial_ends_at
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { error: updErr } = await supabase
          .from("teams")
          .update({
            plan: "solo",
            subscription_status: "trialing",
            trial_ends_at: trialEnds,
          })
          .eq("id", team.id);
        if (updErr) {
          toast.error("Could not start trial", { description: updErr.message });
          setSkipping(false);
          return;
        }
      }

      // Clear any pending plan metadata
      await supabase.auth.updateUser({
        data: { pending_plan_choice: null, pending_plan_interval: null },
      }).catch(() => {});

      navigate("/projects", { replace: true });
    } catch (err) {
      setSkipping(false);
      const msg = err instanceof Error ? err.message : "Could not start trial";
      toast.error(msg);
    }
  };

  // Auto-launch checkout if signup metadata included a plan choice
  useEffect(() => {
    if (autoLaunched.current) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const pendingPlan = meta.pending_plan_choice as PlanKey | null | undefined;
      const pendingInterval = (meta.pending_plan_interval as "annual" | "monthly" | null | undefined) ?? "monthly";
      if (pendingPlan && ["solo", "pro", "studio"].includes(pendingPlan)) {
        autoLaunched.current = true;
        setAnnual(pendingInterval === "annual");
        startTrial(pendingPlan, pendingInterval);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingLayout step={3}>
      <div>
        <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Choose your plan</h2>
        <p className="text-sm text-[#7A7974] mb-6">Start free for 14 days. Cancel anytime.</p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={cn("text-sm font-medium", !annual ? "text-[#0F1724]" : "text-[#7A7974]")}>Monthly</span>
          <button
            onClick={() => setAnnual((a) => !a)}
            className={cn(
              "relative w-10 h-6 rounded-full transition-colors",
              annual ? "bg-[#1A6EFF]" : "bg-[#D4D1CA]"
            )}
            aria-label="Toggle annual billing"
          >
            <span
              className={cn(
                "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                annual && "translate-x-4"
              )}
            />
          </button>
          <span className={cn("text-sm font-medium", annual ? "text-[#0F1724]" : "text-[#7A7974]")}>
            Annual <span className="text-[#1A6EFF] text-xs">(save ~20%)</span>
          </span>
        </div>

        <div className="space-y-3">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                p.recommended ? "border-[#1A6EFF] bg-[#1A6EFF]/5" : "border-[#D4D1CA] bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[#0F1724]">{p.name}</h3>
                    {p.recommended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A6EFF] text-white font-medium uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7A7974] mt-0.5">{p.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-[#0F1724]">
                    {annual ? p.annualMonthly : p.monthly}
                  </div>
                  <div className="text-[10px] text-[#7A7974]">/month</div>
                </div>
              </div>
              <ul className="space-y-1 mb-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#0F1724]/80">
                    <Check className="h-3.5 w-3.5 text-[#1A6EFF] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => startTrial(p.key)}
                disabled={loading !== null}
                className={cn(
                  "w-full",
                  p.recommended
                    ? "bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
                    : "bg-white border border-[#D4D1CA] text-[#0F1724] hover:bg-[#FBFBF9]"
                )}
              >
                {loading === p.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start free trial
              </Button>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/projects", { replace: true })}
          className="mt-6 w-full text-sm text-[#7A7974] hover:text-[#0F1724] transition-colors"
        >
          Skip for now
        </button>
      </div>
    </OnboardingLayout>
  );
}
