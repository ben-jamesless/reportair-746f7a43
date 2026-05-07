import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AdminTeam = {
  id: string; name: string; plan: string; status: string;
  suspended_at: string | null; billing_owner_user_id: string | null;
  billing_owner_email: string | null; member_count: number;
  project_count: number; created_at: string;
  trial_ends_at: string | null; region: string | null; industry: string | null;
  plan_name: string | null; billing_interval: string | null;
  unit_amount: number | null; subscription_status: string | null;
  current_period_end: string | null; trial_end: string | null;
};

type BillingSummary = {
  total_mrr: number; active_accounts: number;
  churned_accounts_last_30d: number; churned_mrr_last_30d: number;
  mrr_start_30d_ago: number; currency: string;
};

const fmtHKD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(Number(n));
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

type Member = { user_id: string; email: string | null; full_name: string | null };

const PLANS = ["free", "pro", "team", "enterprise"];

const AdminAccounts = () => {
  const [rows, setRows] = useState<AdminTeam[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ownerDialog, setOwnerDialog] = useState<AdminTeam | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pickedUser, setPickedUser] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const teamsRes: any = await supabase.rpc("admin_list_teams" as never);
    const sumRes: any = await supabase.rpc("admin_billing_summary" as never);
    if (teamsRes.error) toast.error(teamsRes.error.message);
    setRows((teamsRes.data as AdminTeam[]) ?? []);
    if (!sumRes.error && sumRes.data) setSummary(sumRes.data as BillingSummary);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleSuspend = async (t: AdminTeam) => {
    const { error } = await supabase.rpc("admin_set_team_suspended" as never, {
      _team_id: t.id, _suspended: !t.suspended_at,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); load(); }
  };

  const changePlan = async (t: AdminTeam, plan: string) => {
    const { error } = await supabase.rpc("admin_set_team_plan" as never, { _team_id: t.id, _plan: plan } as never);
    if (error) toast.error(error.message);
    else { toast.success(`Plan set to ${plan}`); load(); }
  };

  const openOwnerDialog = async (t: AdminTeam) => {
    setOwnerDialog(t);
    setPickedUser(t.billing_owner_user_id ?? "");
    const { data } = await supabase
      .from("team_members")
      .select("user_id, profiles:profiles!inner(email, full_name)")
      .eq("team_id", t.id);
    const list = (data ?? []).map((m: any) => ({
      user_id: m.user_id, email: m.profiles?.email, full_name: m.profiles?.full_name,
    }));
    setMembers(list);
  };

  const saveOwner = async () => {
    if (!ownerDialog || !pickedUser) return;
    const { error } = await supabase.rpc("admin_set_team_billing_owner" as never, {
      _team_id: ownerDialog.id, _user_id: pickedUser,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Billing owner updated"); setOwnerDialog(null); load(); }
  };

  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) ||
    (r.billing_owner_email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const churnPct = summary && summary.mrr_start_30d_ago > 0
    ? (summary.churned_mrr_last_30d / summary.mrr_start_30d_ago) * 100
    : 0;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Total MRR</div>
            <div className="text-lg font-semibold">{fmtHKD(summary.total_mrr)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Active accounts</div>
            <div className="text-lg font-semibold">{summary.active_accounts}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">30‑day churn</div>
            <div className="text-lg font-semibold">{churnPct.toFixed(1)}% ({fmtHKD(summary.churned_mrr_last_30d)})</div>
          </div>
        </div>
      )}
      <Input placeholder="Search team or billing owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Billing owner</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>MRR (HKD)</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Renews</TableHead>
              <TableHead>Trial ends</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No teams</TableCell></TableRow>
            ) : filtered.map((t) => {
              const subscribed = !!t.subscription_status;
              return (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.billing_owner_email ?? "—"}</TableCell>
                <TableCell>
                  <Select value={t.plan} onValueChange={(v) => changePlan(t, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue>{PLAN_LABELS[t.plan] ?? t.plan}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p] ?? p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{subscribed ? fmtHKD(t.unit_amount) : <span className="text-muted-foreground">Not subscribed</span>}</TableCell>
                <TableCell>{subscribed ? (t.billing_interval ?? "monthly") : "—"}</TableCell>
                <TableCell>{subscribed ? <Badge variant="outline">{t.subscription_status}</Badge> : "—"}</TableCell>
                <TableCell>{fmtDate(t.current_period_end)}</TableCell>
                <TableCell>{fmtDate(t.trial_end ?? t.trial_ends_at)}</TableCell>
                <TableCell>{t.region ?? "—"}</TableCell>
                <TableCell>{t.industry ?? "—"}</TableCell>
                <TableCell>
                  {t.suspended_at
                    ? <Badge variant="destructive">Suspended</Badge>
                    : <Badge variant="secondary">{t.status}</Badge>}
                </TableCell>
                <TableCell>{t.member_count}</TableCell>
                <TableCell>{t.project_count}</TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => openOwnerDialog(t)}>Change owner</Button>
                  <Button size="sm" variant="outline" onClick={() => { console.log("Open in Stripe", t.id); toast.info("Stripe integration not yet wired"); }}>Open in Stripe</Button>
                  <Button size="sm" variant={t.suspended_at ? "outline" : "destructive"} onClick={() => toggleSuspend(t)}>
                    {t.suspended_at ? "Unsuspend" : "Suspend"}
                  </Button>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!ownerDialog} onOpenChange={(o) => !o && setOwnerDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change billing owner — {ownerDialog?.name}</DialogTitle>
          </DialogHeader>
          <Select value={pickedUser} onValueChange={setPickedUser}>
            <SelectTrigger><SelectValue placeholder="Select team member…" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.email ?? m.full_name ?? m.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnerDialog(null)}>Cancel</Button>
            <Button onClick={saveOwner} disabled={!pickedUser}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccounts;
