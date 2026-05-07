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
};

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
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ownerDialog, setOwnerDialog] = useState<AdminTeam | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pickedUser, setPickedUser] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_teams" as never);
    if (error) toast.error(error.message);
    setRows((data as AdminTeam[]) ?? []);
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

  return (
    <div className="space-y-4">
      <Input placeholder="Search team or billing owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Billing owner</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No teams</TableCell></TableRow>
            ) : filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.billing_owner_email ?? "—"}</TableCell>
                <TableCell>
                  <Select value={t.plan} onValueChange={(v) => changePlan(t, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {t.suspended_at
                    ? <Badge variant="destructive">Suspended</Badge>
                    : <Badge variant="secondary">{t.status}</Badge>}
                </TableCell>
                <TableCell>{t.member_count}</TableCell>
                <TableCell>{t.project_count}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openOwnerDialog(t)}>Change owner</Button>
                  <Button size="sm" variant={t.suspended_at ? "outline" : "destructive"} onClick={() => toggleSuspend(t)}>
                    {t.suspended_at ? "Unsuspend" : "Suspend"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
