import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_TO_PLAN: Record<string, string> = {
  "price_0TWWkf1c550c7HdPqtOvUZJC": "pro",
  "price_0TWWko1c550c7HdPLsR4Dqy8": "team",
  "price_0TWWl01c550c7HdPy7nsH4qG": "enterprise",
};

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

  if (teamError || !team?.stripe_customer_id) {
    return new Response(JSON.stringify({ updated: false, reason: "no_billing_customer" }), {
      status: teamError ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const subscriptions = await stripeGet("/subscriptions", {
      customer: team.stripe_customer_id,
      status: "all",
      limit: "20",
    });

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