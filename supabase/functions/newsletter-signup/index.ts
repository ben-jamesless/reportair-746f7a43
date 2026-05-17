// Public newsletter signup: stores email in Lovable Cloud and optionally
// syncs to a Resend audience (when RESEND_AUDIENCE_ID is configured).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const source = typeof body?.source === "string" ? body.source.slice(0, 100) : null;

    if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert by lower(email) — duplicates are not an error to the user.
    const { data: existing } = await supabase
      .from("newsletter_signups")
      .select("id, synced_to_resend")
      .ilike("email", rawEmail)
      .maybeSingle();

    let rowId = existing?.id as string | undefined;
    let alreadySynced = existing?.synced_to_resend ?? false;

    if (!rowId) {
      const { data: inserted, error: insErr } = await supabase
        .from("newsletter_signups")
        .insert({ email: rawEmail, source })
        .select("id")
        .single();
      if (insErr) {
        console.error("insert error", insErr);
        return new Response(JSON.stringify({ error: "Could not save signup" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      rowId = inserted.id;
    }

    // Optional Resend sync
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");
    if (resendKey && audienceId && !alreadySynced) {
      try {
        const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: rawEmail, unsubscribed: false }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          await supabase
            .from("newsletter_signups")
            .update({ synced_to_resend: true, resend_contact_id: json?.id ?? null })
            .eq("id", rowId);
        } else {
          const text = await res.text();
          console.warn("Resend sync failed", res.status, text);
        }
      } catch (e) {
        console.warn("Resend sync exception", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
