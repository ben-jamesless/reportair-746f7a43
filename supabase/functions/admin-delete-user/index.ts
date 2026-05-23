import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const fallback = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
  const allow =
    /^https:\/\/([a-z0-9-]+\.)*buildslides\.com$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin)
      ? origin
      : fallback;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData } = await userClient.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is platform_admin
    const { data: isAdmin, error: adminErr } = await service.rpc("has_role", {
      _user_id: callerId,
      _role: "platform_admin",
    });
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.user_id as string | undefined;
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (targetUserId === callerId) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Clean up RESTRICT foreign keys to auth.users before deletion.
    // 1. Delete all projects created by this user (cascade related data via delete_project RPC).
    const { data: ownedProjects, error: projListErr } = await service
      .from("projects").select("id").eq("created_by", targetUserId);
    if (projListErr) {
      return new Response(JSON.stringify({ error: `List projects: ${projListErr.message}` }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    for (const p of ownedProjects ?? []) {
      // delete_project requires owner auth; do raw deletes via service role instead
      const tables = [
        "notifications","comments","guest_notes","area_day_status","area_day_notes",
        "day_notes","photos","areas","albums","share_links","project_invites",
        "project_exports","activity_events","project_members",
      ];
      for (const t of tables) {
        await service.from(t).delete().eq("project_id", p.id);
      }
      await service.from("projects").delete().eq("id", p.id);
    }

    // 2. Delete all teams created by this user (and their remaining projects/members).
    const { data: ownedTeams, error: teamListErr } = await service
      .from("teams").select("id").eq("created_by", targetUserId);
    if (teamListErr) {
      return new Response(JSON.stringify({ error: `List teams: ${teamListErr.message}` }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    for (const t of ownedTeams ?? []) {
      // Call via userClient so auth.uid() inside is_platform_admin() resolves to the caller.
      const { error: delTeamErr } = await userClient.rpc("admin_delete_team", { _team_id: t.id });
      if (delTeamErr) {
        return new Response(JSON.stringify({ error: `Delete team: ${delTeamErr.message}` }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Profile (cascades user_roles, team_members via auth.users delete, but profile FK is CASCADE too).
    await service.from("profiles").delete().eq("id", targetUserId);

    // 4. Delete auth user (cascades user_roles, team_members, profiles, sessions, etc.)
    const { error: authErr } = await service.auth.admin.deleteUser(targetUserId);
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
