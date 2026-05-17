// Landscape PDF renderers for BuildSlides export — V1 horizontal templates.
//
// Two layouts share this module:
//   * renderHorizontalDeckV1 ("Client deck") — light cream PAPER surface,
//     hero photo cover + per-day spread with "Today in 6 lines" + 2×2 zone grid.
//   * renderHorizontalLogV1 ("Production log") — INK dark surface, KPI strip,
//     narrative card, zone breakdown row.
//
// Both are designed to port BuildSlides_Report_Templates_Horizontal_v1.pdf
// page-for-page using only data we actually have in the schema today
// (projects, areas, day_notes, area_day_status, area_day_notes, photos).
// Sections with no source data are hidden entirely — no placeholder strings.
import { PDFDocument, PDFFont, PDFImage, PDFPage, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// ============ Brand tokens (mirrored from index.ts) ============
const MM = 2.83465;
const HEX = (h: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
};
const COLOR = {
  ACCENT: HEX("#D94F2A"),
  ACCENT_SOFT: HEX("#FBE6DE"),
  INK: HEX("#0E1316"),
  PAPER: HEX("#F3EFE6"),
  RULE: HEX("#E5E1D6"),
  TEXT_ON_PAPER: HEX("#0E1316"),
  MUTED_ON_PAPER: HEX("#6B6B70"),
  TEXT_ON_INK: HEX("#F3EFE6"),
  MUTED_ON_INK: HEX("#A7A7A9"),
  ONTRACK: HEX("#2EB872"),
  ONTRACK_SOFT: HEX("#D7F1E2"),
  SNAG: HEX("#C0392B"),
  SNAG_SOFT: HEX("#F5D9D4"),
  WHITE: rgb(1, 1, 1),
};

// ============ Shared types ============
export type AreaData = {
  id: string;
  name: string;
  status: string;
  notes: string;
  photoCount: number;
  photoImages: (PDFImage | null)[];
  photoCaptions: string[];
};

export type DayNote = {
  today_objectives?: string | null;
  today_achievements?: string | null;
  tomorrow_objectives?: string | null;
  open_issues?: string | null;
  notes?: string | null;
};

export type ProjectMeta = {
  name?: string | null;
  event_location?: string | null;
  event_date?: string | null;
  overall_status?: string | null;
  client_name?: string | null;
};

export type RenderArgs = {
  pdfDoc: PDFDocument;
  pjsFont: PDFFont;
  irFont: PDFFont;
  proj: ProjectMeta;
  areaData: ReadonlyArray<AreaData>;
  dayPhotos: ReadonlyArray<{ id: string }>;
  dayNote: DayNote | null;
  reportDateLabel: string;
  buildDayLabel: string;
  reportNumber: string;
};

// ============ Utilities ============
function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const cleaned = text ?? "";
  const paragraphs = cleaned.split(/\r?\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) current = test;
      else {
        if (current) out.push(current);
        current = w;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

// Split a multi-line / sentence block into up to N short bullet points.
// Used by the "Today in 6 lines" panel — we accept either newline-separated
// lines or a paragraph and pull out individual sentences.
function toBullets(text: string | null | undefined, max = 6): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  // Prefer newline-separated bullets; fall back to sentence splits.
  let parts = raw.split(/\r?\n/).map(s => s.replace(/^[-•*\s]+/, "").trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }
  return parts.slice(0, max);
}

// Normalised status → chip metadata. The horizontal layouts use a simpler
// three-state model than the portrait template (on track / snag / complete).
function chipFor(status: string): { label: string; text: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> } | null {
  if (!status || status === "no_status") return null;
  if (status === "complete") return { label: "COMPLETE", text: COLOR.INK, bg: COLOR.RULE };
  if (status === "delayed" || status === "requires_discussion" || status === "concern" || status === "behind_schedule" || status === "at_risk") {
    return { label: "SNAG", text: COLOR.WHITE, bg: COLOR.SNAG };
  }
  return { label: "ON TRACK", text: COLOR.WHITE, bg: COLOR.ONTRACK };
}

// Draw a small filled chip with text. Returns the chip's drawn width so
// callers can place neighbours.
function drawChip(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  textColor: ReturnType<typeof rgb>,
  bg: ReturnType<typeof rgb>,
  font: PDFFont,
  fontSize = 7.5,
): number {
  const padX = 6;
  const padY = 3.5;
  const tw = font.widthOfTextAtSize(label, fontSize);
  const w = tw + padX * 2;
  const h = fontSize + padY * 2;
  page.drawRectangle({ x, y, width: w, height: h, color: bg });
  page.drawText(label, { x: x + padX, y: y + padY + 0.5, size: fontSize, font, color: textColor });
  return w;
}

// Draw the BuildSlides corner-bracket frame used in the mock around every
// photo tile. Brackets are 12pt long, drawn in PAPER tone — so they read on
// both the cream surface and dark INK surface (we pass colour in).
function drawCornerBrackets(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: ReturnType<typeof rgb>,
  thickness = 0.8,
  size = 10,
) {
  // TL
  page.drawLine({ start: { x, y: y + h }, end: { x: x + size, y: y + h }, thickness, color });
  page.drawLine({ start: { x, y: y + h }, end: { x, y: y + h - size }, thickness, color });
  // TR
  page.drawLine({ start: { x: x + w - size, y: y + h }, end: { x: x + w, y: y + h }, thickness, color });
  page.drawLine({ start: { x: x + w, y: y + h }, end: { x: x + w, y: y + h - size }, thickness, color });
  // BL
  page.drawLine({ start: { x, y }, end: { x: x + size, y }, thickness, color });
  page.drawLine({ start: { x, y }, end: { x, y: y + size }, thickness, color });
  // BR
  page.drawLine({ start: { x: x + w - size, y }, end: { x: x + w, y }, thickness, color });
  page.drawLine({ start: { x: x + w, y }, end: { x: x + w, y: y + size }, thickness, color });
}

// Tiny BuildSlides logomark (two stacked squares) at scale `size`. Mirrors
// drawLogomark in index.ts but defined locally to keep this module standalone.
function drawLogomark(page: PDFPage, x: number, y: number, size: number) {
  const s = size / 100;
  page.drawRectangle({
    x: x + 11 * s, y: y + 31 * s, width: 60 * s, height: 50 * s,
    borderColor: COLOR.ACCENT_SOFT, borderWidth: 4.4 * s,
  });
  page.drawRectangle({
    x: x + 27 * s, y: y + 15 * s, width: 60 * s, height: 50 * s,
    borderColor: COLOR.ACCENT, borderWidth: 6.8 * s,
  });
}

// "BuildSlides" wordmark (logomark + text) used in the page header strip.
// Compact variant: logomark sized to text height.
function drawWordmark(
  page: PDFPage,
  x: number,
  y: number,
  fontSize: number,
  pjsFont: PDFFont,
  textColor: ReturnType<typeof rgb>,
) {
  const iconSize = fontSize * 1.6;
  drawLogomark(page, x, y - iconSize * 0.15, iconSize);
  page.drawText("BuildSlides", {
    x: x + iconSize + iconSize * 0.3,
    y, size: fontSize, font: pjsFont, color: textColor,
  });
}

// Place an image inside the given tile (cover-fit, cropped — no letterbox).
// When `img` is present we paint *only* the image (no background block) and
// add a 0.5pt hairline border so the edge reads cleanly. When `img` is null
// we render a soft empty surface + brackets so the placement is still legible.
function drawPhotoTile(
  page: PDFPage,
  img: PDFImage | null,
  x: number,
  y: number,
  w: number,
  h: number,
  emptyBg: ReturnType<typeof rgb>,
  bracket: ReturnType<typeof rgb>,
  opts: { borderColor?: ReturnType<typeof rgb>; cornerBrackets?: boolean } = {},
) {
  if (img) {
    // Cover-fit (crop): scale to fully cover the tile and centre. Use a PDF
    // graphics-state clip path so any image bleed past tile bounds is hidden
    // cleanly — no letterbox bars and no overflow.
    const scale = Math.max(w / img.width, h / img.height);
    const fw = img.width * scale, fh = img.height * scale;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(x, y, w, h),
      clip(),
      endPath(),
    );
    page.drawImage(img, {
      x: x + (w - fw) / 2,
      y: y + (h - fh) / 2,
      width: fw, height: fh,
    });
    page.pushOperators(popGraphicsState());
    // Hairline outline so the photo edge reads cleanly on either surface.
    const maskColor = opts.borderColor ?? bracket;
    page.drawRectangle({
      x, y, width: w, height: h,
      borderColor: maskColor, borderWidth: 0.5,
    });
  } else {
    // No image — soft empty surface so the layout still reads. Brackets only
    // appear on empty tiles (they're a placeholder cue, not a frame).
    page.drawRectangle({ x, y, width: w, height: h, color: emptyBg });
    if (opts.cornerBrackets !== false) {
      drawCornerBrackets(page, x, y, w, h, bracket);
    }
  }
}

