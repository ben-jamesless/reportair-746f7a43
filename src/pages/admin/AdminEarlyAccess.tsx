import { useEffect, useState } from "react";
import { Check, Copy, Mail, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminEarlyAccess() {
  const [rows, setRows] = useState<Tables<"early_access_requests">[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("early_access_requests").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) setError("Couldn’t load early-access requests.");
      else setRows(data ?? []);
      setLoading(false);
    });
  }, []);
  const review = async (id: string, status: "approved" | "declined") => {
    setBusyId(id);
    const reviewed_at = new Date().toISOString();
    const { data, error } = await supabase.from("early_access_requests").update({ status, reviewed_at }).eq("id", id).select().single();
    setBusyId(null);
    if (error) return toast.error("Couldn’t update the request.");
    setRows(current => current.map(row => row.id === id ? data : row));
    toast.success(status === "approved" ? "Access approved. You can now email their invitation." : "Request declined.");
  };
  const invitation = (email: string) => `${window.location.origin}/auth?tab=signup&beta=1&email=${encodeURIComponent(email)}`;
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Early-access requests</h2>
      {loading ? <Loader2 className="animate-spin" /> : error ? <p role="alert" className="text-destructive">{error}</p> : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted"><tr>{["Name", "Email", "Company", "Requested", "Status", "Actions"].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className="border-t border-border">
              <td className="p-3">{row.full_name}</td><td className="p-3">{row.email}</td><td className="p-3">{row.company || "—"}</td>
              <td className="p-3 whitespace-nowrap">{new Date(row.created_at).toLocaleDateString()}</td><td className="p-3 capitalize">{row.status}</td>
              <td className="p-3"><div className="flex gap-2">
                {row.status !== "approved" && <Button size="sm" disabled={busyId === row.id} onClick={() => review(row.id, "approved")}><Check />Approve</Button>}
                {row.status !== "declined" && <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => review(row.id, "declined")}><X />Decline</Button>}
                {row.status === "approved" && <>
                  <Button asChild size="sm" variant="outline"><a href={`mailto:${row.email}?subject=${encodeURIComponent("Your BuildFolder beta invitation")}&body=${encodeURIComponent(`Hi ${row.full_name},\n\nYou’re invited to try BuildFolder during beta. Create your account using this email address:\n\n${invitation(row.email)}\n\nThanks,\nBuildFolder`)}`}><Mail />Email invitation</a></Button>
                  <Button size="icon" variant="ghost" title="Copy invitation link" aria-label="Copy invitation link" onClick={async () => { try { await navigator.clipboard.writeText(invitation(row.email)); toast.success("Invitation link copied."); } catch { toast.error("Couldn’t copy the invitation link."); } }}><Copy /></Button>
                </>}
              </div></td>
            </tr>)}{rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No early-access requests yet.</td></tr>}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}