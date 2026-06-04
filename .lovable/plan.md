# Homepage Re-skin Plan — "Built for the Build" Paper Theme

## Goal

Re-skin the marketing homepage to match the uploaded HTML reference (paper canvas, dotted grid, orange accent, Geist typography, two-column "How it works"). **All copy, CTAs, FAQ, pricing, auth routes, and app behavior stay exactly as-is.** Changes are cosmetic + one layout restructure.

## Answer to your question: draft first, yes

We can do this safely without committing the whole site. Approach:

1. **Build a draft preview at a hidden route** `/preview/home-v2` (not linked from nav, not indexed).
2. It renders a new `HeroSectionV2` + `HowItWorksSectionV2` + restyled wrappers, leaving the live `/` route untouched.
3. I screenshot it at desktop (1440) and mobile (375) and post the images back.
4. You approve / request tweaks.
5. Once approved, I swap the components into `src/pages/Index.tsx` and delete the preview route.

This costs one extra file (`src/pages/PreviewHomeV2.tsx`) and two new section components. Zero risk to the live page.

## Scope of cosmetic changes (Pass 1 — the draft)

**Global tokens** (`src/index.css`)
- Add a `.bs-paper-grid` utility: `#FAF7F0` base + repeating radial-gradient dot pattern (`#D9D4C5` at ~24px spacing, ~1px dots). This becomes the continuous page background.
- Confirm Geist + Geist Mono are loaded (already are).
- Keep all existing HSL semantic tokens — no token renames.

**`Index.tsx` / page shell**
- Swap the dark `#0F1417` page background for the new paper-grid background on the wrapper div.
- Reviews + Final CTA sections currently use `#0F1417` dark cards — keep them dark as accent "bands" (matches the reference's dark Time Saved band), OR convert to light paper cards. **Question for you below.**

**`HeroSection.tsx` → `HeroSectionV2`**
- Same eyebrow, headline, subtext, CTAs (no copy changes).
- Background: transparent (inherits paper grid).
- Right-side dashboard mockup: keep current mock but lighten the container to sit on paper (white card, soft shadow, 1px `#E5E1D6` border, corner brackets in `#D94F2A`).
- No floating-object animation in Pass 1 — that's Pass 2 if you want it.

**`HowItWorksSection.tsx` → `HowItWorksSectionV2`** (the layout change you asked for)
- Convert from current single-column step list to **two-column, three-row layout** matching the HTML:
  - Each step = one row: left column = number + title + 1-line description; right column = small visual mock (photo grid / sort cards / share-link card).
  - Step copy unchanged ("Capture", "Sort", "Share/Export" or whatever's currently there — I'll preserve verbatim).
  - Bracket-accent number markers in `#D94F2A`.

**Other sections** (`TimeSavedSection`, `UseCasesSection`, `FAQSection`, `PricingSection`, `MarketingFooter`, `MarketingHeader`)
- No structural changes. Only background tweak: ensure they render correctly over (or alongside) the paper grid — most are already light. Dark sections stay dark as deliberate bands.

## Out of scope for this pass

- Floating "object field" hero animation (photos + WhatsApp/Gmail icons drifting) — defer to Pass 2 if you like the static skin.
- Any copy edits.
- Any change to FAQ items, pricing tiers, auth, routes, edge functions.
- Logos strip (you haven't said you want one — I'll skip unless you ask).

## File changes

**New**
- `src/pages/PreviewHomeV2.tsx` (draft route, deleted after approval)
- `src/components/marketing/HeroSectionV2.tsx`
- `src/components/marketing/HowItWorksSectionV2.tsx`

**Edited**
- `src/index.css` — add `.bs-paper-grid` utility only
- `src/App.tsx` — register `/preview/home-v2` route (removed at end)

**Untouched**
- `src/pages/Index.tsx` (until after approval)
- All other section components, auth, pricing, FAQ data

## One question before I build the draft

The reference HTML uses a continuous light paper background throughout. Your current page has two intentionally dark sections (Reviews, Final CTA). For the draft, do you want:

- **A)** Keep Reviews + Final CTA dark as accent bands (matches reference's dark Time Saved band — recommended), or
- **B)** Convert everything to light paper edge-to-edge?

I'll default to **A** unless you say otherwise. Approve this plan and I'll build the draft route and post screenshots.
