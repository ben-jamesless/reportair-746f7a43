// Public lead magnet signup: stores email and emails the PDF download link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const APP_URL = "https://www.buildfolder.com";
const PDF_BUCKET = "lead-magnet";
const PDF_OBJECT = "BuildFolder_Benefits.pdf";
// 1 year signed URL — regenerated on every send, so always fresh.
const PDF_SIGN_TTL_SECONDS = 60 * 60 * 24 * 365;

function emailHtml(downloadUrl: string): string {
  return `<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #C9C5BC;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#F4F1EA;padding:22px 28px;border-bottom:1px solid #C9C5BC;">
          <span style="font-size:18px;font-weight:900;color:#0F1417;letter-spacing:-0.01em;">BuildFolder</span>
        </td></tr>
        <tr><td style="padding:32px 28px 28px;">
          <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;line-height:1.25;">Here&rsquo;s your guide</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Thanks for signing up. Click below to download your BuildFolder guide.</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.7;">If you have any questions, just reply to this email &mdash; we read every response.</p>
          <a href="${downloadUrl}" style="display:inline-block;background:#D94F2A;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">Download the PDF &rarr;</a>
          <p style="margin:24px 0 0;font-size:13px;color:#6B6B66;">Or paste this link into your browser:<br><a href="${downloadUrl}" style="color:#D94F2A;">${downloadUrl}</a></p>
        </td></tr>
        <tr><td style="padding:24px 28px 28px;border-top:1px solid #C9C5BC;background:#F4F1EA;">
          <p style="margin:0 0 8px;font-size:13px;"><strong>Built for the build. Built in Hong Kong.</strong></p>
          <p style="margin:0;font-size:12px;color:#6B6B66;"><a href="${APP_URL}" style="color:#D94F2A;text-decoration:none;">buildfolder.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const source = typeof body?.source === "string" ? body.source.slice(0, 100) : "homepage-popup";
    const pdfSlug = typeof body?.pdfSlug === "string" ? body.pdfSlug.slice(0, 100) : "default";

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

    const { data: inserted, error: insErr } = await supabase
      .from("lead_magnet_signups")
      .insert({ email: rawEmail, source, pdf_slug: pdfSlug })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("insert error", insErr);
      return new Response(JSON.stringify({ error: "Could not save signup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a fresh signed URL for the PDF (bucket is private).
    let pdfUrl = `${APP_URL}/`;
    const { data: signed, error: signErr } = await supabase
      .storage
      .from(PDF_BUCKET)
      .createSignedUrl(PDF_OBJECT, PDF_SIGN_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      console.error("PDF sign URL error", signErr);
    } else {
      pdfUrl = signed.signedUrl;
    }

    // Send the email and capture the real result.
    let emailSent = false;
    let resendStatus: number | null = null;
    let resendMessageId: string | null = null;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("RESEND_API_KEY missing");
    } else {
      const from = (Deno.env.get("RESEND_FROM_EMAIL") || "BuildFolder <onboarding@resend.dev>").trim();
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [rawEmail],
            subject: "Your BuildFolder guide",
            html: emailHtml(pdfUrl),
          }),
        });
        resendStatus = resp.status;
        const text = await resp.text();
        if (resp.ok) {
          emailSent = true;
          try { resendMessageId = JSON.parse(text)?.id ?? null; } catch { /* ignore */ }
        } else {
          console.error("Resend send failed", resp.status, text);
        }
      } catch (e) {
        console.error("Resend exception", String(e));
      }
    }

    // Record the send outcome on the signup row (best-effort).
    await supabase
      .from("lead_magnet_signups")
      .update({ resend_status: resendStatus, resend_message_id: resendMessageId })
      .eq("id", inserted.id);

    return new Response(JSON.stringify({ ok: true, emailSent }), {
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
