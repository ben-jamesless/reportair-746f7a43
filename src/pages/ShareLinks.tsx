import { useEffect, useState, useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Eye, Link2, Trash2, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Row = {
  id: string;
  token: string;
  label: string | null;
  has_password: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_accessed_at: string | null;
  created_at: string;
  project_id: string;
  project_name?: string | null;
};

export default function ShareLinksPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("share_links")
      .select("id,token,label,has_password,expires_at,revoked_at,view_count,last_accessed_at,created_at,project_id")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setRows([]); setLoading(false); return; }
    const links = (data ?? []) as Row[];
    const projectIds = Array.from(new Set(links.map(l => l.project_id).filter(Boolean)));
    let nameMap = new Map<string, string>();
    if (projectIds.length) {
      const { data: projs } = await supabase.from("projects").select("id,name").in("id", projectIds);
      (projs ?? []).forEach((p: { id: string; name: string | null }) => nameMap.set(p.id, p.name ?? ""));
    }
    setRows(links.map(l => ({ ...l, project_name: nameMap.get(l.project_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.label ?? "").toLowerCase().includes(q) ||
      (r.project_name ?? "").toLowerCase().includes(q) ||
      r.token.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Link revoked");
    load();
  };

  const statusOf = (r: Row) => {
    if (r.revoked_at) return "Revoked";
    if (r.expires_at && new Date(r.expires_at) < new Date()) return "Expired";
    return "Active";
  };

  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Share Links" }]}>
      <div className="mx-auto w-full max-w-5xl space-y-6 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Share Links</h1>
            <p className="text-sm text-muted-foreground">All share links generated across your projects.</p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by label, project, or token"
            className="sm:w-72"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Link2 className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {rows.length === 0 ? "No share links have been generated yet." : "No links match your search."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const status = statusOf(r);
              const isActive = status === "Active";
              return (
                <Card key={r.id}>
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{r.label || "Untitled link"}</span>
                          <Badge variant={isActive ? "default" : "secondary"}>{status}</Badge>
                          {r.has_password && <Badge variant="outline">Password</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Project:{" "}
                          {r.projects?.id ? (
                            <RouterLink to={`/projects/${r.projects.id}`} className="font-medium text-foreground hover:underline">
                              {r.projects.name || "Untitled project"}
                            </RouterLink>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">/s/{r.token}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyUrl(r.token)}><Copy className="h-4 w-4" /></Button>
                        {!r.revoked_at && (
                          <Button variant="ghost" size="icon" onClick={() => revoke(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{r.view_count} view{r.view_count === 1 ? "" : "s"}</span>
                      <span>Created {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      {r.last_accessed_at && <span>Last viewed {formatDistanceToNow(new Date(r.last_accessed_at), { addSuffix: true })}</span>}
                      {r.expires_at && <span>Expires {format(new Date(r.expires_at), "PP p")}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
