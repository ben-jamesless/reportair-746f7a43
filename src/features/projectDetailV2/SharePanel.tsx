import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Copy, QrCode, Loader2, FileText, FileArchive, Lock, Unlock, Trash2, Plus, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { dayKey as photoDayKey } from "@/lib/projectDetailTypes";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { FinaliseEventBlock } from "./FinaliseEventBlock";

/**
 * Phase 3.5 — Share/Deliver side panel.
 * Backed by the existing `share_links` table (no new schema).
 * Design pass: dashed dividers between blocks, each with a 9px dot label.
 */

const DASH = "1px dashed #E3DFD4";
const LABEL_INK = "#5C5850";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  has_password: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_accessed_at: string | null;
  created_at: string;
  show_photo_pins: boolean;
};

function BlockLabel({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full"
        style={{ width: 9, height: 9, backgroundColor: dot }}
      />
      <span
        className="font-semibold uppercase"
        style={{ fontSize: 11, letterSpacing: "0.08em", color: LABEL_INK }}
      >
        {children}
      </span>
    </div>
  );
}

export function SharePanel({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { photos, project } = useProjectDetail(projectId);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPins, setSavingPins] = useState(false);

  const togglePhotoPins = async (next: boolean) => {
    if (!link) return;
    setSavingPins(true);
    const { error } = await supabase
      .from("share_links")
      .update({ show_photo_pins: next })
      .eq("id", link.id);
    setSavingPins(false);
    if (error) {
      toast.error("Couldn't update photo pins");
      return;
    }
    setLink({ ...link, show_photo_pins: next });
    toast.success(next ? "Photo pins on" : "Photo pins off");
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("share_links")
      .select("id,token,label,has_password,expires_at,revoked_at,view_count,last_accessed_at,created_at,show_photo_pins")
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    setLink(((data ?? [])[0] as ShareLink) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Latest day with photos — drives the "Day PDF" export scope.
  const latestDay = useMemo(() => {
    if (photos.length === 0) return null;
    const keys = new Set<string>();
    for (const p of photos) keys.add(photoDayKey(p));
    const sorted = Array.from(keys).sort().reverse();
    const key = sorted[0];
    if (!key) return null;
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const label = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const count = photos.filter((p) => photoDayKey(p) === key).length;
    return { key, label, date, count };
  }, [photos]);

  // Canonical share host — never derived from window.location so preview,
  // custom-domain and lovable.app all copy/QR to the same public URL clients use.
  const SHARE_BASE = "https://buildfolder.com";
  const shareUrl = link ? `${SHARE_BASE}/s/${link.token}` : null;
  // Message variant for chat apps: the event name in the message text, then the
  // plain share URL (chat apps only unfurl the real page, so we never send a
  // redirect wrapper — those render as a bare, untrusted-looking URL).
  const shareMessage = link
    ? `${project?.name ?? "Live build report"} — live build report\n${SHARE_BASE}/s/${link.token}`
    : null;


  const createLink = async () => {
    setCreating(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("share_links").insert({
      project_id: projectId,
      created_by: auth.user?.id,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client link created");
    load();
  };

  const copyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const copyShareMessage = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Message copied — paste into WhatsApp or email");
    } catch {
      toast.error("Copy failed");
    }
  };

  const revokeLink = async () => {
    if (!link) return;
    setConfirmRevoke(false);
    const { error } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", link.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link revoked");
    setLink(null);
  };

  const setPassword = async () => {
    if (!link) return;
    const pwd = passwordDraft.trim();
    setSavingPassword(true);
    try {
      let hash: string | null = null;
      if (pwd) {
        const { data, error } = await supabase.rpc("hash_share_password", { _password: pwd });
        if (error) throw error;
        hash = data as string;
      }
      const { error: upErr } = await supabase
        .from("share_links")
        .update({ password_hash: hash, has_password: !!hash })
        .eq("id", link.id);
      if (upErr) throw upErr;
      toast.success(pwd ? "Password set" : "Password removed");
      setPasswordDraft("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Share &amp; deliver</SheetTitle>
            <SheetDescription>
              One live link for your client. Same link the share page serves — no publish step.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !link ? (
              <div className="py-8 text-center">
                <BlockLabel dot="#D94F2A">Live client link</BlockLabel>
                <p className="text-sm text-muted-foreground mb-4">No link yet.</p>
                <Button onClick={createLink} disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create client link
                </Button>
              </div>
            ) : (
              <>
                {/* Live client link */}
                <section>
                  <BlockLabel dot="#D94F2A">Live client link</BlockLabel>
                  <div
                    className="rounded-md border p-3 text-xs break-all"
                    style={{ fontFamily: MONO, borderColor: "#E3DFD4", backgroundColor: "#FAF8F2" }}
                  >
                    {shareUrl}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={copyUrl}>
                      <Copy className="mr-1.5 h-4 w-4" /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}>
                      <QrCode className="mr-1.5 h-4 w-4" /> QR
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={shareUrl!} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                      </a>
                    </Button>
                  </div>
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" onClick={copyPreviewUrl}>
                      <Copy className="mr-1.5 h-4 w-4" /> Copy link for WhatsApp / email
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Same report, but the preview card shows the event name and its satellite map.
                    </p>
                  </div>
                </section>

                {/* Who can open it */}
                <section style={{ borderTop: DASH, paddingTop: 20 }}>
                  <BlockLabel dot="#3A6EA5">Who can open it</BlockLabel>
                  <div className="flex items-center gap-2 text-sm mb-3">
                    {link.has_password ? (
                      <>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span>Password required to open</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                        <span>Anyone with the link can open</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={passwordDraft}
                      onChange={(e) => setPasswordDraft(e.target.value)}
                      placeholder={link.has_password ? "New password (leave blank to remove)" : "Set a password"}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button size="sm" variant="outline" onClick={setPassword} disabled={savingPassword}>
                      {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : link.has_password && !passwordDraft ? "Remove" : "Save"}
                    </Button>
                  </div>
                </section>

                {/* Photo locations */}
                <section style={{ borderTop: DASH, paddingTop: 20 }}>
                  <BlockLabel dot="#3A6EA5">Photo locations</BlockLabel>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      Show a “Show on map” button on photos with GPS, and drop pins on the site map.
                    </p>
                    <Button
                      size="sm"
                      variant={link.show_photo_pins ? "default" : "outline"}
                      onClick={() => togglePhotoPins(!link.show_photo_pins)}
                      disabled={savingPins}
                    >
                      {savingPins ? <Loader2 className="h-4 w-4 animate-spin" /> : link.show_photo_pins ? "On" : "Off"}
                    </Button>
                  </div>
                </section>



                {/* Client views */}
                {(link.view_count > 0 || link.last_accessed_at) && (
                  <section style={{ borderTop: DASH, paddingTop: 20 }}>
                    <BlockLabel dot="#7B8B4F">Client views</BlockLabel>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Total opens</dt>
                        <dd className="mt-1 text-lg font-semibold" style={{ fontFamily: MONO }}>
                          {link.view_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Last opened</dt>
                        <dd className="mt-1 text-sm">
                          {link.last_accessed_at
                            ? formatDistanceToNow(new Date(link.last_accessed_at), { addSuffix: true })
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}

                {/* Exports */}
                <section style={{ borderTop: DASH, paddingTop: 20 }}>
                  <BlockLabel dot="#B7791F">Exports</BlockLabel>
                  <div className="space-y-2">
                    {latestDay ? (
                      <ExportPdfDialog
                        projectId={projectId}
                        photoCount={latestDay.count}
                        dayKey={latestDay.key}
                        dayLabel={latestDay.label}
                        lockMode="single"
                        trigger={
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <FileText className="mr-2 h-4 w-4" />
                            Day PDF — {latestDay.label}
                          </Button>
                        }
                      />
                    ) : (
                      <Button variant="outline" size="sm" className="w-full justify-start" disabled>
                        <FileText className="mr-2 h-4 w-4" />
                        Day PDF — no photos yet
                      </Button>
                    )}
                    <ExportPdfDialog
                      projectId={projectId}
                      photoCount={photos.length}
                      trigger={
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <FileArchive className="mr-2 h-4 w-4" />
                          Full record
                        </Button>
                      }
                    />
                  </div>
                </section>

                {/* Finalise / Unfile */}
                <FinaliseEventBlock projectId={projectId} />

                {/* Revoke */}
                <section style={{ borderTop: DASH, paddingTop: 20 }}>
                  <BlockLabel dot="#C7382A">Revoke link</BlockLabel>
                  <p className="text-xs text-muted-foreground mb-3">
                    Revoking makes this URL stop working immediately. You can create a new one after.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmRevoke(true)}
                    className="w-full"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Revoke client link
                  </Button>
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* QR modal — no extra deps, uses external QR renderer with the same URL. */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan to open</DialogTitle>
          </DialogHeader>
          {shareUrl && (
            <div className="flex flex-col items-center gap-3 py-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(shareUrl)}`}
                alt="QR code for client link"
                width={280}
                height={280}
                className="rounded-md border"
                style={{ borderColor: "#E3DFD4" }}
              />
              <p className="text-xs text-muted-foreground text-center break-all" style={{ fontFamily: MONO }}>
                {shareUrl}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this client link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone with the current URL will stop being able to open the share page.
              This can't be undone — you'd have to create a new link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeLink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
