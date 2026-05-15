import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowUpRight, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo",
  pro: "Pro",
  studio: "Studio",
};

type ComparePlan = {
  key: "solo" | "pro" | "studio";
  name: string;
  monthly: string;
  annualMonthly: string;
  monthlyRaw: string;
  annualRaw: string;
  includes: string;
  extraUser: string;
  footnote: string;
  heading: string;
  features: string[];
};

const COMPARE_PLANS: ComparePlan[] = [
  {
    key: "solo",
    name: "Solo",
    monthly: "HK$128",
    annualMonthly: "HK$102",
    monthlyRaw: "HK$128/month",
    annualRaw: "HK$1,229/year",
    includes: "Includes 1 User",
    extraUser: "Single seat plan",
    footnote: "Annual price ~HK$1,229. Monthly price HK$128, billed monthly.",
    heading: "Key Features:",
    features: [
      "1 active event",
      "Unlimited PDF exports",
      "Standard report templates",
      "Email support",
      "14-day free trial",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    monthly: "HK$298",
    annualMonthly: "HK$238",
    monthlyRaw: "HK$298/month",
    annualRaw: "HK$2,860/year",
    includes: "Includes 5 Users",
    extraUser: "HK$58 / additional user / month",
    footnote: "Annual price ~HK$2,860. Monthly price HK$298, billed monthly.",
    heading: "Everything in Solo, and:",
    features: [
      "5 active events",
      "Share & client links",
      "Password-protected links",
      "Project folders",
      "External project invites",
      "Priority email support",
    ],
  },
  {
    key: "studio",
    name: "Studio",
    monthly: "HK$688",
    annualMonthly: "HK$550",
    monthlyRaw: "HK$688/month",
    annualRaw: "HK$6,604/year",
    includes: "Unlimited Users",
    extraUser: "No per-seat charges",
    footnote: "Annual price ~HK$6,604. Monthly price HK$688, billed monthly.",
    heading: "Everything in Pro, and:",
    features: [
      "Unlimited active events",
      "Custom logo on PDF",
      "White-label report header",
      "Onboarding call",
      "Priority support",
    ],
  },
];

const Billing = () => {
  const [searchParams] = useSearchParams();
  const {
    plan, memberCount,
    subscriptionStatus, trialEndsAt, currentPeriodEnd, loading, refetch,
  } = usePlan();

  const [upgradeOpen, setUpgradeOpen]     = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [annual, setAnnual]               = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const hasHandledCheckout                = useRef(false);
  const hasSyncedExisting                 = useRef(false);

  const crumbs = [{ label: "Projects", to: "/projects" }, { label: "Billing" }];

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (!status || hasHandledCheckout.current) return;
    hasHandledCheckout.current = true;

    if (status === "success") {
      toast.success("Subscription activated — welcome aboard!");

      const syncSubscription = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke("stripe-sync-subscription", {
          body: {},
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        await refetch?.();
      };

      void syncSubscription();

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await syncSubscription();
        if (attempts >= 6) clearInterval(poll);
      }, 2000);

      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }

    if (status === "cancelled") {
      toast.info("Checkout cancelled. No changes were made.");
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, refetch]);

  useEffect(() => {
    if (loading || plan !== "solo" || hasSyncedExisting.current) return;
    hasSyncedExisting.current = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke("stripe-sync-subscription", {
        body: {},
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (data?.updated) await refetch?.();
    })();
  }, [loading, plan, refetch]);

  const handleManage = async () => {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stripe-portal", {
      body: {},
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || !data?.url) {
      toast.error("Could not open billing portal. Please try again.");
      setPortalLoading(false);
      return;
    }
    window.location.href = data.url;
  };

  const handleChoosePlan = async (planKey: string) => {
    if (planKey === plan && (subscriptionStatus === "active" || subscriptionStatus === "trialing")) {
      handleManage();
      return;
    }
    setCheckoutLoading(planKey);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: { plan: planKey, interval: annual ? "annual" : "monthly" },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || !data?.url) {
      toast.error("Could not start checkout. Please try again.");
      setCheckoutLoading(null);
      return;
    }
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

  const isSubscribed  = subscriptionStatus && !["canceled", null].includes(subscriptionStatus);
  const isTrial       = subscriptionStatus === "trialing";
  const isPastDue     = subscriptionStatus === "past_due";
  const planLabel     = PLAN_LABELS[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);

  const statusBadge = isTrial
    ? <Badge className="bg-primary text-primary-foreground hover:bg-primary">Trial</Badge>
    : isPastDue
    ? <Badge variant="destructive">Payment failed</Badge>
    : isSubscribed
    ? <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Active</Badge>
    : <Badge variant="secondary">Solo</Badge>;

  const renewalLine = isTrial && trialEndsAt
    ? `Trial ends ${new Date(trialEndsAt).toLocaleDateString("en-HK", { day: "numeric", month: "long", year: "numeric" })}`
    : currentPeriodEnd && isSubscribed
    ? `Renews ${new Date(currentPeriodEnd).toLocaleDateString("en-HK", { day: "numeric", month: "long", year: "numeric" })}`
    : "No active subscription";

  return (
    <AppShell crumbs={crumbs}>
      <div className="mx-auto max-w-7xl py-6 px-1 space-y-8">
        {/* Current plan summary */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Current plan: {planLabel}
              </h2>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{renewalLine}</p>
          </div>
          {isSubscribed && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManage}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Manage billing <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></>}
            </Button>
          )}
        </div>

        {isPastDue && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Your last payment failed. Please update your payment method to keep your subscription active.{" "}
            <button onClick={handleManage} className="font-semibold underline hover:no-underline">
              Update now →
            </button>
          </div>
        )}

        {/* Compare plans heading */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Compare Plans</h1>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Pill toggle */}
            <div className="inline-flex items-center rounded-full border-2 border-[#D4D1CA] bg-[#F5F4F0] p-1.5">
              <button
                onClick={() => setAnnual(true)}
                className={`px-6 py-2.5 text-base font-semibold rounded-full transition-all ${
                  annual ? "bg-[#1A6EFF] text-white shadow-md" : "text-[#7A7974] hover:text-[#0F1724]"
                }`}
              >
                Pay Once a Year
              </button>
              <button
                onClick={() => setAnnual(false)}
                className={`px-6 py-2.5 text-base font-semibold rounded-full transition-all ${
                  !annual ? "bg-[#1A6EFF] text-white shadow-md" : "text-[#7A7974] hover:text-[#0F1724]"
                }`}
              >
                Pay Once a Month
              </button>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {memberCount} Billable {memberCount === 1 ? "User" : "Users"}
            </div>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid gap-5 lg:grid-cols-[repeat(3,minmax(0,1fr))_280px]">
          {COMPARE_PLANS.map((p) => {
            const isCurrent = p.key === plan;
            const price = annual ? p.annualMonthly : p.monthly;
            return (
              <div
                key={p.key}
                className={cn(
                  "rounded-2xl border-2 p-6 flex flex-col gap-5",
                  isCurrent
                    ? "border-[#1A6EFF] bg-[#1A6EFF]/[0.03] shadow-md"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-foreground">{p.name}</h3>
                  {isCurrent && (
                    <Badge className="text-xs bg-[#1A6EFF] text-white hover:bg-[#1A6EFF]">Current</Badge>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">{price}</span>
                    <span className="text-sm text-muted-foreground">*/month</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{p.includes}</p>
                  <p className="text-sm text-muted-foreground">{p.extraUser}</p>
                  <p className="text-sm text-muted-foreground">
                    HKD / {annual ? "Billed Annually" : "Billed Monthly"}
                  </p>
                </div>

                <Button
                  className="w-full font-semibold bg-primary text-primary-foreground hover:bg-primary-hover"
                  onClick={() => handleChoosePlan(p.key)}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === p.key
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : isCurrent && isSubscribed ? "Manage Plan" : "Choose Plan"}
                </Button>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold text-foreground">{p.heading}</p>
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground mt-auto pt-2">{p.footnote}</p>
              </div>
            );
          })}

          {/* Walkthrough card */}
          <div className="rounded-2xl bg-muted/40 border border-border p-6 flex flex-col gap-4 self-start">
            <h3 className="text-lg font-semibold text-foreground">Want a live walkthrough?</h3>
            <p className="text-sm text-muted-foreground">
              See how Reportair works, ask questions, and start saving your team time and money.
            </p>
            <Button
              variant="outline"
              className="w-full font-semibold"
              onClick={() => window.open("mailto:ben@reportair.co?subject=Reportair%20Demo%20Request", "_blank")}
            >
              Schedule a Demo
            </Button>
          </div>
        </div>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={plan}
      />
    </AppShell>
  );
};

export default Billing;
