import { Link } from "react-router-dom";
import { useMyBillingTeam } from "@/hooks/useBillingOwner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

/**
 * Placeholder billing page.
 *
 * Stripe is intentionally NOT wired here yet — this page only enforces the
 * separation between project roles and billing ownership. Only the user
 * whose id is recorded as `teams.billing_owner_user_id` can view it.
 */
const Billing = () => {
  const { teamId, loading } = useMyBillingTeam();

  const crumbs = [
    { label: "Projects", to: "/projects" },
    { label: "Billing" },
  ];

  if (loading) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!teamId) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Billing is restricted</h1>
          <p className="text-sm text-muted-foreground">
            Only the billing owner of your team can manage the subscription and payment method.
            If this should be you, ask your current billing owner to transfer ownership.
          </p>
          <Button asChild variant="outline">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell crumbs={crumbs}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team subscription, payment method, and invoices.
          </p>
        </header>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Subscription management will appear here. Billing is tied to your account, not to
          individual project roles — adding more project owners does not grant access to this page.
        </div>
      </div>
    </AppShell>
  );
};

export default Billing;
