import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, ArrowRight } from "lucide-react";

const BRAND_ORANGE = "#FF6A1A";
const BRAND_NAVY = "#0B2A4A";

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
  const pct = max === -1 ? 100 : Math.min((used / max) * 100, 100);
  const over = max !== -1 && used >= max;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${over ? "text-red-600" : ""}`} style={!over ? { color: BRAND_NAVY } : undefined}>
          {used}{max === -1 ? "" : ` / ${max}`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: over ? "#dc2626" : BRAND_ORANGE }}
        />
      </div>
    </div>
  );
}

const Billing = () => {
  const [searchParams] = useSearchParams();
  const {
    plan, limits, projectCount, memberCount, exportsThisMonth,
    subscriptionStatus, trialEndsAt, currentPeriodEnd, loading, refetch,
  } = usePlan();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const crumbs = [{ label: "Projects", to: "/projects" }, { label: "Billing" }];

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Subscription activated — welcome aboard!");
      setTimeout(() => refetch(), 2500);
    }
    if (searchParams.get("checkout") === "cancelled") {
      toast.info("Checkout cancelled. No changes were made.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const upgradePlans = PLANS.filter(p => {
    const order: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };
    return (order[p.key] ?? 0) > (order[plan] ?? 0);
  });

  let statusBadge: { label: string; bg: string; color: string } | null = null;
  if (isTrial) statusBadge = { label: "Trial", bg: BRAND_ORANGE, color: "#fff" };
  else if (subscriptionStatus === "active") statusBadge = { label: "Active", bg: "#10b981", color: "#fff" };
  else if (subscriptionStatus === "past_due") statusBadge = { label: "Payment failed", bg: "#dc2626", color: "#fff" };
  else statusBadge = { label: "Free", bg: "#e5e7eb", color: "#374151" };

  return (
    <AppShell crumbs={crumbs}>
      <div className="mx-auto max-w-6xl py-6 px-1">
        <div className={`grid gap-6 ${plan !== "enterprise" ? "lg:grid-cols-5" : ""}`}>
          {/* Left: current plan */}
          <div className={`${plan !== "enterprise" ? "lg:col-span-2" : "max-w-xl"} rounded-2xl border bg-card p-6 shadow-sm`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: BRAND_NAVY }}>
                  {planLabel}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isTrial && trialEndsAt
                    ? `Trial ends ${new Date(trialEndsAt).toLocaleDateString()}`
                    : currentPeriodEnd && isSubscribed
                    ? `Renews ${new Date(currentPeriodEnd).toLocaleDateString()}`
                    : "No active subscription"}
                </p>
              </div>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}
              >
                {statusBadge.label}
              </span>
            </div>

            <div className="my-6 h-px w-full" style={{ backgroundColor: BRAND_NAVY, opacity: 0.12 }} />

            <div className="space-y-4">
              <p className="text-sm font-semibold" style={{ color: BRAND_NAVY }}>Usage this month</p>
              <UsageMeter label="Projects"     used={projectCount}     max={limits.maxProjects} />
              <UsageMeter label="Team members" used={memberCount}      max={limits.maxMembers} />
              <UsageMeter label="PDF exports"  used={exportsThisMonth} max={limits.maxExportsMonth} />
            </div>

            {isSubscribed && (
              <div className="mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManage}
                  disabled={portalLoading}
                  style={{ borderColor: BRAND_NAVY, color: BRAND_NAVY }}
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage subscription"}
                </Button>
              </div>
            )}
          </div>

          {/* Right: upgrade cards */}
          {plan !== "enterprise" && (
            <div className="lg:col-span-3 space-y-4">
              <h2 className="text-base font-semibold" style={{ color: BRAND_NAVY }}>
                Upgrade your plan
              </h2>
              <div className={`grid gap-4 ${upgradePlans.length === 1 ? "" : upgradePlans.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                {upgradePlans.map(p => {
                  const highlighted = "highlighted" in p && p.highlighted;
                  const cardStyle = highlighted
                    ? { backgroundColor: BRAND_NAVY, color: "#fff" }
                    : undefined;
                  const featureColor = highlighted ? "rgba(255,255,255,0.85)" : undefined;
                  return (
                    <div
                      key={p.key}
                      className={`rounded-2xl border p-5 space-y-4 shadow-sm flex flex-col ${highlighted ? "border-transparent" : ""}`}
                      style={cardStyle}
                    >
                      {highlighted && (
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND_ORANGE }}>
                          Recommended
                        </p>
                      )}
                      <div>
                        <p className="font-semibold text-lg">{p.name}</p>
                        <p className="text-3xl font-bold mt-1">
                          {p.price}
                          <span className={`text-sm font-normal ${highlighted ? "" : "text-muted-foreground"}`} style={highlighted ? { color: "rgba(255,255,255,0.7)" } : undefined}>
                            {p.interval}
                          </span>
                        </p>
                      </div>
                      <ul className="space-y-2 flex-1">
                        {p.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: featureColor }}>
                            <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: BRAND_ORANGE }} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full font-semibold"
                        onClick={() => handleUpgrade(p.key)}
                        disabled={checkoutLoading === p.key}
                        style={
                          highlighted
                            ? { backgroundColor: BRAND_ORANGE, color: "#fff", border: "none" }
                            : { backgroundColor: "transparent", color: BRAND_NAVY, border: `1px solid ${BRAND_NAVY}` }
                        }
                      >
                        {checkoutLoading === p.key
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <>Start 7-day free trial <ArrowRight className="h-4 w-4 ml-1" /></>}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Billing;