// Draw a small "+N more" pill at the bottom-right corner of a photo tile.
function drawMorePill(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  more: number,
  font: PDFFont,
  textColor: ReturnType<typeof rgb>,
  bgColor: ReturnType<typeof rgb>,
) {
  if (more <= 0) return;
  const label = `+${more} MORE`;
  const fs = 7;
  const tw = font.widthOfTextAtSize(label, fs);
  const padX = 6, padY = 3;
  const pw = tw + padX * 2;
  const ph = fs + padY * 2;
  const px = x + w - pw - 6;
  const py = y + 6;
  void h;
  page.drawRectangle({ x: px, y: py, width: pw, height: ph, color: bgColor });
  page.drawText(label, { x: px + padX, y: py + padY + 1, size: fs, font, color: textColor });
}

// ============ Shared page chrome ============
//
// Both horizontal layouts share the same top + bottom strip:
//   header: wordmark · TEMPLATE A/B · CLIENT DECK/PRODUCTION LOG · SAMPLE   right: eyebrow
//   footer: BUILDSLIDES · REPORT TEMPLATES · <date>                          right: PAGE 0X / 0Y
// `surface` controls whether the chrome inverts for the dark INK page.
type Chrome = "paper" | "ink";

function drawPageChrome(
  page: PDFPage,
  args: {
    W: number; H: number;
    chrome: Chrome;
    pjsFont: PDFFont; irFont: PDFFont;
    eyebrowLeft: string;       // e.g. "TEMPLATE A · CLIENT DECK · SAMPLE"
    eyebrowRight: string;      // e.g. "DAILY BUILD REPORT · DAY 03 · LOAD-IN"
    footerLeft: string;        // e.g. "BUILDSLIDES · REPORT · 17 MAY 2026"
    pageNumber: number;
    totalPages: number;
  },
) {
  const { W, H, chrome, pjsFont, irFont } = args;
  const ink = chrome === "ink";
  const textColor = ink ? COLOR.TEXT_ON_INK : COLOR.TEXT_ON_PAPER;
  const mutedColor = ink ? COLOR.MUTED_ON_INK : COLOR.MUTED_ON_PAPER;
  const ruleColor = ink ? COLOR.MUTED_ON_INK : COLOR.RULE;

  // Top strip
  const HEADER_Y = H - 14 * MM;
  drawWordmark(page, 12 * MM, HEADER_Y, 9, pjsFont, textColor);
  page.drawText(args.eyebrowLeft, {
    x: 38 * MM, y: HEADER_Y + 1, size: 7, font: irFont, color: mutedColor,
  });
  const erW = irFont.widthOfTextAtSize(args.eyebrowRight, 7);
  page.drawText(args.eyebrowRight, {
    x: W - 12 * MM - erW, y: HEADER_Y + 1, size: 7, font: irFont, color: COLOR.ACCENT,
  });
  page.drawLine({
    start: { x: 12 * MM, y: HEADER_Y - 4 },
    end: { x: W - 12 * MM, y: HEADER_Y - 4 },
    thickness: 0.4, color: ruleColor,
  });

  // Bottom strip
  const FOOTER_Y = 12 * MM;
  page.drawLine({
    start: { x: 12 * MM, y: FOOTER_Y + 5 },
    end: { x: W - 12 * MM, y: FOOTER_Y + 5 },
    thickness: 0.4, color: ruleColor,
  });
  page.drawText(args.footerLeft, {
    x: 12 * MM, y: FOOTER_Y - 4, size: 7, font: irFont, color: mutedColor,
  });
  const pn = `PAGE ${String(args.pageNumber).padStart(2, "0")} / ${String(args.totalPages).padStart(2, "0")}`;
  const pnW = irFont.widthOfTextAtSize(pn, 7);
  page.drawText(pn, {
    x: W - 12 * MM - pnW, y: FOOTER_Y - 4, size: 7, font: irFont, color: mutedColor,
  });
}

