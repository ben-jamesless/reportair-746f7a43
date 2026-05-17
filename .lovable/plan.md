## BuildSlides Rebrand — Implementation Plan

Full rebrand per uploaded `LOVABLE_REBRAND_PROMPT.md`. Visual + copy only. No DB / API / business-logic changes.

---

### 1. Assets
- Copy uploaded SVGs into `public/brand/`:
  - `buildslides-mark.svg`
  - `buildslides-lockup.svg` (light bg)
  - `buildslides-lockup-on-dark.svg` (dark bg)
- Replace `public/favicon.svg` with the orange-tile mark.
- Update `index.html` to add `theme-color` `#D94F2A` meta.

### 2. Design tokens (`src/index.css` + `tailwind.config.ts`)
- Add full `--bs-*` token set from §4 of the brief (accent, ink, paper, text, rule, yellow, status, radii, shadows, focus ring).
- Map shadcn semantic HSL tokens (`--background`, `--foreground`, `--primary`, `--sidebar-*`, `--border`, `--ring`, etc.) to the new BuildSlides palette so all existing components recolour automatically.
- Extend Tailwind theme: `accent`, `ink`, `paper`, `yellow`, `status.*`, font families (`display: DM Sans`, `sans: Inter`, `mono: JetBrains Mono`), `bs-sm/md/lg` radius + shadow.
- Load Google Fonts (DM Sans, Inter, JetBrains Mono) in `index.html` (replace current Inter + Plus Jakarta Sans link).
- Add `.bs-pill`, `.bs-pill.is-{ontrack,active,review,concern,archived}`, `.bs-area-rail.is-*`, `.bs-icon` utility classes.

### 3. Logo & brand components
- Replace `src/components/brand/ReportAirMark.tsx` with `BuildSlidesMark` + `BuildSlidesLockup` (inline SVG from upload, light/dark variants). Keep old export names as aliases to avoid breakage, or update all imports.
- Replace `src/components/marketing/brand.tsx` `BrandMark` + `Logo` with the new orange-tile mark and `BuildSlides` wordmark.
- Update `src/components/marketing/brand-tokens.ts`: swap `sky/deepSky/skySoft/ink/...` to new BuildSlides hex values so existing inline-styled marketing sections recolour.

### 4. Wordmark + visible copy: `ReportAir` → `BuildSlides`
Find/replace across:
- `index.html` — title, description, OG/twitter title+desc.
- App pages: `Auth.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Billing.tsx`, `SharePage.tsx`, `AppSidebar.tsx`, `AppShell.tsx`, `OnboardingLayout.tsx`.
- Marketing: `HeroSection`, `HowItWorksSection`, `FAQSection`, `TimeSavedSection`, `MarketingFooter`, `LegalDialog`, `Index.tsx` (review/CTA copy).
- Edge functions (user-visible email/PDF strings only): `send-invite-email`, `send-transactional-email`, `generate-pdf`, `stripe-checkout`, `stripe-portal`, `stripe-sync-subscription`, `admin-delete-user`, `heic-backfill`.
- `public/sitemap.xml`, `public/robots.txt` user-visible references.
- Skip: DB columns, route names, variable names, `useProjectDetail.ts` internal strings if not rendered, the migration file `20260515_plan_rename.sql` (historical).

### 5. Emoji → Lucide icons
Project already uses `lucide-react`. Replace emoji glyphs everywhere with Lucide icons at `size={14}` `strokeWidth={1.5}`:
`AlertTriangle, MessageSquare, Link2, Download, Upload, MapPin, Calendar, Tag, Folder, Pencil, FileText, Search`.
Audit step: `rg -P '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` returns 0 hits.

### 6. Component restyling (only where current styling collides with the spec)
- `AppSidebar`: dark ink bg, paper text, accent active pill, mono section dividers.
- `TrialBanner`: yellow `#F2C14E` bg, ink text, outline upgrade pill.
- Buttons/Tabs/Inputs/Tables/Cards: rely on the recoloured shadcn tokens; add small overrides only where needed (tab underline accent, area-card status rail).
- Sign-in page: split layout per spec (ink left panel with orange radial glow, paper-2 inputs, accent primary).
- Status pills: introduce `.bs-pill` and adopt across area cards / project status badges.

### 7. PDF export (`supabase/functions/generate-pdf/index.ts`)
- Switch PDF page bg to pure `#FFFFFF`, rules to `#E5E5E5`, muted to `#6B6B70`.
- Cover band: 26mm (was ~38mm), logo 36px, wordmark 17pt, eyebrows 8.5/10pt, accent `#D94F2A`.
- Area band (pages 2+): 32mm tall, 5mm status rail, area title 20pt, eyebrow 8pt, status pill vertically centred.
- BuildSlides lockup in cover + footer.
- App canvas stays warm paper `#FAF7F0` — only PDF is white.

### 8. SEO / meta (`index.html`)
- Title: `BuildSlides — Site to report in 10 minutes`
- Description updated to BuildSlides build-reporting positioning.
- Update og:title / twitter:title / og:description / twitter:description.
- Canonical + og:url stay `https://reportair.co/` (domain unchanged per earlier instruction).
- JSON-LD `Organization.name` → `BuildSlides`.

### 9. Acceptance checks (run after changes)
- `rg -i "reportair"` → only historical migration / reference template hits remain.
- `rg -P '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` → 0.
- Visit `/` (marketing), `/auth`, `/projects`, a project detail, `/billing`: no blue anywhere; sidebar dark; canvas paper; trial banner yellow; pills follow status map; fonts = DM Sans / Inter / JetBrains Mono.
- Generate a sample PDF: white pages, slim orange cover band, slim dark area bands.

### Out of scope
- Domain (stays `reportair.co`).
- DB schema, API routes, auth flow, business logic.
- Email-template auth scaffolding (will only update visible copy inside existing templates).
