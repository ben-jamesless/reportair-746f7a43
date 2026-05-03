import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";
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
    // If already onboarded (has a team), skip to projects
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
      .insert({ name: teamName, slug, created_by: user.id });
    if (teamErr) {
      setBusy(false);
      return toast.error(teamErr.message);
    }

    setBusy(false);
    toast.success(`Welcome, ${fullName.split(" ")[0]}!`);
    navigate("/projects", { replace: true });
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <ReportAirLockup variant="light" markClassName="h-9 w-9" textClassName="text-xl" />
        </div>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Let's set things up</CardTitle>
            <CardDescription>Two quick details and you're in.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team name</Label>
                <Input id="team" required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Northwind Events" />
                <p className="text-xs text-muted-foreground">You can invite teammates later.</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
