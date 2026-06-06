import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Signup = {
  id: string;
  email: string;
  source: string | null;
  pdf_slug: string;
  created_at: string;
  resend_status: number | null;
  resend_message_id: string | null;
};

const statusLabel = (s: number | null) => {
  if (s === null || s === undefined) return { label: "Unknown", tone: "text-muted-foreground" };
  if (s >= 200 && s < 300) return { label: "Sent", tone: "text-emerald-600" };
  return { label: `Failed (${s})`, tone: "text-destructive" };
};

const toCsv = (rows: Signup[]) => {
  const header = ["email", "created_at", "source", "pdf_slug", "resend_status", "resend_message_id"];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(","), ...rows.map((r) => header.map((k) => esc((r as any)[k])).join(","))].join("\n");
};

const AdminLeadMagnet = () => {
  const [rows, setRows] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lead_magnet_signups")
        .select("id,email,source,pdf_slug,created_at,resend_status,resend_message_id")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) setError(error.message);
      else setRows((data ?? []) as Signup[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (q.trim() ? rows.filter((r) => r.email.toLowerCase().includes(q.trim().toLowerCase())) : rows),
    [rows, q]
  );

  const downloadCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead-magnet-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lead magnet signups</h2>
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-medium text-foreground">{rows.length}</span>
            {q && <> · Showing <span className="font-medium text-foreground">{filtered.length}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={downloadCsv} disabled={!filtered.length}>
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Signed up</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">PDF</th>
                <th className="px-3 py-2">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = statusLabel(r.resend_status);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.source ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.pdf_slug}</td>
                    <td className={`px-3 py-2 ${s.tone}`}>{s.label}</td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No signups found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLeadMagnet;
