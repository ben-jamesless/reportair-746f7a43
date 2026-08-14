// Public endpoint for posting client feedback on a share link.
//
// This is the ONLY guest write path for report comments — the old
// add_guest_note_project_public RPC has had its grants revoked. Everything the
// anti-spam brief asks for is enforced here, server-side:
//   - honeypot field must be empty
//   - name + email required, email shape validated
//   - 1,000 character cap on the body
//   - 3 posts per hour per IP (hashed, never stored raw)
// It also sends the Resend notifications: event owner on a new root comment,
// thread participants on a reply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY = 1000;
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("INTERNAL_SECRET") ?? "buildfolder-share-comment";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function anchorLabel(areaName: string | null, day: string | null, hasPhoto: boolean): string {
  const parts: string[] = [];
  if (areaName) parts.push(areaName);
  if (day) {
    const d = new Date(`${day}T00:00:00Z`);
    parts.push(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }));
  }
  if (hasPhoto && parts.length === 0) parts.push("a photo");
  return parts.join(" · ");
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping notification");
    return;
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "BuildFolder <onboarding@resend.dev>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!resp.ok) console.error(`Resend ${resp.status}: ${await resp.text()}`);
}

function notificationHtml(opts: {
  heading: string;
  projectName: string;
  authorName: string;
  anchor: string;
  body: string;
  link: string;
}) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#0F1417;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #C9C5BC;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#6B6B66;">${escapeHtml(opts.projectName)}</p>
        <h1 style="margin:0 0 16px;font-size:21px;font-weight:800;line-height:1.3;">${escapeHtml(opts.heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 28px 20px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F1EA;border-left:4px solid #D94F2A;border-radius:8px;"><tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;">${escapeHtml(opts.authorName)}</p>
          ${opts.anchor ? `<p style="margin:0 0 10px;font-size:12px;color:#6B6B66;">on ${escapeHtml(opts.anchor)}</p>` : ""}
          <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(opts.body)}</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:0 28px 30px;">
        <a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#D94F2A;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">View the thread &rarr;</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const honeypot = typeof payload.website === "string" ? payload.website.trim() : "";
  const parentId = typeof payload.parent_id === "string" && payload.parent_id ? payload.parent_id : null;
  const areaId = typeof payload.area_id === "string" && payload.area_id ? payload.area_id : null;
  const photoId = typeof payload.photo_id === "string" && payload.photo_id ? payload.photo_id : null;
  const day = typeof payload.day === "string" && payload.day ? payload.day : null;

  // Honeypot: a real person never fills this in. Return 200 so bots learn nothing.
  if (honeypot) return json({ ok: true });

  if (!token) return json({ error: "Missing share link" }, 400);
  if (!name) return json({ error: "Please add your name." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Please add a valid email address." }, 400);
  if (!body) return json({ error: "Please write a comment." }, 400);
  if (body.length > MAX_BODY) return json({ error: `Comments must be ${MAX_BODY} characters or fewer.` }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate the share link.
  const { data: link } = await supabase
    .from("share_links")
    .select("id, project_id, revoked_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return json({ error: "This share link is no longer active." }, 403);
  }

  // Filed events are read-only.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, finalised_at")
    .eq("id", link.project_id)
    .maybeSingle();

  if (!project) return json({ error: "Event not found." }, 404);
  if (project.finalised_at) {
    return json({ error: "This event has been filed — feedback is now read-only." }, 403);
  }

  // Rate limit: 3 posts per hour per IP.
  const ipHash = await hashIp(clientIp(req));
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("share_comment_throttle")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_LIMIT) {
    return json({ error: "You've reached the comment limit for this hour. Please try again later." }, 429);
  }

  // Resolve the parent, and inherit its anchor so replies stay in context.
  let parent: { id: string; parent_id: string | null; area_id: string | null; photo_id: string | null; day: string | null } | null = null;
  if (parentId) {
    const { data } = await supabase
      .from("guest_notes")
      .select("id, parent_id, area_id, photo_id, day")
      .eq("id", parentId)
      .eq("project_id", link.project_id)
      .maybeSingle();
    if (!data) return json({ error: "That thread no longer exists." }, 404);
    if (data.parent_id) return json({ error: "Replies cannot be nested more than one level deep." }, 400);
    parent = data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("guest_notes")
    .insert({
      share_link_id: link.id,
      project_id: link.project_id,
      parent_id: parent?.id ?? null,
      area_id: parent ? parent.area_id : areaId,
      photo_id: parent ? parent.photo_id : photoId,
      day: parent ? parent.day : day,
      guest_name: name,
      guest_email: email,
      author_email: email,
      body,
      is_ops: false,
    })
    .select("id, area_id, photo_id, day")
    .single();

  if (insertError || !inserted) {
    console.error("guest_notes insert failed:", insertError);
    return json({ error: insertError?.message ?? "Could not save your comment." }, 400);
  }

  await supabase.from("share_comment_throttle").insert({ ip_hash: ipHash, share_link_id: link.id });

  // ── Notifications ──────────────────────────────────────────────────────────
  try {
    const origin = req.headers.get("origin") || "https://buildfolder.com";
    const rootId = parent?.id ?? inserted.id;
    const deepLink = `${origin}/s/${token}#comment-${rootId}`;

    let areaName: string | null = null;
    if (inserted.area_id) {
      const { data: area } = await supabase
        .from("areas")
        .select("name")
        .eq("id", inserted.area_id)
        .maybeSingle();
      areaName = area?.name ?? null;
    }
    const anchor = anchorLabel(areaName, inserted.day as string | null, !!inserted.photo_id);

    const recipients = new Set<string>();

    if (parent) {
      // Reply → everyone already in this thread.
      const { data: participants } = await supabase
        .from("guest_notes")
        .select("author_email")
        .or(`id.eq.${parent.id},parent_id.eq.${parent.id}`);
      for (const p of participants ?? []) {
        if (p.author_email) recipients.add(p.author_email);
      }
    } else {
      // New root → the event owner.
      const { data: owners } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", link.project_id)
        .eq("role", "owner");
      const ownerIds = (owners ?? []).map((o) => o.user_id);
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("email").in("id", ownerIds);
        for (const p of profiles ?? []) if (p.email) recipients.add(p.email);
      }
    }

    recipients.delete(email);

    const heading = parent
      ? `${name} replied to a comment`
      : `${name} left a comment on your report`;
    const html = notificationHtml({
      heading,
      projectName: project.name ?? "Event",
      authorName: name,
      anchor,
      body,
      link: deepLink,
    });
    const subject = anchor
      ? `${heading} — ${anchor}`
      : heading;

    await Promise.all(
      Array.from(recipients)
        .filter((to) => EMAIL_RE.test(to) && !to.endsWith(".invalid"))
        .map((to) => sendEmail(to, subject, html)),
    );
  } catch (e) {
    // Never fail the post because a notification could not be delivered.
    console.error("comment notification failed:", e);
  }

  return json({ ok: true, id: inserted.id });
});
