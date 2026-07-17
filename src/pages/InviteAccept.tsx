import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !token) return;
    if (!user) {
      // Look up invite context so /auth can render the right (sign-in vs sign-up)
      // variant with project-specific copy and prefilled email.
      (async () => {
        const { data } = await supabase.rpc("get_invite_context", { _token: token });
        const ctx = Array.isArray(data) ? data[0] : data;
        const params = new URLSearchParams({ redirect: `/invite/${token}` });
        if (ctx?.email) params.set("email", ctx.email as string);
        if (ctx?.project_name) params.set("invite_project", ctx.project_name as string);
        // Default new invitees to signup; returning users to signin.
        params.set("tab", ctx?.account_exists ? "signin" : "signup");
        params.set("invite", "1");
        navigate(`/auth?${params.toString()}`, { replace: true });
      })();
    }
  }, [user, loading, token, navigate]);

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    const { data, error } = await supabase.rpc("accept_project_invite", { _token: token });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome to the project!");
    navigate(`/projects/${data}`, { replace: true });
  };

  // Auto-accept as soon as a logged-in user lands on the invite page.
  useEffect(() => {
    if (user && token && !working) accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
};

export default InviteAccept;
