// Public edge function: returns a signed URL for the project logo if the share token is valid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: path, error } = await supabase.rpc("get_share_logo_path", { _token: token });
    if (error) {
      return new Response(JSON.stringify({ error: "invalid" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!path) {
      return new Response(JSON.stringify({ url: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: signed, error: signErr } = await supabase.storage.from("export-assets").createSignedUrl(path as string, 60 * 60);
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: signErr?.message ?? "sign failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
