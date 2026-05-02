// Generate a PDF export for a project. Async: invoked once per export row.
// Layout follows the approved Site Story V2 design templates.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

type PhotoRow = {
  id: string;
  storage_path: string;
  file_name?: string | null;
  caption?: string | null;
  area_id: string | null;
  album_id?: string | null;
  captured_at: string | null;
  created_at: string;
};
type AreaRow = { id: string; name: string; sort_order: number };
type AlbumRow = { id: string; name: string };
type DayNoteRow = { date: string; notes: string | null };
type AreaDayStatusRow = { area_id: string; date: string; status: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHOTO_CAP = 300;

// ============ Design tokens ============
const MM = 2.83465; // 1mm in points
const TOK = {
  accent: { r: 0x01 / 255, g: 0x69 / 255, b: 0x6f / 255 },     // #01696F
  nearBlack: { r: 0x1a / 255, g: 0x1a / 255, b: 0x1a / 255 },  // #1a1a1a
  body: { r: 0x37 / 255, g: 0x41 / 255, b: 0x51 / 255 },       // #374151
  muted: { r: 0x6b / 255, g: 0x72 / 255, b: 0x80 / 255 },      // #6b7280
  label: { r: 0x9c / 255, g: 0xa3 / 255, b: 0xaf / 255 },      // #9ca3af
  divider: { r: 0xe5 / 255, g: 0xe7 / 255, b: 0xeb / 255 },    // #e5e7eb
  rowStripe: { r: 0xf9 / 255, g: 0xfa / 255, b: 0xfb / 255 },  // #f9fafb
  rowDivider: { r: 0xf3 / 255, g: 0xf4 / 255, b: 0xf6 / 255 }, // #f3f4f6
  white: { r: 1, g: 1, b: 1 },
};

// Status pill spec: rounded rect with white text. null/missing → omit.
const STATUS_META: Record<string, { label: string; color: { r: number; g: number; b: number } }> = {
  on_track: { label: "On Track", color: { r: 0x16 / 255, g: 0xa3 / 255, b: 0x4a / 255 } },           // #16a34a
  at_risk: { label: "At Risk", color: { r: 0xd9 / 255, g: 0x77 / 255, b: 0x06 / 255 } },             // #d97706
  requires_discussion: { label: "Requires Discussion", color: { r: 0xd9 / 255, g: 0x77 / 255, b: 0x06 / 255 } },
  delayed: { label: "Delayed", color: { r: 0xdc / 255, g: 0x26 / 255, b: 0x26 / 255 } },             // #dc2626
  complete: { label: "Complete", color: { r: 0x01 / 255, g: 0x69 / 255, b: 0x6f / 255 } },           // #01696F
  // Legacy values map to closest equivalents:
  concern: { label: "Delayed", color: { r: 0xdc / 255, g: 0x26 / 255, b: 0x26 / 255 } },
  behind_schedule: { label: "Delayed", color: { r: 0xdc / 255, g: 0x26 / 255, b: 0x26 / 255 } },
};

function hexToRgbObj(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return TOK.accent;
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

function fmtDateLong(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtDayMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDayMonth(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function dateKeyOf(p: { captured_at: string | null; created_at: string }) {
  const d = new Date(p.captured_at || p.created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateKey(k: string) {
  const [y, m, dd] = k.split("-").map(Number);
  return new Date(y, m - 1, dd);
}

function groupByDate<T extends { captured_at: string | null; created_at: string }>(photos: T[]) {
  const map = new Map<string, { date: Date; key: string; label: string; photos: T[] }>();
  for (const p of photos) {
    const key = dateKeyOf(p);
    let g = map.get(key);
    if (!g) {
      const d = parseDateKey(key);
      g = { date: d, key, label: fmtDateLong(d), photos: [] };
      map.set(key, g);
    }
    g.photos.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function fail(supabase: SupabaseClient, exportId: string, msg: string) {
  await supabase
    .from("project_exports")
    .update({ status: "failed", error_message: msg.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", exportId);
}

function sanitize(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  const map: Record<string, string> = {
    "\u00A0": " ", "\u2007": " ", "\u2009": " ", "\u200A": " ",
    "\u202F": " ", "\u205F": " ", "\u3000": " ", "\u200B": "",
    "\u200C": "", "\u200D": "", "\uFEFF": "",
    "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
    "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
    "\u2013": "-", "\u2014": "-", "\u2212": "-",
    "\u2026": "...", "\u2022": "*",
  };
  // eslint-disable-next-line no-misleading-character-class
  s = s.replace(/[\u00A0\u2007\u2009\u200A\u202F\u205F\u3000\u200B\u200C\u200D\uFEFF\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2212\u2026\u2022]/g, (c) => map[c] ?? "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "?");
  return s;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line); line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncate(s: string, n: number) {
  const t = sanitize(s);
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "...";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let exportId: string | null = null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    exportId = body.export_id;
    if (!exportId) return new Response(JSON.stringify({ error: "missing export_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("project_exports").update({ status: "processing" }).eq("id", exportId);

    const { data: exp, error: expErr } = await supabase.from("project_exports").select("*").eq("id", exportId).single();
    if (expErr || !exp) throw new Error("Export row not found");

    const projectId = exp.project_id;
    const dayKey: string | null = exp.options?.day_key ?? null;
    const dateFrom: string | null = exp.options?.date_from ?? null;
    const dateTo: string | null = exp.options?.date_to ?? null;
    const albumIdFilter: string | null = exp.options?.album_id ?? null;
    const albumLabel: string | null = exp.options?.album_label ?? null;
    const orientation: "landscape" | "portrait" = exp.options?.orientation === "portrait" ? "portrait" : "landscape";
    const isRange = !!(dateFrom && dateTo);
    const isAlbum = !!albumIdFilter;
    const accentOverride = hexToRgbObj(exp.accent_color || "#01696F");

    const [
      { data: proj },
      { data: photos },
      { data: albums },
      { data: areas },
      { data: dayNotesRows },
      { data: areaDayStatusRows },
      { data: areaDayNotesRows },
    ] = await Promise.all([
      supabase.from("projects").select("name, description, template, client_name, event_type, event_location, event_date, overall_status").eq("id", projectId).single(),
      supabase.from("photos").select("id, file_name, caption, captured_at, created_at, storage_path, album_id, area_id").eq("project_id", projectId).order("captured_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      supabase.from("albums").select("id, name").eq("project_id", projectId),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("day_notes").select("date, notes").eq("project_id", projectId),
      supabase.from("area_day_status").select("area_id, date, status").eq("project_id", projectId),
      supabase.from("area_day_notes").select("area_id, date, notes").eq("project_id", projectId),
    ]);

    if (!proj) throw new Error("Project not found");
    let allPhotos = (photos ?? []) as PhotoRow[];

    if (dayKey) {
      allPhotos = allPhotos.filter((p) => dateKeyOf(p) === dayKey);
      if (allPhotos.length === 0) throw new Error("No photos found for the selected day.");
    } else if (isRange) {
      allPhotos = allPhotos.filter((p) => {
        const k = dateKeyOf(p);
        return k >= dateFrom! && k <= dateTo!;
      });
      if (allPhotos.length === 0) throw new Error("No photos found in the selected date range.");
    } else if (isAlbum) {
      allPhotos = allPhotos.filter((p) => p.album_id === albumIdFilter);
      if (allPhotos.length === 0) throw new Error("No photos found in the selected album.");
    }

    if (allPhotos.length > PHOTO_CAP) {
      throw new Error(`This export contains ${allPhotos.length} photos. The PDF export is limited to ${PHOTO_CAP}.`);
    }

    // Maps
    const _albumName = new Map(((albums ?? []) as AlbumRow[]).map((a) => [a.id, a.name]));
    const sortedAreas = ((areas ?? []) as AreaRow[]);
    const areaName = new Map(sortedAreas.map((a) => [a.id, a.name]));
    const _dayNoteByDate = new Map<string, string>();
    for (const r of (dayNotesRows ?? []) as DayNoteRow[]) {
      if (r.notes && String(r.notes).trim()) _dayNoteByDate.set(r.date, String(r.notes));
    }
    const areaDayStatus = new Map<string, string>();
    for (const r of (areaDayStatusRows ?? []) as AreaDayStatusRow[]) {
      areaDayStatus.set(`${r.area_id}|${r.date}`, r.status);
    }
    const areaDayNotes = new Map<string, string>();
    for (const r of (areaDayNotesRows ?? []) as { area_id: string; date: string; notes: string | null }[]) {
      if (r.notes && r.notes.trim()) areaDayNotes.set(`${r.area_id}|${r.date}`, r.notes);
    }

    // ============ Build PDF ============
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    // Try Lato (Google Fonts), fall back to Helvetica family on any failure.
    const LATO_URLS = {
      reg: "https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjxAwXiWtFCfQ7A.ttf",
      bold: "https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0N7w.ttf",
      ital: "https://fonts.gstatic.com/s/lato/v24/S6u8w4BMUTPHjxsAXC-vNiXg7Q.ttf",
      boldItal: "https://fonts.gstatic.com/s/lato/v24/S6u_w4BMUTPHjxsI5wq_FQftx9897g.ttf",
    };
    const tryFetch = async (url: string): Promise<Uint8Array | null> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return new Uint8Array(await r.arrayBuffer());
      } catch { return null; }
    };
    const [latoRegBytes, latoBoldBytes, latoItalBytes, latoBoldItalBytes] = await Promise.all([
      tryFetch(LATO_URLS.reg), tryFetch(LATO_URLS.bold), tryFetch(LATO_URLS.ital), tryFetch(LATO_URLS.boldItal),
    ]);

    let fontReg: PDFFont, fontBold: PDFFont, fontItal: PDFFont, fontBoldItal: PDFFont;
    if (latoRegBytes && latoBoldBytes && latoItalBytes && latoBoldItalBytes) {
      fontReg = await pdf.embedFont(latoRegBytes, { subset: true });
      fontBold = await pdf.embedFont(latoBoldBytes, { subset: true });
      fontItal = await pdf.embedFont(latoItalBytes, { subset: true });
      fontBoldItal = await pdf.embedFont(latoBoldItalBytes, { subset: true });
    } else {
      fontReg = await pdf.embedFont(StandardFonts.Helvetica);
      fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      fontItal = await pdf.embedFont(StandardFonts.HelveticaOblique);
      fontBoldItal = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
    }

    const pickFont = (b: boolean, i: boolean) =>
      b && i ? fontBoldItal : b ? fontBold : i ? fontItal : fontReg;

    // Page size — A4 (mm-correct in pt: 595.28 x 841.89)
    const PAGE_W = orientation === "landscape" ? 841.89 : 595.28;
    const PAGE_H = orientation === "landscape" ? 595.28 : 841.89;
    const MARGIN = 20 * MM;          // 20mm left/right
    const FOOTER_Y = 8 * MM;         // 8mm from bottom (baseline-ish)
    const FOOTER_RULE_Y = FOOTER_Y + 10; // hairline above footer text
    const FOOTER_RESERVE = FOOTER_RULE_Y + 8;

    const C = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);
    const ACCENT = C(accentOverride);
    const ACCENT_DEFAULT = C(TOK.accent);

    // Track which pages are "content" (eligible for footer & numbering)
    const contentPageIndices = new Set<number>();

    // Cover stats: photo date range from filtered set
    const photoDateRangeLabel = (() => {
      if (allPhotos.length === 0) return "";
      const dates = allPhotos.map((p) => parseDateKey(dateKeyOf(p)).getTime()).sort((a, b) => a - b);
      const first = new Date(dates[0]);
      const last = new Date(dates[dates.length - 1]);
      const sameDay = dates[0] === dates[dates.length - 1];
      if (sameDay) return fmtDayMonthYear(first);
      const sameYear = first.getFullYear() === last.getFullYear();
      return sameYear ? `${fmtDayMonth(first)} - ${fmtDayMonthYear(last)}` : `${fmtDayMonthYear(first)} - ${fmtDayMonthYear(last)}`;
    })();

    // Wrapper to sanitise drawText input
    type DrawTextFn = PDFPage["drawText"];
    const wrapDraw = (p: PDFPage): PDFPage => {
      const orig = p.drawText.bind(p) as DrawTextFn;
      p.drawText = ((text: string, opts: Parameters<DrawTextFn>[1]) =>
        orig(sanitize(text), opts)) as DrawTextFn;
      return p;
    };
    const origAddPage = pdf.addPage.bind(pdf);
    pdf.addPage = ((...args: Parameters<typeof origAddPage>) => wrapDraw(origAddPage(...args))) as typeof pdf.addPage;

    const addContentPage = (): PDFPage => {
      const p = pdf.addPage([PAGE_W, PAGE_H]);
      contentPageIndices.add(pdf.getPageCount() - 1);
      return p;
    };

    // ===== Status pill drawing (rectangle with white bold text) =====
    // Spec: 3pt corner radius (pdf-lib has no native rounded rect → use rectangle; visual difference negligible at this size),
    // 8pt horizontal padding, 3pt vertical padding, 7.5pt bold white text.
    const drawStatusPill = (page: PDFPage, x: number, y: number, statusKey: string | null | undefined): { width: number; height: number } | null => {
      if (!statusKey) return null;
      const meta = STATUS_META[statusKey];
      if (!meta) return null;
      const size = 7;
      const padX = 8;
      const padY = 3;
      const textW = fontBold.widthOfTextAtSize(meta.label, size);
      const w = textW + padX * 2;
      const h = size + padY * 2;
      page.drawRectangle({ x, y, width: w, height: h, color: C(meta.color) });
      page.drawText(meta.label, { x: x + padX, y: y + padY + 1, size, font: fontBold, color: C(TOK.white) });
      return { width: w, height: h };
    };

    const pillWidth = (statusKey: string | null | undefined): number => {
      if (!statusKey) return 0;
      const meta = STATUS_META[statusKey];
      if (!meta) return 0;
      return fontBold.widthOfTextAtSize(meta.label, 7) + 16;
    };

    // Lighter accent variant: 3pt wide vertical bar in status colour, then label text in same colour at 8pt.
    // Used in scan-light contexts (cover right column, day summary table). y is the baseline-area bottom.
    const drawStatusAccent = (page: PDFPage, x: number, y: number, statusKey: string | null | undefined): { width: number; height: number } | null => {
      if (!statusKey) return null;
      const meta = STATUS_META[statusKey];
      if (!meta) return null;
      const size = 8;
      const barW = 3;
      const barH = size + 4; // a touch taller than the cap height
      const gap = 5;
      page.drawRectangle({ x, y, width: barW, height: barH, color: C(meta.color) });
      page.drawText(meta.label, { x: x + barW + gap, y: y + 2, size, font: fontReg, color: C(meta.color) });
      const w = barW + gap + fontReg.widthOfTextAtSize(meta.label, size);
      return { width: w, height: barH };
    };

    // ===== Rich-text bullet renderer =====
    // Splits on \n. Each line gets a teal • prefix + 8pt indent.
    // - or * prefix is treated as bullet (stripped). **bold**, *italic*, # heading supported.
    type Token = { text: string; bold: boolean; italic: boolean };
    const parseInline = (s: string): Token[] => {
      const tokens: Token[] = [];
      const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        if (m.index > last) tokens.push({ text: s.slice(last, m.index), bold: false, italic: false });
        const t = m[0];
        if (t.startsWith("**")) tokens.push({ text: t.slice(2, -2), bold: true, italic: false });
        else tokens.push({ text: t.slice(1, -1), bold: false, italic: true });
        last = re.lastIndex;
      }
      if (last < s.length) tokens.push({ text: s.slice(last), bold: false, italic: false });
      return tokens;
    };

    // Wrap a sequence of styled tokens into lines that fit maxWidth at the given size.
    type StyledLine = Token[];
    const wrapTokens = (tokens: Token[], size: number, maxWidth: number): StyledLine[] => {
      const lines: StyledLine[] = [];
      let cur: StyledLine = [];
      let curW = 0;
      for (const tok of tokens) {
        const f = pickFont(tok.bold, tok.italic);
        const words = sanitize(tok.text).split(/(\s+)/); // keep spaces
        for (const w of words) {
          if (!w) continue;
          const ww = f.widthOfTextAtSize(w, size);
          if (curW + ww > maxWidth && cur.length > 0) {
            lines.push(cur);
            cur = [];
            curW = 0;
            if (/^\s+$/.test(w)) continue;
          }
          cur.push({ text: w, bold: tok.bold, italic: tok.italic });
          curW += ww;
        }
      }
      if (cur.length) lines.push(cur);
      return lines;
    };

    const drawStyledLine = (page: PDFPage, line: StyledLine, x: number, y: number, size: number, color = C(TOK.body)) => {
      let cx = x;
      for (const tok of line) {
        const f = pickFont(tok.bold, tok.italic);
        page.drawText(tok.text, { x: cx, y, size, font: f, color });
        cx += f.widthOfTextAtSize(tok.text, size);
      }
    };

    // Returns how much vertical space the rendered notes consume.
    const renderRichNotes = (
      page: PDFPage,
      raw: string,
      x: number,
      yTop: number,
      maxWidth: number,
      opts: { size?: number; color?: ReturnType<typeof rgb>; lineH?: number; bulletColor?: ReturnType<typeof rgb> } = {},
    ): number => {
      const size = opts.size ?? 9;
      const color = opts.color ?? C(TOK.body);
      const lineH = opts.lineH ?? 14;
      const bulletColor = opts.bulletColor ?? C(TOK.accent);
      const indent = 10;
      const rawLines = String(raw).split(/\r?\n/);
      let y = yTop;
      for (const lnRaw of rawLines) {
        const ln = lnRaw.trim();
        if (!ln) { y -= 4; continue; }
        if (ln.startsWith("# ")) {
          // Heading: 10pt bold with 4pt space above
          y -= 4;
          const headSize = 10;
          const tokens = [{ text: ln.slice(2), bold: true, italic: false }];
          const wrapped = wrapTokens(tokens, headSize, maxWidth);
          for (const wln of wrapped) {
            drawStyledLine(page, wln, x, y - headSize, headSize, C(TOK.nearBlack));
            y -= headSize + 4;
          }
          continue;
        }
        const isBullet = ln.startsWith("- ") || ln.startsWith("* ");
        const content = isBullet ? ln.slice(2) : ln;
        const tokens = parseInline(content);
        const wrapped = wrapTokens(tokens, size, maxWidth - indent);
        for (let i = 0; i < wrapped.length; i++) {
          if (i === 0) {
            page.drawText("•", { x, y: y - size, size, font: fontBold, color: bulletColor });
          }
          drawStyledLine(page, wrapped[i], x + indent, y - size, size, color);
          y -= lineH;
        }
      }
      return yTop - y;
    };

    // ============ COVER PAGE ============
    {
      const page = pdf.addPage([PAGE_W, PAGE_H]); // NOT a content page (no footer pagination but spec says cover has footer)
      // Spec says "Footer (all pages including cover)" — include cover in content pages set.
      contentPageIndices.add(pdf.getPageCount() - 1);

      // Zone 1 — Accent band (28mm tall, flush top)
      const BAND_H = 28 * MM;
      page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: ACCENT });

      // Logo placeholder (left): 22mm × 8mm white rounded rect, vertically centred, 20mm from left
      const logoW = 22 * MM;
      const logoH = 8 * MM;
      const logoX = 20 * MM;
      const logoY = PAGE_H - BAND_H + (BAND_H - logoH) / 2;

      let logoDrawn = false;
      if (exp.logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage.from("export-assets").download(exp.logo_path);
          if (logoBlob) {
            const bytes = new Uint8Array(await logoBlob.arrayBuffer());
            let img: PDFImage;
            try { img = await pdf.embedPng(bytes); } catch { img = await pdf.embedJpg(bytes); }
            const scale = Math.min(logoW / img.width, logoH / img.height);
            const w = img.width * scale, h = img.height * scale;
            page.drawImage(img, { x: logoX + (logoW - w) / 2, y: logoY + (logoH - h) / 2, width: w, height: h });
            logoDrawn = true;
          }
        } catch (_) { /* fall through */ }
      }
      if (!logoDrawn) {
        // White rounded rect placeholder (drawn as rectangle)
        page.drawRectangle({ x: logoX, y: logoY, width: logoW, height: logoH, color: C(TOK.white) });
      }

      // Project name in band (right, 12pt bold white, right-aligned, 20mm from right)
      const bandTitleSize = 12;
      const bandTitleW = fontBold.widthOfTextAtSize(sanitize(proj.name), bandTitleSize);
      const bandTitleY = PAGE_H - BAND_H + (BAND_H - bandTitleSize) / 2 + 1;
      page.drawText(proj.name, {
        x: PAGE_W - 20 * MM - bandTitleW,
        y: bandTitleY,
        size: bandTitleSize,
        font: fontBold,
        color: C(TOK.white),
      });

      // Zone 2 — Title block (starts 12mm below band)
      let y = PAGE_H - BAND_H - 12 * MM;
      // Project name 20pt bold
      const titleSize = 20;
      page.drawText(proj.name, { x: MARGIN, y: y - titleSize, size: titleSize, font: fontBold, color: C(TOK.nearBlack) });
      y -= titleSize + 3 * MM;

      // Subtitle: client · location · event_type (omit nulls)
      const subtitleParts: string[] = [];
      if (proj.client_name) subtitleParts.push(proj.client_name as string);
      if (proj.event_location) subtitleParts.push(proj.event_location as string);
      if ((proj as { event_type?: string | null }).event_type) subtitleParts.push((proj as { event_type: string }).event_type);
      if (subtitleParts.length) {
        page.drawText(subtitleParts.join(" · "), { x: MARGIN, y: y - 9, size: 9, font: fontReg, color: C(TOK.muted) });
        y -= 9;
      }

      // 10mm below: full-width 0.5pt #e5e7eb rule
      y -= 10 * MM;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.5,
        color: C(TOK.divider),
      });

      // Zone 3 — Two columns (10mm below rule)
      const zoneTop = y - 10 * MM;
      const contentW = PAGE_W - 2 * MARGIN;
      const leftW = contentW * 0.58;
      const rightW = contentW * 0.42;
      const leftX = MARGIN;
      const rightX = MARGIN + leftW;
      const colBottom = FOOTER_RESERVE + 4;

      // Vertical separator
      page.drawLine({
        start: { x: rightX, y: zoneTop },
        end: { x: rightX, y: colBottom },
        thickness: 0.5,
        color: C(TOK.divider),
      });

      // ----- LEFT column -----
      let ly = zoneTop;
      // Project description (9pt body, line height 14pt) or italic placeholder
      const descMaxW = leftW - 4;
      const descSize = 9;
      const descLineH = 14;
      if (proj.description && String(proj.description).trim()) {
        const lines = wrapText(proj.description as string, fontReg, descSize, descMaxW);
        for (const ln of lines) {
          if (ly - descLineH < zoneTop - 60 * MM) break; // keep room for table
          page.drawText(ln, { x: leftX, y: ly - descSize, size: descSize, font: fontReg, color: C(TOK.body) });
          ly -= descLineH;
        }
      }
      // (else: no description → leave the column blank; the area table fills it)

      // 10mm below: 0.5pt rule across left column
      ly -= 10 * MM;
      page.drawLine({
        start: { x: leftX, y: ly },
        end: { x: leftX + leftW - 8, y: ly },
        thickness: 0.5,
        color: C(TOK.divider),
      });

      // 8mm below: area coverage mini-table
      ly -= 8 * MM;
      // Headers
      page.drawText("AREA", { x: leftX, y: ly - 7, size: 7, font: fontBold, color: C(TOK.label) });
      page.drawText("STATUS", { x: leftX + leftW * 0.6, y: ly - 7, size: 7, font: fontBold, color: C(TOK.label) });
      ly -= 12;

      const rowH = 9 * MM;
      // Compute "latest area status" from area_day_status (most recent date per area)
      const latestStatus = new Map<string, string>();
      const latestDate = new Map<string, string>();
      for (const r of (areaDayStatusRows ?? []) as AreaDayStatusRow[]) {
        const prev = latestDate.get(r.area_id);
        if (!prev || r.date > prev) {
          latestDate.set(r.area_id, r.date);
          latestStatus.set(r.area_id, r.status);
        }
      }

      let stripe = false;
      for (const ar of sortedAreas) {
        if (ly - rowH < colBottom + 8) break;
        if (stripe) {
          page.drawRectangle({ x: leftX, y: ly - rowH, width: leftW - 8, height: rowH, color: C(TOK.rowStripe) });
        }
        page.drawText(truncate(ar.name, 40), {
          x: leftX + 4, y: ly - rowH / 2 - 3, size: 9, font: fontReg, color: C(TOK.nearBlack),
        });
        const sk = latestStatus.get(ar.id);
        if (sk && STATUS_META[sk]) {
          const pw = pillWidth(sk);
          drawStatusPill(page, leftX + leftW * 0.6, ly - rowH / 2 - 7, sk);
          void pw;
        }
        // Row divider
        page.drawLine({
          start: { x: leftX, y: ly - rowH },
          end: { x: leftX + leftW - 8, y: ly - rowH },
          thickness: 0.5,
          color: C(TOK.rowDivider),
        });
        ly -= rowH;
        stripe = !stripe;
      }

      // ----- RIGHT column -----
      const rPad = 16; // left padding inside right column
      let ry = zoneTop;
      page.drawText("REPORT DETAILS", { x: rightX + rPad, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
      ry -= 14;

      const drawMetaPair = (label: string, value: string) => {
        page.drawText(label, { x: rightX + rPad, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
        ry -= 9;
        page.drawText(truncate(value, 40), { x: rightX + rPad, y: ry - 10, size: 10, font: fontBold, color: C(TOK.nearBlack) });
        ry -= 7 * MM;
      };

      drawMetaPair("REPORT DATE", photoDateRangeLabel || "—");
      if (proj.event_date) {
        try {
          drawMetaPair("EVENT DATE", fmtDayMonthYear(new Date(proj.event_date as string)));
        } catch { /* ignore */ }
      }
      if (proj.event_location) drawMetaPair("LOCATION", String(proj.event_location));
      if (proj.client_name) drawMetaPair("CLIENT", String(proj.client_name));

      // 12mm below last row: rule
      ry -= 12 * MM - 7 * MM;
      page.drawLine({
        start: { x: rightX + rPad, y: ry },
        end: { x: PAGE_W - MARGIN, y: ry },
        thickness: 0.5,
        color: C(TOK.divider),
      });
      ry -= 10;

      // STATUS label · pill
      page.drawText("STATUS", { x: rightX + rPad, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
      const overallStatus = (proj as { overall_status?: string | null }).overall_status ?? null;
      if (overallStatus && STATUS_META[overallStatus]) {
        drawStatusAccent(page, rightX + rPad + 50, ry - 11, overallStatus);
      }
      ry -= 10 * MM;

      // 0.5pt rule
      page.drawLine({
        start: { x: rightX + rPad, y: ry },
        end: { x: PAGE_W - MARGIN, y: ry },
        thickness: 0.5,
        color: C(TOK.divider),
      });
      ry -= 10;

      // PREPARED BY
      page.drawText("PREPARED BY", { x: rightX + rPad, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
      ry -= 12;
      page.drawText("Site Story", { x: rightX + rPad, y: ry - 10, size: 10, font: fontBold, color: C(TOK.nearBlack) });
      ry -= 12;
      page.drawText("sitestory.app", { x: rightX + rPad, y: ry - 8, size: 8, font: fontReg, color: ACCENT_DEFAULT });
    }

    // ============ DAY SUMMARY + PHOTO PAGES ============
    type DayBucket = { key: string; date: Date; label: string; photos: PhotoRow[] };
    let dayBuckets: DayBucket[] = [];
    if (isAlbum) {
      // Album: single "day" bucket containing all album photos. We still produce summary + photo pages per area.
      const lbl = albumLabel ?? "Album";
      dayBuckets = [{
        key: "album",
        date: new Date(),
        label: lbl,
        photos: allPhotos,
      }];
    } else {
      const groups = groupByDate(allPhotos);
      dayBuckets = groups.map((g) => ({ key: g.key, date: g.date, label: g.label, photos: g.photos }));
    }

    // Helper: split day photos by area in sortedAreas order. Photos with no area_id
    // do NOT get their own "Unassigned" page — they are appended to the last area's
    // photo grid. If there are no assigned areas at all, they're shown under a single
    // synthetic group using the day label so the page isn't empty.
    const splitDayByArea = (dayPhotos: PhotoRow[]): { areaId: string | null; name: string; photos: PhotoRow[] }[] => {
      const byArea = new Map<string, PhotoRow[]>();
      const unassigned: PhotoRow[] = [];
      for (const p of dayPhotos) {
        if (!p.area_id) unassigned.push(p);
        else {
          const arr = byArea.get(p.area_id) ?? [];
          arr.push(p); byArea.set(p.area_id, arr);
        }
      }
      const out: { areaId: string | null; name: string; photos: PhotoRow[] }[] = [];
      for (const ar of sortedAreas) {
        const list = byArea.get(ar.id);
        if (list?.length) out.push({ areaId: ar.id, name: ar.name, photos: list });
      }
      if (unassigned.length) {
        if (out.length > 0) {
          // Append to the last area's photos (excluded from per-area breakdown / summary table).
          out[out.length - 1].photos = out[out.length - 1].photos.concat(unassigned);
        } else {
          // Edge case: nothing assigned to any area — show under day label.
          out.push({ areaId: null, name: "Photos", photos: unassigned });
        }
      }
      return out;
    };

    for (const day of dayBuckets) {
      const subgroups = splitDayByArea(day.photos);

      // ---- A2: Day Summary Page ----
      // (For album exports we still render a summary using areas covered by the album.)
      {
        const page = addContentPage();
        // Left accent stripe (10mm wide, full height)
        const stripeW = 10 * MM;
        page.drawRectangle({ x: 0, y: 0, width: stripeW, height: PAGE_H, color: ACCENT });

        const contentX = 30 * MM; // 30mm from left
        const topY = PAGE_H - 12 * MM;

        // Day label
        page.drawText(day.label, { x: contentX, y: topY - 16, size: 16, font: fontBold, color: C(TOK.nearBlack) });

        let ty = topY - 16 - 8 * MM;
        const tableX = contentX;
        const tableW = PAGE_W - MARGIN - tableX;
        const colArea = tableW * 0.30;
        const colStatus = tableW * 0.20;
        const colNotes = tableW - colArea - colStatus;
        void colNotes;

        // Overall Project Status block
        const overallStatus = (proj as { overall_status?: string | null }).overall_status ?? null;
        if (overallStatus && STATUS_META[overallStatus]) {
          page.drawText("OVERALL PROJECT STATUS", { x: tableX, y: ty - 7, size: 7, font: fontBold, color: C(TOK.label) });
          ty -= 14;
          drawStatusAccent(page, tableX, ty - 12, overallStatus);
          ty -= 10 * MM;
        }

        // Helper: render an area-summary table for a given source day key.
        // Returns the new ty after drawing. If isAlbumMode, uses album latest-status logic
        // and the supplied subgroup list; otherwise looks up by sourceKey.
        const renderAreaTable = (
          startY: number,
          sourceSubgroups: { areaId: string | null; name: string; photos: PhotoRow[] }[],
          sourceKey: string,
          albumMode: boolean,
        ): number => {
          let cy = startY;
          // Headers
          page.drawText("AREA", { x: tableX, y: cy - 7, size: 7, font: fontBold, color: C(TOK.label) });
          page.drawText("STATUS", { x: tableX + colArea, y: cy - 7, size: 7, font: fontBold, color: C(TOK.label) });
          page.drawText("NOTES", { x: tableX + colArea + colStatus, y: cy - 7, size: 7, font: fontBold, color: C(TOK.label) });
          cy -= 12;

          const drowH = 8 * MM;
          let stripe = false;
          for (const sg of sourceSubgroups) {
            if (cy - drowH < FOOTER_RESERVE) break;
            if (stripe) {
              page.drawRectangle({ x: tableX, y: cy - drowH, width: tableW, height: drowH, color: C(TOK.rowStripe) });
            }
            // AREA
            page.drawText(truncate(sg.name, 40), {
              x: tableX + 4, y: cy - drowH / 2 - 3, size: 9, font: fontReg, color: C(TOK.nearBlack),
            });
            // STATUS
            let statusKey: string | null | undefined;
            if (sg.areaId) {
              if (albumMode) {
                let bestDate = "";
                for (const p of sg.photos) {
                  const k = dateKeyOf(p);
                  const sk = areaDayStatus.get(`${sg.areaId}|${k}`);
                  if (sk && k > bestDate) { bestDate = k; statusKey = sk; }
                }
              } else {
                statusKey = areaDayStatus.get(`${sg.areaId}|${sourceKey}`);
              }
            }
            if (statusKey && STATUS_META[statusKey]) {
              drawStatusAccent(page, tableX + colArea, cy - drowH / 2 - 7, statusKey);
            }
            // NOTES
            let noteText = "";
            if (sg.areaId) {
              if (albumMode) {
                let bestDate = "";
                for (const p of sg.photos) {
                  const k = dateKeyOf(p);
                  const n = areaDayNotes.get(`${sg.areaId}|${k}`);
                  if (n && k > bestDate) { bestDate = k; noteText = n; }
                }
              } else {
                noteText = areaDayNotes.get(`${sg.areaId}|${sourceKey}`) ?? "";
              }
            }
            if (noteText) {
              const firstLine = noteText.split(/\r?\n/)[0]
                .replace(/^[-*]\s+/, "")
                .replace(/\*\*/g, "")
                .replace(/\*/g, "");
              page.drawText(truncate(firstLine, 60), {
                x: tableX + colArea + colStatus, y: cy - drowH / 2 - 3,
                size: 9, font: fontReg, color: C(TOK.muted),
              });
            }
            page.drawLine({
              start: { x: tableX, y: cy - drowH },
              end: { x: tableX + tableW, y: cy - drowH },
              thickness: 0.5,
              color: C(TOK.rowDivider),
            });
            cy -= drowH;
            stripe = !stripe;
          }
          return cy;
        };

        ty = renderAreaTable(ty, subgroups, day.key, isAlbum);

        // Previous Report comparison (skip in album mode)
        if (!isAlbum) {
          const idx = dayBuckets.findIndex((d) => d.key === day.key);
          const prev = idx > 0 ? dayBuckets[idx - 1] : null;
          if (prev && ty - 20 * MM > FOOTER_RESERVE) {
            ty -= 8 * MM;
            const prevSubgroups = splitDayByArea(prev.photos);
            page.drawText(`PREVIOUS REPORT — ${prev.label}`, {
              x: tableX, y: ty - 7, size: 7, font: fontBold, color: C(TOK.label),
            });
            ty -= 14;
            ty = renderAreaTable(ty, prevSubgroups, prev.key, false);
          }
        }
      }

      // ---- A3: Photo + Context Page (one per area per day) ----
      for (const sg of subgroups) {
        // Layout
        const contentW = PAGE_W - 2 * MARGIN;
        const leftW = contentW * 0.78;
        const rightW = contentW * 0.22 - 10; // 10mm-ish gap accounted by left padding inside right
        const leftX = MARGIN;
        const dividerX = MARGIN + leftW;
        const rightX = dividerX + 10; // 10mm-ish padding inside

        // Photo grid spec
        const COLS = orientation === "landscape" ? 4 : 3;
        const GAP = 4;
        const cellW = (leftW - GAP * (COLS - 1)) / COLS;
        const cellH = cellW * 0.75;

        let page = addContentPage();
        let topY = PAGE_H - MARGIN;

        // Vertical divider on each new page (and teal left stripe matching day summary)
        const drawPageChrome = (p: PDFPage) => {
          // 10mm teal stripe full height on left
          p.drawRectangle({ x: 0, y: 0, width: 10 * MM, height: PAGE_H, color: ACCENT });
          p.drawLine({
            start: { x: dividerX, y: FOOTER_RESERVE },
            end: { x: dividerX, y: PAGE_H - MARGIN },
            thickness: 0.5,
            color: C(TOK.divider),
          });
        };
        drawPageChrome(page);

        // Heading row (left col only on first page)
        const headingY = topY;
        // Area name 10pt bold, status pill inline, photo count "N photos" 9pt muted
        page.drawText(sg.name, { x: leftX, y: headingY - 10, size: 10, font: fontBold, color: C(TOK.nearBlack) });
        const nameW = fontBold.widthOfTextAtSize(sanitize(sg.name), 10);
        // status inline (per area+day)
        let inlineStatus: string | null | undefined;
        if (sg.areaId) {
          if (isAlbum) {
            let bestDate = "";
            for (const p of sg.photos) {
              const k = dateKeyOf(p);
              const sk = areaDayStatus.get(`${sg.areaId}|${k}`);
              if (sk && k > bestDate) { bestDate = k; inlineStatus = sk; }
            }
          } else {
            inlineStatus = areaDayStatus.get(`${sg.areaId}|${day.key}`);
          }
        }
        let nextX = leftX + nameW + 8;
        if (inlineStatus && STATUS_META[inlineStatus]) {
          drawStatusPill(page, nextX, headingY - 13, inlineStatus);
          nextX += pillWidth(inlineStatus) + 8;
        }
        const countLabel = `${sg.photos.length} photo${sg.photos.length === 1 ? "" : "s"}`;
        page.drawText(countLabel, { x: nextX, y: headingY - 9, size: 9, font: fontReg, color: C(TOK.muted) });

        // 0.5pt teal rule below heading
        const ruleY = headingY - 6 * MM;
        page.drawLine({
          start: { x: leftX, y: ruleY },
          end: { x: leftX + leftW - 4, y: ruleY },
          thickness: 0.5,
          color: ACCENT,
        });

        // Right column on first page
        let ry = headingY;
        // AREA NOTES label
        page.drawText("AREA NOTES", { x: rightX, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
        ry -= 5 * MM + 7;
        // Note body
        let areaNoteText = "";
        if (sg.areaId) {
          if (isAlbum) {
            let bestDate = "";
            for (const p of sg.photos) {
              const k = dateKeyOf(p);
              const n = areaDayNotes.get(`${sg.areaId}|${k}`);
              if (n && k > bestDate) { bestDate = k; areaNoteText = n; }
            }
          } else {
            areaNoteText = areaDayNotes.get(`${sg.areaId}|${day.key}`) ?? "";
          }
        }
        if (areaNoteText.trim()) {
          const used = renderRichNotes(page, areaNoteText, rightX, ry, rightW, { size: 9, lineH: 14, color: C(TOK.body), bulletColor: ACCENT });
          ry -= used;
        }

        // 8mm below: rule, then STATUS label + pill
        ry -= 8 * MM;
        page.drawLine({ start: { x: rightX, y: ry }, end: { x: rightX + rightW, y: ry }, thickness: 0.5, color: C(TOK.divider) });
        ry -= 10;
        page.drawText("STATUS", { x: rightX, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
        if (inlineStatus && STATUS_META[inlineStatus]) {
          drawStatusPill(page, rightX + 45, ry - 11, inlineStatus);
        }
        ry -= 8 * MM;

        // CAPTIONS section (omit if none)
        const captions = sg.photos.map((p) => p.caption?.trim()).filter((c): c is string => !!c);
        if (captions.length > 0) {
          page.drawLine({ start: { x: rightX, y: ry }, end: { x: rightX + rightW, y: ry }, thickness: 0.5, color: C(TOK.divider) });
          ry -= 10;
          page.drawText("CAPTIONS", { x: rightX, y: ry - 7, size: 7, font: fontBold, color: C(TOK.label) });
          ry -= 12;
          for (const cap of captions) {
            const wrapped = wrapText(cap, fontReg, 8, rightW - 10);
            for (let i = 0; i < wrapped.length; i++) {
              if (ry - 11 < FOOTER_RESERVE) break;
              if (i === 0) {
                page.drawText("•", { x: rightX, y: ry - 8, size: 8, font: fontBold, color: ACCENT });
              }
              page.drawText(wrapped[i], { x: rightX + 8, y: ry - 8, size: 8, font: fontReg, color: C(TOK.muted) });
              ry -= 11;
            }
            if (ry < FOOTER_RESERVE) break;
          }
        }

        // ---- Photo grid in left column, flowing rows below the rule ----
        let gy = ruleY - 6; // start a touch below rule
        for (let i = 0; i < sg.photos.length; i += COLS) {
          if (gy - cellH < FOOTER_RESERVE + 4) {
            // New continuation page (no heading repeated; just photos & divider rule)
            page = addContentPage();
            drawPageChrome(page);
            gy = PAGE_H - MARGIN;
          }
          const rowPhotos = sg.photos.slice(i, i + COLS);
          for (let c = 0; c < rowPhotos.length; c++) {
            const ph = rowPhotos[c];
            const x = leftX + c * (cellW + GAP);
            const yCell = gy - cellH;
            try {
              const { data: signed } = await supabase.storage.from("photos").createSignedUrl(
                ph.storage_path,
                600,
                { transform: { width: 1200, quality: 80, format: "origin" as unknown as "png" } },
              );
              const baseUrl = signed?.signedUrl;
              const transformedUrl = baseUrl
                ? baseUrl.replace("/object/sign/", "/render/image/sign/") + "&width=1200&quality=80"
                : null;
              if (transformedUrl) {
                let r = await fetch(transformedUrl);
                if (!r.ok && baseUrl) r = await fetch(baseUrl);
                if (r.ok) {
                  const bytes = new Uint8Array(await r.arrayBuffer());
                  const ct = r.headers.get("content-type") || "";
                  let img: PDFImage | null = null;
                  try {
                    if (ct.includes("png")) img = await pdf.embedPng(bytes);
                    else img = await pdf.embedJpg(bytes);
                  } catch {
                    try { img = await pdf.embedJpg(bytes); } catch { try { img = await pdf.embedPng(bytes); } catch { img = null; } }
                  }
                  if (img) {
                    // Contain-fit so the photo never bleeds beyond its cell. This avoids needing
                    // any mask rectangles in the gutters — empty cells stay completely blank,
                    // with no border artefacts when a row is partially filled.
                    const sFit = Math.min(cellW / img.width, cellH / img.height);
                    const w = img.width * sFit, h = img.height * sFit;
                    const ox = x + (cellW - w) / 2;
                    const oy = yCell + (cellH - h) / 2;
                    page.drawImage(img, { x: ox, y: oy, width: w, height: h });
                  }
                }
              }
            } catch (_) { /* skip */ }
          }
          gy -= cellH + GAP;
        }
      }
    }

    // ============ FOOTER on every content page ============
    const allPages = pdf.getPages();
    const contentList = allPages.filter((_, idx) => contentPageIndices.has(idx));
    const totalContent = contentList.length;
    const clientName = (proj.client_name ?? "client") as string;
    let pageNum = 0;
    for (let idx = 0; idx < allPages.length; idx++) {
      if (!contentPageIndices.has(idx)) continue;
      pageNum += 1;
      const p = allPages[idx];
      // Hairline rule above footer
      p.drawLine({
        start: { x: MARGIN, y: FOOTER_RULE_Y },
        end: { x: PAGE_W - MARGIN, y: FOOTER_RULE_Y },
        thickness: 0.5,
        color: C(TOK.divider),
      });
      const fSize = 7;
      // Left: Confidential — prepared for [client_name]
      const left = `Confidential · prepared for ${clientName}`;
      p.drawText(left, { x: MARGIN, y: FOOTER_Y - 2, size: fSize, font: fontReg, color: C(TOK.label) });
      // Center: photo date range
      const center = photoDateRangeLabel;
      if (center) {
        const cw = fontReg.widthOfTextAtSize(sanitize(center), fSize);
        p.drawText(center, { x: (PAGE_W - cw) / 2, y: FOOTER_Y - 2, size: fSize, font: fontReg, color: C(TOK.label) });
      }
      // Right: Page X of Y
      const right = `Page ${pageNum} of ${totalContent}`;
      const rw = fontReg.widthOfTextAtSize(sanitize(right), fSize);
      p.drawText(right, { x: PAGE_W - MARGIN - rw, y: FOOTER_Y - 2, size: fSize, font: fontReg, color: C(TOK.label) });
    }

    const pdfBytes = await pdf.save();

    const outputPath = `${projectId}/${exportId}.pdf`;
    const { error: upErr } = await supabase.storage.from("exports").upload(outputPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await supabase.from("project_exports").update({
      status: "ready",
      output_path: outputPath,
      photo_count: allPhotos.length,
      completed_at: new Date().toISOString(),
    }).eq("id", exportId);

    // Suppress unused warnings
    void areaName; void _albumName; void _dayNoteByDate;

    return new Response(JSON.stringify({ ok: true, output_path: outputPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-pdf error", e);
    if (exportId) await fail(supabase, exportId, String((e as Error)?.message ?? e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
