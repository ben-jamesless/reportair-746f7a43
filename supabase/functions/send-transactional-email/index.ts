import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "https://www.buildslides.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// ── Auth helpers ────────────────────────────────────────────────────────────

async function getCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user } } = await anon.auth.getUser(token);
  return user?.id ?? null;
}

function isInternalCall(req: Request): boolean {
  return req.headers.get("x-internal-secret") === Deno.env.get("INTERNAL_SECRET");
}

// ── Brand helpers (v5) ───────────────────────────────────────────────────────

const APP_URL = "https://www.buildslides.com";

const LOGO_HEADER = `<table cellpadding="0" cellspacing="0" role="presentation"><tr>
  <td style="padding-right:12px;vertical-align:middle;">
    <img src="${APP_URL}/favicon-96.png" width="36" height="36" alt="" style="display:block;border-radius:8px;" />
  </td>
  <td style="vertical-align:middle;">
    <span style="font-family:Geist,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;font-weight:900;color:#0F1417;letter-spacing:-0.01em;">BuildSlides</span>
  </td>
</tr></table>`;

function escapeHtml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function baseWrapper(subheader: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:0;background-color:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #C9C5BC;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#F4F1EA;padding:22px 28px;border-bottom:1px solid #C9C5BC;">${LOGO_HEADER}</td></tr>
        ${subheader}
        <tr><td style="padding:32px 28px 28px;">${body}</td></tr>
        <tr><td style="padding:24px 28px 28px;border-top:1px solid #C9C5BC;background:#F4F1EA;">
          <p style="margin:0 0 8px;font-size:13px;color:#0F1417;line-height:1.5;"><strong style="color:#0F1417;">Built for the build. Built in Hong Kong.</strong></p>
          <p style="margin:0 0 12px;font-size:13px;color:#6B6B66;line-height:1.5;">Ben Lee · Director · <a href="mailto:ben@buildslides.com" style="color:#D94F2A;text-decoration:underline;">ben@buildslides.com</a></p>
          <p style="margin:0;font-size:12px;color:#6B6B66;"><a href="${APP_URL}" style="color:#D94F2A;text-decoration:none;">buildslides.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaBtn(url: string, label: string, bg = "#D94F2A"): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${bg};color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;letter-spacing:0.01em;">${escapeHtml(label)} &rarr;</a>`;
}

function infoBox(content: string, borderColor = "#D94F2A", bg = "#F4F1EA"): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:${bg};border-radius:10px;margin-bottom:28px;border-left:4px solid ${borderColor};"><tr><td style="padding:16px 20px;">${content}</td></tr></table>`;
}

const PLAN_PRICES: Record<string, string> = { solo: "HK$128", pro: "HK$298", studio: "HK$688" };
const PLAN_FEATURES: Record<string, string[][]> = {
  solo:   [["1 active event","Unlimited PDF exports"],["1 team member","7-day free trial"]],
  pro:    [["5 active events","Share & client links"],["5 team members","Password-protected links"],["Unlimited PDF exports","Project invites"]],
  studio: [["Unlimited events","Share & client links"],["Unlimited members","Custom logo on PDF"],["Unlimited PDF exports","White-label header"],["Priority support","Onboarding call"]],
};

