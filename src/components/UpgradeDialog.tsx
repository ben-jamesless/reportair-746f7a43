import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { withTimeout, NETWORK_TIMEOUT_MS, NETWORK_HELP } from "@/lib/network";
import { Loader2, Check } from "lucide-react";
import type { PlanName } from "@/hooks/usePlan";

const PLANS = [
  {
    key: "solo",
    name: "Solo",
    monthlyPrice: "HK$128",
    annualPrice:  "HK$1,229",
    annualMonthly: "HK$102",
    description: "For solo operators running events.",
    features: [
      "1 active event",
      "Unlimited PDF exports",
      "7-day free trial",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: "HK$298",
    annualPrice:  "HK$2,860",
    annualMonthly: "HK$238",
    description: "For growing event teams.",
    features: [
      "5 active events",
      "5 team members",
      "Unlimited PDF exports",
      "Share & client links",
      "Password-protected links",
      "Project folders",
      "Project invites",
      "7-day free trial",
    ],
    recommended: true,
  },
  {
    key: "studio",
    name: "Studio",
    monthlyPrice: "HK$688",
    annualPrice:  "HK$6,604",
    annualMonthly: "HK$550",
    description: "For agencies and large organisations.",
    features: [
      "Unlimited events",
      "Unlimited team members",
      "Unlimited PDF exports",
      "Share & client links",
      "Custom logo on PDF",
      "White-label report header",
      "Priority support",
      "Onboarding call",
      "7-day free trial",
    ],
  },
];

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  try {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.clone === "function") {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    }
  } catch { /* ignore */ }
  return error instanceof Error ? error.message : fallback;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanName;
}

export const UpgradeDialog = ({ open, onOpenChange, currentPlan }: Props) => {
  const [loading, setLoading]   = useState<string | null>(null);
  const [annual, setAnnual]     = useState(false);

  const planOrder: Record<string, number> = { solo: 0, pro: 1, studio: 2 };
  const availablePlans = PLANS.filter(p => (planOrder[p.key] ?? 0) > (planOrder[currentPlan] ?? 0));

  const handleUpgrade = async (planKey: string) => {
    setLoading(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await withTimeout(
        supabase.functions.invoke("stripe-checkout", {
          body: { plan: planKey, interval: annual ? "annual" : "monthly" },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        NETWORK_TIMEOUT_MS,
        "Checkout"
      );
      if (error || !data?.url) {
        const description = await getFunctionErrorMessage(error, NETWORK_HELP);
        toast.error("Could not start checkout", {
          description,
        });
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setLoading(null);
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error(msg, { description: NETWORK_HELP });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">Your 3 build days are up</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Keep the build going — upgrade to Solo. Start 7-day free trial. No card until day 8.
          </p>
        </DialogHeader>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            className={`relative w-10 h-6 rounded-full transition-colors ${annual ? "bg-[#01696F]" : "bg-muted"}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-card transition-transform ${annual ? "translate-x-4" : ""}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
            Annual <span className="ml-1 text-xs font-semibold text-[#01696F] bg-[#01696F]/10 px-1.5 py-0.5 rounded-full">Save 20%</span>
          </span>
        </div>

        <div className="grid gap-4 items-stretch sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {availablePlans.map(plan => (
            <div
              key={plan.key}
              className={`relative rounded-xl border flex flex-col h-full p-6 gap-4 ${
                plan.recommended
                  ? "border-[#01696F] bg-[#01696F] text-white"
                  : "bg-card"
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-4 bg-[#01696F] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/30">
                  Most popular
                </span>
              )}

              <div>
                <p className="font-semibold text-lg">{plan.name}</p>
                <p className={`text-sm mt-1 ${plan.recommended ? "text-white/70" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>

              <div>
                <div className="text-3xl font-bold">
                  {annual ? plan.annualMonthly : plan.monthlyPrice}
                  <span className={`text-sm font-normal ml-1 ${plan.recommended ? "text-white/70" : "text-muted-foreground"}`}>
                    / month
                  </span>
                </div>
                {annual && (
                  <p className={`text-xs mt-0.5 ${plan.recommended ? "text-white/60" : "text-muted-foreground"}`}>
                    {plan.annualPrice} billed annually
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: plan.recommended ? "#ffffff" : "#01696F" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full font-semibold"
                onClick={() => handleUpgrade(plan.key)}
                disabled={!!loading}
                style={plan.recommended
                  ? { backgroundColor: "#ffffff", color: "#01696F", border: "none" }
                  : { backgroundColor: "#01696F", color: "#ffffff", border: "none" }
                }
              >
                {loading === plan.key
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Start 7-day free trial. No card until day 8. →"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
