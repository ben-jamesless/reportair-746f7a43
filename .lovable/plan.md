## Update home pricing section

Replace the three "TBC" pricing cards in `src/pages/Index.tsx` with the live Solo / Pro / Studio plans, and add a Monthly ↔ Annual toggle above the cards. Source of truth is the existing `UpgradeDialog` (same prices, same features) so the marketing page stays in sync with the in-app upgrade flow.

### Pricing data

| Plan | Monthly | Annual (billed yearly) | Effective /mo |
|---|---|---|---|
| Solo | HK$128 | HK$1,229 | HK$102 |
| Pro (featured) | HK$298 | HK$2,860 | HK$238 |
| Studio | HK$688 | HK$6,604 | HK$550 |

Annual saves ~20% — surfaced as a "Save 20%" pill next to the toggle.

### Feature lists (mirroring UpgradeDialog)

- **Solo** — 1 active event · Unlimited PDF exports · 14-day free trial
- **Pro** — 5 active events · 5 team members · Unlimited PDFs · Share & client links · Password-protected links · Project folders · Project invites · 14-day free trial
- **Studio** — Unlimited events · Unlimited team members · Unlimited PDFs · Share & client links · Custom logo on PDF · White-label report header · Priority support · Onboarding call · 14-day free trial

### Changes (frontend only, `src/pages/Index.tsx`)

1. Replace the `COPY.pricing.plans` array with the three plans above, each carrying `monthlyPrice`, `annualPrice`, `annualMonthly`, feature list, CTA, and `featured` flag (Pro = featured, "Most teams start here").
2. Drop the `note` about "pricing being finalized".
3. Add local `useState` for `annual` in the Index component, and render a Monthly/Annual pill toggle above the grid (matching the UpgradeDialog visual: two labels with a switch and a "Save 20%" badge).
4. In each card:
   - Show `annual ? annualMonthly : monthlyPrice` as the big number, with `per: "/month"` underneath.
   - When annual, add a small line: "HK$X,XXX billed annually".
5. CTA buttons stay pointing at `#cta` (early-access form) — no checkout wiring on the marketing page.

Layout, colors, gradient, featured-card scale, and "Most teams start here" flag all stay as-is. No other files change.
