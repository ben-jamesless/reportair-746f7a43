import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const PRICE_TO_PLAN: Record<string, string> = {
  "price_0TWVf21c550c7HdPB7reS14B": "pro",
  "price_0TWVfw1c550c7HdPixmHoZxm": "team",
  "price_0TWVh21c550c7HdP3C2WQVnm": "enterprise",
};

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

    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId = sub.items.data[0]?.price?.id;
    const plan    = PRICE_TO_PLAN[priceId] ?? "pro";

    await service.from("teams").update({
      plan,
      stripe_subscription_id: sub.id,
      subscription_status:    sub.status,
      billing_interval:       sub.items.data[0]?.price?.recurring?.interval ?? null,
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    }).eq("id", teamId);
  }

  else if (event.type === "customer.subscription.updated") {
    const sub    = event.data.object as Stripe.Subscription;
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    const priceId = sub.items.data[0]?.price?.id;
    const plan    = PRICE_TO_PLAN[priceId] ?? "pro";

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

    await service.from("teams").update({
      plan:                 "free",
      subscription_status:  "canceled",
      stripe_subscription_id: null,
      current_period_end:   null,
      trial_ends_at:        null,
    }).eq("id", teamId);
  }

  else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId   = invoice.subscription as string | null;
    if (!subId) return new Response("ok");

    const sub    = await stripe.subscriptions.retrieve(subId);
    const teamId = sub.metadata?.supabase_team_id;
    if (!teamId) return new Response("ok");

    await service.from("teams").update({
      subscription_status: "past_due",
    }).eq("id", teamId);
  }

  return new Response("ok");
});
