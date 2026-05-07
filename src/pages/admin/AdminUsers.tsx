import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  suspended_at: string | null;
  team_count: number;
  project_count: number;
};

const AdminUsers = () => {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users" as never);
    if (error) toast.error(error.message);
    setRows((data as AdminUser[]) ?? []);
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

  const toggleSuspend = async (u: AdminUser) => {
    const { error } = await supabase.rpc("admin_set_user_suspended" as never, {
      _user_id: u.id, _suspended: !u.suspended_at,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success(u.suspended_at ? "User unsuspended" : "User suspended"); load(); }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.email ?? "").toLowerCase().includes(s) || (r.full_name ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users</TableCell></TableRow>
            ) : filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{u.team_count}</TableCell>
                <TableCell>{u.project_count}</TableCell>
                <TableCell>
                  {u.suspended_at
                    ? <Badge variant="destructive">Suspended</Badge>
                    : <Badge variant="secondary">Active</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => sendReset(u.email)}>Send reset</Button>
                  <Button size="sm" variant={u.suspended_at ? "outline" : "destructive"} onClick={() => toggleSuspend(u)}>
                    {u.suspended_at ? "Unsuspend" : "Suspend"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminUsers;
