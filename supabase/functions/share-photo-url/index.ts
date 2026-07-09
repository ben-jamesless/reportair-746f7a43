// Public edge function: returns a signed URL for a photo if the share token is valid.
// Optional `variant` selects a Supabase image transform preset so grids/lightboxes
// download appropriately-sized bytes instead of the full-resolution original.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Variant = "thumb" | "lightbox" | "original";
const TRANSFORMS: Record<Exclude<Variant, "original">, { width?: number; height?: number; resize?: "cover" | "contain" | "fill"; quality?: number }> = {
  thumb: { width: 600, height: 600, resize: "cover", quality: 75 },
  lightbox: { width: 2400, resize: "contain", quality: 82 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { token, photo_id } = body ?? {};
    const variant: Variant = (body?.variant === "lightbox" || body?.variant === "original") ? body.variant : "thumb";
    if (!token || !photo_id) {
      return new Response(JSON.stringify({ error: "missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: path, error } = await supabase.rpc("get_share_photo_url", { _token: token, _photo_id: photo_id });
    if (error || !path) {
      return new Response(JSON.stringify({ error: "invalid" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const signOpts = variant === "original" ? undefined : { transform: TRANSFORMS[variant] };
    const { data: signed, error: signErr } = await supabase.storage
      .from("photos")
      .createSignedUrl(path as string, 60 * 60, signOpts);
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: signErr?.message ?? "sign failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
