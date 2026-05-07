// Sends a project invite email via Resend.
// Input: { inviteId: string }
// Looks up the invite, project, and inviter, then dispatches an HTML email
// containing a CTA button linking to /invite/<token> on the app's origin.
//
// Failure modes (missing RESEND_API_KEY, Resend errors, etc.) are caught and
// returned as 200 { ok:false, error } so the caller can log without blocking
// the invite-creation flow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(args: {
  inviterName: string;
  projectName: string;
  role: string;
  inviteUrl: string;
}): string {
  const { inviterName, projectName, role, inviteUrl } = args;
  const safeProject = escapeHtml(projectName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);
  const safeUrl = escapeHtml(inviteUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:600;color:#0f172a;">
                  You've been invited to ${safeProject}
                </h1>
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">
                  <strong>${safeInviter}</strong> invited you to collaborate on
                  <strong>${safeProject}</strong> in ReportAir as a
                  <strong>${safeRole}</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Accept the invite to view photos, daily updates, and project activity.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px 32px;">
                <a href="${safeUrl}"
                   style="display:inline-block;background-color:#1A6EFF;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">
                  Accept invite
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;word-break:break-all;">
                  Or open this link: <br />
                  <a href="${safeUrl}" style="color:#1A6EFF;">${safeUrl}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:11px;color:#94a3b8;">
            Sent by ReportAir
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const inviteId: unknown = body?.inviteId;
    if (typeof inviteId !== "string" || inviteId.length < 8) {
      return json({ ok: false, error: "inviteId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the invite + project name + inviter name.
    const { data: invite, error: invErr } = await supabase
      .from("project_invites")
      .select("id, email, role, token, project_id, invited_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (invErr) {
      console.error("Invite lookup failed", invErr);
      return json({ ok: false, error: "Invite lookup failed" }, 200);
    }
    if (!invite) {
      return json({ ok: false, error: "Invite not found" }, 404);
    }

    const [{ data: project }, { data: inviterProfile }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", invite.project_id).maybeSingle(),
      invite.invited_by
        ? supabase.from("profiles").select("full_name").eq("id", invite.invited_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const projectName = project?.name ?? "a project";
    const inviterName = inviterProfile?.full_name ?? "A teammate";

    // Build the invite URL using the request origin (so it works on preview/published).
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      "https://whatops.lovable.app";
    const cleanOrigin = origin.replace(/\/$/, "").split("/").slice(0, 3).join("/");
    const inviteUrl = `${cleanOrigin}/invite/${invite.token}`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured — email skipped", {
        inviteId,
        to: invite.email,
        inviteUrl,
      });
      return json({
        ok: false,
        error: "RESEND_API_KEY not configured",
        inviteUrl,
      }, 200);
    }

    const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") || "ReportAir <onboarding@resend.dev>";
    // Strip surrounding quotes if the secret was saved with them.
    const fromAddress = rawFrom.trim().replace(/^['"]|['"]$/g, "").trim();

    const subject = `You've been invited to ${projectName} on ReportAir`;
    const html = renderEmail({
      inviterName,
      projectName,
      role: invite.role,
      inviteUrl,
    });

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [invite.email],
        subject,
        html,
      }),
    });

    const responseBody = await resp.text();
    console.log("Resend response", {
      inviteId,
      to: invite.email,
      status: resp.status,
      body: responseBody,
    });

    if (!resp.ok) {
      console.error("Resend send failed", resp.status, responseBody);
      return json({ ok: false, error: `Resend ${resp.status}: ${responseBody}` }, 200);
    }

    let result: Record<string, unknown> = {};
    try {
      result = responseBody ? JSON.parse(responseBody) : {};
    } catch (_e) {
      result = { raw: responseBody };
    }
    console.log("Invite email sent", { inviteId, to: invite.email, id: result?.id });
    return json({ ok: true, status: resp.status, body: result, id: result?.id });
  } catch (e) {
    console.error("send-invite-email crashed", e);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
