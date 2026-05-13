import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";

const PLANS = [
  {
    key: "pro",
    name: "Pro",
    price: "HK$80",
    interval: "/ month",
    features: ["5 projects", "5 team members", "Unlimited PDF exports", "Share links"],
  },
  {
    key: "team",
    name: "Team",
    price: "HK$240",
    interval: "/ month",
    features: ["20 projects", "15 team members", "Unlimited PDF exports", "Share links", "Custom logo on PDF"],
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "HK$800",
    interval: "/ month",
    features: ["Unlimited projects", "Unlimited members", "Unlimited PDF exports", "Share links", "Custom logo on PDF", "Priority support"],
  },
] as const;

function UsageMeter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max === -1 ? 0 : Math.min((used / max) * 100, 100);
  const over = max !== -1 && used >= max;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? "font-medium text-destructive" : "font-medium"}>
          {used}{max === -1 ? "" : ` / ${max}`}
        </span>
      </div>
      {max !== -1 && (
        <div className="h-1.5 w-full rounded-full bg-secondary">
          <div
            className={`h-1.5 rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

const Billing = () => {
  const [searchParams] = useSearchParams();
  const {
    plan, limits, projectCount, memberCount, exportsThisMonth,
    subscriptionStatus, trialEndsAt, currentPeriodEnd, loading,
  } = usePlan();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const crumbs = [{ label: "Projects", to: "/projects" }, { label: "Billing" }];

  useEffect(() => {
    if (searchParams.get("checkout") === "success") toast.success("Subscription activated — welcome aboard!");
    if (searchParams.get("checkout") === "cancelled") toast.info("Checkout cancelled. No changes were made.");
  }, [searchParams]);

  const handleUpgrade = async (planKey: string) => {
    setCheckoutLoading(planKey);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: { plan: planKey },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || !data?.url) { toast.error("Could not start checkout. Please try again."); setCheckoutLoading(null); return; }
    window.location.href = data.url;
  };

  const handleManage = async () => {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stripe-portal", {
      body: {},
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || !data?.url) { toast.error("Could not open billing portal. Please try again."); setPortalLoading(false); return; }
    window.location.href = data.url;
  };

  if (loading) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const isSubscribed = !!subscriptionStatus && subscriptionStatus !== "canceled";
  const isTrial      = subscriptionStatus === "trialing";
  const planLabel    = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <AppShell crumbs={crumbs}>
      <div className="mx-auto max-w-3xl space-y-8 py-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{planLabel} plan</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isTrial && trialEndsAt
                  ? `Trial ends ${new Date(trialEndsAt).toLocaleDateString()}`
                  : currentPeriodEnd && isSubscribed
                  ? `Renews ${new Date(currentPeriodEnd).toLocaleDateString()}`
                  : "No active subscription"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTrial && <Badge variant="secondary">Trial</Badge>}
              {subscriptionStatus === "past_due" && <Badge variant="destructive">Payment failed</Badge>}
              {subscriptionStatus === "active" && <Badge>Active</Badge>}
              {isSubscribed && (
                <Button variant="outline" size="sm" onClick={handleManage} disabled={portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage"}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">Usage this month</p>
            <UsageMeter label="Projects"     used={projectCount}     max={limits.maxProjects} />
            <UsageMeter label="Team members" used={memberCount}      max={limits.maxMembers} />
            <UsageMeter label="PDF exports"  used={exportsThisMonth} max={limits.maxExportsMonth} />
          </div>
        </div>

        {plan !== "enterprise" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Upgrade your plan</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.filter(p => {
                const order: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };
                return (order[p.key] ?? 0) > (order[plan] ?? 0);
              }).map(p => (
                <div key={p.key} className={`rounded-lg border p-5 space-y-4 ${"highlighted" in p && p.highlighted ? "border-primary ring-1 ring-primary" : ""}`}>
                  {"highlighted" in p && p.highlighted && (
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">Most popular</p>
                  )}
                  <div>
                    <p className="font-semibold text-lg">{p.name}</p>
                    <p className="text-2xl font-bold mt-1">
                      {p.price}<span className="text-sm font-normal text-muted-foreground">{p.interval}</span>
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={"highlighted" in p && p.highlighted ? "default" : "outline"}
                    onClick={() => handleUpgrade(p.key)}
                    disabled={checkoutLoading === p.key}
                  >
                    {checkoutLoading === p.key
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <>Start 7-day trial <ArrowRight className="h-4 w-4 ml-1" /></>}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Billing;