// ============ Phase / day-meta helpers ============
//
// Build the eyebrow string "DAY 03 · LOAD-IN" used on every horizontal page.
// We have buildDayLabel ("Build Day 3") but no per-day phase string — until
// the schema gains one, we just emit "DAY 03". Once a phase field exists we
// can append " · LOAD-IN" without breaking the layout.
function dayEyebrow(buildDayLabel: string): string {
  const n = parseInt(buildDayLabel.replace(/\D+/g, ""), 10);
  if (!Number.isFinite(n)) return "DAILY BUILD REPORT";
  return `DAILY BUILD REPORT · DAY ${String(n).padStart(2, "0")}`;
}

// Compress a long event title onto two lines max. The mock uses display-size
// type that wraps naturally; we wrap manually so we can size the title down
// when the event name is very long.
function fitTitle(name: string, font: PDFFont, maxWidth: number, prefer = 38, min = 22): { lines: string[]; size: number } {
  const target = name.trim() || "Event";
  for (let size = prefer; size >= min; size -= 2) {
    const lines = wrapLines(target, font, size, maxWidth);
    if (lines.length <= 2) return { lines, size };
  }
  // Fallback: force two-line truncation at min size.
  const lines = wrapLines(target, font, min, maxWidth).slice(0, 2);
  return { lines, size: min };
}

