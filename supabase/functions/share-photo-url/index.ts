// Public edge function: returns a signed URL for a photo if the share token is valid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, photo_id } = await req.json();
    if (!token || !photo_id) {
      return new Response(JSON.stringify({ error: "missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Validate via RPC (returns storage_path or null)
    const { data: path, error } = await supabase.rpc("get_share_photo_url", { _token: token, _photo_id: photo_id });
    if (error || !path) {
      return new Response(JSON.stringify({ error: "invalid" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: signed, error: signErr } = await supabase.storage.from("photos").createSignedUrl(path as string, 60 * 60);
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: signErr?.message ?? "sign failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
