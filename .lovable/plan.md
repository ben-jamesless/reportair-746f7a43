# ReportAir Brand Book — PDF

A polished, multi-page PDF saved to `/mnt/documents/reportair-brand-book.pdf`, built from the actual tokens, fonts, mark, and screenshots already in the repo. Generated with ReportLab (Python) using the SKY palette as the dominant brand color.

## Pages

1. **Cover** — Dark INK background, large ReportAir lockup (mark + wordmark), tagline, version + date.
2. **Brand at a glance** — One-paragraph brand essence, primary color swatch, wordmark sample.
3. **Logo & mark** — The two-rectangle mark rendered from `public/favicon.svg`:
   - Primary lockup (mark + REPORTAIR)
   - Mark-only
   - Light, Dark, and OnSky variants
   - Clear-space + minimum-size rules
   - Do / Don't grid (no recoloring, no stretching, no shadows, no rotating)
4. **Color palette** — All tokens from `src/index.css` rendered as swatches with name, hex, HSL, and CSS var:
   - Brand: SKY `#1A6EFF`, SKY_DARK `#0D47B5`, SKY_MID `#5590FF`, SKY_SOFT `#A8C4FF`
   - Neutrals: INK `#0F1724`, MIST `#7A8FA8`, CLOUD `#EDF1F7`, FOG `#F5F7FA`, BORDER `#D0D9E8`, White
   - Semantic: Success `#1DB87A`, Warning `#FF8C00`, Destructive `#FF3B30`
   - Gradient: `--gradient-primary` (SKY → SKY_MID, 135°)
5. **Typography** — Plus Jakarta Sans (display/wordmark) + Inter (body):
   - Type scale samples (H1–H4, body, caption)
   - Wordmark spec (Plus Jakarta Sans 600, letter-spacing 0.04em, uppercase)
   - Font-feature-settings note (`ss01`, `cv11`)
6. **UI tokens** — Radius `0.75rem`, shadows (`--shadow-soft`, `--shadow-elegant`), spacing scale, border color samples.
7. **Components** — Rendered examples of primary/secondary/ghost buttons, card, input, badge — drawn as vector approximations of the live components.
8. **Product in use** — Full-bleed screenshots from `src/assets/mockups/` (1–6) with captions.
9. **Voice & usage** — Short do/don't writing guidance ("efficient, professional, direct"), incorrect-usage examples, contact line.

## Technical details

- Script: `/tmp/build_brand_book.py` using `reportlab` (Platypus for flow pages, Canvas for cover/swatch pages).
- Mark: parse `public/favicon.svg` and redraw the two rounded rects with ReportLab `canvas.roundRect` so it renders crisply at any size and recolors per variant — no external SVG renderer needed.
- Fonts: Plus Jakarta Sans + Inter downloaded from Google Fonts at build time into `/tmp/fonts/` and registered via `pdfmetrics.registerFont`; fall back to Helvetica if download fails.
- Screenshots: embedded directly from `src/assets/mockups/*.png`.
- Page size: US Letter, 0.6" margins, dark cover + section dividers, light content pages.
- QA: convert PDF to JPGs with `pdftoppm -r 150` and visually inspect every page for overflow, contrast, and missing glyphs before delivering. Iterate until clean.

## Deliverable

`<presentation-artifact path="reportair-brand-book.pdf" mime_type="application/pdf">` linking the final PDF (plus a `_v2` if revisions are requested).

No app code is changed — this is a one-off artifact generation.
