import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EarlyAccessForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { error: requestError } = await supabase.rpc("request_early_access", {
        _email: String(values.get("email") ?? "").trim(),
        _full_name: String(values.get("name") ?? "").trim(),
        _company: String(values.get("company") ?? "").trim(),
        _website: String(values.get("website") ?? ""),
      });
      if (requestError) throw requestError;
      setSent(true);
    } catch {
      setError("We couldn’t save your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) return (
    <div role="status" className="border-y border-border py-8 text-center">
      <Check className="mx-auto mb-4 h-7 w-7 text-primary" />
      <h2 className="text-xl font-semibold">Your request is in.</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Thanks for your interest in BuildFolder. We’ll review your request and contact you if a beta place becomes available.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5 text-left">
      <div className="space-y-2">
        <Label htmlFor="access-name">Name</Label>
        <Input id="access-name" name="name" autoComplete="name" required maxLength={120} className="rounded-none" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-email">Email</Label>
        <Input id="access-email" name="email" type="email" autoComplete="email" required maxLength={254} className="rounded-none" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-company">Company <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="access-company" name="company" autoComplete="organization" maxLength={200} className="rounded-none" />
      </div>
      <div hidden aria-hidden="true"><label htmlFor="access-website">Website</label><input id="access-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="h-auto min-h-11 w-full whitespace-normal rounded-none px-4 py-3">
        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {busy ? "Sending request…" : "Request early access"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">We’ll only use these details to contact you about early access. Requesting access does not create an account.</p>
    </form>
  );
}