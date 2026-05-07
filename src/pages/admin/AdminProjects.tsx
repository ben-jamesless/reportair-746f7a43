import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AdminProject = {
  id: string; name: string; team_id: string | null; team_name: string | null;
  owner_id: string | null; owner_email: string | null;
  created_at: string; archived_at: string | null; overall_status: string;
};

const AdminProjects = () => {
  const [rows, setRows] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_projects" as never);
    if (error) toast.error(error.message);
    setRows((data as AdminProject[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const teams = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.team_id) m.set(r.team_id, r.team_name ?? r.team_id); });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const toggleArchive = async (p: AdminProject) => {
    const { error } = await supabase.rpc("admin_set_project_archived" as never, {
      _project_id: p.id, _archived: !p.archived_at,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); load(); }
  };

  const filtered = rows.filter((r) => {
    if (team !== "all" && r.team_id !== team) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search project name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All teams" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No projects</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.team_name ?? "—"}</TableCell>
                <TableCell>{p.owner_email ?? "—"}</TableCell>
                <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {p.archived_at
                    ? <Badge variant="secondary">Archived</Badge>
                    : <Badge>Active</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/projects/${p.id}`}>View</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleArchive(p)}>
                    {p.archived_at ? "Unarchive" : "Archive"}
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

export default AdminProjects;
