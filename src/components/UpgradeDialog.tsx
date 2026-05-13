import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import type { PlanName } from "@/hooks/usePlan";

const PLANS = [
  {
    key: "pro",
    name: "Pro",
    price: "HK$80",
    description: "For solo operators who need more.",
    features: ["5 projects", "5 team members", "Unlimited PDF exports", "Share links"],
  },
  {
    key: "team",
    name: "Team",
    price: "HK$240",
    description: "For growing event teams.",
    features: ["20 projects", "15 team members", "Unlimited PDF exports", "Share links", "Custom logo on PDF"],
    recommended: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "HK$800",
    description: "For large organisations.",
    features: ["Unlimited projects", "Unlimited members", "Unlimited exports", "Share links", "Custom logo on PDF", "Priority support"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanName;
}

export const UpgradeDialog = ({ open, onOpenChange, currentPlan }: Props) => {
  const [loading, setLoading] = useState<string | null>(null);

  const planOrder: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };
  const availablePlans = PLANS.filter(p => (planOrder[p.key] ?? 0) > (planOrder[currentPlan] ?? 0));

  const handleUpgrade = async (planKey: string) => {
    setLoading(planKey);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: { plan: planKey },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || !data?.url) {
      toast.error("Could not start checkout. Please try again.");
      setLoading(null);
      return;
    }
    window.location.href = data.url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">Upgrade your plan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Start a 7-day free trial. Cancel anytime.
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {availablePlans.map(plan => (
            <div
              key={plan.key}
              className={`relative rounded-xl border p-5 flex flex-col gap-4 ${
                plan.recommended
                  ? "border-[#FF6A1A] bg-[#0B2A4A] text-white"
                  : "bg-card"
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-4 bg-[#FF6A1A] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}

              <div>
                <p className="font-semibold text-lg">{plan.name}</p>
                <p className={`text-sm mt-1 ${plan.recommended ? "text-white/70" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="text-3xl font-bold">
                {plan.price}
                <span className={`text-sm font-normal ml-1 ${plan.recommended ? "text-white/70" : "text-muted-foreground"}`}>
                  / month
                </span>
              </div>

              <Button
                className="w-full font-semibold"
                onClick={() => handleUpgrade(plan.key)}
                disabled={loading === plan.key}
                style={
                  plan.recommended
                    ? { backgroundColor: "#FF6A1A", color: "#fff", border: "none" }
                    : undefined
                }
              >
                {loading === plan.key
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Start 7-day free trial →"}
              </Button>

              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: plan.recommended ? "#FF6A1A" : "#0B2A4A" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
