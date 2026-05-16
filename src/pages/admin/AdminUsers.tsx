import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import AccountPreviewDialog from "@/components/admin/AccountPreviewDialog";

type UnifiedRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  user_created_at: string;
  last_active_at: string | null;
  auth_method: string | null;
  user_suspended_at: string | null;
  team_id: string | null;
  team_name: string | null;
  team_role: string | null;
  plan: string | null;
  subscription_status: string | null;
  mrr_hkd: number | null;
  trial_ends_at: string | null;
  team_suspended_at: string | null;
  owned_project_count: number | null;
  team_project_count: number | null;
};

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo", pro: "Pro", studio: "Studio",
};

const fmtHKD = (n: number | null | undefined) =>
  n == null || Number(n) === 0
    ? "—"
    : new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const AdminUsers = () => {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<UnifiedRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users_with_accounts" as never);
    if (error) toast.error(error.message);
    setRows((data as UnifiedRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendReset = async (email: string | null) => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Password reset sent to ${email}`);
  };

  const toggleSuspend = async (r: UnifiedRow) => {
    const { error } = await supabase.rpc("admin_set_user_suspended" as never, {
      _user_id: r.user_id, _suspended: !r.user_suspended_at,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success(r.user_suspended_at ? "User unsuspended" : "User suspended"); load(); }
  };

  const viewAs = (r: UnifiedRow) => {
    if (r.team_id) window.open(`/?team=${r.team_id}`, "_blank");
    else toast.info("User has no team");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleteTarget.user_id },
    });
    setDeleting(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(error?.message || (data as { error?: string })?.error || "Failed to delete user");
      return;
    }
    toast.success(`Deleted ${deleteTarget.email ?? "user"}`);
    setDeleteTarget(null);
    load();
  };

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (r.email ?? "").toLowerCase().includes(s) ||
      (r.full_name ?? "").toLowerCase().includes(s) ||
      (r.team_name ?? "").toLowerCase().includes(s) ||
      (r.team_role ?? "").toLowerCase().includes(s) ||
      (r.plan ?? "").toLowerCase().includes(s) ||
      (r.auth_method ?? "").toLowerCase().includes(s) ||
      (r.subscription_status ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by email, name, team, plan…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No users
                </TableCell>
              </TableRow>
            ) : filtered.map((r) => {
              const hasTeam = !!r.team_id;
              return (
                <TableRow key={`${r.user_id}-${r.team_id ?? "none"}`}>
                  <TableCell className="font-medium">{r.email ?? "—"}</TableCell>
                  <TableCell>{r.full_name ?? "—"}</TableCell>
                  <TableCell>{fmtDate(r.user_created_at)}</TableCell>
                  <TableCell>{fmtDate(r.last_active_at)}</TableCell>
                  <TableCell className="text-xs">{r.auth_method ?? "password"}</TableCell>
                  <TableCell>
                    {hasTeam ? (
                      <div className="flex flex-col">
                        <span>{r.team_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{r.team_role}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasTeam ? (PLAN_LABELS[r.plan ?? ""] ?? r.plan ?? "—") : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {hasTeam ? fmtHKD(r.mrr_hkd) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.user_suspended_at ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : !hasTeam ? (
                      <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">No account</Badge>
                    ) : r.team_suspended_at ? (
                      <Badge variant="destructive">Team suspended</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => sendReset(r.email)}>Send reset</Button>
                    <Button size="sm" variant="outline" onClick={() => viewAs(r)}>View as</Button>
                    {!hasTeam ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(r)}
                      >
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={r.user_suspended_at ? "outline" : "destructive"}
                        onClick={() => toggleSuspend(r)}
                      >
                        {r.user_suspended_at ? "Unsuspend" : "Suspend"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.email ?? "user"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove their account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
