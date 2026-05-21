// Public endpoint: returns either
//  - a short-lived signed download URL for the latest ready PDF export of the
//    share-link's project (when called with just { token }), or
//  - the status (+ signed URL when ready) for a specific export id created via
//    share-create-export (when called with { token, export_id }).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, export_id } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const signPath = async (path: string) => {
      const filename = String(path).split("/").pop() || "site-story.pdf";
      const { data: signed, error } = await supabase.storage
        .from("exports")
        .createSignedUrl(path, 60 * 60, { download: filename });
      if (error || !signed?.signedUrl) return null;
      return signed.signedUrl;
    };

    // Per-export status path
    if (export_id && typeof export_id === "string") {
      // Validate token + project match
      const { data: link } = await supabase.from("share_links")
        .select("project_id, revoked_at, expires_at")
        .eq("token", token).maybeSingle();
      if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at as string) <= new Date())) {
        return new Response(JSON.stringify({ error: "invalid token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: exp } = await supabase.from("project_exports")
        .select("status, output_path, error_message, project_id")
        .eq("id", export_id).maybeSingle();
      if (!exp || exp.project_id !== link.project_id) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let url: string | null = null;
      if (exp.status === "ready" && exp.output_path) {
        url = await signPath(exp.output_path as string);
      }
      return new Response(JSON.stringify({
        status: exp.status,
        url,
        error_message: exp.error_message ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Legacy: latest ready export for the token's project
    const { data: path, error } = await supabase.rpc("get_share_export_url", { _token: token });
    if (error || !path) {
      return new Response(JSON.stringify({ error: "no export available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = await signPath(path as string);
    if (!url) {
      return new Response(JSON.stringify({ error: "could not sign url" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
