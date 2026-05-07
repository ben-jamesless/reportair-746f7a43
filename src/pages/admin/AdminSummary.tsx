import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, FolderKanban, Building2, Image as ImageIcon, DollarSign, TrendingDown, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Summary = {
  total_users: number;
  active_users: number;
  suspended_users: number;
  new_users_30d: number;
  total_projects: number;
  active_projects: number;
  archived_projects: number;
  new_projects_30d: number;
  total_teams: number;
  total_photos: number;
  roles: Record<string, number>;
  project_members_by_role: Record<string, number>;
};

type BillingSummary = {
  total_mrr: number; active_accounts: number;
  churned_accounts_last_30d: number; churned_mrr_last_30d: number;
  mrr_start_30d_ago: number; currency: string;
};

const fmtHKD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(Number(n));

const Stat = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const AdminSummary = () => {
  const [data, setData] = useState<Summary | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [sumRes, billRes]: any = await Promise.all([
        supabase.rpc("admin_summary" as never),
        supabase.rpc("admin_billing_summary" as never),
      ]);
      if (sumRes.error) toast.error(sumRes.error.message);
      setData((sumRes.data as Summary) ?? null);
      if (!billRes.error && billRes.data) setBilling(billRes.data as BillingSummary);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">No summary available.</p>;
  }

  const roleEntries = Object.entries(data.roles ?? {});
  const memberRoleEntries = Object.entries(data.project_members_by_role ?? {});

  const churnPct = billing && billing.mrr_start_30d_ago > 0
    ? (billing.churned_mrr_last_30d / billing.mrr_start_30d_ago) * 100
    : 0;

  return (
    <div className="space-y-6">
      {billing && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={DollarSign} label="Total MRR" value={fmtHKD(billing.total_mrr)} />
          <Stat icon={Activity} label="Active accounts" value={billing.active_accounts} />
          <Stat icon={TrendingDown} label="30‑day churn" value={`${churnPct.toFixed(1)}%`} sub={fmtHKD(billing.churned_mrr_last_30d)} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Total users" value={data.total_users} sub={`${data.new_users_30d} new in last 30 days`} />
        <Stat icon={FolderKanban} label="Total projects" value={data.total_projects} sub={`${data.new_projects_30d} new in last 30 days`} />
        <Stat icon={Building2} label="Teams" value={data.total_teams} />
        <Stat icon={ImageIcon} label="Photos" value={data.total_photos} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <Badge variant="secondary">{data.active_users}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Suspended</span>
              <Badge variant="destructive">{data.suspended_users}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <Badge variant="secondary">{data.active_projects}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Archived</span>
              <Badge variant="outline">{data.archived_projects}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roleEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned roles.</p>
            ) : (
              roleEntries.map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{role.replace(/_/g, " ")}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project members by role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberRoleEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project members.</p>
            ) : (
              memberRoleEntries.map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{role}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSummary;