function featureGrid(plan: string): string {
  const rows = PLAN_FEATURES[plan] ?? PLAN_FEATURES.solo;
  const rowsHtml = rows.map(([a, b]) => `<tr>
    <td style="padding:4px 0;font-size:14px;color:#0F1417;width:50%;">&#10003;&nbsp; ${escapeHtml(a)}</td>
    <td style="padding:4px 0;font-size:14px;color:#0F1417;">${b ? `&#10003;&nbsp; ${escapeHtml(b)}` : ""}</td>
  </tr>`).join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F1EA;border-radius:10px;margin-bottom:28px;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#0F1417;letter-spacing:0.04em;text-transform:uppercase;">What's included</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;">${rowsHtml}</table>
    </td></tr>
  </table>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

type TemplateData = Record<string, string>;

const TEMPLATES: Record<string, (d: TemplateData) => { subject: string; html: string }> = {

  welcome: (d) => ({
    subject: "Welcome to BuildSlides",
    html: baseWrapper("", `
      <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">Welcome, ${escapeHtml(d.name || "there")}!</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;">Your BuildSlides account is ready. Start by creating your first project &mdash; upload photos, track area progress, and share polished daily reports with your team.</p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#0F1417;">You&rsquo;re on the <strong style="color:#0F1417;">Solo plan</strong>. Upgrade anytime to unlock share links, more events, team members, and custom branding.</p>
      ${ctaBtn("https://www.buildslides.com/projects", "Go to your projects")}
    `),
  }),

  upgrade: (d) => {
    const planLabel = d.plan ? d.plan.charAt(0).toUpperCase() + d.plan.slice(1) : "Pro";
    const price = PLAN_PRICES[d.plan] ?? "";
    const strip = `<tr><td style="background:linear-gradient(135deg,#D94F2A,#D94F2A);padding:14px 32px;">
      <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(planLabel)} Plan &mdash; Active</span>
    </td></tr>`;
    return {
      subject: `You're now on the ${planLabel} plan`,
      html: baseWrapper(strip, `
        <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">You&rsquo;re all set, ${escapeHtml(d.name || "there")}.</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;">Your BuildSlides <strong style="color:#0F1417;">${escapeHtml(planLabel)}</strong> subscription is now active${price ? ` at <strong style="color:#0F1417;">${escapeHtml(price)}/month</strong>` : ""}.</p>
        ${d.renewalDate ? `<p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#0F1417;">Your next billing date is <strong style="color:#0F1417;">${escapeHtml(d.renewalDate)}</strong>.</p>` : "<p style='margin:0 0 28px;'></p>"}
        ${featureGrid(d.plan)}
        ${ctaBtn("https://www.buildslides.com/projects", "Go to BuildSlides")}
        <p style="margin:20px 0 0;font-size:13px;color:#6B6B66;">Manage or cancel anytime from your <a href="https://www.buildslides.com/billing" style="color:#D94F2A;text-decoration:none;font-weight:500;">Billing page</a>.</p>
      `),
    };
  },

  cancelled: (d) => {
    const planLabel = d.plan ? d.plan.charAt(0).toUpperCase() + d.plan.slice(1) : "your";
    return {
      subject: "Your BuildSlides subscription has been cancelled",
      html: baseWrapper("", `
        <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">Subscription cancelled</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;">Hi ${escapeHtml(d.name || "there")}, your <strong style="color:#0F1417;">${escapeHtml(planLabel)}</strong> subscription has been cancelled.</p>
        ${d.endDate ? `<p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#0F1417;">You&rsquo;ll have full access until <strong style="color:#0F1417;">${escapeHtml(d.endDate)}</strong>, after which your account reverts to the Solo plan. All your projects and photos are safe &mdash; nothing gets deleted.</p>` : ""}
        ${infoBox(`<p style="margin:0;font-size:14px;line-height:1.6;color:#0F1417;"><strong style="color:#0F1417;">Your data is safe.</strong> Projects, photos, and reports remain accessible on the Solo plan. Upgrade again anytime to restore full access.</p>`)}
        ${ctaBtn("https://www.buildslides.com/billing", "Reactivate subscription")}
        <p style="margin:20px 0 0;font-size:13px;color:#6B6B66;">Have feedback on why you left? Just reply to this email &mdash; we read every response.</p>
      `),
    };
  },

  payment_failed: (d) => {
    const planLabel = d.plan ? d.plan.charAt(0).toUpperCase() + d.plan.slice(1) : "your";
    const price = PLAN_PRICES[d.plan] ?? "";
    const alertStrip = `<tr><td style="background:#FEF2F2;border-bottom:1px solid #FECACA;padding:14px 32px;">
      <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#DC2626;letter-spacing:0.04em;">&#9888;&nbsp; Action required &mdash; payment failed</span>
    </td></tr>`;
    return {
      subject: "Action required: payment failed for your BuildSlides subscription",
      html: baseWrapper(alertStrip, `
        <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">We couldn&rsquo;t process your payment</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;">Hi ${escapeHtml(d.name || "there")}, your payment${price ? ` of <strong style="color:#0F1417;">${escapeHtml(price)}</strong>` : ""} for the ${escapeHtml(planLabel)} plan was declined.</p>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#0F1417;">Please update your payment method to keep your subscription active. If we can&rsquo;t collect payment, your account will revert to the Solo plan.</p>
        ${infoBox(`<p style="margin:0;font-size:14px;line-height:1.6;color:#0F1417;"><strong style="color:#DC2626;">Subscription at risk.</strong> Update your card within 3 days to avoid losing access to share links, team members, and unlimited exports.</p>`, "#DC2626", "#FEF2F2")}
        ${ctaBtn("https://www.buildslides.com/billing", "Update payment method", "#DC2626")}
        <p style="margin:20px 0 0;font-size:13px;color:#6B6B66;">If you need help, reply to this email and we&rsquo;ll sort it out.</p>
      `),
    };
  },

  trial_ending: (d) => {
    const planLabel = d.plan ? d.plan.charAt(0).toUpperCase() + d.plan.slice(1) : "Pro";
    const price = PLAN_PRICES[d.plan] ?? "";
    const daysLeft = d.daysLeft ?? "2";
    const strip = `<tr><td style="background:linear-gradient(135deg,#D94F2A,#D94F2A);padding:14px 32px;">
      <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">Your free trial ends in ${escapeHtml(daysLeft)} day${daysLeft === "1" ? "" : "s"}</span>
    </td></tr>`;
    return {
      subject: `Your BuildSlides trial ends in ${daysLeft} day${daysLeft === "1" ? "" : "s"}`,
      html: baseWrapper(strip, `
        <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">Make the most of BuildSlides</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;">Hi ${escapeHtml(d.name || "there")}, your 7-day free trial of the <strong style="color:#0F1417;">${escapeHtml(planLabel)} plan</strong>${d.trialEnd ? ` ends on <strong style="color:#0F1417;">${escapeHtml(d.trialEnd)}</strong>` : " is ending soon"}.</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#0F1417;">After that, you&rsquo;ll move to the Solo plan unless you add a payment method. No charge until your trial ends &mdash; cancel anytime before then.</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F1EA;border-radius:10px;margin-bottom:28px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#0F1417;letter-spacing:0.04em;text-transform:uppercase;">Keep with ${escapeHtml(planLabel)} plan</p>
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              ${(PLAN_FEATURES[d.plan] ?? PLAN_FEATURES.solo).map(([a, b]) => `<tr>
                <td style="padding:4px 0;font-size:14px;color:#0F1417;width:50%;">&#10003;&nbsp; ${escapeHtml(a)}</td>
                <td style="padding:4px 0;font-size:14px;color:#0F1417;">${b ? `&#10003;&nbsp; ${escapeHtml(b)}` : ""}</td>
              </tr>`).join("")}
            </table>
            ${price ? `<p style="margin:14px 0 0;font-size:14px;color:#6B6B66;border-top:1px solid #C9C5BC;padding-top:12px;"><strong style="color:#0F1417;">${escapeHtml(price)}/month</strong> &mdash; billed monthly, cancel anytime.</p>` : ""}
          </td></tr>
        </table>
        ${ctaBtn("https://www.buildslides.com/billing", `Keep my ${planLabel} plan`)}
        ${d.trialEnd ? `<p style="margin:20px 0 0;font-size:13px;color:#6B6B66;">Not ready? <a href="https://www.buildslides.com/billing" style="color:#D94F2A;text-decoration:none;font-weight:500;">Cancel before ${escapeHtml(d.trialEnd)}</a> and you won&rsquo;t be charged.</p>` : ""}
      `),
    };
  },

  share_link: (d) => ({
    subject: `${escapeHtml(d.senderName || "Someone")} shared a report with you`,
    html: baseWrapper("", `
      <h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:#0F1417;line-height:1.25;">You&rsquo;ve been shared a report</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#0F1417;"><strong style="color:#0F1417;">${escapeHtml(d.senderName || "Someone")}</strong> has shared the <strong style="color:#0F1417;">${escapeHtml(d.projectName || "a project")}</strong> report with you.</p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#0F1417;">View the latest photos, area progress, and daily status updates &mdash; no account required.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F1EA;border-radius:10px;margin-bottom:28px;">
        <tr><td style="padding:20px 24px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
            <td>
              <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0F1417;">${escapeHtml(d.projectName || "Project")}</p>
              <p style="margin:0;font-size:13px;color:#6B6B66;">Shared by ${escapeHtml(d.senderName || "your team")} &middot; View only</p>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <span style="display:inline-block;background:#D94F2A;color:#fff;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">Live</span>
            </td>
          </tr></table>
        </td></tr>
      </table>
      ${ctaBtn(d.shareUrl || "https://www.buildslides.com", "View report")}
      <p style="margin:20px 0 0;font-size:13px;color:#6B6B66;">This link was shared with you directly. You don&rsquo;t need an account to view it.</p>
    `),
  }),
};

