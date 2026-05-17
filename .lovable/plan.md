# Remove blue tones from marketing home

Pre-change screenshot saved: `tool-results://screenshots/20260517-034705-860306.png` (full-page).

## Findings

Although `BRAND.sky` was rebranded to orange, many marketing files still contain raw blue hex values and blue rgba glows inline. Affected files:

- `src/pages/Index.tsx` (Reviews, Final CTA radial glows)
- `src/components/marketing/HeroSection.tsx` (panel bg, glow halo, pulse ring, chip backgrounds, SVG strokes)
- `src/components/marketing/HowItWorksSection.tsx` (stepper, device frame, ghost buttons, status pills)
- `src/components/marketing/FAQSection.tsx` (section bg, expanded item bg)
- `src/components/marketing/TimeSavedSection.tsx` (section bg, eyebrow color)
- `src/components/marketing/UseCasesSection.tsx` (section bg, eyebrow color)
- `src/components/marketing/PricingSection.tsx` (section bg, card bg/border, toggle, glow)

## Color mapping (find → replace, marketing only)

| Old (blue) | New (brand) | Use |
|---|---|---|
| `#060D18` | `#0F1417` (ink) | dark section background |
| `#0B1830`, `#0E2040`, `#0E2044` | `#1A2025` (ink-2) | panel/card gradient stops |
| `rgba(26,110,255,X)` | `rgba(217,79,42,X)` | borders, glows, active rings, pulse, chip bg |
| `rgba(168,196,255,X)` | `rgba(244,241,234,X)` (paper at same alpha) | eyebrow muted text, SVG strokes |
| `linear-gradient(135deg, rgba(11,24,48,0.95), rgba(14,32,68,0.85))` | `linear-gradient(135deg, rgba(26,32,37,0.95), rgba(15,20,23,0.85))` | reused panel bg constant |

No other behavior changes. No tokens, fonts, copy, or layout touched.

## Steps

1. Apply the mapping above via targeted `code--line_replace` edits in each listed file.
2. Leave `BRAND.sky`/`BRAND.deepSky` alone (already orange) — uses of those tokens stay as-is.
3. Re-screenshot `/` full-page after edits and visually confirm no blue remains (hero panel, How it works, Time saved, Reviews, FAQ, Pricing, Final CTA).

## Out of scope

- App (logged-in) views — only the marketing home (`/`).
- Domain, copy, layout, fonts, JSON-LD.
