## Scope split

Most "Customer Portal config" and "Branding on Stripe-hosted pages" items are **Stripe Dashboard settings, not code**. I'll do all the code, and list the Dashboard clicks you (or I, if you paste a screenshot) need to make.

---

### A. Code changes I'll ship

**1. Webhook handlers (`supabase/functions/stripe-webhook/index.ts`)**
- Add `customer.subscription.created` → same provisioning logic as `checkout.session.completed` (idempotent upsert on `teams.plan`, `stripe_subscription_id`, status, period end, trial end). Keeps the checkout handler too (covers metadata edge cases).
- Add `invoice.payment_succeeded` → set `teams.subscription_status = 'active'` and clear `payment_failed_at`. This is what clears the in-app banner.
- Existing handlers stay as-is: `subscription.updated`, `subscription.deleted` (→ downgrades to `solo` today; **changing to `free`** per spec), `invoice.payment_failed`, `trial_will_end`.
- `subscription.deleted` change: set `plan = 'free'` (not `'solo'`), keep all team/project/photo data untouched.

**2. Grandfathering**
- DB: add `teams.grandfathered_until timestamptz` and `teams.payment_failed_at timestamptz` columns.
- `stripe-checkout`: when creating the Stripe customer, set `metadata.grandfathered = "true"` and `metadata.grandfathered_until = <now + 12 months ISO>` **only if** the team's `created_at` is before the v1→v2 cutover date (I'll use `now()` as the cutover — every team that subscribes from this deploy forward is grandfathered for 12 months from their first subscription). Mirror to `teams.grandfathered_until`.
- Webhook on `subscription.updated`: if a price change would move them off their grandfathered price before `grandfathered_until`, log a warning (Stripe is source of truth — we don't auto-revert, just flag).

**3. Payment-failed in-app banner**
- New `src/components/PaymentFailedBanner.tsx` (sibling to `TrialBanner`). Shows when `teams.subscription_status === 'past_due'` OR `payment_failed_at` is set.
- Copy: **"Payment failed. Update your card to keep access."** + "Update card" link → opens Stripe Portal.
- Mount in `AppShell` alongside `TrialBanner`.
- `usePlan` hook: expose `paymentFailedAt` and `subscriptionStatus` (already there).

**4. Copy strings — replace in place**
- Trial CTAs everywhere → **"Start 7-day free trial. No card until day 8."** (Plan.tsx, PricingSection.tsx, Billing.tsx, FAQ if relevant).
- Upgrade dialog when out of free build days → **"Your 3 build days are up. Keep the build going — upgrade to Solo."** (UpgradeDialog.tsx).
- Cancel confirmation (rendered in our app before sending to portal; portal itself we can't customize copy beyond branding) → **"Your builds and reports stay on file. Access ends at period end."** New small confirm dialog before "Manage billing → Cancel" flows.

**5. Confirmation gate for paid downgrades**
- Stripe Portal lets users downgrade freely. To force a confirmation, I'll **disable plan switching in the Portal** (Dashboard setting) and instead route downgrades through our own `Plan.tsx` flow, where I'll add a confirm dialog with the cancel copy above before calling `stripe-checkout` with the new (lower) price. Upgrades go straight through. This matches your "no self-serve downgrade without confirmation" rule.

---

### B. Stripe Dashboard items (you do these, or paste screenshots and I'll walk you through each)

In **Stripe Dashboard → Settings → Billing → Customer portal**:
- Enable: update payment method, view invoices, cancel subscription
- Enable: switch plans (Free / Solo / Crew / Studio products)
- Cancellation mode: **"At end of billing period"**
- Proration: on for upgrades, off for downgrades (we gate downgrades in-app anyway)

In **Settings → Branding**:
- Logo: upload `lockup_horizontal_ink.svg` (Paper-ground horizontal lockup)
- Brand colour: `#D94F2A`
- Accent background: `#F4F1EA`
- Font: Inter (Stripe default)

In **Settings → Emails**:
- Turn on "Send finalized invoices" and "Send emails about expiring cards"

---

### C. Out of scope right now (per your last message)
- Alipay / WeChat Pay — held until HK account approval.
- Move from sandbox → live mode — held until you confirm Stripe keys for live are ready in `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`. Right now this ships against whichever mode your current keys point to.

---

### Files touched
- `supabase/functions/stripe-webhook/index.ts` (+ `helpers.ts` no change)
- `supabase/functions/stripe-checkout/index.ts` (grandfathering metadata)
- DB migration: `teams.grandfathered_until`, `teams.payment_failed_at`
- `src/components/PaymentFailedBanner.tsx` (new)
- `src/components/AppShell.tsx` (mount banner)
- `src/components/CancelSubscriptionDialog.tsx` (new)
- `src/hooks/usePlan.ts` (expose `paymentFailedAt`)
- `src/pages/Plan.tsx`, `src/pages/Billing.tsx`, `src/components/marketing/PricingSection.tsx`, `src/components/UpgradeDialog.tsx`, `src/components/marketing/FAQSection.tsx` (copy)

Approve and I'll ship A in one pass, then hand you the B checklist.