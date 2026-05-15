import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

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

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });

async function getCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user } } = await anon.auth.getUser(token);
  return user?.id ?? null;
}

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const callerId = await getCallerUserId(req);
  if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: team } = await service
    .from("teams")
    .select("id, stripe_customer_id")
    .eq("billing_owner_user_id", callerId)
    .maybeSingle();

  if (!team?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "No Stripe customer found. Please subscribe first." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { return_url } = await req.json().catch(() => ({}));

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: team.stripe_customer_id,
    return_url: return_url ?? `${Deno.env.get("APP_URL")}/billing`,
  });

  return new Response(JSON.stringify({ url: portalSession.url }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
