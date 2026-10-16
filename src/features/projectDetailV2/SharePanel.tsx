import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectTimeZone } from "@/hooks/useProjectTimeZone";
import { Copy, QrCode, Loader2, Trash2, Plus, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { dayKey as photoDayKey, UNDATED } from "@/lib/projectDetailTypes";
import { FinaliseEventBlock } from "./FinaliseEventBlock";
import {
  T,
  PanelBar,
  SectionLabel,
  FieldLabel,
  fieldClass,
  fieldStyle,
  inkButtonClass,
  quietButtonClass,
  SquareSwitch,
} from "@/features/projectSettings/settingsUi";


/**
 * Phase 3.5 — Share/Deliver side panel.
 * Backed by the existing `share_links` table (no new schema).
 * Design pass: dashed dividers between blocks, each with a 9px dot label.
 */


const MONO = "'Inter Variable', Inter, system-ui, sans-serif";

type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  /** Opens by signed-in project members — never counted as client opens. */
  team_view_count: number;
  last_accessed_at: string | null;
  created_at: string;
  show_photo_pins: boolean;
};

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
  const eventTz = useProjectTimeZone(projectId);

  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

  useEffect(() => {
    setExpiry(link?.expires_at ? new Date(link.expires_at).toISOString().slice(0, 10) : "");
  }, [link?.id, link?.expires_at]);

  const saveExpiry = async () => {
    if (!link) return;
    // Date-only choice expires at the end of the chosen UTC day, not browser-local midnight.
    const expiresAt = expiry ? `${expiry}T23:59:59.999Z` : null;
    if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      toast.error("Choose a future expiry date."); return;
    }
    setSavingExpiry(true);
    const { error } = await supabase.from("share_links").update({ expires_at: expiresAt }).eq("id", link.id);
    setSavingExpiry(false);
    if (error) { toast.error("Couldn’t save the expiry date."); return; }
    setLink(current => current ? { ...current, expires_at: expiresAt } : current);
    toast.success(expiresAt ? "Link expiry saved." : "Link expiry removed.");
  };

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
      .select("id,token,label,expires_at,revoked_at,view_count,team_view_count,last_accessed_at,created_at,show_photo_pins")
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
    for (const p of photos) {
      const k = photoDayKey(p, eventTz);
      if (k !== UNDATED) keys.add(k);
    }
    const sorted = Array.from(keys).sort().reverse();
    const key = sorted[0];
    if (!key) return null;
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const label = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    const count = photos.filter((p) => photoDayKey(p, eventTz) === key).length;
    return { key, label, date, count };
  }, [photos, eventTz]);

  // Canonical share host — never derived from window.location so preview,
  // custom-domain and lovable.app all copy/QR to the same public URL clients use.
  const SHARE_BASE = "https://buildfolder.com";
  const shareUrl = link ? `${SHARE_BASE}/s/${link.token}` : null;

  // Signed token so the team's own opens are attributed as previews rather than
  // client opens. Minted per member; it stops working if they lose access.
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  useEffect(() => {
    if (!link?.id) { setPreviewToken(null); return; }
    let cancelled = false;
    void supabase
      .rpc("share_preview_token" as never, { _share_link_id: link.id } as never)
      .then(({ data }) => { if (!cancelled) setPreviewToken((data as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [link?.id]);

  /** The link the TEAM opens. Never the one copied for the client. */
  const teamPreviewUrl = shareUrl
    ? previewToken
      ? `${shareUrl}?preview=${encodeURIComponent(previewToken)}`
      : shareUrl
    : null;
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 shadow-elegant sm:max-w-[480px]"
          style={{ backgroundColor: T.paper, borderColor: T.rule }}
        >
          <PanelBar title="Share & deliver" />
          <SheetHeader className="sr-only">
            <SheetTitle>Share &amp; deliver</SheetTitle>
            <SheetDescription>
              One live link for your client. Same link the share page serves — no publish step.
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: T.muted }}>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !link ? (
              <section>
                <SectionLabel>Live client link</SectionLabel>
                <p className="mb-3 text-sm" style={{ color: T.ink2 }}>
                  No client link yet. One live link per project — it updates as you work, with no publish step.
                </p>
                <Button type="button" className={inkButtonClass} onClick={createLink} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create client link
                </Button>
              </section>
            ) : (
              <>
                {/* Live client link */}
                <section className="mb-6">
                  <SectionLabel>Live client link</SectionLabel>
                  <div
                    className="rounded-md border p-3 text-xs break-all"
                    style={{ fontFamily: MONO, borderColor: T.rule, backgroundColor: T.white, borderRadius: 6, color: T.ink }}
                  >
                    {shareUrl}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className={inkButtonClass} onClick={copyUrl}>
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                    <Button type="button" variant="outline" className={quietButtonClass} onClick={() => setQrOpen(true)}>
                      <QrCode className="h-4 w-4" /> QR
                    </Button>
                    <a className={quietButtonClass} href={teamPreviewUrl ?? undefined} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open
                    </a>
                  </div>
                  <div className="mt-3">
                    <Button type="button" variant="outline" className={quietButtonClass} onClick={copyShareMessage}>
                      <Copy className="h-4 w-4" /> Copy message for WhatsApp / email
                    </Button>
                    <p className="mt-1.5 text-xs" style={{ color: T.muted }}>
                      Copies the event name plus the same link, ready to paste.
                    </p>
                  </div>
                </section>

                <section className="mb-6 space-y-3">
                  <SectionLabel>Link expiry</SectionLabel>
                  <Label htmlFor="client-link-expiry">Expiry date (optional, end of day UTC)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input id="client-link-expiry" type="date" className="w-auto rounded-md" value={expiry} onChange={event => setExpiry(event.target.value)} />
                    <Button type="button" variant="outline" className="rounded-md" disabled={savingExpiry} onClick={saveExpiry}>{savingExpiry ? "Saving…" : expiry ? "Save expiry" : "No expiry"}</Button>
                    {expiry && <Button type="button" variant="ghost" onClick={() => setExpiry("")}>Clear date</Button>}
                  </div>
                </section>

                {/* Photo locations */}
                <section className="mb-6">
                  <SectionLabel>Photo locations</SectionLabel>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm" style={{ color: T.ink2 }}>
                      Show a “Show on map” button on photos with GPS, and drop pins on the site map.
                    </p>
                    <SquareSwitch
                      checked={link.show_photo_pins}
                      onChange={(next) => togglePhotoPins(next)}
                      disabled={savingPins}
                      label="Photo locations"
                    />
                  </div>
                </section>

                {/* Finalise / Unfile — outlined secondary, never the loudest control */}
                <FinaliseEventBlock projectId={projectId} />

                {/* Revoke */}
                <section className="mb-2">
                  <SectionLabel>Revoke link</SectionLabel>
                  <p className="mb-3 text-xs" style={{ color: T.muted }}>
                    Revoking makes this URL stop working immediately. You can create a new one after.
                  </p>
                  <Button type="button" variant="outline" className={quietButtonClass} onClick={() => setConfirmRevoke(true)}>
                    <Trash2 className="h-4 w-4" /> Revoke client link
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
                className="border"
                style={{ borderColor: T.rule }}
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