// ============ Template A — Client deck ============
//
// Page 1: Cover. Hero photo + event title + status pill + venue/date line.
// Page 2..N: Per-day spread. "Today in 6 lines" column + 2×2 zone tile grid.
//
// MVP scope: one cover + one spread (current report day). When per-day data
// is unavailable we hide the affected blocks rather than fabricate filler.
export async function renderHorizontalDeckV1(args: RenderArgs): Promise<void> {
  const { pdfDoc, pjsFont, irFont, proj, areaData, dayNote, reportDateLabel, buildDayLabel } = args;
  // Landscape A4 — swap width / height vs the portrait template.
  const W = 841.89, H = 595.28;

  const eventName = (proj.name ?? "Event").trim();
  const venue = (proj.event_location ?? "").trim();
  const eyebrow = dayEyebrow(buildDayLabel);
  // Day-spread total count: just the spread page for now (cover + 1 spread).
  // When we add per-day pagination this becomes dayCount + 1.
  const totalPages = 2;
  const footerLeft = `BUILDSLIDES · DAILY REPORT · ${reportDateLabel.toUpperCase()}`;

  // ===== Cover page =====
  {
    const page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR.PAPER });
    drawPageChrome(page, {
      W, H, chrome: "paper", pjsFont, irFont,
      eyebrowLeft: "TEMPLATE A · CLIENT DECK",
      eyebrowRight: eyebrow,
      footerLeft, pageNumber: 1, totalPages,
    });

    // Title block — large display
    const TITLE_Y = H - 26 * MM;
    const titleMaxW = W - 24 * MM;
    const fitted = fitTitle(`${eventName}.`, pjsFont, titleMaxW, 40, 24);
    let ty = TITLE_Y;
    for (const ln of fitted.lines) {
      page.drawText(ln, { x: 12 * MM, y: ty, size: fitted.size, font: pjsFont, color: COLOR.INK });
      ty -= fitted.size * 1.05;
    }

    // Venue / date subline
    const subParts: string[] = [];
    if (venue) subParts.push(venue.toUpperCase());
    if (reportDateLabel) subParts.push(reportDateLabel.toUpperCase());
    const subline = subParts.join("  ·  ");
    if (subline) {
      page.drawText(subline, {
        x: 12 * MM, y: ty - 4, size: 8.5, font: irFont, color: COLOR.MUTED_ON_PAPER,
      });
    }

    // Hero photo tile — pick the first photo we have. If no photo, render
    // a labelled placeholder tile with brackets so the page still reads.
    // Per spec ("hide sections entirely if data is missing") we still draw
    // the cover but skip the tile if there are zero photos overall.
    const hero = areaData.find(a => a.photoImages.some(Boolean));
    const heroImg = hero?.photoImages.find(Boolean) ?? null;
    const heroLabel = hero ? hero.name.toUpperCase() : "";

    const TILE_TOP = ty - 16;
    const TILE_BOTTOM = 40 * MM;
    const TILE_H = TILE_TOP - TILE_BOTTOM;
    const TILE_W = W - 24 * MM;
    if (TILE_H > 60) {
      drawPhotoTile(page, heroImg, 12 * MM, TILE_BOTTOM, TILE_W, TILE_H, COLOR.RULE, COLOR.MUTED_ON_PAPER);
      if (!heroImg && heroLabel) {
        const lbl = `${heroLabel} · LOAD-IN OVERVIEW`;
        const lw = irFont.widthOfTextAtSize(lbl, 8.5);
        page.drawText(lbl, {
          x: 12 * MM + (TILE_W - lw) / 2,
          y: TILE_BOTTOM + TILE_H / 2 - 3,
          size: 8.5, font: irFont, color: COLOR.MUTED_ON_PAPER,
        });
      }
    }

    // Status pill (bottom-right corner)
    const statusChip = chipFor(proj.overall_status ?? "");
    if (statusChip) {
      const labelText = "STATUS";
      const lw = irFont.widthOfTextAtSize(labelText, 7);
      const chipW = irFont.widthOfTextAtSize(statusChip.label, 7.5) + 12;
      const totalW = lw + 6 + chipW;
      const baseX = W - 12 * MM - totalW;
      const baseY = 22 * MM;
      page.drawText(labelText, { x: baseX, y: baseY + 3, size: 7, font: irFont, color: COLOR.MUTED_ON_PAPER });
      drawChip(page, baseX + lw + 6, baseY, statusChip.label, statusChip.text, statusChip.bg, irFont, 7.5);
    }

    // "Prepared by" left of the status pill — only if we have a client name
    // (proxy for "prepared for / by" until we wire auth-user lookup in).
    if (proj.client_name) {
      page.drawText("PREPARED FOR", { x: 12 * MM, y: 22 * MM + 3, size: 7, font: irFont, color: COLOR.MUTED_ON_PAPER });
      page.drawText(proj.client_name, { x: 12 * MM, y: 22 * MM - 8, size: 9, font: pjsFont, color: COLOR.INK });
    }
  }

  // ===== Per-day spread =====
  {
    const page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR.PAPER });
    drawPageChrome(page, {
      W, H, chrome: "paper", pjsFont, irFont,
      eyebrowLeft: "TEMPLATE A · CLIENT DECK",
      eyebrowRight: eyebrow,
      footerLeft, pageNumber: 2, totalPages,
    });

    // ----- Left column: "Today in 6 lines" -----
    const LEFT_X = 12 * MM;
    const LEFT_W = 0.32 * W;        // 32% of width for the bullet column
    const TOP_Y = H - 24 * MM;

    // Pull bullets from achievements first, fall back to notes paragraph.
    const bullets = (() => {
      const fromAchievements = toBullets(dayNote?.today_achievements, 6);
      if (fromAchievements.length) return fromAchievements;
      return toBullets(dayNote?.notes, 6);
    })();
    const headline = bullets[0] ?? "";
    const restBullets = bullets.slice(1, 6);

    const hasBullets = bullets.length > 0;
    let leftY = TOP_Y;
    if (hasBullets) {
      page.drawText("TODAY IN 6 LINES", {
        x: LEFT_X, y: leftY, size: 7, font: irFont, color: COLOR.ACCENT,
      });
      leftY -= 16;
      // Headline: bigger display weight
      const headlineLines = wrapLines(headline, pjsFont, 22, LEFT_W);
      for (const ln of headlineLines.slice(0, 2)) {
        page.drawText(ln, { x: LEFT_X, y: leftY, size: 22, font: pjsFont, color: COLOR.INK });
        leftY -= 26;
      }
      leftY -= 4;
      // Up to 5 remaining bullets
      for (const b of restBullets) {
        const lines = wrapLines(b, irFont, 9.5, LEFT_W - 14);
        // Dot
        page.drawCircle({ x: LEFT_X + 3, y: leftY + 4, size: 1.6, color: COLOR.ACCENT });
        for (let i = 0; i < lines.length; i++) {
          page.drawText(lines[i], {
            x: LEFT_X + 12, y: leftY + (i === 0 ? 0 : -12 * i),
            size: 9.5, font: irFont, color: COLOR.INK,
          });
        }
        leftY -= 14 + (lines.length - 1) * 12;
      }
    }

    // ----- Right grid: 2×2 zone tiles -----
    const GRID_X = LEFT_X + LEFT_W + 10 * MM;
    const GRID_W = W - GRID_X - 12 * MM;
    const GRID_TOP = H - 24 * MM;
    const GRID_BOTTOM = 30 * MM;
    const GRID_H = GRID_TOP - GRID_BOTTOM;
    const CAPTION_BAND = 38;        // space below each tile for label + note
    const TILE_GAP = 10;
    const TILE_W = (GRID_W - TILE_GAP) / 2;
    const TILE_H = (GRID_H - TILE_GAP) / 2 - CAPTION_BAND;

    // Build the tile list. When we have only 1–2 zones with multiple photos
    // each, fill the 2×2 grid with photos (still grouped, captioned by zone).
    // When we have ≥3 zones, show one hero per zone (up to 4). This way the
    // grid never wastes tiles when the user has more photos to show.
    type Tile = { img: PDFImage | null; zoneName: string; caption: string; more: number };
    const tiles: Tile[] = [];
    const zonesWithPhotos = areaData.filter(a => a.photoImages.some(Boolean));
    if (zonesWithPhotos.length <= 2 && zonesWithPhotos.length > 0) {
      // Distribute the 4 grid slots fairly across the 1–2 zones with photos.
      // Then if we still have empty slots and one zone has more photos to
      // show, top up from that zone so the grid never has a hanging blank.
      const zoneAllocations = zonesWithPhotos.map(a => {
        const imgs = a.photoImages.filter((p): p is PDFImage => !!p);
        return { area: a, imgs, take: Math.min(imgs.length, Math.max(1, Math.ceil(4 / zonesWithPhotos.length))) };
      });
      // Top up to fill 4 slots if any zone still has extras
      let used = zoneAllocations.reduce((n, z) => n + z.take, 0);
      while (used < 4) {
        const z = zoneAllocations.find(z => z.take < z.imgs.length);
        if (!z) break;
        z.take += 1;
        used += 1;
      }
      for (const z of zoneAllocations) {
        const take = z.imgs.slice(0, z.take);
        for (let k = 0; k < take.length; k++) {
          const capParts: string[] = [];
          if (k === 0 && z.area.notes && z.area.notes.trim()) {
            capParts.push(z.area.notes.split(/\r?\n/)[0] ?? "");
          }
          tiles.push({
            img: take[k],
            zoneName: z.area.name.toUpperCase(),
            caption: capParts.join(" \u00b7 "),
            more: k === take.length - 1 ? Math.max(0, z.imgs.length - take.length) : 0,
          });
        }
      }
      // If we still have zones without photos, append placeholder tiles for them.
      const noPhotoZones = areaData.filter(a => !a.photoImages.some(Boolean));
      for (const a of noPhotoZones) {
        if (tiles.length >= 4) break;
        tiles.push({
          img: null,
          zoneName: a.name.toUpperCase(),
          caption: (a.notes ?? "").split(/\r?\n/)[0] ?? "",
          more: 0,
        });
      }
    } else {
      // ≥3 zones — 1 hero per zone, up to 4.
      const topAreas = areaData.slice(0, 4);
      for (const a of topAreas) {
        const imgs = a.photoImages.filter((p): p is PDFImage => !!p);
        const hero = imgs[0] ?? null;
        const cap = (a.notes ?? "").split(/\r?\n/)[0] ?? "";
        tiles.push({
          img: hero,
          zoneName: a.name.toUpperCase(),
          caption: cap,
          more: Math.max(0, imgs.length - 1),
        });
      }
    }

    const visibleTiles = tiles.slice(0, 4);
    for (let i = 0; i < visibleTiles.length; i++) {
      const t = visibleTiles[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = GRID_X + col * (TILE_W + TILE_GAP);
      const tyTop = GRID_TOP - row * (TILE_H + CAPTION_BAND + TILE_GAP);
      const ty = tyTop - TILE_H;
      drawPhotoTile(page, t.img, tx, ty, TILE_W, TILE_H, COLOR.RULE, COLOR.MUTED_ON_PAPER);
      if (!t.img) {
        const lw = irFont.widthOfTextAtSize(t.zoneName, 8);
        page.drawText(t.zoneName, {
          x: tx + (TILE_W - lw) / 2,
          y: ty + TILE_H / 2 - 3,
          size: 8, font: irFont, color: COLOR.MUTED_ON_PAPER,
        });
      }
      if (t.img && t.more > 0) {
        drawMorePill(page, tx, ty, TILE_W, TILE_H, t.more, irFont, COLOR.INK, COLOR.PAPER);
      }
      // Caption band
      const capY = ty - 14;
      page.drawText(t.zoneName, {
        x: tx, y: capY, size: 8, font: pjsFont, color: COLOR.INK,
      });
      if (t.caption && t.caption.trim()) {
        const oneLine = wrapLines(t.caption, irFont, 8.5, TILE_W)[0] ?? "";
        page.drawText(oneLine, { x: tx, y: capY - 12, size: 8.5, font: irFont, color: COLOR.MUTED_ON_PAPER });
      }
    }
  }
}