// ── Send ─────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, template: string, data: TemplateData) {
  const tpl = TEMPLATES[template];
  if (!tpl) throw new Error(`Unknown template: ${template}`);
  const { subject, html } = tpl(data);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "BuildSlides <onboarding@resend.dev>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

// ── Template access control ──────────────────────────────────────────────────
//
// INTERNAL_SECRET callers (stripe-webhook, other edge functions): all templates.
// Authenticated user JWT callers: only the allowlisted templates below.
//   - "welcome"    : sent on own signup — no extra checks needed.
//   - "share_link" : must supply share_link_token; caller must own the project
//                   that token belongs to.
// All billing templates (upgrade, cancelled, payment_failed, trial_ending) are
// internal-only to prevent authenticated users from sending phishing emails.

const USER_JWT_ALLOWED_TEMPLATES = new Set(["welcome", "share_link"]);

// For share_link template: verify the caller owns the project the token belongs to.
async function callerOwnsShareLinkProject(
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  shareLinkToken: string,
): Promise<boolean> {
  const { data: link } = await supabase
    .from("share_links")
    .select("project_id")
    .eq("token", shareLinkToken)
    .maybeSingle();
  if (!link?.project_id) return false;
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", link.project_id)
    .eq("user_id", callerId)
    .maybeSingle();
  return ["owner", "editor"].includes(membership?.role ?? "");
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const internal = isInternalCall(req);
  let callerId: string | null = null;

  if (!internal) {
    callerId = await getCallerUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const { to, template, data } = await req.json();
    if (!to || !template) {
      return new Response(JSON.stringify({ error: "to and template required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // JWT callers: enforce template allowlist and additional per-template checks.
    if (!internal) {
      if (!USER_JWT_ALLOWED_TEMPLATES.has(template)) {
        console.error(JSON.stringify({ fn: "send-transactional-email", error: "forbidden_template", template, caller: callerId }));
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // share_link: caller must own/edit the project the share token belongs to.
      if (template === "share_link") {
        const shareLinkToken = (data as Record<string, string>)?.shareLinkToken;
        if (!shareLinkToken) {
          return new Response(JSON.stringify({ error: "shareLinkToken required for share_link template" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const allowed = await callerOwnsShareLinkProject(service, callerId!, shareLinkToken);
        if (!allowed) {
          console.error(JSON.stringify({ fn: "send-transactional-email", error: "forbidden_share_link", caller: callerId }));
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const result = await sendEmail(to, template, data ?? {});
    console.log(JSON.stringify({ fn: "send-transactional-email", template, to, id: result?.id }));
    return new Response(JSON.stringify({ ok: true, id: result?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify({ fn: "send-transactional-email", error: (e as Error).message }));
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
