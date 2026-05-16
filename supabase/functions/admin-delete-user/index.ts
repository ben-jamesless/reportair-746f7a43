import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const fallback = Deno.env.get("APP_URL") ?? "https://reportair.co";
  const allow =
    /^https:\/\/([a-z0-9-]+\.)*reportair\.co$/i.test(origin) ||
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

    // Delete from profiles first (RLS bypassed via service role)
    const { error: profileErr } = await service.from("profiles").delete().eq("id", targetUserId);
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Delete auth user
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
