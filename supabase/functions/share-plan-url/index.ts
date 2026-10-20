// Public: returns a short-lived signed URL for a plan file shared on a client link.
// The database checks token scope, expiry, revocation, client visibility and current revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { token, plan_file_id } = body ?? {};
    const preview = body?.preview === true;
    const download = body?.download === true;
    if (typeof token !== "string" || !UUID.test(token) || typeof plan_file_id !== "string" || !UUID.test(plan_file_id)) {
      return json({ error: "invalid params" }, 400);
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: path, error } = await supabase.rpc("get_share_plan_path", {
      _token: token, _plan_file_id: plan_file_id, _preview: preview,
    });
    if (error || !path) return json({ error: "not available" }, 403);
    const { data: signed, error: sErr } = await supabase.storage
      .from("plan-files")
      .createSignedUrl(path as string, 300, download ? { download: true } : undefined);
    if (sErr || !signed) return json({ error: "sign failed" }, 500);
    return json({ url: signed.signedUrl });
  } catch (_e) {
    return json({ error: "server error" }, 500);
  }
});
