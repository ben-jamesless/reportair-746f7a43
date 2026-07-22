import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

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

  if (!team) {
    return new Response(JSON.stringify({ error: "No team found for this user." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { return_url } = await req.json().catch(() => ({}));
  const returnUrl = return_url ?? `${Deno.env.get("APP_URL")}/billing`;

  const openPortal = async (customerId: string) =>
    stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });

  const resolveOrRecreateCustomer = async (): Promise<string> => {
    // Look up user email for (re)creation.
    const { data: userRow } = await service.auth.admin.getUserById(callerId);
    const email = userRow?.user?.email ?? undefined;

    // If we have a stored customer, verify it exists in the current Stripe mode.
    if (team.stripe_customer_id) {
      try {
        const existing = await stripe.customers.retrieve(team.stripe_customer_id);
        // Deleted customers come back as { deleted: true }.
        if (existing && !(existing as { deleted?: boolean }).deleted) {
          return team.stripe_customer_id;
        }
      } catch (err) {
        const code = (err as { code?: string; raw?: { code?: string } })?.code
          ?? (err as { raw?: { code?: string } })?.raw?.code;
        if (code !== "resource_missing") throw err;
        // fall through and create a new one
      }
    }

    // Try to find by email first (avoid creating dupes).
    let customerId: string | null = null;
    if (email) {
      const found = await stripe.customers.list({ email, limit: 1 });
      customerId = found.data[0]?.id ?? null;
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        email,
        metadata: { team_id: team.id, user_id: callerId },
      });
      customerId = created.id;
    }
    await service.from("teams").update({ stripe_customer_id: customerId }).eq("id", team.id);
    return customerId;
  };

  try {
    const customerId = await resolveOrRecreateCustomer();
    const portalSession = await openPortal(customerId);
    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-portal error", err);
    const message = (err as { message?: string })?.message ?? "Failed to open billing portal";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
