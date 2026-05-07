import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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

const fmtHKD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(Number(n));
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const PLAN_LABELS: Record<string, string> = {
  free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise",
};

type Member = { user_id: string; email: string | null; full_name: string | null };

const PLANS = ["free", "pro", "team", "enterprise"];

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-right">{value ?? "—"}</span>
  </div>
);

const AdminAccounts = () => {
  const [rows, setRows] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ownerDialog, setOwnerDialog] = useState<AdminTeam | null>(null);
  const [detailsTeam, setDetailsTeam] = useState<AdminTeam | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc" | null>("desc");
  const [members, setMembers] = useState<Member[]>([]);
  const [pickedUser, setPickedUser] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const teamsRes: any = await supabase.rpc("admin_list_teams" as never);
    if (teamsRes.error) toast.error(teamsRes.error.message);
    setRows((teamsRes.data as AdminTeam[]) ?? []);
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

  const openStripe = (t: AdminTeam) => {
    console.log("Open in Stripe", t.id);
    toast.info("Stripe integration not yet wired");
  };

  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) ||
    (r.billing_owner_email ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const sorted = sortDir == null ? filtered : [...filtered].sort((a, b) => {
    const av = Number(a.unit_amount ?? 0);
    const bv = Number(b.unit_amount ?? 0);
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const cycleSort = () => setSortDir((d) => (d === "desc" ? "asc" : d === "asc" ? null : "desc"));
  const SortIcon = sortDir === "desc" ? ArrowDown : sortDir === "asc" ? ArrowUp : ArrowUpDown;

  return (
    <div className="space-y-4">
      <Input placeholder="Search team or billing owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Billing owner</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>MRR (HKD)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No teams</TableCell></TableRow>
            ) : filtered.map((t) => {
              const subscribed = !!t.subscription_status;
              return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetailsTeam(t)}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.billing_owner_email ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={t.plan} onValueChange={(v) => changePlan(t, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue>{PLAN_LABELS[t.plan] ?? t.plan}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p] ?? p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{subscribed ? fmtHKD(t.unit_amount) : <span className="text-muted-foreground">Not subscribed</span>}</TableCell>
                <TableCell>
                  {t.suspended_at
                    ? <Badge variant="destructive">Suspended</Badge>
                    : <Badge variant="secondary">{t.status}</Badge>}
                </TableCell>
                <TableCell>{t.member_count}</TableCell>
                <TableCell>{t.project_count}</TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => setDetailsTeam(t)}>Details</Button>
                  <Button size="sm" variant="outline" onClick={() => openOwnerDialog(t)}>Change owner</Button>
                  <Button size="sm" variant="outline" onClick={() => openStripe(t)}>Open in Stripe</Button>
                  <Button size="sm" variant={t.suspended_at ? "outline" : "destructive"} onClick={() => toggleSuspend(t)}>
                    {t.suspended_at ? "Unsuspend" : "Suspend"}
                  </Button>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detailsTeam} onOpenChange={(o) => !o && setDetailsTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsTeam?.name}</DialogTitle>
          </DialogHeader>
          {detailsTeam && (() => {
            const subscribed = !!detailsTeam.subscription_status;
            const mrrLabel = subscribed
              ? `${fmtHKD(detailsTeam.unit_amount)}${detailsTeam.current_period_end ? ` / renews ${fmtDate(detailsTeam.current_period_end)}` : ""}`
              : "Not subscribed";
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Plan</div>
                    <div className="text-base font-semibold">{PLAN_LABELS[detailsTeam.plan] ?? detailsTeam.plan}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">MRR</div>
                    <div className="text-base font-semibold">{mrrLabel}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Total users</div>
                    <div className="text-base font-semibold">{detailsTeam.member_count}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Total projects</div>
                    <div className="text-base font-semibold">{detailsTeam.project_count}</div>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <DetailRow label="Billing owner" value={detailsTeam.billing_owner_email} />
                  <DetailRow label="Subscription status" value={detailsTeam.subscription_status} />
                  <DetailRow label="Billing interval" value={detailsTeam.billing_interval} />
                  <DetailRow label="Trial ends" value={fmtDate(detailsTeam.trial_end ?? detailsTeam.trial_ends_at)} />
                  <DetailRow label="Region" value={detailsTeam.region} />
                  <DetailRow label="Industry" value={detailsTeam.industry} />
                  <DetailRow label="Status" value={detailsTeam.suspended_at ? "Suspended" : detailsTeam.status} />
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 flex-wrap">
            {detailsTeam && (
              <>
                <Button variant="outline" size="sm" onClick={() => { const t = detailsTeam; setDetailsTeam(null); openOwnerDialog(t); }}>Change owner</Button>
                <Button variant="outline" size="sm" onClick={() => detailsTeam && openStripe(detailsTeam)}>Open in Stripe</Button>
                <Button variant={detailsTeam.suspended_at ? "outline" : "destructive"} size="sm" onClick={() => { toggleSuspend(detailsTeam); setDetailsTeam(null); }}>
                  {detailsTeam.suspended_at ? "Unsuspend" : "Suspend"}
                </Button>
              </>
            )}
            <Button onClick={() => setDetailsTeam(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
