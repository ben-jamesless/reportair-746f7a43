import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPriceToPlan,
  resolvePlan,
  fmtDate,
} from "./helpers.ts";

Deno.test("buildPriceToPlan maps configured env vars to plan names", () => {
  const env = (k: string) =>
    ({
      STRIPE_PRICE_SOLO_MONTHLY:   "price_solo_m",
      STRIPE_PRICE_SOLO_ANNUAL:    "price_solo_a",
      STRIPE_PRICE_PRO_MONTHLY:    "price_pro_m",
      STRIPE_PRICE_PRO_ANNUAL:     "price_pro_a",
      STRIPE_PRICE_STUDIO_MONTHLY: "price_studio_m",
      STRIPE_PRICE_STUDIO_ANNUAL:  "price_studio_a",
    } as Record<string, string>)[k];

  const map = buildPriceToPlan(env);
  assertEquals(map["price_solo_m"],   "solo");
  assertEquals(map["price_solo_a"],   "solo");
  assertEquals(map["price_pro_m"],    "pro");
  assertEquals(map["price_pro_a"],    "pro");
  assertEquals(map["price_studio_m"], "studio");
  assertEquals(map["price_studio_a"], "studio");
  assertEquals(Object.keys(map).length, 6);
});

Deno.test("buildPriceToPlan skips unset env vars", () => {
  const env = (k: string) =>
    k === "STRIPE_PRICE_PRO_MONTHLY" ? "price_pro_only" : undefined;
  const map = buildPriceToPlan(env);
  assertEquals(map, { price_pro_only: "pro" });
});

Deno.test("resolvePlan returns mapped plan", () => {
  const map = { price_x: "pro" as const };
  assertEquals(resolvePlan("price_x", map), "pro");
});

Deno.test("resolvePlan falls back to solo for unknown price", () => {
  assertEquals(resolvePlan("price_unknown", {}), "solo");
});

Deno.test("resolvePlan falls back to solo for null/undefined price", () => {
  assertEquals(resolvePlan(null, {}), "solo");
  assertEquals(resolvePlan(undefined, {}), "solo");
});

Deno.test("fmtDate returns empty string for null/undefined", () => {
  assertEquals(fmtDate(null), "");
  assertEquals(fmtDate(undefined), "");
  assertEquals(fmtDate(0), "");
});

Deno.test("fmtDate formats unix seconds as en-HK long date", () => {
  // 2025-01-15 UTC noon — locale formatting is stable for day/month/year
  const out = fmtDate(1736942400);
  assertStringIncludes(out, "2025");
  assertStringIncludes(out, "January");
});

Deno.test("stripe signature verification rejects bad signatures", async () => {
  const Stripe = (await import("https://esm.sh/stripe@14?target=deno")).default;
  const stripe = new Stripe("sk_test_dummy", { apiVersion: "2024-04-10" });
  const body = JSON.stringify({ id: "evt_test", type: "ping" });
  let threw = false;
  try {
    await stripe.webhooks.constructEventAsync(body, "t=1,v1=bad", "whsec_test");
  } catch (e) {
    threw = true;
    assertStringIncludes(String(e), "signature");
  }
  assertEquals(threw, true);
});

Deno.test("stripe signature verification accepts a valid signature", async () => {
  const Stripe = (await import("https://esm.sh/stripe@14?target=deno")).default;
  const stripe = new Stripe("sk_test_dummy", { apiVersion: "2024-04-10" });
  const secret  = "whsec_testsecret";
  const payload = JSON.stringify({ id: "evt_1", type: "ping", data: { object: {} } });
  const ts      = Math.floor(Date.now() / 1000);

  // Compute v1 signature exactly as Stripe does: HMAC-SHA256(`${ts}.${payload}`)
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`)),
  );
  const sigHex = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const header = `t=${ts},v1=${sigHex}`;

  const event = await stripe.webhooks.constructEventAsync(payload, header, secret);
  assertEquals(event.id, "evt_1");
  assertEquals(event.type, "ping");
});
