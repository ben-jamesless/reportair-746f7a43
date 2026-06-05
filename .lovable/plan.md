## Add WhyBuildFolderV2 benefits section

Create a new section component matching the uploaded HTML and slot it into the V2 home page.

### 1. New component: `src/components/marketing/WhyBuildFolderV2.tsx`
- Port the uploaded HTML/CSS into a React component with a scoped `<style>` block (same pattern as `HeroSectionV2`).
- Use the V2 token values inline (`--ink: #0F1417`, `--paper: #FAF7F0`, `--accent: #D94F2A`, `--font-display: 'Geist'`) since the V2 sections don't rely on `brand.css` vars.
- Eyebrow "Why Build Folder", headline "A workflow, **not a bucket.**" (orange span), lead paragraph, 2×2 grid of 4 cards with inline SVG icons:
  1. Sorted, not dumped
  2. A live build timeline
  3. Hours back on admin
  4. A record that lasts
- Drop the `[data-reveal]` JS-dependent animation (no observer in V2); keep cards statically visible. Preserve hairline icon tiles, dotted ink background, responsive 1-col stack ≤760px.

### 2. Wire into `src/pages/PreviewHomeV2.tsx`
- Import `WhyBuildFolderV2`.
- Insert it between `<WhyWeBuiltV2 />` and `<UseCasesSection />` (i.e. right after the manifesto, before the dark UseCases band) — matches the uploaded file's "after Manifesto / before Time-saved" intent while respecting the current V2 order.

### Notes
- No changes to V1 home, pricing, or other components.
- No new deps, no backend changes.
