import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function CompanyInviteAccept() {
  const { token } = useParams();
  const { user, loading, refreshProfile } = useAuth();
  const [error, setError] = useState("");
  const started = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !token || started.current) return;
    started.current = true;
    void (async () => {
      if (!user) {
        const { data, error: lookupError } = await supabase.rpc("get_company_invite_context", { _token: token });
        const ctx = data as { email?: string; company_name?: string; account_exists?: boolean } | null;
        if (lookupError || !ctx?.email) { setError("This invitation is invalid, cancelled or expired."); return; }
        const params = new URLSearchParams({ redirect: `/company-invite/${token}`, invite: "1", email: ctx.email, invite_project: ctx.company_name ?? "your company", tab: ctx.account_exists ? "signin" : "signup" });
        navigate(`/auth?${params}`, { replace: true }); return;
      }
      const { data, error: acceptError } = await supabase.rpc("accept_company_invite", { _token: token });
      if (acceptError) { setError(acceptError.message); return; }
      await refreshProfile(); navigate(data ? `/projects/${data}` : "/projects", { replace: true });
    })();
  }, [loading, token, user, navigate, refreshProfile]);
  return <main className="flex min-h-screen items-center justify-center p-6">{error ? <div className="max-w-md space-y-4"><h1 className="text-xl font-semibold">Invitation unavailable</h1><p role="alert" className="text-sm text-destructive">{error}</p><Button asChild variant="outline"><Link to="/auth">Sign in with the invited email</Link></Button></div> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}</main>;
}