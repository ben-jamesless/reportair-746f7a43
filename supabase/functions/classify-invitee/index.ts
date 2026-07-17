// Classify an invitee against a team's domain-matching rules.
// This function is a *thin wrapper* around the SQL function
// `public.classify_invitee(_team_id, _email)`. The SQL function is the single
// source of truth — the trigger `enforce_team_member_caps` on `team_members`
// calls the same function on write. Do not re-implement the logic here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  // Verify caller is authenticated.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify caller is a member of the team they're classifying against.
  // (Prevents domain enumeration via arbitrary team ids.) RLS on
  // team_members already scopes this select to the caller.
  const { data: membership } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", parsed.data.team_id)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!membership) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.rpc("classify_invitee", {
    _team_id: parsed.data.team_id,
    _email: parsed.data.email.toLowerCase(),
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ classification: data as "core" | "external" | "requires_explicit_choice" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
