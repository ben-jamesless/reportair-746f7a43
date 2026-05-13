import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });

const PRICE_IDS: Record<string, string> = {
  pro:        "price_0TWVf21c550c7HdPB7reS14B",
  team:       "price_0TWVfw1c550c7HdPixmHoZxm",
  enterprise: "price_0TWVh21c550c7HdP3C2WQVnm",
};

async function getCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user } } = await anon.auth.getUser(token);
  return user?.id ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const callerId = await getCallerUserId(req);
  if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { plan, success_url, cancel_url } = await req.json();
  const priceId = PRICE_IDS[plan];
  if (!priceId) return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: team } = await service
    .from("teams")
    .select("id, name, stripe_customer_id")
    .eq("billing_owner_user_id", callerId)
    .maybeSingle();

  if (!team) return new Response(JSON.stringify({ error: "No billing team found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: { user } } = await service.auth.admin.getUserById(callerId);
  const email = user?.email ?? undefined;

  let customerId = team.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: team.name,
      metadata: { supabase_team_id: team.id },
    });
    customerId = customer.id;
    await service.from("teams").update({ stripe_customer_id: customerId }).eq("id", team.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { supabase_team_id: team.id },
    },
    success_url: success_url ?? `${Deno.env.get("APP_URL")}/billing?checkout=success`,
    cancel_url:  cancel_url  ?? `${Deno.env.get("APP_URL")}/billing?checkout=cancelled`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
