// new-layouts.ts
// Two new PDF layout renderers for ReportAir.
//
//   renderEditorialPortraitV1  — "Editorial" A4 portrait
//     Dark charcoal cover, DM Sans display title, ON TRACK pill under title,
//     orange accent rule, cover photo, 2×2 daily info fields, bottom strip.
//     Area pages: paper bg, area name + status pill far-right, 2-photo grid,
//     notes, single-row footer (event · date · page).
//
//   renderGridLandscapeV1      — "Grid" landscape A4
//     Light PAPER bg, full-width INK header bar, left content column + right
//     cover photo. Area pages: dark sidebar (area/status/date) + photos column
//     (2×2 grid or 2 portrait) + notes column.
//     Bottom bar: project name · date left | OVERALL STATUS + pill right.
//
// Uses only pdf-lib primitives (same as index.ts) — no extra deps.
// Font convention: pjsFont = Plus Jakarta Sans Bold (display/headings)
//                  irFont  = Inter Regular (body/mono/labels)

import {
  PDFDocument, PDFFont, PDFImage, PDFPage, rgb,
  pushGraphicsState, popGraphicsState, rectangle, clip, endPath,
} from "https://esm.sh/pdf-lib@1.17.1";

// ── Shared helpers ────────────────────────────────────────────────────────────

const MM = 2.83465;

function hex(h: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

// Brand palette
const C = {
  INK:      hex("#0F1417"),
  PAPER:    hex("#F4F1EA"),
  ACCENT:   hex("#D94F2A"),
  MUTED:    hex("#6B6B66"),
  RULE:     hex("#C9C5BC"),
  WHITE:    rgb(1, 1, 1),
  // Cover dark tones
  CHARCOAL:      hex("#1A1A1A"),
  COVER_CELL_BG: hex("#242424"),
  COVER_CELL_BD: hex("#3A3A3A"),
  COVER_PHOTO:   hex("#2E2E2E"),
  COVER_PHOTO_BD:hex("#555555"),
  COVER_MUTED:   hex("#A1A1AA"),
  COVER_DATE:    hex("#71717A"),
  COVER_VALUE:   hex("#CCCCCC"),
  // Status
  GREEN: hex("#22C55E"),
  BLUE:  hex("#3B82F6"),
  GREY:  hex("#9CA3AF"),
  // Photo placeholder
  PHOTO_BG: hex("#E8E6E0"),
  PHOTO_BD: hex("#C9C5BC"),
  // Sidebar
  SIDEBAR_RULE: hex("#2A3F58"),
  SIDEBAR_DATE: hex("#B0BAC6"),
  SIDEBAR_PG:   hex("#4A6080"),
};

function statusColour(s: string | null): ReturnType<typeof rgb> {
  if (!s) return C.GREY;
  const l = s.toLowerCase();
  if (l.includes("track") || l.includes("complete") || l === "done") {
    return l.includes("complete") || l === "done" ? C.BLUE : C.GREEN;
  }
  if (l.includes("delay") || l.includes("snag") || l.includes("risk")) return hex("#EF4444");
  return C.GREY;
}

function statusLabel(s: string | null): string {
  if (!s || s === "no_status") return "—";
  return s.replace(/_/g, " ").toUpperCase();
}

/** Clip content to a rectangle, execute draw calls, then restore. */
function withClip(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  draw: () => void,
) {
  page.pushOperators(
    pushGraphicsState(),
    rectangle(x, y, w, h),
    clip(),
    endPath(),
  );
  draw();
  page.pushOperators(popGraphicsState());
}

/** Draw a filled + optionally stroked rectangle. */
function fillRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  fill: ReturnType<typeof rgb>,
  strokeColor?: ReturnType<typeof rgb>,
  strokeWidth = 0.5,
) {
  page.drawRectangle({
    x, y, width: w, height: h,
    color: fill,
    ...(strokeColor ? { borderColor: strokeColor, borderWidth: strokeWidth } : {}),
  });
}

/** Draw a rounded-rectangle pill with centred label. */
function pill(
  page: PDFPage,
  x: number, y: number,
  label: string,
  bg: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb>,
  font: PDFFont,
  fontSize = 7,
): number {
  const padH = 6, padV = 3.5;
  const tw = font.widthOfTextAtSize(label, fontSize);
  const pw = tw + padH * 2;
  const ph = fontSize + padV * 2;
  page.drawRectangle({ x, y, width: pw, height: ph, color: bg, borderRadius: ph / 2 });
  page.drawText(label, { x: x + padH, y: y + padV + 0.5, size: fontSize, font, color: textColor });
  return pw;
}

