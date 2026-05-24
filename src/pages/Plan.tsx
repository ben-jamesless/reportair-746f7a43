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
type PlanAction = { type: "checkout"; plan: PlanKey } | { type: "free" } | { type: "contact"; href: string };

const PLANS: {
  key: string;
  name: string;
  monthly: string;
  annualMonthly: string;
  annualBilled: string;
  description: string;
  features: string[];
  recommended?: boolean;
  action: PlanAction;
  cta: string;
}[] = [
  {
    key: "free",
    name: "Free",
    monthly: "HK$0",
    annualMonthly: "HK$0",
    annualBilled: "Always free",
    description: "Try it — no card needed.",
    features: [
      "1 active build",
      "3 build-day reports",
      "Unlimited photo uploads",
      "Live share link",
      "BuildSlides branded",
    ],
    action: { type: "free" },
    cta: "Start for free",
  },
  {
    key: "solo",
    name: "Solo",
    monthly: "HK$128",
    annualMonthly: "HK$102",
    annualBilled: "HK$1,229 billed annually",
    description: "For solo operators.",
    features: [
      "1 active build",
      "Unlimited build days",
      "Unlimited photo uploads",
      "Live share link",
      "BuildSlides branded",
      "7-day free trial",
    ],
    action: { type: "checkout", plan: "solo" },
    cta: "Start 7-day free trial",
  },
  {
    key: "crew",
    name: "Crew",
    monthly: "HK$298",
    annualMonthly: "HK$238",
    annualBilled: "HK$2,860 billed annually",
    description: "For growing event teams.",
    features: [
      "5 active builds",
      "5 team members",
      "Unlimited photo uploads",
      "Password-protected links",
      "PDF export",
      "Your logo + BuildSlides",
      "Project folders & invites",
      "7-day free trial",
    ],
    recommended: true,
    action: { type: "checkout", plan: "pro" },
    cta: "Start 7-day free trial",
  },
  {
    key: "studio",
    name: "Studio",
    monthly: "Get in touch",
    annualMonthly: "Get in touch",
    annualBilled: "Custom pricing",
    description: "For agencies and large organisations.",
    features: [
      "Unlimited active builds",
      "Unlimited team members",
      "Password-protected links",
      "PDF export",
      "Your logo only — no BuildSlides",
      "White-label report header",
      "Priority support + onboarding call",
    ],
    action: { type: "contact", href: "mailto:hello@buildslides.co" },
    cta: "Get in touch",
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

  const handleAction = (action: PlanAction, key: string) => {
    if (action.type === "checkout") {
      setLoading(action.plan);
      startTrial(action.plan);
      return;
    }
    if (action.type === "free") {
      handleSkip();
      return;
    }
    window.location.href = action.href;
  };

  return (
    <OnboardingLayout step={3}>
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Choose your plan</h2>
        <p className="text-sm text-muted-foreground mb-6">Start free — upgrade any time. Cancel whenever.</p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={cn("text-sm font-medium", !annual ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
          <button
            onClick={() => setAnnual((a) => !a)}
            className={cn(
              "relative w-10 h-6 rounded-full transition-colors",
              annual ? "bg-[#D94F2A]" : "bg-[#D4D1CA]"
            )}
            aria-label="Toggle annual billing"
          >
            <span
              className={cn(
                "absolute top-1 left-1 w-4 h-4 rounded-full bg-card transition-transform",
                annual && "translate-x-4"
              )}
            />
          </button>
          <span className={cn("text-sm font-medium", annual ? "text-foreground" : "text-muted-foreground")}>
            Annual <span className="text-[#D94F2A] text-xs">(save ~20%)</span>
          </span>
        </div>

        <div className="space-y-3">
          {PLANS.map((p) => {
            const isCustom = p.monthly === "Get in touch";
            const isCheckout = p.action.type === "checkout";
            const isLoading = isCheckout && loading === (p.action as { plan: PlanKey }).plan;
            return (
              <div
                key={p.key}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  p.recommended ? "border-[#D94F2A] bg-[#D94F2A]/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                      {p.recommended && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D94F2A] text-white font-medium uppercase tracking-wide">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {isCustom ? (
                      <div className="text-sm font-bold text-foreground">Get in touch</div>
                    ) : (
                      <>
                        <div className="text-base font-bold text-foreground">
                          {annual ? p.annualMonthly : p.monthly}
                        </div>
                        <div className="text-[10px] text-muted-foreground">/month</div>
                      </>
                    )}
                    {annual && !isCustom && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.annualBilled}</div>
                    )}
                  </div>
                </div>
                <ul className="space-y-1 mb-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                      <Check className="h-3.5 w-3.5 text-[#D94F2A] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleAction(p.action, p.key)}
                  disabled={loading !== null || skipping}
                  className={cn(
                    "w-full",
                    p.recommended
                      ? "bg-[#D94F2A] hover:bg-[#D94F2A]/90 text-white"
                      : "bg-card border border-border text-foreground hover:bg-muted/40"
                  )}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {p.cta}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Paid plans include a 7-day free trial. Cancel any time.
        </p>
      </div>
    </OnboardingLayout>
  );
}
