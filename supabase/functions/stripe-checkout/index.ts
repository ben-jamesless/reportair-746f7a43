import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const fallback = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
  const allow =
    /^https:\/\/([a-z0-9-]+\.)*buildslides\.com$/i.test(origin) ||
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

// ── Price IDs ─────────────────────────────────────────────────────────────────
// Set these environment variables in Supabase Dashboard → Edge Functions → Secrets
// STRIPE_PRICE_SOLO_MONTHLY, STRIPE_PRICE_SOLO_ANNUAL
// STRIPE_PRICE_PRO_MONTHLY,  STRIPE_PRICE_PRO_ANNUAL
// STRIPE_PRICE_STUDIO_MONTHLY, STRIPE_PRICE_STUDIO_ANNUAL
const PRICE_IDS: Record<string, string> = {
  solo:          Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY")   ?? "",
  solo_annual:   Deno.env.get("STRIPE_PRICE_SOLO_ANNUAL")    ?? "",
  pro:           Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")    ?? "",
  pro_annual:    Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")     ?? "",
  studio:        Deno.env.get("STRIPE_PRICE_STUDIO_MONTHLY") ?? "",
  studio_annual: Deno.env.get("STRIPE_PRICE_STUDIO_ANNUAL")  ?? "",
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
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const callerId = await getCallerUserId(req);
  if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...cors, "Content-Type": "application/json" },
  });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // plan: "solo" | "pro" | "studio"
  // interval: "monthly" (default) | "annual"
  const { plan, interval = "monthly", success_url, cancel_url } = await req.json();
  const priceKey = interval === "annual" ? `${plan}_annual` : plan;
  const priceId  = PRICE_IDS[priceKey];
  if (!priceId) return new Response(JSON.stringify({ error: "Invalid plan or interval" }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });

  const { data: team } = await service
    .from("teams")
    .select("id, name, stripe_customer_id")
    .eq("billing_owner_user_id", callerId)
    .maybeSingle();

  if (!team) return new Response(JSON.stringify({ error: "No billing team found" }), {
    status: 403, headers: { ...cors, "Content-Type": "application/json" },
  });

  const { data: { user } } = await service.auth.admin.getUserById(callerId);
  const email = user?.email ?? undefined;

  let customerId = team.stripe_customer_id;
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if ((existing as any).deleted) customerId = null;
    } catch (err: any) {
      if (err?.code === "resource_missing") {
        console.log(JSON.stringify({ fn: "stripe-checkout", info: "customer_not_in_current_mode", customerId }));
        customerId = null;
      } else {
        throw err;
      }
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: team.name,
      metadata: { supabase_team_id: team.id },
    });
    customerId = customer.id;
    await service.from("teams").update({ stripe_customer_id: customerId }).eq("id", team.id);
  }

  const rawAppUrl =
    Deno.env.get("APP_URL") ||
    req.headers.get("origin") ||
    req.headers.get("referer")?.replace(/\/$/, "") ||
    "https://www.buildslides.com";
  const appUrl = rawAppUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
  const baseOrigin = /^https?:\/\//i.test(appUrl)
    ? appUrl.split("/").slice(0, 3).join("/")
    : "https://www.buildslides.com";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_team_id: team.id },
    },
    success_url: success_url ?? `${baseOrigin}/billing?checkout=success`,
    cancel_url:  cancel_url  ?? `${baseOrigin}/billing?checkout=cancelled`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
