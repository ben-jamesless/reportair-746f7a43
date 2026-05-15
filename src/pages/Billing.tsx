import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowUpRight } from "lucide-react";

function UsageMeter({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min((used / max) * 100, 100);
  const over = !unlimited && used >= max;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${over ? "text-red-600" : "text-foreground"}`}>
          {used}{unlimited ? "" : ` / ${max}`}
          {unlimited && " · Unlimited"}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: over ? "#dc2626" : "#01696F" }}
          />
        </div>
      )}
    </div>
  );
}

const PLAN_PRICES: Record<string, string> = {
  solo:   "HK$128",
  pro:    "HK$298",
  studio: "HK$688",
};

const PLAN_LABELS: Record<string, string> = {
  solo:   "Solo",
  pro:    "Pro",
  studio: "Studio",
};

const Billing = () => {
  const [searchParams] = useSearchParams();
  const {
    plan, limits, projectCount, memberCount, exportsThisMonth,
    subscriptionStatus, trialEndsAt, currentPeriodEnd, loading, refetch,
  } = usePlan();

  const [upgradeOpen, setUpgradeOpen]     = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
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
  const planPrice     = PLAN_PRICES[plan];

  const statusBadge = isTrial
    ? <Badge style={{ backgroundColor: "#01696F", color: "#fff" }}>Trial</Badge>
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
      <div className="mx-auto max-w-xl py-6 px-1">
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
          {/* Plan card */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {planLabel}
                </h1>
                {statusBadge}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{renewalLine}</p>
              {isSubscribed && !isTrial && currentPeriodEnd && planPrice && (
                <p className="text-sm font-medium mt-2">
                  Next charge: <span className="text-foreground">{planPrice}</span>
                  <span className="text-muted-foreground"> on {new Date(currentPeriodEnd).toLocaleDateString("en-HK", { day: "numeric", month: "long", year: "numeric" })}</span>
                </p>
              )}
              {isTrial && trialEndsAt && planPrice && (
                <p className="text-sm font-medium mt-2">
                  After trial: <span className="text-foreground">{planPrice} / month</span>
                  <span className="text-muted-foreground"> — cancel before {new Date(trialEndsAt).toLocaleDateString("en-HK", { day: "numeric", month: "long" })}</span>
                </p>
              )}
            </div>
            {isSubscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManage}
                disabled={portalLoading}
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Manage <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></>}
              </Button>
            )}
          </div>

          {/* Usage */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">Usage</p>
            <UsageMeter label="Active events" used={projectCount} max={limits.maxProjects} />
            <UsageMeter label="Team members"  used={memberCount}  max={limits.maxMembers} />
            <UsageMeter label="PDF exports"   used={exportsThisMonth} max={limits.maxExportsMonth} />
          </div>

          {/* Features summary */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-semibold text-foreground">Plan features</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Unlimited PDF exports</li>
              {limits.shareLinks     && <li>Share &amp; client links</li>}
              {limits.passwordLinks  && <li>Password-protected links</li>}
              {limits.projectFolders && <li>Project folders</li>}
              {limits.planIncludesInvites && <li>External project invites</li>}
              {limits.customLogo     && <li>Custom logo on PDF</li>}
              {limits.whiteLabelHeader && <li>White-label report header</li>}
            </ul>
          </div>

          {/* Upgrade CTA */}
          {plan !== "studio" && (
            <div className="pt-2 border-t space-y-3">
              <p className="text-sm text-muted-foreground">
                {plan === "solo"
                  ? "Unlock share links, more events, team members, and project invites."
                  : "Get unlimited events, custom branding, and priority support."}
              </p>
              <Button
                className="w-full font-semibold"
                onClick={() => setUpgradeOpen(true)}
                style={{ backgroundColor: "#01696F", color: "#fff", border: "none" }}
              >
                Upgrade plan
              </Button>
            </div>
          )}
        </div>

        {isPastDue && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Your last payment failed. Please update your payment method to keep your subscription active.{" "}
            <button onClick={handleManage} className="font-semibold underline hover:no-underline">
              Update now →
            </button>
          </div>
        )}
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
