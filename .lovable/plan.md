## Plan: BuildFolder rebrand + hero overhaul

### 1. Brand assets (new SVGs in `/public/brand/`)

Generate three SVGs from the supplied artwork and drop them in `/public/brand/`:

- `buildfolder-mark.svg` — black squircle with the orange corner-bracket mark (favicon / app icon use)
- `buildfolder-lockup-twotone.svg` — "Build" in ink + "Folder" in orange with corner brackets around "Folder" (for light backgrounds)
- `buildfolder-lockup-dark-bg.svg` — same lockup but "Build" in paper/white + "Folder" in orange (for dark backgrounds)

Update `/public/favicon.svg` to the new mark.

### 2. Wordmark rename: "BuildSlides" → "BuildFolder" (project-wide)

Replace every occurrence in code, copy, alt text, page titles, meta, manifest, and email templates. Known locations include:

- `index.html` (title, og:*, twitter:*, manifest references)
- `public/site.webmanifest`
- `public/robots.txt` / `public/sitemap.xml` if they contain the name
- Marketing: `MarketingHeader.tsx`, `MarketingFooter.tsx`, `HeroSection.tsx`, `HowItWorksSection.tsx`, `FAQSection.tsx`, `PricingSection.tsx`, `TimeSavedSection.tsx`, `UseCasesSection.tsx`, `LegalDialog.tsx`, `brand.tsx`, `brand-tokens.ts` comment
- App shell: `OnboardingLayout.tsx`, `AppSidebar.tsx`, `AppShell.tsx`, auth/onboarding pages, `BuildSlidesMark.tsx` (rename to `BuildFolderMark.tsx` + update imports)
- Share/export branding: `ShareBrandingFooter.tsx`, share pages, PDF generator templates in `supabase/functions/generate-pdf/`
- Email templates: `supabase/functions/_shared/email-templates/` and `signup-buildslides.html` (rename + content)
- Tests in `src/test/` where the string appears

Keep the domain strings (`buildslides.lovable.app`, `buildslides.com`) untouched — those are infrastructure, not user-facing brand text. Domains are managed in Settings, not code.

### 3. Marketing header logo

`MarketingHeader.tsx` + `brand.tsx`: swap the existing favicon mark + "BuildSlides" text for an `<img>` of `buildfolder-lockup-twotone.svg` (and `-dark-bg.svg` where the header is on a dark surface). Keep link target and aria-label.

### 4. Hero section rewrite (`src/components/marketing/HeroSection.tsx`)

Left column — copy only this changes:
- Eyebrow: `BUILT FOR THE BUILD` (unchanged)
- Headline: unchanged — "Client-ready event build reports in **10 minutes.**" with `.accent` on "10 minutes."
- Subline: replace with exact text — *"Capture and sort event site photos. Export a client-safe link or polished PDF in minutes."*
- CTAs: unchanged ("Start your first build" primary, "See how it works →" secondary)

Right column — full replacement (delete chip/lines/node/report-card stage):

New `<div class="dash">` styled as a screenshot card sitting on a paper-tinted rounded container. Internal layout matches the uploaded mock:

```text
┌──────────────────────────────────────────────────────────┐
│ [sidebar 28%]   │  [main 72%]                            │
│ BuildFolder     │  Hong Kong Open  ●Complete   [Share]   │
│ DAILY LOG       │  Fanling · 20 Oct 2026 · HKGC [PDF]    │
│ ┌Thu 30 Oct─5┐  │                              [+Upload] │
│ │ active     │  │  Updates  Gallery  Activity  Settings  │
│ └────────────┘  │  ──────                                │
│  Tue 28 Oct 12  │  Thursday, 30 October 2025             │
│  Fri 24 Oct  8  │  ┌──────────┐ ┌──────────┐             │
│  Mon 13 Oct 16  │  │ OBJ...   │ │ ACH...   │             │
│  Tue  7 Oct 15  │  └──────────┘ └──────────┘             │
│  Thu  2 Oct  8  │  ┌──────────┐ ┌──────────┐             │
│  Sun 28 Sep  9  │  │ TOM OBJ  │ │ RISKS    │             │
│                 │  └──────────┘ └──────────┘             │
│                 │  ▌18th Hospitality      ●Delayed       │
│                 │  ▌Media Centre          ●On track      │
│                 │  ▌Spectator Village     ●Complete      │
└──────────────────────────────────────────────────────────┘
```

Content exactly as specified in the brief (objectives/achievements/tomorrow/risks lists, three status rows with red/blue/green left borders and matching pills).

Styling rules:
- Paper background `#F4F1EA`, card `#FFFFFF`, ink `#0F1417`, accent `#D94F2A`
- Sidebar items: date chip (day + small SEP/OCT label) in JetBrains Mono, row label in Geist, photo count right-aligned. Active row = orange fill + white text.
- Small uppercase labels and the `Fanling · 20 Oct 2026 · HKGC` metadata in JetBrains Mono mute color.
- Bulleted list markers in accent orange.
- Header buttons: "Share link" + "Export PDF" ghost (border, ink text, download/share icon), "+ Upload photos" solid orange.
- "Updates" tab gets an orange underline; others muted.
- Status pills: green `#3A7D44` / blue `#3A6EA5` / red `#C7382A` on tinted backgrounds, with matching 3px left border on each row.
- Subtle drop shadow + 1px line around the card so it reads as a screenshot.

Keep the existing hero dark ground (`#0F1417`) behind the dashboard so it pops.

### 5. Responsive

- Desktop ≥1024px: copy ~40% / dashboard ~60% side-by-side, dashboard never overlaps copy.
- Tablet/mobile <1024px: stack — copy on top, dashboard full-width below. Sidebar inside the dashboard collapses to a horizontal scroll row of date chips (or hides on <640px) so the main panel stays readable. Cards stack to single column on mobile.

### 6. Sections explicitly left alone

How it works, Time Saved, Who it's for (Use Cases), Reviews, FAQ, Pricing, Final CTA, Footer — no content or layout changes. Only the wordmark string inside them flips to "BuildFolder" as part of step 2.

### 7. Verification

- Build passes, no broken imports after the `BuildSlidesMark → BuildFolderMark` rename.
- `rg -i buildslides` returns only intentional matches (domains, lockup file paths kept for back-compat if any).
- Quick browser pass on the homepage at desktop + 375px width to confirm hero reflow and dashboard legibility.
