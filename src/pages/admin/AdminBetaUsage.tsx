import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eventDayKey, resolveEventZone } from "@/lib/eventTime";

type Activity = { project_id: string; geo_lat: number | null; geo_lng: number | null; captured_at: string | null; created_at: string };
type Usage = { id: string; name: string; beta_joined_at: string | null; founding_member: boolean; projects: number; members: number; exports: number; activity: Activity[]; days?: number };
export default function AdminBetaUsage() {
  const [rows, setRows] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase.rpc("admin_beta_usage");
      if (queryError) { if (!cancelled) { setError("Couldn’t load beta usage."); setLoading(false); } return; }
      const result = await Promise.all(((data ?? []) as unknown as Usage[]).map(async row => {
        const dates = await Promise.all(row.activity.map(async a => { const zone = await resolveEventZone(a.geo_lat, a.geo_lng); return `${a.project_id}:${eventDayKey(a.captured_at ?? a.created_at, zone.tz)}`; }));
        return { ...row, days: new Set(dates).size };
      }));
      if (!cancelled) { setRows(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Beta companies</h2>{loading ? <p>Loading…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : <div className="overflow-x-auto border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Company", "Beta joined", "Founding member", "Projects", "Members", "Recorded days", "Completed PDFs"].map(h => <th key={h} className="whitespace-nowrap p-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-border"><td className="p-3 font-medium">{r.name}</td><td className="p-3 whitespace-nowrap">{r.beta_joined_at ? new Date(r.beta_joined_at).toLocaleDateString() : "—"}</td><td className="p-3">{r.founding_member ? "Yes" : "No"}</td><td className="p-3 tabular-nums">{r.projects}</td><td className="p-3 tabular-nums">{r.members}</td><td className="p-3 tabular-nums">{r.days}</td><td className="p-3 tabular-nums">{r.exports}</td></tr>)}</tbody></table></div>}</section>;
}