// ============ Template B — Production log ============
//
// Single landscape page on INK_DARK surface. Lays out:
//   * Event title block (top-left)
//   * KPI strip: PHOTOS · ZONES · (ON-TRACK %)
//     SNAGS card omitted — no source data. ON-TRACK only renders if every
//     area has a status row (otherwise we can't honestly derive a %).
//   * "Today's narrative" card (optional, hidden when day_note.notes empty)
//   * Zone breakdown row (4 cards across), each with status chip + bullets
//
// Snags & follow-ups footer is intentionally omitted — there is no snags
// table yet. When we add one this is the place to render it.
export async function renderHorizontalLogV1(args: RenderArgs): Promise<void> {
  const { pdfDoc, pjsFont, irFont, proj, areaData, dayPhotos, dayNote, reportDateLabel, buildDayLabel } = args;
  const W = 841.89, H = 595.28;

  const eventName = (proj.name ?? "Event").trim();
  const venue = (proj.event_location ?? "").trim();
  const eyebrowRight = dayEyebrow(buildDayLabel).replace("DAILY BUILD REPORT", "PRODUCTION LOG");
  const footerLeft = `BUILDSLIDES · PRODUCTION LOG · ${reportDateLabel.toUpperCase()}`;
  const totalPages = 1;

  const page = pdfDoc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLOR.INK });
  drawPageChrome(page, {
    W, H, chrome: "ink", pjsFont, irFont,
    eyebrowLeft: "TEMPLATE B · PRODUCTION LOG",
    eyebrowRight,
    footerLeft, pageNumber: 1, totalPages,
  });

  // ----- Title block -----
  const TITLE_Y = H - 28 * MM;
  const titleMaxW = W - 24 * MM;
  const fitted = fitTitle(`${eventName}.`, pjsFont, titleMaxW, 32, 22);
  let ty = TITLE_Y;
  for (const ln of fitted.lines) {
    page.drawText(ln, { x: 12 * MM, y: ty, size: fitted.size, font: pjsFont, color: COLOR.TEXT_ON_INK });
    ty -= fitted.size * 1.05;
  }
  // Sub-line: venue · date — no crew count (no source data).
  const subParts: string[] = [];
  if (venue) subParts.push(venue.toUpperCase());
  subParts.push(reportDateLabel.toUpperCase());
  page.drawText(subParts.join("  ·  "), {
    x: 12 * MM, y: ty - 4, size: 8.5, font: irFont, color: COLOR.ACCENT,
  });

  // ----- KPI strip -----
  //
  // Card layout (variable count, evenly distributed across content width):
  //   PHOTOS  |  ZONES  |  ON-TRACK %  (only if derivable)
  // Each card: small accent eyebrow + 1pt rule + huge numeric value.
  const photosKpi = String(dayPhotos.length);
  const zonesKpi = String(areaData.length);
  // On-track % from area_day_status: count areas with status === on_track.
  // Hidden unless every shown area has a status (we don't want to mislead).
  let onTrackKpi: string | null = null;
  if (areaData.length > 0 && areaData.every(a => a.status && a.status !== "no_status")) {
    const ok = areaData.filter(a => a.status === "on_track" || a.status === "complete").length;
    onTrackKpi = `${Math.round((ok / areaData.length) * 100)}%`;
  }

  const kpis: { label: string; value: string }[] = [
    { label: "PHOTOS", value: photosKpi },
    { label: "ZONES", value: zonesKpi },
  ];
  if (onTrackKpi) kpis.push({ label: "ON-TRACK", value: onTrackKpi });

  const KPI_TOP = ty - 24;
  const KPI_H = 38 * MM;
  const KPI_BOTTOM = KPI_TOP - KPI_H;
  const KPI_GAP = 12;
  const KPI_AREA_W = W - 24 * MM;
  // Cap card width — if we only have 2 KPIs they shouldn't sprawl across the
  // whole width and look unbalanced. Max each card at ~82mm.
  const KPI_MAX_W = 82 * MM;
  const KPI_W = Math.min(
    KPI_MAX_W,
    (KPI_AREA_W - KPI_GAP * (kpis.length - 1)) / kpis.length,
  );
  for (let i = 0; i < kpis.length; i++) {
    const kx = 12 * MM + i * (KPI_W + KPI_GAP);
    // Card surface — subtle lift on ink with a 0.5pt outline.
    page.drawRectangle({
      x: kx, y: KPI_BOTTOM, width: KPI_W, height: KPI_H,
      borderColor: COLOR.MUTED_ON_INK, borderWidth: 0.5,
    });
    // Accent rule (top-left), per mock
    page.drawLine({
      start: { x: kx + 12, y: KPI_TOP - 12 },
      end: { x: kx + 32, y: KPI_TOP - 12 },
      thickness: 1.5, color: COLOR.ACCENT,
    });
    page.drawText(kpis[i].label, {
      x: kx + 12, y: KPI_TOP - 22, size: 8, font: irFont, color: COLOR.MUTED_ON_INK,
    });
    // Big value — sized to fit card
    page.drawText(kpis[i].value, {
      x: kx + 12, y: KPI_BOTTOM + 14, size: 38, font: pjsFont, color: COLOR.TEXT_ON_INK,
    });
  }

  // ----- "Today's narrative" card (hidden if empty) -----
  const narrative = (dayNote?.notes ?? "").trim();
  const NARR_TOP = KPI_BOTTOM - 14;
  const NARR_H = 50 * MM;
  const NARR_BOTTOM = NARR_TOP - NARR_H;
  let zoneRowTop: number;
  if (narrative) {
    // Accent left rail + outline
    page.drawRectangle({
      x: 12 * MM, y: NARR_BOTTOM, width: 3, height: NARR_H, color: COLOR.ACCENT,
    });
    page.drawRectangle({
      x: 12 * MM + 3, y: NARR_BOTTOM, width: W - 24 * MM - 3, height: NARR_H,
      borderColor: COLOR.MUTED_ON_INK, borderWidth: 0.5,
    });
    page.drawText("TODAY'S NARRATIVE", {
      x: 12 * MM + 16, y: NARR_TOP - 14, size: 8, font: irFont, color: COLOR.ACCENT,
    });
    const lines = wrapLines(narrative, irFont, 10.5, W - 24 * MM - 32).slice(0, 6);
    let ny = NARR_TOP - 30;
    for (const ln of lines) {
      page.drawText(ln, { x: 12 * MM + 16, y: ny, size: 10.5, font: irFont, color: COLOR.TEXT_ON_INK });
      ny -= 14;
    }
    zoneRowTop = NARR_BOTTOM - 16;
  } else {
    // No narrative — slide the zone row up to fill the space.
    zoneRowTop = NARR_TOP;
  }

  // ----- Zone breakdown row -----
  //
  // Up to 4 cards across. Each: photo tile + status chip + zone label +
  // up to 3 note bullets. Cards omit gracefully when an area has no photo
  // or no notes (chip only renders if status set).
  const topAreas = areaData.slice(0, 4);
  if (topAreas.length > 0) {
    const ZONE_BOTTOM = 22 * MM;
    const ZONE_H = zoneRowTop - ZONE_BOTTOM;
    const ZONE_GAP = 10;
    const ZONE_AREA_W = W - 24 * MM;
    const ZONE_W = (ZONE_AREA_W - ZONE_GAP * (topAreas.length - 1)) / topAreas.length;
    const PHOTO_H = Math.max(40, Math.min(ZONE_H * 0.55, 65 * MM));

    for (let i = 0; i < topAreas.length; i++) {
      const a = topAreas[i];
      const zx = 12 * MM + i * (ZONE_W + ZONE_GAP);
      const photoTop = zoneRowTop;
      const photoBottom = photoTop - PHOTO_H;
      const imgs = a.photoImages.filter((p): p is PDFImage => !!p);
      const heroImg = imgs[0] ?? null;
      drawPhotoTile(page, heroImg, zx, photoBottom, ZONE_W, PHOTO_H, COLOR.MUTED_ON_INK, COLOR.MUTED_ON_INK, {
        borderColor: COLOR.MUTED_ON_INK,
      });
      if (!heroImg) {
        const lbl = a.name.toUpperCase();
        const lw = irFont.widthOfTextAtSize(lbl, 8);
        page.drawText(lbl, {
          x: zx + (ZONE_W - lw) / 2,
          y: photoBottom + PHOTO_H / 2 - 3,
          size: 8, font: irFont, color: COLOR.MUTED_ON_INK,
        });
      }
      if (heroImg && imgs.length > 1) {
        drawMorePill(page, zx, photoBottom, ZONE_W, PHOTO_H, imgs.length - 1, irFont, COLOR.TEXT_ON_INK, COLOR.INK);
      }
      // Status chip below the photo
      let chipBottom = photoBottom - 18;
      const chip = chipFor(a.status);
      if (chip) {
        drawChip(page, zx, chipBottom, chip.label, chip.text, chip.bg, irFont, 7.5);
      }
      // Zone label
      const labelY = chipBottom - 12;
      page.drawText(a.name.toUpperCase(), {
        x: zx, y: labelY, size: 8, font: pjsFont, color: COLOR.TEXT_ON_INK,
      });
      // Up to 3 note bullets
      if (a.notes && a.notes.trim()) {
        const bullets = toBullets(a.notes, 3);
        let by = labelY - 14;
        for (const b of bullets) {
          const lines = wrapLines(b, irFont, 8.5, ZONE_W - 12).slice(0, 2);
          // Dot
          page.drawCircle({ x: zx + 3, y: by + 3.5, size: 1.4, color: COLOR.ACCENT });
          for (let k = 0; k < lines.length; k++) {
            page.drawText(lines[k], {
              x: zx + 10, y: by - k * 11,
              size: 8.5, font: irFont, color: COLOR.TEXT_ON_INK,
            });
          }
          by -= 12 + (lines.length - 1) * 11;
        }
      }
    }
  }
}
