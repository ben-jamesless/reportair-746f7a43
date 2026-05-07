import { useEffect, useMemo, useState } from "react";
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
  project_type: string | null; phase: string | null;
  location: string | null; last_activity_at: string | null;
};

const AdminProjects = () => {
  const [rows, setRows] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("all");
  const [phase, setPhase] = useState<string>("all");
  const [ptype, setPtype] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_projects" as never, {
      _team_id: team === "all" ? null : team,
      _phase: phase === "all" ? null : phase,
      _project_type: ptype === "all" ? null : ptype,
    } as never);
    if (error) toast.error(error.message);
    setRows((data as AdminProject[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [team, phase, ptype]);

  const teams = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.team_id) m.set(r.team_id, r.team_name ?? r.team_id); });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const phases = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.phase) s.add(r.phase); });
    return Array.from(s);
  }, [rows]);

  const ptypes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.project_type) s.add(r.project_type); });
    return Array.from(s);
  }, [rows]);

  const toggleArchive = async (p: AdminProject) => {
    const { error } = await supabase.rpc("admin_set_project_archived" as never, {
      _project_id: p.id, _archived: !p.archived_at,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); load(); }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    return r.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search project name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All teams" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={phase} onValueChange={setPhase}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All phases" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All phases</SelectItem>
            {phases.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ptype} onValueChange={setPtype}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ptypes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No projects</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.team_name ?? "—"}</TableCell>
                <TableCell>{p.owner_email ?? "—"}</TableCell>
                <TableCell>{p.project_type ?? "—"}</TableCell>
                <TableCell>{p.phase ?? "—"}</TableCell>
                <TableCell>{p.location ?? "—"}</TableCell>
                <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{p.last_activity_at ? new Date(p.last_activity_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  {p.archived_at
                    ? <Badge variant="secondary">Archived</Badge>
                    : <Badge>Active</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => window.open(`/projects/${p.id}`, "_blank")}>Open project</Button>
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
