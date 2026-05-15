import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// ── Price → Plan mapping ────────────────────────────────────────────────────
// All 6 price IDs (monthly + annual per tier) resolve to the plan name.
// Add your real Stripe price IDs to Supabase Edge Function secrets and they'll
// be picked up automatically here.
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

async function sendTransactionalEmail(payload: { to: string; template: string; data: Record<string, string> }) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_SECRET")!,
    },
    body: JSON.stringify(payload),
  }).catch(e => console.error(JSON.stringify({ fn: "stripe-webhook", error: "email dispatch failed", detail: String(e) })));
}

async function getBillingOwner(service: ReturnType<typeof createClient>, teamId: string): Promise<{ email: string; name: string } | null> {
  const { data: team } = await service.from("teams").select("billing_owner_user_id").eq("id", teamId).maybeSingle();
  if (!team?.billing_owner_user_id) return null;
  const { data: { user } } = await service.auth.admin.getUserById(team.billing_owner_user_id);
  if (!user?.email) return null;
  return {
    email: user.email,
    name: (user.user_metadata?.full_name as string) ?? user.email.split("@")[0],
  };
}

function fmtDate(unix: number | null | undefined): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString("en-HK", { day: "numeric", month: "long", year: "numeric" });
}

serve(async (req) => {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error(JSON.stringify({ fn: "stripe-webhook", error: "signature_invalid", detail: String(err) }));
    return new Response("Invalid signature", { status: 400 });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log(JSON.stringify({ fn: "stripe-webhook", event: event.type, id: event.id }));

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return new Response("ok");

    const sub    = await stripe.subscriptions.retrieve(session.subscription as string);
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId = sub.items.data[0]?.price?.id;
    const plan    = PRICE_TO_PLAN[priceId ?? ""] ?? "solo";

    await service.from("teams").update({
      plan,
      stripe_subscription_id: sub.id,
      subscription_status:    sub.status,
      billing_interval:       sub.items.data[0]?.price?.recurring?.interval ?? null,
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    }).eq("id", teamId);

    const owner = await getBillingOwner(service, teamId);
    if (owner) {
      await sendTransactionalEmail({
        to: owner.email,
        template: "upgrade",
        data: { name: owner.name, plan, renewalDate: fmtDate(sub.current_period_end) },
      });
    }
  }

  else if (event.type === "customer.subscription.updated") {
    const sub    = event.data.object as Stripe.Subscription;
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId = sub.items.data[0]?.price?.id;
    const plan    = PRICE_TO_PLAN[priceId ?? ""] ?? "solo";

    await service.from("teams").update({
      plan,
      subscription_status:  sub.status,
      billing_interval:     sub.items.data[0]?.price?.recurring?.interval ?? null,
      current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at:        sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    }).eq("id", teamId);
  }

  else if (event.type === "customer.subscription.deleted") {
    const sub    = event.data.object as Stripe.Subscription;
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId  = sub.items.data[0]?.price?.id;
    const oldPlan  = PRICE_TO_PLAN[priceId ?? ""] ?? "solo";
    const endDate  = fmtDate(sub.current_period_end);

    // Cancel → downgrade to solo (no free plan)
    await service.from("teams").update({
      plan:                   "solo",
      stripe_subscription_id: null,
      subscription_status:    "canceled",
      billing_interval:       null,
      current_period_end:     null,
      trial_ends_at:          null,
    }).eq("id", teamId);

    const owner = await getBillingOwner(service, teamId);
    if (owner) {
      await sendTransactionalEmail({
        to: owner.email,
        template: "cancelled",
        data: { name: owner.name, plan: oldPlan, endDate },
      });
    }
  }

  else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId   = invoice.subscription as string | null;
    if (!subId) return new Response("ok");

    const sub    = await stripe.subscriptions.retrieve(subId);
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    await service.from("teams").update({ subscription_status: "past_due" }).eq("id", teamId);

    const owner = await getBillingOwner(service, teamId);
    if (owner) {
      await sendTransactionalEmail({
        to: owner.email,
        template: "payment_failed",
        data: { name: owner.name, plan: PRICE_TO_PLAN[sub.items.data[0]?.price?.id ?? ""] ?? "" },
      });
    }
  }

  else if (event.type === "customer.subscription.trial_will_end") {
    const sub    = event.data.object as Stripe.Subscription;
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId  = sub.items.data[0]?.price?.id;
    const plan     = PRICE_TO_PLAN[priceId ?? ""] ?? "solo";
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const daysLeft = trialEnd
      ? Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 2;

    const owner = await getBillingOwner(service, teamId);
    if (owner && trialEnd) {
      await sendTransactionalEmail({
        to: owner.email,
        template: "trial_ending",
        data: {
          name:     owner.name,
          plan,
          daysLeft: String(daysLeft),
          trialEnd: trialEnd.toLocaleDateString("en-HK", { day: "numeric", month: "long", year: "numeric" }),
        },
      });
    }
  }

  return new Response("ok");
});
