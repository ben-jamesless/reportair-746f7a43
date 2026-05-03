import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Look up invited email so the register form can prefill it,
      // then send the user to /auth and return here after sign-in/up.
      (async () => {
        const { data: inviteEmail } = await supabase.rpc("get_invite_email", { _token: token });
        const params = new URLSearchParams({ redirect: `/invite/${token}` });
        if (inviteEmail) {
          params.set("email", inviteEmail as string);
          params.set("tab", "signup");
        }
        navigate(`/auth?${params.toString()}`, { replace: true });
      })();
      return;
    }
  }, [user, loading, token, navigate]);

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    const { data, error } = await supabase.rpc("accept_project_invite", { _token: token });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite accepted");
    navigate(`/projects/${data}`);
  };

  // Auto-accept as soon as a logged-in user lands on the invite page.
  useEffect(() => {
    if (user && token && !working) accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <Card className="max-w-md">
        <CardContent className="space-y-4 pt-6 text-center">
          <h1 className="text-xl font-semibold">You've been invited to a project</h1>
          <p className="text-sm text-muted-foreground">Accept this invite to join the project as a member.</p>
          <Button onClick={accept} disabled={working} className="w-full">
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Accept invite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;
