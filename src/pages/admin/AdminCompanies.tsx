import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type Company = { id: string; name: string; beta_joined_at: string | null; projects: number; members: number; exports: number };
type Totals = { total_users: number; total_projects: number; total_teams: number; total_photos: number };
type Project = { id: string; name: string; archived_at: string | null; overall_status: string | null; created_at: string };
type Member = { user_id: string; email: string | null; full_name: string | null; role: string };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function CompanyDetail({ teamId }: { teamId: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const load = async () => {
    const [p, m] = await Promise.all([
      supabase.rpc("admin_list_projects" as never, { _team_id: teamId } as never),
      supabase.rpc("admin_list_team_members" as never, { _team_id: teamId } as never),
    ]);
    if (p.error || m.error) toast.error((p.error ?? m.error)!.message);
    const mem = (m.data as Member[]) ?? [];
    setProjects((p.data as Project[]) ?? []);
    setMembers(mem);
  };
  useEffect(() => { void load(); }, [teamId]);

  const toggleArchive = async (p: Project) => {
    const { error } = await supabase.rpc("admin_set_project_archived" as never, { _project_id: p.id, _archived: !p.archived_at } as never);
    if (error) toast.error(error.message);
    else { toast.success(p.archived_at ? "Event restored" : "Event archived"); void load(); }
  };

  if (!projects) return <div className="py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  return (
    <div className="grid gap-6 py-4 md:grid-cols-2">
      <section>
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Events ({projects.length})</h3>
        <div className="divide-y border border-border">
          {projects.length === 0 && <p className="p-3 text-sm text-muted-foreground">No events yet.</p>}
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {p.archived_at ? "Archived" : (p.overall_status ?? "").replace(/_/g, " ")}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => window.open(`/projects/${p.id}`, "_blank")}>Open</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)}>{p.archived_at ? "Unarchive" : "Archive"}</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">People ({members.length})</h3>
        <div className="divide-y border border-border">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.full_name ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email ?? "—"}</div>
              </div>
              <Badge variant={m.role === "owner" ? "default" : "outline"} className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AdminCompanies() {
  const [rows, setRows] = useState<Company[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<string, string | null>>({});

  useEffect(() => {
    void (async () => {
      const [c, s, u] = await Promise.all([
        supabase.rpc("admin_beta_usage"),
        supabase.rpc("admin_summary" as never),
        supabase.rpc("admin_list_users_with_accounts" as never),
      ]);
      const own: Record<string, string | null> = {};
      ((u.data ?? []) as { team_id: string | null; team_role: string | null; email: string | null }[])
        .forEach((x) => { if (x.team_id && x.team_role === "owner") own[x.team_id] = x.email; });
      setOwners(own);
      if (c.error) toast.error(c.error.message);
      setRows(((c.data ?? []) as unknown as Company[]));
      setTotals((s.data as Totals) ?? null);
    })();
  }, []);

  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const stats = totals
    ? [["Companies", totals.total_teams], ["People", totals.total_users], ["Events", totals.total_projects], ["Photos", totals.total_photos]]
    : [];

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {stats.map(([l, v]) => (
            <div key={l as string}><span className="text-muted-foreground">{l}</span> <span className="font-semibold tabular-nums">{v}</span></div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>{["", "Company", "Owner", "Joined", "Events", "People", "PDFs"].map((h) => <th key={h} className="whitespace-nowrap p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="w-8 p-3">{open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{owners[r.id] ?? "—"}</td>
                  <td className="whitespace-nowrap p-3">{fmtDate(r.beta_joined_at)}</td>
                  <td className="p-3 tabular-nums">{r.projects}</td>
                  <td className="p-3 tabular-nums">{r.members}</td>
                  <td className="p-3 tabular-nums">{r.exports}</td>
                </tr>
                {open === r.id && (
                  <tr className="border-t border-border"><td colSpan={7} className="px-3">
                    <CompanyDetail teamId={r.id} />
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
