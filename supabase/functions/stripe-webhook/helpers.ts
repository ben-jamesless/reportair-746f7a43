// Pure helpers extracted from stripe-webhook so they can be unit tested
// without booting the HTTP server or hitting Stripe/Supabase.

export type PlanName = "solo" | "pro" | "studio";

export const PRICE_ENV_PAIRS: Array<[string, PlanName]> = [
  ["STRIPE_PRICE_SOLO_MONTHLY",   "solo"],
  ["STRIPE_PRICE_SOLO_ANNUAL",    "solo"],
  ["STRIPE_PRICE_PRO_MONTHLY",    "pro"],
  ["STRIPE_PRICE_PRO_ANNUAL",     "pro"],
  ["STRIPE_PRICE_STUDIO_MONTHLY", "studio"],
  ["STRIPE_PRICE_STUDIO_ANNUAL",  "studio"],
];

export function buildPriceToPlan(
  env: (k: string) => string | undefined = (k) => Deno.env.get(k),
): Record<string, PlanName> {
  const map: Record<string, PlanName> = {};
  for (const [key, plan] of PRICE_ENV_PAIRS) {
    const id = env(key);
    if (id) map[id] = plan;
  }
  return map;
}

export function resolvePlan(
  priceId: string | null | undefined,
  map: Record<string, PlanName>,
): PlanName {
  if (!priceId) return "solo";
  return map[priceId] ?? "solo";
}

export function fmtDate(unix: number | null | undefined): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString("en-HK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
