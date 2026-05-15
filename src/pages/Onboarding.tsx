import { OnboardingLayout } from "@/components/OnboardingLayout";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.onboarded_at) {
        navigate("/projects", { replace: true });
        return;
      }
      // Invited user shortcut: if they already belong to a project (via invite
      // auto-accept trigger), skip team creation and drop them in the project.
      const { data: pm } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id)
        .limit(1);
      if (pm && pm.length > 0) {
        await supabase
          .from("profiles")
          .update({ onboarded_at: new Date().toISOString(), full_name: profile?.full_name ?? user.email })
          .eq("id", user.id);
        const slug =
          ((profile?.full_name ?? user.email ?? "user")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 20)) +
          "-" +
          Math.random().toString(36).slice(2, 6);
        await supabase.from("teams").insert({
          name: profile?.full_name ?? user.email ?? "My Team",
          slug,
          created_by: user.id,
          billing_owner_user_id: user.id,
        });
        navigate("/projects", { replace: true });
        return;
      }
      if (profile?.full_name) setFullName(profile.full_name);
      setChecking(false);
    })();
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);

    // Update profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ full_name: fullName, onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    if (profileErr) {
      setBusy(false);
      return toast.error(profileErr.message);
    }

    // Create team — trigger auto-adds creator as owner
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { error: teamErr } = await supabase
      .from("teams")
      .insert({ name: teamName, slug, created_by: user.id, billing_owner_user_id: user.id });
    if (teamErr) {
      setBusy(false);
      return toast.error(teamErr.message);
    }

    // Welcome email — fire and forget, does not block onboarding completion
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) return;
      supabase.functions.invoke("send-transactional-email", {
        body: {
          to: session.user.email,
          template: "welcome",
          data: { name: fullName ?? session.user.user_metadata?.full_name ?? "" },
        },
      }).catch(() => {});
    });

    setBusy(false);
    toast.success(`Welcome, ${fullName.split(" ")[0]}!`);
    navigate("/onboarding/plan", { replace: true });
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingLayout step={2}>
      <div>
        <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Set up your workspace</h2>
        <p className="text-sm text-[#7A7974] mb-6">A couple of quick details and you're in.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team">Team / company name</Label>
            <Input id="team" required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Northwind Events" />
            <p className="text-xs text-[#7A7974]">You can invite teammates later.</p>
          </div>
          <Button
            type="submit"
            className="w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
            disabled={busy}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </div>
    </OnboardingLayout>
  );
};

export default Onboarding;