/** Draw text and return width. */
function txt(
  page: PDFPage,
  text: string,
  x: number, y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  anchor: "left" | "right" | "center" = "left",
  maxWidth?: number,
): number {
  let s = text;
  if (maxWidth) {
    while (s.length > 1 && font.widthOfTextAtSize(s, size) > maxWidth) s = s.slice(0, -1);
    if (s !== text) s = s.slice(0, -1) + "…";
  }
  const tw = font.widthOfTextAtSize(s, size);
  const dx = anchor === "right" ? x - tw : anchor === "center" ? x - tw / 2 : x;
  page.drawText(s, { x: dx, y, size, font, color });
  return tw;
}

/** Wrap text into lines no wider than maxWidth. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Draw an image scaled to fit a box, centred. */
function drawImageFit(
  page: PDFPage,
  img: PDFImage,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.min(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
}

/** Draw a photo placeholder box. */
function photoPlaceholder(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  font: PDFFont,
  label = "PHOTO",
  img?: PDFImage | null,
) {
  fillRect(page, x, y, w, h, C.PHOTO_BG, C.PHOTO_BD, 0.5);
  if (img) {
    withClip(page, x, y, w, h, () => {
      const scale = Math.max(w / img.width, h / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      page.drawImage(img, {
        x: x + (w - iw) / 2,
        y: y + (h - ih) / 2,
        width: iw, height: ih,
      });
    });
  } else {
    const lw = font.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: x + w / 2 - lw / 2, y: y + h / 2 - 4, size: 8, font, color: hex("#AAAAAA") });
  }
}

/** Draw the BuildSlides overlapping-squares mark. Returns width consumed. */
function drawLogoMark(
  page: PDFPage,
  x: number, y: number,
  size = 14,
  darkBg = false,
): number {
  const offset = size * 0.28;
  const sq = size - offset;
  if (darkBg) {
    page.drawRectangle({ x, y: y + offset, width: sq, height: sq, color: hex("#2A2A2A"), borderColor: hex("#888888"), borderWidth: 0.6 });
    page.drawRectangle({ x: x + offset * 0.5, y: y + offset * 0.5, width: sq, height: sq, color: C.PAPER, borderColor: hex("#CCCCCC"), borderWidth: 0.4 });
  } else {
    page.drawRectangle({ x, y: y + offset, width: sq, height: sq, color: C.INK, borderColor: C.INK, borderWidth: 0.5 });
    page.drawRectangle({ x: x + offset * 0.5, y: y + offset * 0.5, width: sq, height: sq, color: C.PAPER, borderColor: C.INK, borderWidth: 0.5 });
  }
  page.drawRectangle({ x: x + offset, y, width: sq, height: sq, color: C.ACCENT, borderColor: C.ACCENT, borderWidth: 0.3 });
  return size;
}

/** Draw BuildSlides wordmark (mark + text). Returns total width. */
function drawWordmark(
  page: PDFPage,
  x: number, y: number,
  font: PDFFont,
  fontSize = 10,
  darkBg = false,
  markSize = 14,
  logoImage?: PDFImage | null,
  companyName?: string | null,
  whiteLabelPdf?: boolean,
): number {
  if (whiteLabelPdf && logoImage) {
    const maxH = markSize * 1.4;
    const scale = Math.min(maxH / logoImage.height, 120 / logoImage.width);
    const lw = logoImage.width * scale, lh = logoImage.height * scale;
    page.drawImage(logoImage, { x, y: y - lh * 0.1, width: lw, height: lh });
    return lw;
  }
  const mw = drawLogoMark(page, x, y, markSize, darkBg);
  const gap = mw + 5;
  const textColor = darkBg ? C.WHITE : C.INK;
  const textY = y + (markSize - fontSize) * 0.35;
  page.drawText(companyName || "BuildSlides", { x: x + gap, y: textY, size: fontSize, font, color: textColor });
  const tw = font.widthOfTextAtSize(companyName || "BuildSlides", fontSize);
  page.drawText(".", { x: x + gap + tw, y: textY, size: fontSize, font, color: C.ACCENT });
  return gap + tw + font.widthOfTextAtSize(".", fontSize);
}

// ── Shared data types (match index.ts) ───────────────────────────────────────

export type AreaData = {
  id: string;
  name: string;
  status: string;
  notes: string;
  photoCount: number;
  photoImages: (PDFImage | null)[];
  photoCaptions: string[];
};

export type NewLayoutParams = {
  pdfDoc: PDFDocument;
  pjsFont: PDFFont;      // Plus Jakarta Sans Bold — used for display headings
  irFont: PDFFont;       // Inter Regular — used for body / labels / mono
  proj: Record<string, unknown>;
  areaData: AreaData[];
  dayNote: Record<string, unknown> | null;
  reportDateLabel: string;
  buildDayLabel: string;
  reportNumber: string;
  logoImage: PDFImage | null;
  coverImage: PDFImage | null;
  accentColour?: string | null;
  whiteLabelPdf?: boolean;
  companyName?: string | null;
};

