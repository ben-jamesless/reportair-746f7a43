import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { event as gaEvent } from "@/lib/analytics";

const SEEN_KEY = "bf_lead_magnet_seen";
const SCROLL_THRESHOLD = 0.5;

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(254),
});

export function LeadMagnetPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEN_KEY) === "1") return;

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total > 0 && scrolled / total >= SCROLL_THRESHOLD) {
        setOpen(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) markSeen();
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("lead-magnet-signup", {
        body: { email: parsed.data.email, source: "homepage-popup", pdfSlug: "default" },
      });
      if (fnError) throw fnError;
      gaEvent("lead_magnet_submit", { source: "homepage-popup" });
      markSeen();
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="py-4 text-center">
            <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We just sent your guide to <strong>{email}</strong>. If it doesn&rsquo;t arrive in a minute, check spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Get the BuildFolder guide</h2>
              <p className="text-sm text-muted-foreground">
                Drop your email and we&rsquo;ll send you the PDF straight away.
              </p>
            </div>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send me the guide"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LeadMagnetPopup;
