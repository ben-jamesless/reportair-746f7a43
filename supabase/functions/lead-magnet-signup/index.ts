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

const LOGO_URL = "https://buildfolder.com/__l5e/assets-v1/e85ee73c-12f9-4cf9-b414-9951e118bf3d/buildfolder-logo.png";

function emailHtml(downloadUrl: string): string {
  return `<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #C9C5BC;border-radius:14px;overflow:hidden;">
        <tr><td align="left" style="background:#F4F1EA;padding:26px 32px;border-bottom:1px solid #C9C5BC;">
          <img src="${LOGO_URL}" alt="BuildFolder" height="30" style="display:block;height:30px;width:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:36px 32px 30px;">
          <h1 style="margin:0 0 16px;font-size:25px;font-weight:800;line-height:1.25;color:#0F1417;letter-spacing:-0.01em;">Here&rsquo;s your guide</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#0F1417;">Thanks for signing up. Click below to download your BuildFolder guide.</p>
          <p style="margin:0 0 30px;font-size:15px;line-height:1.7;color:#0F1417;">If you have any questions, just reply to this email &mdash; we read every response.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:9px;background:#D94F2A;">
            <a href="${downloadUrl}" style="display:inline-block;background:#D94F2A;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:14px 26px;border-radius:9px;">Download the PDF &nbsp;&rarr;</a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#8A8A82;">Button not working? <a href="${downloadUrl}" style="color:#D94F2A;text-decoration:underline;">Download here</a> instead.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 26px;border-top:1px solid #C9C5BC;background:#F4F1EA;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0F1417;">Built for the build. Built in Hong Kong.</p>
          <p style="margin:0;font-size:12px;color:#8A8A82;"><a href="${APP_URL}" style="color:#D94F2A;text-decoration:none;">buildfolder.com</a></p>
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
            reply_to: "ben.jameslee@gmail.com",
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
