// Public lead magnet signup: stores email and emails the PDF download link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const APP_URL = "https://www.buildfolder.com";
const PDF_URL = `${APP_URL}/__l5e/assets-v1/b84f5219-055b-4df0-aa5e-3165bbad384b/BuildFolder_Benefits.pdf`;

function emailHtml(downloadUrl: string): string {
  return `<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #C9C5BC;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#F4F1EA;padding:22px 28px;border-bottom:1px solid #C9C5BC;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding-right:12px;vertical-align:middle;">
              <img src="${APP_URL}/favicon-96.png" width="36" height="36" alt="" style="display:block;border-radius:8px;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:18px;font-weight:900;color:#0F1417;letter-spacing:-0.01em;">BuildFolder</span>
            </td>
          </tr></table>
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

    const { error: insErr } = await supabase
      .from("lead_magnet_signups")
      .insert({ email: rawEmail, source, pdf_slug: pdfSlug });

    if (insErr) {
      console.error("insert error", insErr);
      return new Response(JSON.stringify({ error: "Could not save signup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the email
    const apiKey = Deno.env.get("RESEND_API_KEY");
    let debug: Record<string, unknown> = { apiKeyPresent: !!apiKey };
    if (apiKey) {
      const rawFrom = (Deno.env.get("RESEND_FROM_EMAIL") || "BuildFolder <onboarding@resend.dev>").trim();
      let from = rawFrom;
      if (!/^[^<>]+<[^\s@<>]+@[^\s@<>]+>$/.test(rawFrom) && !EMAIL_RE.test(rawFrom)) {
        const m = rawFrom.match(/([^\s<>"]+@[^\s<>"]+)/);
        if (m) {
          const name = rawFrom.replace(m[1], "").replace(/[<>"]/g, "").trim() || "BuildFolder";
          from = `${name} <${m[1]}>`;
        } else {
          from = "BuildFolder <onboarding@resend.dev>";
        }
      }
      debug.rawFrom = rawFrom;
      debug.normalizedFrom = from;
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [rawEmail],
            subject: "Your BuildFolder guide",
            html: emailHtml(PDF_URL),
          }),
        });
        const text = await resp.text();
        debug.resendStatus = resp.status;
        debug.resendBody = text.slice(0, 500);
        if (!resp.ok) console.warn("Resend send failed", resp.status, text);
      } catch (e) {
        debug.resendException = String(e);
      }
    }

    return new Response(JSON.stringify({ ok: true, debug }), {
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
