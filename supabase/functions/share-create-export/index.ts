// Public endpoint: create a portrait PDF export for a project via share-link token.
// Validates the token, inserts a project_exports row using the link owner as
// created_by, and fires the generate-pdf worker with the share token so it can
// re-authorise without a user JWT.
//
// Request body:
//   { token, mode: "single" | "range", day_key?, day_label?, date_from?, date_to? }
// Response:
//   { export_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const token: string | undefined = body?.token;
    const mode: "single" | "range" = body?.mode === "range" ? "range" : "single";
    const day_key: string | null = typeof body?.day_key === "string" ? body.day_key : null;
    const day_label: string | null = typeof body?.day_label === "string" ? body.day_label : null;
    const date_from: string | null = typeof body?.date_from === "string" ? body.date_from : null;
    const date_to: string | null = typeof body?.date_to === "string" ? body.date_to : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate share link
    const { data: link } = await supabase.from("share_links")
      .select("project_id, revoked_at, expires_at, created_by")
      .eq("token", token).maybeSingle();
    if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at as string) <= new Date())) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = link.project_id as string;

    // created_by is NOT NULL. Use the share link's creator, falling back to a
    // project owner so the row inserts cleanly even if the link author was removed.
    let createdBy: string | null = (link.created_by as string | null) ?? null;
    if (!createdBy) {
      const { data: owner } = await supabase.from("project_members")
        .select("user_id").eq("project_id", projectId).eq("role", "owner").maybeSingle();
      createdBy = (owner?.user_id as string | null) ?? null;
    }
    if (!createdBy) {
      return new Response(JSON.stringify({ error: "no owner available" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Project brand colour for accent
    const { data: proj } = await supabase.from("projects").select("color").eq("id", projectId).maybeSingle();
    const accent = (proj?.color as string | undefined) ?? "#D94F2A";

    // Build options — portrait layout only.
    const options: Record<string, unknown> = {
      sections: { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false },
      orientation: "portrait",
      quality: "compressed",
      template: "portrait_v1",
      source: "share",
    };
    if (mode === "range" && date_from && date_to) {
      const lo = date_from <= date_to ? date_from : date_to;
      const hi = date_from <= date_to ? date_to : date_from;
      options.date_from = lo;
      options.date_to = hi;
    } else {
      options.day_key = day_key;
      options.day_label = day_label;
    }

    const { data: row, error } = await supabase.from("project_exports").insert({
      project_id: projectId,
      created_by: createdBy,
      status: "queued",
      options,
      logo_path: null,
      accent_color: accent,
    }).select("id").single();

    if (error || !row) {
      return new Response(JSON.stringify({ error: error?.message ?? "insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget the generator with the share token so it bypasses JWT auth.
    supabase.functions.invoke("generate-pdf", {
      body: { export_id: row.id, share_token: token },
    }).catch((e) => console.error("invoke generate-pdf failed", e));

    return new Response(JSON.stringify({ export_id: row.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
