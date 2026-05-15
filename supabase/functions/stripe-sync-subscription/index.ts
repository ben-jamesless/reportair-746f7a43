import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Price → Plan mapping. All 6 price IDs (monthly + annual per tier) map here
// from Edge Function secrets — same source of truth as stripe-checkout & stripe-webhook.
function buildPriceToPlan(): Record<string, string> {
  const map: Record<string, string> = {};
  const pairs: Array<[string, string]> = [
    ["STRIPE_PRICE_SOLO_MONTHLY",   "solo"],
    ["STRIPE_PRICE_SOLO_ANNUAL",    "solo"],
    ["STRIPE_PRICE_PRO_MONTHLY",    "pro"],
    ["STRIPE_PRICE_PRO_ANNUAL",     "pro"],
    ["STRIPE_PRICE_STUDIO_MONTHLY", "studio"],
    ["STRIPE_PRICE_STUDIO_ANNUAL",  "studio"],
  ];
  for (const [envKey, plan] of pairs) {
    const id = Deno.env.get(envKey);
    if (id) map[id] = plan;
  }
  return map;
}
const PRICE_TO_PLAN = buildPriceToPlan();

const BILLING_STATUSES = new Set(["active", "trialing", "past_due"]);

interface StripeSubscriptionSummary {
  id: string;
  status: string;
  created?: number;
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        recurring?: { interval?: string | null } | null;
      } | null;
    }>;
  };
}

async function getCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user } } = await anon.auth.getUser(token);
  return user?.id ?? null;
}

async function stripeGet(path: string, params: Record<string, string>) {
  const key = Deno.env.get("STRIPE_SECRET_KEY")!;
  const url = new URL(`https://api.stripe.com/v1${path}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.append(name, value));

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${btoa(`${key}:`)}` },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? "Stripe request failed");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: team, error: teamError } = await service
    .from("teams")
    .select("id, stripe_customer_id")
    .eq("billing_owner_user_id", callerId)
    .maybeSingle();

  if (teamError || !team) {
    return new Response(JSON.stringify({ updated: false, reason: "no_team" }), {
      status: teamError ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Look up caller email for customer fallback search
  const { data: profile } = await service
    .from("profiles")
    .select("email")
    .eq("id", callerId)
    .maybeSingle();
  const callerEmail = profile?.email ?? null;

  async function findSubscriptionsForCustomer(customerId: string) {
    return await stripeGet("/subscriptions", {
      customer: customerId,
      status: "all",
      limit: "20",
    });
  }

  try {
    let customerId = team.stripe_customer_id as string | null;
    let subscriptions: any = null;

    if (customerId) {
      try {
        subscriptions = await findSubscriptionsForCustomer(customerId);
      } catch (err) {
        const msg = String(err);
        if (/No such customer/i.test(msg)) {
          console.log(JSON.stringify({ fn: "stripe-sync-subscription", info: "stale_customer", customerId }));
          customerId = null;
        } else {
          throw err;
        }
      }
    }

    // Fallback: find a customer in current Stripe mode by email
    if (!customerId && callerEmail) {
      const customers = await stripeGet("/customers", { email: callerEmail, limit: "10" });
      const match = (customers.data ?? [])[0];
      if (match?.id) {
        customerId = match.id;
        await service.from("teams").update({ stripe_customer_id: customerId }).eq("id", team.id);
        subscriptions = await findSubscriptionsForCustomer(customerId);
      }
    }

    if (!customerId || !subscriptions) {
      return new Response(JSON.stringify({ updated: false, reason: "no_billing_customer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription = ((subscriptions.data ?? []) as StripeSubscriptionSummary[])
      .filter((sub) => BILLING_STATUSES.has(sub.status))
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];

    if (!subscription) {
      return new Response(JSON.stringify({ updated: false, reason: "no_active_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const item = subscription.items?.data?.[0];
    const priceId = item?.price?.id;
    const plan = PRICE_TO_PLAN[priceId];

    if (!plan) {
      console.error(JSON.stringify({ fn: "stripe-sync-subscription", error: "unknown_price", priceId }));
      return new Response(JSON.stringify({ updated: false, reason: "unknown_price" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await service.from("teams").update({
      plan,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      billing_interval: item?.price?.recurring?.interval ?? null,
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    }).eq("id", team.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ updated: true, plan, status: subscription.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(JSON.stringify({ fn: "stripe-sync-subscription", error: String(error) }));
    return new Response(JSON.stringify({ error: "Could not sync subscription" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});