// ════════════════════════════════════════════════════════════════════════════
// CONCEPT 1 — Editorial Portrait
// A4 portrait (595 × 842). Dark charcoal cover + light paper area pages.
// ════════════════════════════════════════════════════════════════════════════

export async function renderEditorialPortraitV1(p: NewLayoutParams): Promise<void> {
  const { pdfDoc, pjsFont, irFont, proj, areaData, dayNote, reportDateLabel, buildDayLabel,
          logoImage, coverImage, accentColour, whiteLabelPdf, companyName } = p;

  const W = 595.28, H = 841.89;
  const ML = 42, MR = 42, MT = 42;
  const CW = W - ML - MR; // ~511

  // Effective accent (allow project brand colour override)
  const effectiveAccent = accentColour && /^#[0-9a-fA-F]{6}$/.test(accentColour)
    ? hex(accentColour) : C.ACCENT;

  const font = pjsFont;   // display headings
  const body = irFont;    // body / labels

  // Status helpers
  function statusBg(s: string | null) { return statusColour(s); }

  // ── Shared header (area pages) ─────────────────────────────────────────────
  function drawAreaHeader(page: PDFPage): number {
    const stripTop = H - MT;
    const logoY = stripTop - 16;
    drawWordmark(page, ML, logoY, font, 10, false, 13, logoImage, companyName, whiteLabelPdf);
    const dayLbl = buildDayLabel.toUpperCase();
    const dw = body.widthOfTextAtSize(dayLbl, 8);
    page.drawText(dayLbl, { x: W - MR - dw, y: logoY + 2, size: 8, font: body, color: effectiveAccent });
    const ruleY = logoY - 10;
    page.drawLine({ start: { x: ML, y: ruleY }, end: { x: W - MR, y: ruleY }, thickness: 0.75, color: C.RULE });
    return ruleY;
  }

  // ── Footer (area pages) ────────────────────────────────────────────────────
  function drawAreaFooter(page: PDFPage, pageLabel: string) {
    const ruleY = 46;
    page.drawLine({ start: { x: ML, y: ruleY }, end: { x: W - MR, y: ruleY }, thickness: 0.5, color: C.RULE });
    const rowY = 22;
    const eventName = (proj.name as string) || "Event";
    page.drawText(eventName, { x: ML, y: rowY, size: 7, font: body, color: C.MUTED });
    const dateTxt = reportDateLabel;
    const dw = body.widthOfTextAtSize(dateTxt, 7);
    page.drawText(dateTxt, { x: W / 2 - dw / 2, y: rowY, size: 7, font: body, color: C.MUTED });
    const plw = body.widthOfTextAtSize(pageLabel, 7);
    page.drawText(pageLabel, { x: W - MR - plw, y: rowY, size: 7, font: body, color: C.MUTED });
  }

  // ════════════════════════════════════════════
  // PAGE 1 — COVER
  // ════════════════════════════════════════════
  {
    const page = pdfDoc.addPage([W, H]);

    // Full charcoal background
    fillRect(page, 0, 0, W, H, C.CHARCOAL);

    // Header: wordmark left, day label right
    const stripTop = H - MT;
    const logoY = stripTop - 16;
    drawWordmark(page, ML, logoY, font, 10, true, 13, logoImage, companyName, whiteLabelPdf);
    const dayLbl = buildDayLabel.toUpperCase();
    const dw = body.widthOfTextAtSize(dayLbl, 9);
    page.drawText(dayLbl, { x: W - MR - dw, y: logoY + 2, size: 9, font: body, color: effectiveAccent });

    // Title: event name — full content width, wraps to 2 lines if needed
    const eventName = (proj.name as string) || "Event";
    const titleY = H * 0.80;
    {
      const titleSize = 44;
      const titleLines = wrapText(eventName, font, titleSize, CW);
      titleLines.slice(0, 2).forEach((ln, li) => {
        page.drawText(ln, { x: ML, y: titleY - li * (titleSize + 6), size: titleSize, font, color: C.WHITE });
      });
    }

    // Overall status pill directly under title
    const overallStatus = (proj.overall_status as string | null) ?? null;
    const pillLabel = statusLabel(overallStatus);
    const pillBg = statusBg(overallStatus);
    const pillY = titleY - 58;
    pill(page, ML, pillY, pillLabel, pillBg, C.WHITE, body, 7.5);

    // Accent rule below pill
    const accentRuleY = pillY - 20;
    page.drawLine({ start: { x: ML, y: accentRuleY }, end: { x: W - MR, y: accentRuleY }, thickness: 1.2, color: effectiveAccent });

    // Cover photo placeholder
    const photoTop = accentRuleY - 14;
    const photoH = 150;
    const photoY = photoTop - photoH;
    photoPlaceholder(page, ML, photoY, CW, photoH, body, "COVER PHOTO HERE", coverImage);

    // 2×2 info fields
    const fieldsTop = photoY - 12;
    const colW = (CW - 10) / 2;
    const fieldH = 58, rowGap = 8;
    const fields = [
      { label: "TODAY'S OBJECTIVES",    value: (dayNote?.today_objectives    as string) || "—" },
      { label: "TODAY'S ACHIEVEMENTS",  value: (dayNote?.today_achievements  as string) || "—" },
      { label: "TOMORROW'S OBJECTIVES", value: (dayNote?.tomorrow_objectives as string) || "—" },
      { label: "OPEN ISSUES / RISKS",   value: (dayNote?.open_issues         as string) || "—" },
    ];
    fields.forEach(({ label, value }, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const fx = ML + col * (colW + 10);
      const fy = fieldsTop - row * (fieldH + rowGap) - fieldH;
      fillRect(page, fx, fy, colW, fieldH, C.COVER_CELL_BG, C.COVER_CELL_BD, 0.5);
      page.drawText(label, { x: fx + 8, y: fy + fieldH - 13, size: 5.5, font: body, color: effectiveAccent });
      // Wrap value
      const lines = wrapText(value, body, 9, colW - 20).slice(0, 3);
      lines.forEach((ln, li) => {
        page.drawText(ln, { x: fx + 8, y: fy + fieldH - 26 - li * 11, size: 9, font: body, color: C.COVER_VALUE });
      });
    });

    // ── Area Summary table (like original portrait report) ──────────────────
    const fieldsBottomY = fieldsTop - 1 * (fieldH + rowGap) - fieldH;
    const summaryTopY = fieldsBottomY - 18;
    // Heading
    page.drawText("AREA SUMMARY", { x: ML, y: summaryTopY, size: 8, font, color: C.WHITE });
    page.drawLine({ start: { x: ML, y: summaryTopY - 3 }, end: { x: ML + body.widthOfTextAtSize("AREA SUMMARY", 8) + 2, y: summaryTopY - 3 }, thickness: 1.5, color: effectiveAccent });
    // Column headers
    const sumHeaderY = summaryTopY - 16;
    const sumCols = [
      { label: "AREA",   x: ML,       w: 180 },
      { label: "STATUS", x: ML + 190, w: 100 },
      { label: "PHOTOS", x: ML + 300, w: 60 },
      { label: "NOTES",  x: ML + 370, w: CW - 370 },
    ];
    sumCols.forEach(({ label, x }) => {
      page.drawText(label, { x, y: sumHeaderY, size: 6, font: body, color: C.COVER_MUTED });
    });
    page.drawLine({ start: { x: ML, y: sumHeaderY - 6 }, end: { x: W - MR, y: sumHeaderY - 6 }, thickness: 0.4, color: C.COVER_CELL_BD });
    // Rows
    const rowH = 18;
    areaData.forEach((area, ri) => {
      const ry = sumHeaderY - 6 - (ri + 1) * rowH;
      if (ry < 105) return; // stop if we'd run into the bottom strip
      // Area name
      let aName = area.name || "—";
      while (aName.length > 1 && body.widthOfTextAtSize(aName, 8) > sumCols[0].w - 4) aName = aName.slice(0, -1);
      if (aName !== area.name) aName = aName.slice(0, -1) + "…";
      page.drawText(aName, { x: sumCols[0].x, y: ry + 4, size: 8, font, color: hex("#DDDDDD") });
      // Status pill
      const sLbl = statusLabel(area.status);
      const sBg  = statusBg(area.status);
      const sPh  = 12, sPv = 2.5;
      const sPw  = body.widthOfTextAtSize(sLbl, 6.5) + sPh * 2;
      page.drawRectangle({ x: sumCols[1].x, y: ry + 1, width: sPw, height: 6.5 + sPv * 2, color: sBg, borderRadius: (6.5 + sPv * 2) / 2 });
      page.drawText(sLbl, { x: sumCols[1].x + sPh, y: ry + 1 + sPv + 0.5, size: 6.5, font: body, color: C.WHITE });
      // Photo count
      page.drawText(String(area.photoCount ?? 0), { x: sumCols[2].x, y: ry + 4, size: 8, font: body, color: C.COVER_MUTED });
      // Notes snippet
      let noteSnip = area.notes || "—";
      while (noteSnip.length > 1 && body.widthOfTextAtSize(noteSnip, 7.5) > sumCols[3].w - 4) noteSnip = noteSnip.slice(0, -1);
      if (noteSnip !== (area.notes || "—")) noteSnip = noteSnip.slice(0, -1) + "…";
      page.drawText(noteSnip, { x: sumCols[3].x, y: ry + 4, size: 7.5, font: body, color: C.COVER_MUTED });
      // Row divider
      page.drawLine({ start: { x: ML, y: ry }, end: { x: W - MR, y: ry }, thickness: 0.3, color: C.COVER_CELL_BD });
    });

    // Orange accent rule above bottom strip
    const bottomStripTop = 90;
    page.drawLine({ start: { x: ML, y: bottomStripTop }, end: { x: W - MR, y: bottomStripTop }, thickness: 1.0, color: effectiveAccent });

    // Bottom strip: date left, PREPARED FOR right
    page.drawText(reportDateLabel, { x: ML, y: 52, size: 8, font: body, color: C.COVER_DATE });
    const prepLbl = "PREPARED FOR";
    const prepLblW = body.widthOfTextAtSize(prepLbl, 6.5);
    page.drawText(prepLbl, { x: W - MR - prepLblW, y: 67, size: 6.5, font: body, color: C.COVER_DATE });
    const clientName = (proj.client_name as string) || (companyName ?? "");
    if (clientName) {
      const cnw = font.widthOfTextAtSize(clientName, 11);
      page.drawText(clientName, { x: W - MR - cnw, y: 52, size: 11, font, color: hex("#D4D4D8") });
    }
  }

  // ════════════════════════════════════════════
  // AREA PAGES
  // ════════════════════════════════════════════
  areaData.forEach((area, ai) => {
    const page = pdfDoc.addPage([W, H]);
    fillRect(page, 0, 0, W, H, C.PAPER);

    const ruleY = drawAreaHeader(page);
    const headingY = ruleY - 44;

    // Area name
    page.drawText(area.name || "Area", { x: ML, y: headingY, size: 28, font, color: C.INK });

    // Status pill — far right, vertically centred on heading cap height
    const sLabel = statusLabel(area.status);
    const sBg    = statusBg(area.status);
    const sLw    = body.widthOfTextAtSize(sLabel, 7.5);
    const sPadH  = 5.5;
    const sPw    = sLw + sPadH * 2;
    pill(page, W - MR - sPw, headingY + 10, sLabel, sBg, C.WHITE, body, 7.5);

    // Accent rule below heading
    const accentRuleY = headingY - 24;
    page.drawLine({ start: { x: ML, y: accentRuleY }, end: { x: W - MR, y: accentRuleY }, thickness: 0.9, color: effectiveAccent });

    // Photos — 2×2 grid only when actual photos exist; no placeholders for empty areas
    const GAP = 10;
    const GRID_CELL_H = 180;
    const GRID_CELL_W = (CW - GAP) / 2;
    const realPhotos = area.photoImages.filter((img) => img != null) as PDFImage[];
    let y = accentRuleY - 28;

    if (realPhotos.length > 0) {
      // Pad real photos to a multiple of 4 for clean grid pages
      const allPhotos: (PDFImage | null)[] = [...realPhotos];
      while (allPhotos.length % 4 !== 0) allPhotos.push(null);

      // First page — draw first 4 slots
      const firstBatch = allPhotos.slice(0, 4);
      firstBatch.forEach((img, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const px = ML + col * (GRID_CELL_W + GAP);
        const py = y - (row + 1) * GRID_CELL_H - row * GAP;
        // Only render slot if it has a real photo (no empty placeholders)
        if (img) photoPlaceholder(page, px, py, GRID_CELL_W, GRID_CELL_H, body, `PHOTO ${i + 1}`, img);
      });
      y -= 2 * GRID_CELL_H + GAP + 22;

      // Overflow pages — groups of 4
      const overflowBatches: (PDFImage | null)[][] = [];
      for (let start = 4; start < allPhotos.length; start += 4) {
        overflowBatches.push(allPhotos.slice(start, start + 4));
      }
      overflowBatches.forEach((batch, bi) => {
        const ovPage = pdfDoc.addPage([W, H]);
        fillRect(ovPage, 0, 0, W, H, C.PAPER);
        const ovRuleY = drawAreaHeader(ovPage);
        ovPage.drawText(`${area.name || "Area"} (continued)`, { x: ML, y: ovRuleY - 20, size: 14, font, color: C.INK });
        let oy = ovRuleY - 50;
        batch.forEach((img, i) => {
          if (!img) return; // skip empty slots
          const globalIdx = 4 + bi * 4 + i;
          const col = i % 2;
          const row = Math.floor(i / 2);
          const px = ML + col * (GRID_CELL_W + GAP);
          const py = oy - (row + 1) * GRID_CELL_H - row * GAP;
          photoPlaceholder(ovPage, px, py, GRID_CELL_W, GRID_CELL_H, body, `PHOTO ${globalIdx + 1}`, img);
        });
        drawAreaFooter(ovPage, `${ai + 2} / ${areaData.length + 1}`);
      });
    }
    // If no photos, y stays at accentRuleY - 28 and we go straight to notes

    // Notes label
    page.drawText("NOTES", { x: ML, y, size: 7, font: body, color: effectiveAccent });
    page.drawLine({ start: { x: ML, y: y - 2 }, end: { x: ML + body.widthOfTextAtSize("NOTES", 7), y: y - 2 }, thickness: 0.8, color: effectiveAccent });
    y -= 16;

    const noteLines = wrapText(area.notes || "—", body, 10, CW);
    noteLines.slice(0, 8).forEach((ln) => {
      page.drawText(ln, { x: ML, y, size: 10, font: body, color: C.INK });
      y -= 15;
    });

    // No OBSERVATIONS section — not wired in backend
    drawAreaFooter(page, `${ai + 2} / ${areaData.length + 1}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CONCEPT 4 — Grid Landscape
// Landscape A4 (842 × 595). INK header bar, 3-column area pages.
// ════════════════════════════════════════════════════════════════════════════

export async function renderGridLandscapeV1(p: NewLayoutParams): Promise<void> {
  const { pdfDoc, pjsFont, irFont, proj, areaData, dayNote, reportDateLabel, buildDayLabel,
          logoImage, coverImage, accentColour, whiteLabelPdf, companyName } = p;

  const W = 841.89, H = 595.28;   // landscape
  const HEADER_H = 40;
  const BODY_TOP = H - HEADER_H;  // 555.28

  const effectiveAccent = accentColour && /^#[0-9a-fA-F]{6}$/.test(accentColour)
    ? hex(accentColour) : C.ACCENT;

  const font = pjsFont;
  const body = irFont;

  // ── Shared header ──────────────────────────────────────────────────────────
  function drawHeader(page: PDFPage) {
    fillRect(page, 0, H - HEADER_H, W, HEADER_H, C.INK);
    drawWordmark(page, 20, H - HEADER_H + 10, font, 10, true, 14, logoImage, companyName, whiteLabelPdf);
    const dayLbl = buildDayLabel.toUpperCase();
    const dw = body.widthOfTextAtSize(dayLbl, 11);
    page.drawText(dayLbl, { x: W - 20 - dw, y: H - HEADER_H + 14, size: 11, font: body, color: effectiveAccent });
  }

  // ── Column layout (area pages) ─────────────────────────────────────────────
  const COL1_X = 0,   COL1_W = 110;
  const COL2_X = 110, COL2_W = 537;
  const COL3_X = 647, COL3_W = W - 647;  // ~195
  const COL_LABEL_Y  = 500;
  const COL_RULE_Y   = 490;
  const COL_CONTENT_PAD = 14;
  const PHOTO_CEIL = COL_RULE_Y - COL_CONTENT_PAD; // 476

  function drawSidebar(page: PDFPage, areaName: string, status: string, dateStr: string, pageLabel: string) {
    const PAD = 10;
    fillRect(page, COL1_X, 0, COL1_W, BODY_TOP, C.INK);

    page.drawText("AREA", { x: PAD, y: 490, size: 6, font: body, color: effectiveAccent });
    // Area name — wrap into sidebar width
    const nameLines = wrapText(areaName, font, 14, COL1_W - PAD * 2);
    let ny = 472;
    nameLines.slice(0, 3).forEach((ln) => {
      page.drawText(ln, { x: PAD, y: ny, size: 14, font, color: C.WHITE });
      ny -= 17;
    });

    page.drawLine({ start: { x: PAD, y: ny - 2 }, end: { x: COL1_W - PAD, y: ny - 2 }, thickness: 0.5, color: C.SIDEBAR_RULE });
    page.drawText("STATUS", { x: PAD, y: ny - 16, size: 6, font: body, color: effectiveAccent });

    const sLabel = statusLabel(status);
    const sBg = statusColour(status);
    const sPillW = Math.min(COL1_W - PAD * 2, 88);
    const sPillH = 14;
    page.drawRectangle({ x: PAD, y: ny - 38, width: sPillW, height: sPillH, color: sBg, borderRadius: sPillH / 2 });
    const slw = body.widthOfTextAtSize(sLabel, 7.5);
    page.drawText(sLabel, { x: PAD + (sPillW - slw) / 2, y: ny - 38 + 3.5, size: 7.5, font: body, color: C.WHITE });

    page.drawLine({ start: { x: PAD, y: ny - 50 }, end: { x: COL1_W - PAD, y: ny - 50 }, thickness: 0.5, color: C.SIDEBAR_RULE });
    page.drawText("DATE", { x: PAD, y: ny - 64, size: 6, font: body, color: effectiveAccent });
    page.drawText(dateStr, { x: PAD, y: ny - 78, size: 7, font: body, color: C.SIDEBAR_DATE });

    page.drawLine({ start: { x: PAD, y: ny - 90 }, end: { x: COL1_W - PAD, y: ny - 90 }, thickness: 0.5, color: C.SIDEBAR_RULE });

    // Page number at bottom of sidebar
    const pgw = body.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, { x: COL1_X + COL1_W / 2 - pgw / 2, y: 28, size: 8, font: body, color: C.SIDEBAR_PG });
  }

  function drawPhotosCol(page: PDFPage, photos: { img: PDFImage | null; label: string }[]) {
    fillRect(page, COL2_X, 0, COL2_W, BODY_TOP, C.PAPER);
    page.drawLine({ start: { x: COL2_X, y: 0 }, end: { x: COL2_X, y: BODY_TOP }, thickness: 0.5, color: C.RULE });
    page.drawLine({ start: { x: COL2_X + COL2_W, y: 0 }, end: { x: COL2_X + COL2_W, y: BODY_TOP }, thickness: 0.5, color: C.RULE });
    page.drawText("PHOTOS", { x: COL2_X + 12, y: COL_LABEL_Y, size: 6, font: body, color: effectiveAccent });
    page.drawLine({ start: { x: COL2_X, y: COL_RULE_Y }, end: { x: COL2_X + COL2_W, y: COL_RULE_Y }, thickness: 0.5, color: C.RULE });

    const PAD = 10, GAP = 8, BOT = 10;
    if (photos.length >= 4) {
      // 2×2 landscape grid
      const avH = PHOTO_CEIL - BOT;
      const ph = (avH - GAP) / 2;
      const pw = (COL2_W - PAD * 2 - GAP) / 2;
      const rows = [BOT, BOT + ph + GAP];
      [0, 1, 2, 3].forEach((i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const px = COL2_X + PAD + col * (pw + GAP);
        const py = rows[1 - row]; // row 0 = upper, row 1 = lower
        photoPlaceholder(page, px, py, pw, ph, body, photos[i]?.label ?? `PHOTO ${i + 1}`, photos[i]?.img);
      });
    } else if (photos.length === 1) {
      // Single full photo
      const ph = PHOTO_CEIL - BOT;
      const pw = COL2_W - PAD * 2;
      photoPlaceholder(page, COL2_X + PAD, BOT, pw, ph, body, photos[0]?.label ?? "PHOTO 1", photos[0]?.img);
    } else {
      // 2 portrait side by side
      const ph = PHOTO_CEIL - BOT;
      const pw = (COL2_W - PAD * 2 - GAP) / 2;
      [0, 1].forEach((i) => {
        const px = COL2_X + PAD + i * (pw + GAP);
        photoPlaceholder(page, px, BOT, pw, ph, body, photos[i]?.label ?? `PHOTO ${i + 1}`, photos[i]?.img ?? null);
      });
    }
  }

  function drawNotesCol(page: PDFPage, noteText: string) {
    const PAD = 10;
    fillRect(page, COL3_X, 0, COL3_W, BODY_TOP, C.PAPER);
    page.drawLine({ start: { x: COL3_X, y: 0 }, end: { x: COL3_X, y: BODY_TOP }, thickness: 0.5, color: C.RULE });
    page.drawText("NOTES", { x: COL3_X + PAD, y: COL_LABEL_Y, size: 6, font: body, color: effectiveAccent });
    page.drawLine({ start: { x: COL3_X, y: COL_RULE_Y }, end: { x: COL3_X + COL3_W, y: COL_RULE_Y }, thickness: 0.5, color: C.RULE });

    const noteStartY = COL_RULE_Y - COL_CONTENT_PAD - 4;
    const lines = wrapText(noteText || "—", body, 9, COL3_W - PAD * 2);
    let ny = noteStartY;
    lines.slice(0, 20).forEach((ln) => {
      page.drawText(ln, { x: COL3_X + PAD, y: ny, size: 9, font: body, color: C.INK });
      ny -= 13;
    });

    // OBSERVATIONS removed — not wired in backend
  }

  // ════════════════════════════════════════════
  // PAGE 1 — COVER
  // ════════════════════════════════════════════
  {
    const page = pdfDoc.addPage([W, H]);
    fillRect(page, 0, 0, W, H, C.PAPER);

    drawHeader(page);

    // Left content column
    const LX = 40, LW = 360;

    // Title: event name (single line, no "THE" prefix)
    const eventName = (proj.name as string) || "Event";
    const hoppingY = BODY_TOP - 68;
    page.drawText(eventName, { x: LX, y: hoppingY, size: 46, font, color: C.INK });

    // Orange accent rule
    const ruleY = hoppingY - 22;
    page.drawLine({ start: { x: LX, y: ruleY }, end: { x: LX + 100, y: ruleY }, thickness: 3, color: effectiveAccent });

    // Date — Mono style
    const dateY = ruleY - 16;
    page.drawText(reportDateLabel.toUpperCase(), { x: LX, y: dateY, size: 9, font: body, color: hex("#888888") });

    // 4 info fields — 2×2 grid in left column
    const fieldColW = (LW - 10) / 2;
    const fieldH = 50, rowGap = 8;
    const fieldsTopY = dateY - 14;
    const fields = [
      { label: "TODAY'S OBJECTIVES",    value: (dayNote?.today_objectives    as string) || "—" },
      { label: "TODAY'S ACHIEVEMENTS",  value: (dayNote?.today_achievements  as string) || "—" },
      { label: "TOMORROW'S OBJECTIVES", value: (dayNote?.tomorrow_objectives as string) || "—" },
      { label: "OPEN ISSUES / RISKS",   value: (dayNote?.open_issues         as string) || "—" },
    ];
    fields.forEach(({ label, value }, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const fx = LX + col * (fieldColW + 10);
      const fy = fieldsTopY - row * (fieldH + rowGap) - fieldH;
      fillRect(page, fx, fy, fieldColW, fieldH, hex("#E8E5DC"), C.RULE, 0.5);
      page.drawText(label, { x: fx + 6, y: fy + fieldH - 12, size: 5.5, font: body, color: effectiveAccent });
      const lines = wrapText(value, body, 9, fieldColW - 14).slice(0, 2);
      lines.forEach((ln, li) => {
        page.drawText(ln, { x: fx + 6, y: fy + fieldH - 24 - li * 11, size: 9, font: body, color: C.INK });
      });
    });

    // Prepared for block
    const lowestFieldY = fieldsTopY - 1 * (fieldH + rowGap) - fieldH;
    const prepY = lowestFieldY - 18;
    page.drawText("PREPARED FOR", { x: LX, y: prepY, size: 7, font: body, color: hex("#888888") });
    const clientName = (proj.client_name as string) || (companyName ?? "");
    if (clientName) {
      page.drawText(clientName, { x: LX, y: prepY - 14, size: 11, font, color: C.INK });
    }

    // Right half — cover photo, vertically centred between header and bottom bar
    const ZONE_TOP = BODY_TOP;       // 555
    const ZONE_BOT = 50;             // top of bottom bar
    const MARGIN   = 18;
    const photoX   = LX + LW + 20;
    const photoW   = W - photoX - 20;
    const photoH   = (ZONE_TOP - ZONE_BOT) - MARGIN * 2;
    const photoY   = ZONE_BOT + MARGIN;
    photoPlaceholder(page, photoX, photoY, photoW, photoH, body, "COVER PHOTO", coverImage);

    // Bottom bar
    const BAR_H = 50;
    fillRect(page, 0, 0, W, BAR_H, C.INK);

    // Left: project name + date
    page.drawText(eventName, { x: 20, y: 30, size: 11, font, color: C.WHITE });
    page.drawText(reportDateLabel.toUpperCase(), { x: 20, y: 17, size: 7, font: body, color: hex("#AAAAAA") });

    // Right: OVERALL STATUS label + pill
    const overallStatus = (proj.overall_status as string | null) ?? null;
    const pillLbl = statusLabel(overallStatus);
    const pillBgCol = statusColour(overallStatus);
    const PILL_W = 72, PILL_H = 14;
    const PILL_Y = (BAR_H - PILL_H) / 2;
    page.drawRectangle({ x: W - PILL_W - 8, y: PILL_Y, width: PILL_W, height: PILL_H, color: pillBgCol, borderRadius: PILL_H / 2 });
    const pllw = body.widthOfTextAtSize(pillLbl, 7.5);
    page.drawText(pillLbl, { x: W - PILL_W - 8 + (PILL_W - pllw) / 2, y: PILL_Y + 3.5, size: 7.5, font: body, color: C.WHITE });
    const osLabel = "OVERALL STATUS";
    const oslw = body.widthOfTextAtSize(osLabel, 7);
    page.drawText(osLabel, { x: W - PILL_W - 12 - oslw, y: PILL_Y + 4, size: 7, font: body, color: hex("#AAAAAA") });
  }

  // ════════════════════════════════════════════
  // AREA PAGES
  // ════════════════════════════════════════════
  areaData.forEach((area, ai) => {
    const page = pdfDoc.addPage([W, H]);
    fillRect(page, 0, 0, W, H, C.PAPER);

    drawHeader(page);

    const pageLabel = `${String(ai + 2).padStart(2, "0")} / ${String(areaData.length + 1).padStart(2, "0")}`;
    drawSidebar(page, area.name, area.status, reportDateLabel, pageLabel);

    // Photos: use up to 4 images; pick 2×2 if ≥4, portrait pair if ≥2, single otherwise
    const imgs = area.photoImages.slice(0, 4);
    const photoSlots = imgs.map((img, i) => ({ img: img ?? null, label: `PHOTO ${i + 1}` }));
    // Pad to at least 2 slots for layout decision
    while (photoSlots.length < 2) photoSlots.push({ img: null, label: `PHOTO ${photoSlots.length + 1}` });
    drawPhotosCol(page, photoSlots);
    drawNotesCol(page, area.notes);
  });
}
