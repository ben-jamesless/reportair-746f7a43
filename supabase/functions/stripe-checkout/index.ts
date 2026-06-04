import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

class StripeRequestError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const fallback = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
  const allow =
    /^https:\/\/([a-z0-9-]+\.)*buildfolder\.com$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin)
      ? origin
      : fallback;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function stripeMode(secretKey: string) {
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

function safeSuffix(value: string) {
  return value ? value.slice(-6) : "missing";
}

function checkoutConfigError(err: unknown, priceEnvName?: string, secretKey?: string, interval?: string) {
  const message = err instanceof Error ? err.message : String(err);
  const mode = secretKey ? stripeMode(secretKey) : "unknown";
  if (/similar object exists in (live|test) mode/i.test(message) || /No such price/i.test(message)) {
    return priceEnvName
      ? `Stripe configuration mismatch: checkout is using ${interval ?? "selected"} billing and STRIPE_SECRET_KEY is ${mode} mode, but ${priceEnvName} points to a price from the other mode. Update ${priceEnvName} to a ${mode}-mode Stripe price ID.`
      : `Stripe configuration mismatch: STRIPE_SECRET_KEY is ${mode} mode, but the selected price belongs to the other mode.`;
  }
  return message;
}

async function stripeRequest(secretKey: string, method: "GET" | "POST", path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`https://api.stripe.com/v1${path}`);
  const init: RequestInit = {
    method,
    headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
  };

  if (method === "POST") {
    const body = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined) body.append(key, String(value));
    });
    init.headers = { ...init.headers, "Content-Type": "application/x-www-form-urlencoded" };
    init.body = body;
  }

  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) {
    throw new StripeRequestError(data?.error?.message ?? "Stripe request failed", data?.error?.code, response.status);
  }
  return data;
}

// ── Price IDs ─────────────────────────────────────────────────────────────────
// Set these environment variables in Supabase Dashboard → Edge Functions → Secrets
// STRIPE_PRICE_SOLO_MONTHLY, STRIPE_PRICE_SOLO_ANNUAL
// STRIPE_PRICE_PRO_MONTHLY,  STRIPE_PRICE_PRO_ANNUAL
// Studio is custom/contact-sales — no Stripe price, handled outside checkout.
const PRICE_IDS: Record<string, string> = {
  solo:        Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY") ?? "",
  solo_annual: Deno.env.get("STRIPE_PRICE_SOLO_ANNUAL")  ?? "",
  pro:         Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")  ?? "",
  pro_annual:  Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")   ?? "",
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
  if (!callerId) return json(cors, { error: "Unauthorized" }, 401);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!stripeSecretKey) return json(cors, { error: "Missing Stripe secret key configuration." }, 500);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // plan: "solo" | "pro" | "studio"
  // interval: "monthly" (default) | "annual"
  const { plan, interval = "monthly", success_url, cancel_url } = await req.json();
  if (plan === "free") {
    return json(cors, { error: "Free plan does not require checkout." }, 400);
  }
  if (plan === "studio") {
    return json(cors, { error: "Studio is a custom plan — please contact sales." }, 400);
  }
  const priceKey = interval === "annual" ? `${plan}_annual` : plan;
  const priceEnvNames: Record<string, string> = {
    solo: "STRIPE_PRICE_SOLO_MONTHLY",
    solo_annual: "STRIPE_PRICE_SOLO_ANNUAL",
    pro: "STRIPE_PRICE_PRO_MONTHLY",
    pro_annual: "STRIPE_PRICE_PRO_ANNUAL",
  };

  const priceId  = PRICE_IDS[priceKey];
  if (!priceId) return json(cors, { error: "Invalid plan or interval" }, 400);

  console.log(JSON.stringify({
    fn: "stripe-checkout",
    step: "price_config",
    plan,
    interval,
    priceEnv: priceEnvNames[priceKey],
    stripeMode: stripeMode(stripeSecretKey),
    priceSuffix: safeSuffix(priceId),
  }));

  try {
    await stripeRequest(stripeSecretKey, "GET", `/prices/${priceId}`);
  } catch (err) {
    return json(cors, { error: checkoutConfigError(err, priceEnvNames[priceKey], stripeSecretKey, interval) }, 400);
  }

  const { data: team } = await service
    .from("teams")
    .select("id, name, stripe_customer_id")
    .eq("billing_owner_user_id", callerId)
    .maybeSingle();

  if (!team) return json(cors, { error: "No billing team found" }, 403);

  const { data: { user } } = await service.auth.admin.getUserById(callerId);
  const email = user?.email ?? undefined;

  let customerId = team.stripe_customer_id;
  if (customerId) {
    try {
      const existing = await stripeRequest(stripeSecretKey, "GET", `/customers/${customerId}`);
      if ((existing as any).deleted) customerId = null;
    } catch (err: any) {
      if (err?.code === "resource_missing" || /No such customer/i.test(err?.message ?? "")) {
        console.log(JSON.stringify({ fn: "stripe-checkout", info: "customer_not_in_current_mode", customerId }));
        customerId = null;
      } else {
        throw err;
      }
    }
  }
  if (!customerId) {
    const customer = await stripeRequest(stripeSecretKey, "POST", "/customers", {
      email,
      name: team.name ?? undefined,
      "metadata[supabase_team_id]": team.id,
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

  let session;
  try {
    session = await stripeRequest(stripeSecretKey, "POST", "/checkout/sessions", {
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      "subscription_data[trial_period_days]": 7,
      "subscription_data[metadata][supabase_team_id]": team.id,
      success_url: success_url ?? `${baseOrigin}/billing?checkout=success`,
      cancel_url:  cancel_url  ?? `${baseOrigin}/billing?checkout=cancelled`,
    });
  } catch (err) {
    return json(cors, { error: checkoutConfigError(err, priceEnvNames[priceKey], stripeSecretKey, interval) }, 400);
  }

  return json(cors, { url: session.url });
});
