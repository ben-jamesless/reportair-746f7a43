// Sends a project invite email via Resend.
// Input: { inviteId: string }
// Looks up the invite, project, and inviter, then dispatches an HTML email
// containing a CTA button linking to /invite/<token> on the app's origin.
//
// Failure modes (missing RESEND_API_KEY, Resend errors, etc.) are caught and
// returned as 200 { ok:false, error } so the caller can log without blocking
// the invite-creation flow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN_SUFFIXES = [".lovable.app", ".lovable.dev", ".buildslides.com", ".reportair.co"];
const ALLOWED_ORIGINS = new Set([
  "https://www.buildslides.com",
  "https://buildslides.com",
  "https://www.reportair.co",
  "https://reportair.co",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  let allow = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
  try {
    if (origin) {
      const host = new URL(origin).hostname;
      if (ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGIN_SUFFIXES.some((s) => host.endsWith(s))) {
        allow = origin;
      }
    }
  } catch (_e) { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });

// ============ Auth helper ============
/**
 * Validates the caller's JWT and returns their user ID.
 * Returns null if the token is missing, invalid, or expired.
 */
async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const jwt = authHeader.replace("Bearer ", "").trim();
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await anonClient.auth.getUser(jwt);
  if (error || !user) return null;
  return user.id;
}

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
  <body style="margin:0;padding:0;background-color:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #C9C5BC;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#F4F1EA;padding:22px 28px;border-bottom:1px solid #C9C5BC;">
                <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <img src="https://www.buildslides.com/favicon-96.png" width="36" height="36" alt="" style="display:block;border-radius:8px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:Geist,Helvetica,Arial,sans-serif;font-size:18px;font-weight:900;color:#0F1417;letter-spacing:-0.01em;">BuildFolder</span>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px 28px;">
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:700;color:#0F1417;">
                  You've been invited to ${safeProject}
                </h1>
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#0F1417;">
                  <strong>${safeInviter}</strong> invited you to collaborate on
                  <strong>${safeProject}</strong> in BuildFolder as a
                  <strong>${safeRole}</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:#0F1417;">
                  Accept the invite to view photos, daily updates, and project activity.
                </p>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 28px 32px 28px;">
                <a href="${safeUrl}"
                   style="display:inline-block;background:#D94F2A;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">
                  Accept invite &rarr;
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#6B6B66;word-break:break-all;">
                  Or open this link:<br />
                  <a href="${safeUrl}" style="color:#D94F2A;text-decoration:underline;">${safeUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;border-top:1px solid #C9C5BC;background:#F4F1EA;">
                <p style="margin:0 0 8px;font-size:13px;color:#0F1417;line-height:1.5;"><strong>Built for the build. Built in Hong Kong.</strong></p>
                <p style="margin:0 0 12px;font-size:13px;color:#6B6B66;line-height:1.5;">Ben Lee · Director · <a href="mailto:hello@buildfolder.com" style="color:#D94F2A;text-decoration:underline;">hello@buildfolder.com</a></p>
                <p style="margin:0;font-size:12px;color:#6B6B66;"><a href="https://www.buildslides.com" style="color:#D94F2A;text-decoration:none;">buildslides.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }

  // ============ AUTH GATE ============
  // Step 1: Validate the caller has a live session.
  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return json(req, { ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const inviteId: unknown = body?.inviteId;
    if (typeof inviteId !== "string" || inviteId.length < 8) {
      return json(req, { ok: false, error: "inviteId is required" }, 400);
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
      return json(req, { ok: false, error: "Invite lookup failed" }, 200);
    }
    if (!invite) {
      return json(req, { ok: false, error: "Invite not found" }, 404);
    }

    // Step 2: Verify the caller is an owner or admin of the project this invite belongs to.
    // This prevents any authenticated user from triggering emails for invites they don't own.
    const { data: membership, error: memberErr } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", invite.project_id)
      .eq("user_id", callerId)
      .maybeSingle();

    if (memberErr || !membership || !["owner", "admin"].includes(membership.role)) {
      return json(req, { ok: false, error: "Forbidden" }, 403);
    }
    // ============ END AUTH GATE ============

    const [{ data: project }, { data: inviterProfile }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", invite.project_id).maybeSingle(),
      invite.invited_by
        ? supabase.from("profiles").select("full_name").eq("id", invite.invited_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const projectName = project?.name ?? "a project";
    const inviterName = inviterProfile?.full_name ?? "A teammate";

    // Always prefer the configured production app URL so links don't point at the
    // Lovable preview shell. Falls back to request origin, then a hardcoded default.
    const rawAppUrl =
      Deno.env.get("APP_URL") ||
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/$/, "") ||
      "https://www.buildslides.com";
    const appUrl = rawAppUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
    const cleanOrigin = appUrl.split("/").slice(0, 3).join("/");
    const inviteUrl = `${cleanOrigin}/invite/${invite.token}`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured — email skipped", {
        inviteId,
        to: invite.email,
        inviteUrl,
      });
      return json(req, {
        ok: false,
        error: "RESEND_API_KEY not configured",
        inviteUrl,
      }, 200);
    }

    const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") || "BuildFolder <onboarding@resend.dev>";
    let fromAddress = rawFrom.trim().replace(/^['"]|['"]$/g, "").trim();
    if (!/<[^>]+>/.test(fromAddress)) {
      const m = fromAddress.match(/^(.*?)([^\s<>"]+@[^\s<>"]+)\s*$/);
      if (m && m[1].trim()) {
        fromAddress = `${m[1].trim()} <${m[2]}>`;
      }
    }

    const subject = `You've been invited to ${projectName} on BuildFolder`;
    const html = renderEmail({
      inviterName,
      projectName,
      role: invite.role,
      inviteUrl,
    });
    const text = [
      `You've been invited to ${projectName}`,
      ``,
      `${inviterName} invited you to collaborate on ${projectName} in BuildFolder as a ${invite.role}.`,
      ``,
      `Accept the invite here:`,
      inviteUrl,
      ``,
      `— BuildFolder`,
    ].join("\n");

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
        text,
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
      return json(req, { ok: false, error: `Resend ${resp.status}: ${responseBody}` }, 200);
    }

    let result: Record<string, unknown> = {};
    try {
      result = responseBody ? JSON.parse(responseBody) : {};
    } catch (_e) {
      result = { raw: responseBody };
    }
    console.log("Invite email sent", { inviteId, to: invite.email, id: result?.id });
    // Best-effort: also create an in-app notification if the invitee already has an account.
    await supabase.rpc("notify_user_of_invite", { _invite_id: inviteId }).catch((err) => {
      console.error("notify_user_of_invite failed", err);
    });
    return json(req, { ok: true, status: resp.status, body: result, id: result?.id });
  } catch (e) {
    console.error("send-invite-email crashed", e);
    return json(req, { ok: false, error: (e as Error).message }, 200);
  }
});
