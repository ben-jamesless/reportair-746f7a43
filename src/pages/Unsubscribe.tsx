import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) { setState("error"); return; }
    const controller = new AbortController();
    void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, signal: controller.signal }).then(async response => {
      const data = await response.json(); setState(data.valid ? "valid" : data.reason === "already_unsubscribed" ? "done" : "error");
    }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [token]);
  const confirm = async () => {
    setBusy(true); const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setState(!error && (data?.success || data?.reason === "already_unsubscribed") ? "done" : "error"); setBusy(false);
  };
  return <main className="mx-auto max-w-lg space-y-5 px-6 py-20"><p className="font-semibold">BuildFolder</p><h1 className="text-2xl font-semibold">Email preferences</h1>{state === "loading" ? <p>Checking…</p> : state === "valid" ? <><p>Stop receiving app emails? Sign-in and password-reset emails will still arrive.</p><Button disabled={busy} onClick={confirm}>{busy ? "Saving…" : "Confirm unsubscribe"}</Button></> : state === "done" ? <p role="status">You have unsubscribed from app emails.</p> : <p role="alert" className="text-destructive">This link is invalid or unavailable.</p>}</main>;
}