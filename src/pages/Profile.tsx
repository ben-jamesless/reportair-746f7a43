import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

const initialsOf = (name?: string | null, email?: string | null) => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
};

type TeamRow = { id: string; name: string; role: string };

const Profile = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) {
      setFullName(data.full_name ?? "");
      setAvatarUrl(data.avatar_url ?? null);
    }
    setLoadingProfile(false);
  }, [user?.id]);

  const loadTeams = useCallback(async () => {
    if (!user?.id) return;
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role, teams:team_id(id, name)")
      .eq("user_id", user.id);
    const rows: TeamRow[] = (memberships ?? [])
      .map((m: any) => (m.teams ? { id: m.teams.id, name: m.teams.name, role: m.role } : null))
      .filter(Boolean) as TeamRow[];
    setTeams(rows);
    setTeamNames(Object.fromEntries(rows.map((t) => [t.id, t.name])));
  }, [user?.id]);

  useEffect(() => { loadProfile(); loadTeams(); }, [loadProfile, loadTeams]);

  // Realtime: keep local profile state in sync with the row
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { full_name?: string | null; avatar_url?: string | null };
          if (typeof row.full_name !== "undefined") setFullName(row.full_name ?? "");
          if (typeof row.avatar_url !== "undefined") setAvatarUrl(row.avatar_url ?? null);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleSaveName = async () => {
    if (!user?.id) return;
    const trimmed = fullName.trim();
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmed })
      .eq("id", user.id);
    setSavingName(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Name updated");
  };

  const handleSaveTeam = async (teamId: string) => {
    const trimmed = (teamNames[teamId] ?? "").trim();
    if (!trimmed) { toast.error("Company name cannot be empty"); return; }
    setSavingTeam(teamId);
    const { error } = await supabase
      .from("teams")
      .update({ name: trimmed })
      .eq("id", teamId);
    setSavingTeam(null);
    if (error) { toast.error(error.message); return; }
    setTeams((cur) => cur.map((t) => (t.id === teamId ? { ...t, name: trimmed } : t)));
    toast.success("Company name updated");
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked again
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be 2MB or smaller"); return; }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so newly uploaded image displays immediately
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;
      setAvatarUrl(url);
      toast.success("Avatar updated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset email sent. Check your inbox.");
  };

  return (
    <AppShell crumbs={[{ label: "Profile" }]}>
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your personal information and avatar.</p>
        </div>

        {/* Avatar */}
        <section className="space-y-3">
          <Label>Avatar</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Your avatar" />}
              <AvatarFallback className="bg-secondary text-base">
                {initialsOf(fullName, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button onClick={handleAvatarPick} disabled={uploading} variant="outline" size="sm">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="mt-1 text-xs text-muted-foreground">PNG or JPG up to 2MB.</p>
            </div>
          </div>
        </section>

        {/* Full name */}
        <section className="space-y-2">
          <Label htmlFor="full-name">Full name</Label>
          <div className="flex gap-2">
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              disabled={loadingProfile}
            />
            <Button onClick={handleSaveName} disabled={savingName || loadingProfile}>
              {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </section>

        {/* Company / team name */}
        {teams.length > 0 && (
          <section className="space-y-3">
            <div>
              <Label>{teams.length === 1 ? "Company name" : "Companies"}</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Shown across the app and on shared reports. Only owners and admins can rename.
              </p>
            </div>
            {teams.map((t) => {
              const canEdit = t.role === "owner" || t.role === "admin";
              return (
                <div key={t.id} className="flex gap-2">
                  <Input
                    value={teamNames[t.id] ?? ""}
                    onChange={(e) => setTeamNames((cur) => ({ ...cur, [t.id]: e.target.value }))}
                    placeholder="Company name"
                    disabled={!canEdit || savingTeam === t.id}
                  />
                  <Button
                    onClick={() => handleSaveTeam(t.id)}
                    disabled={!canEdit || savingTeam === t.id || (teamNames[t.id] ?? "").trim() === t.name}
                  >
                    {savingTeam === t.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              );
            })}
          </section>
        )}

        {/* Email */}
        <section className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} readOnly disabled />
          <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
        </section>

        {/* Password */}
        <section className="space-y-2">
          <Label>Password</Label>
          <div>
            <Button variant="outline" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Change password
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">We'll send a reset link to your email.</p>
        </section>
      </div>
    </AppShell>
  );
};

export default Profile;
