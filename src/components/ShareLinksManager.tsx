import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Eye, Link2, Trash2, Plus } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  password_hash: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_accessed_at: string | null;
  created_at: string;
};

export const ShareLinksManager = ({ projectId }: { projectId: string }) => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("share_links")
      .select("id,token,label,password_hash,expires_at,revoked_at,view_count,last_accessed_at,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setLinks((data ?? []) as ShareLink[]);
  };

  useEffect(() => { load(); }, [projectId]);

  const createLink = async () => {
    setCreating(true);
    let password_hash: string | null = null;
    if (password.trim()) {
      const { data, error } = await supabase.rpc("hash_share_password", { _password: password.trim() });
      if (error) { toast.error(error.message); setCreating(false); return; }
      password_hash = data as string;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("share_links").insert({
      project_id: projectId,
      label: label.trim() || null,
      password_hash,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      created_by: auth.user?.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setLabel(""); setPassword(""); setExpiresAt(""); setShowForm(false);
    toast.success("Share link created");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Public links to share this project read-only.</p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New link</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client preview" />
            </div>
            <div>
              <Label htmlFor="pwd">Password (optional)</Label>
              <Input id="pwd" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" />
            </div>
            <div>
              <Label htmlFor="exp">Expires (optional)</Label>
              <Input id="exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={createLink} disabled={creating}>Create link</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {links.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No share links yet</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {links.map((link) => {
          const expired = link.expires_at && new Date(link.expires_at) < new Date();
          const status = link.revoked_at ? "Revoked" : expired ? "Expired" : "Active";
          return (
            <Card key={link.id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{link.label || "Untitled link"}</span>
                      <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
                      {link.password_hash && <Badge variant="outline">Password</Badge>}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">/s/{link.token}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyUrl(link.token)}><Copy className="h-4 w-4" /></Button>
                    {!link.revoked_at && (
                      <Button variant="ghost" size="icon" onClick={() => revoke(link.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{link.view_count} view{link.view_count === 1 ? "" : "s"}</span>
                  {link.last_accessed_at && <span>Last viewed {formatDistanceToNow(new Date(link.last_accessed_at), { addSuffix: true })}</span>}
                  {link.expires_at && <span>Expires {format(new Date(link.expires_at), "PP p")}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
