// Generate a PDF export for a project. Async: invoked once per export row.
// Layout: ReportAir V3 daily report — 1 cover page + 1 page per area.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ Brand tokens (V3) ============
const MM = 2.83465;
const HEX = (h: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
};
const COLOR = {
  SKY: HEX("#1A6EFF"),
  SKY_SOFT: HEX("#A8C4FF"),
  INK: HEX("#0F1724"),
  SLATE: HEX("#3D4F66"),
  MIST: HEX("#7A8FA8"),
  CLOUD: HEX("#EDF1F7"),
  FOG: HEX("#F5F7FA"),
  BORDER: HEX("#D0D9E8"),
  WHITE: rgb(1, 1, 1),
  CAPTION_BAR: HEX("#D8E5F0"),
};

type StatusKey = "on_track" | "complete" | "requires_discussion" | "delayed" | "no_status";
const STATUS: Record<StatusKey, { label: string; text: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> }> = {
  on_track: { label: "On Track", text: HEX("#1DB87A"), bg: HEX("#E8F8F1") },
  complete: { label: "Complete", text: HEX("#1DB87A"), bg: HEX("#E8F8F1") },
  requires_discussion: { label: "Requires Discussion", text: HEX("#FF8C00"), bg: HEX("#FFF4E5") },
  delayed: { label: "Delayed", text: HEX("#C0392B"), bg: HEX("#FDECEA") },
  no_status: { label: "No Status", text: HEX("#7A8FA8"), bg: HEX("#EDF1F7") },
};
const normaliseStatus = (s: string | null | undefined): StatusKey => {
  if (!s) return "no_status";
  if (s === "concern" || s === "behind_schedule" || s === "at_risk") return "delayed";
  if (s === "on_track" || s === "complete" || s === "requires_discussion" || s === "delayed" || s === "no_status") return s;
  return "no_status";
};
const statusMeta = (s: string | null | undefined) => STATUS[normaliseStatus(s)];

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

function fmtDateLong(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function dateKeyOf(p: { captured_at: string | null; created_at: string }) {
  const d = new Date(p.captured_at || p.created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

async function fail(supabase: SupabaseClient, exportId: string, msg: string) {
  await supabase.from("project_exports").update({
    status: "failed", error_message: msg.slice(0, 500), completed_at: new Date().toISOString(),
  }).eq("id", exportId);
}

// ============ Drawing helpers ============
function drawRoundedRect(page: PDFPage, opts: {
  x: number; y: number; width: number; height: number; radius: number;
  fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; strokeWidth?: number;
}) {
  const { x, y, width: w, height: h } = opts;
  const r = Math.max(0, Math.min(opts.radius, w / 2, h / 2));
  // Build SVG path (pdf-lib drawSvgPath uses top-left origin from x,y).
  // We translate from bottom-left coords by passing x,y of rectangle bottom-left and using y+h as svg-top.
  const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x, y,
    color: opts.fill,
    borderColor: opts.stroke,
    borderWidth: opts.strokeWidth,
  });
}

function drawPill(
  page: PDFPage,
  x: number,
  y: number,
  text: string,
  textColor: ReturnType<typeof rgb>,
  bgColor: ReturnType<typeof rgb>,
  font: PDFFont,
  fontSize = 8,
): number {
  const padX = 8, padY = 4;
  const tw = font.widthOfTextAtSize((text ?? ""), fontSize);
  const w = tw + padX * 2;
  const h = fontSize + padY * 2;
  drawRoundedRect(page, { x, y, width: w, height: h, radius: h / 2, fill: bgColor });
  page.drawText((text ?? ""), { x: x + padX, y: y + padY + 0.8, size: fontSize, font, color: textColor });
  return w;
}

function drawLogomark(page: PDFPage, x: number, y: number, size: number) {
  // y here is bottom-left of the icon's bounding box (size x size).
  const s = size / 100;
  // Back frame: svg x=11, y=19, w=60, h=50, stroke #A8C4FF, sw 4.4
  // pdf_y (bottom-left of rect) = 100 - 19 - 50 = 31 (in svg-100 coords; multiply by s; offset by base y)
  page.drawRectangle({
    x: x + 11 * s,
    y: y + 31 * s,
    width: 60 * s,
    height: 50 * s,
    borderColor: COLOR.SKY_SOFT,
    borderWidth: 4.4 * s,
  });
  // Front frame: svg x=27, y=35, w=60, h=50, stroke #1A6EFF, sw 6.8
  page.drawRectangle({
    x: x + 27 * s,
    y: y + 15 * s,
    width: 60 * s,
    height: 50 * s,
    borderColor: COLOR.SKY,
    borderWidth: 6.8 * s,
  });
}

function drawWordmark(page: PDFPage, x: number, y: number, fontSize: number, pjsFont: PDFFont) {
  const iconSize = fontSize * 1.6;
  drawLogomark(page, x, y - iconSize * 0.15, iconSize);
  const gap = iconSize * 0.3;
  const text = "REPORTAIR";
  // Approximate letter spacing 0.04em by drawing per-character with slight tracking
  let cx = x + iconSize + gap;
  const tracking = fontSize * 0.04;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size: fontSize, font: pjsFont, color: COLOR.INK });
    cx += pjsFont.widthOfTextAtSize(ch, fontSize) + tracking;
  }
}

// ============ Image embedding ============
async function fetchAndEmbedImage(pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const isJpg = ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g(\?|$)/i.test(url);
    try {
      return isJpg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    } catch {
      try { return await pdfDoc.embedJpg(bytes); } catch {
        try { return await pdfDoc.embedPng(bytes); } catch { return null; }
      }
    }
  } catch { return null; }
}

// Module-scope font cache.
let _fontCache: { pjs: Uint8Array; ir: Uint8Array } | null = null;
const PJS_URL = "https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-Bold.ttf";
const IR_URL = "https://cdn.jsdelivr.net/gh/rsms/inter@v4.0/docs/font-files/Inter-Regular.otf";
async function loadFontBytes(): Promise<{ pjs: Uint8Array | null; ir: Uint8Array | null }> {
  if (_fontCache) return _fontCache;
  const fetchOne = async (url: string) => {
    try { const r = await fetch(url); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); }
    catch { return null; }
  };
  const [pjs, ir] = await Promise.all([fetchOne(PJS_URL), fetchOne(IR_URL)]);
  if (pjs && ir) _fontCache = { pjs, ir };
  return { pjs, ir };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let exportId: string | null = null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    exportId = body.export_id;
    if (!exportId) return new Response(JSON.stringify({ error: "missing export_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    await supabase.from("project_exports").update({ status: "processing" }).eq("id", exportId);
    const { data: exp, error: expErr } = await supabase.from("project_exports").select("*").eq("id", exportId).single();
    if (expErr || !exp) throw new Error("Export row not found");

    const projectId = exp.project_id as string;
    // Determine report_date — prefer day_key, else date_from, else today.
    const reportDateStr: string = exp.options?.day_key
      ?? exp.options?.date_from
      ?? new Date().toISOString().slice(0, 10);

    // ============ Fetch all data ============
    const [
      { data: proj },
      { data: areas },
      { data: dayNote },
      { data: areaStatusRows },
      { data: areaNotesRows },
      { data: photos },
    ] = await Promise.all([
      supabase.from("projects").select("name, event_location, event_date, build_start_date, overall_status, geo_lat, geo_lng, geo_location_query, client_name").eq("id", projectId).single(),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("day_notes").select("today_objectives, today_achievements, tomorrow_objectives, open_issues, notes").eq("project_id", projectId).eq("date", reportDateStr).maybeSingle(),
      supabase.from("area_day_status").select("area_id, status").eq("project_id", projectId).eq("date", reportDateStr),
      supabase.from("area_day_notes").select("area_id, notes").eq("project_id", projectId).eq("date", reportDateStr),
      supabase.from("photos").select("id, file_name, caption, captured_at, created_at, storage_path, report_path, area_id").eq("project_id", projectId).order("captured_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
    ]);

    if (!proj) throw new Error("Project not found");

    const sortedAreas = (areas ?? []) as Array<{ id: string; name: string; sort_order: number }>;
    const statusByArea = new Map<string, string>();
    for (const r of (areaStatusRows ?? []) as Array<{ area_id: string; status: string }>) statusByArea.set(r.area_id, r.status);
    const notesByArea = new Map<string, string>();
    for (const r of (areaNotesRows ?? []) as Array<{ area_id: string; notes: string | null }>) {
      if (r.notes) notesByArea.set(r.area_id, r.notes);
    }

    // Photos for the report date, grouped by area
    const dayPhotos = ((photos ?? []) as Array<{ id: string; storage_path: string; report_path: string | null; area_id: string | null; captured_at: string | null; created_at: string; caption: string | null }>)
      .filter((p) => dateKeyOf(p) === reportDateStr);
    const photosByArea = new Map<string, typeof dayPhotos>();
    for (const p of dayPhotos) {
      if (!p.area_id) continue;
      const arr = photosByArea.get(p.area_id) ?? [];
      arr.push(p);
      photosByArea.set(p.area_id, arr);
    }

    // ============ Compute derived fields ============
    const reportDate = parseISODate(reportDateStr);
    const reportDateLabel = fmtDateLong(reportDate);

    let buildDayLabel = "Build Day 1";
    if (proj.build_start_date) {
      const buildStart = parseISODate(proj.build_start_date as string);
      const diffDays = Math.floor((reportDate.getTime() - buildStart.getTime()) / 86400000);
      buildDayLabel = `Build Day ${diffDays + 1}`;
    }
    const buildDayN = buildDayLabel.replace(/\D+/g, "") || "1";
    const reportNumber = `DR-${String(buildDayN).padStart(3, "0")}`;

    // ============ Weather (Open-Meteo) — silent on failure ============
    const WMO: Record<number, string> = {
      0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Rime fog",
      51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
      61:"Light rain",63:"Rain",65:"Heavy rain",
      71:"Light snow",73:"Snow",75:"Heavy snow",
      80:"Rain showers",81:"Rain showers",82:"Heavy rain showers",
      95:"Thunderstorm",96:"Thunderstorm",99:"Severe thunderstorm",
    };
    let weatherStr = "";
    try {
      const projAny = proj as { event_location?: string | null; geo_lat?: number | null; geo_lng?: number | null; geo_location_query?: string | null };
      const loc = projAny.event_location;
      let lat = projAny.geo_lat, lng = projAny.geo_lng;
      if (loc && (lat == null || lng == null || projAny.geo_location_query !== loc)) {
        const gr = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1`);
        if (gr.ok) {
          const gj = await gr.json();
          const hit = gj?.results?.[0];
          if (hit) {
            lat = hit.latitude; lng = hit.longitude;
            await supabase.from("projects").update({ geo_lat: lat, geo_lng: lng, geo_location_query: loc }).eq("id", projectId);
          }
        }
      }
      if (lat != null && lng != null) {
        const urls = [
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode,precipitation_sum&start_date=${reportDateStr}&end_date=${reportDateStr}&timezone=auto`,
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode,precipitation_sum&start_date=${reportDateStr}&end_date=${reportDateStr}&timezone=auto`,
        ];
        for (const url of urls) {
          try {
            const wr = await fetch(url);
            if (!wr.ok) continue;
            const wj = await wr.json();
            const d = wj?.daily;
            if (!d?.time?.length) continue;
            const cond = WMO[d.weathercode?.[0]] ?? "—";
            const tmin = Math.round(d.temperature_2m_min?.[0]);
            const tmax = Math.round(d.temperature_2m_max?.[0]);
            const wind = Math.round(d.windspeed_10m_max?.[0]);
            const rain = Math.round((d.precipitation_sum?.[0] ?? 0) * 10) / 10;
            weatherStr = `${tmin}°C - ${tmax}°C · ${cond} · ${wind} km/h wind · ${rain} mm rain`;
            break;
          } catch (_) { /* try next */ }
        }
      }
    } catch (_) { /* swallow */ }

    // ============ Build PDF ============
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    pdfDoc.setTitle("ReportAir Daily Report");
    pdfDoc.setAuthor("ReportAir");

    const fontBytes = await loadFontBytes();
    let pjsFont: PDFFont, irFont: PDFFont;
    if (fontBytes.pjs && fontBytes.ir) {
      pjsFont = await pdfDoc.embedFont(fontBytes.pjs, { subset: true });
      irFont = await pdfDoc.embedFont(fontBytes.ir, { subset: true });
    } else {
      pjsFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      irFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Event logo (from export's logo_path in export-assets bucket).
    let eventLogoImage: PDFImage | null = null;
    if (exp.logo_path) {
      try {
        const { data: logoBlob } = await supabase.storage.from("export-assets").download(exp.logo_path);
        if (logoBlob) {
          const bytes = new Uint8Array(await logoBlob.arrayBuffer());
          try { eventLogoImage = await pdfDoc.embedPng(bytes); }
          catch { try { eventLogoImage = await pdfDoc.embedJpg(bytes); } catch { eventLogoImage = null; } }
        }
      } catch (_) { /* fall through */ }
    }

    // Photo URL helper: signed transformed URL (cover-fit at ~retina).
    const photoUrlFor = async (p: { storage_path: string; report_path: string | null }, w: number, h: number): Promise<string | null> => {
      try {
        const sourcePath = p.report_path || p.storage_path;
        const tw = Math.round(w * 2.5), th = Math.round(h * 2.5);
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(sourcePath, 600, {
          transform: { width: tw, height: th, resize: "cover", quality: 80 },
        });
        return signed?.signedUrl ?? null;
      } catch { return null; }
    };

    // Pre-fetch photo images for each area (parallel). Cap to 9 per area.
    type AreaData = {
      id: string;
      name: string;
      status: string;
      notes: string;
      photoCount: number;
      photoImages: (PDFImage | null)[];
    };
    const TILE_W_PT = 160, TILE_H_PT = 100; // approximate target for transform sizing
    const areaData: AreaData[] = await Promise.all(sortedAreas.map(async (a) => {
      const ps = (photosByArea.get(a.id) ?? []).slice(0, 9);
      const urls = await Promise.all(ps.map((p) => photoUrlFor(p, TILE_W_PT, TILE_H_PT)));
      const images = await Promise.all(urls.map((u) => u ? fetchAndEmbedImage(pdfDoc, u) : Promise.resolve(null)));
      return {
        id: a.id,
        name: a.name,
        status: statusByArea.get(a.id) ?? "no_status",
        notes: notesByArea.get(a.id) ?? "",
        photoCount: (photosByArea.get(a.id) ?? []).length,
        photoImages: images,
      };
    }));

    // ============ Page constants ============
    const W = 595.28, H = 841.89;
    const totalPages = 1 + areaData.length;

    // ===== Cover page =====
    {
      const M = 20 * MM;
      const CW = W - 2 * M;
      const page = pdfDoc.addPage([W, H]);

      // Top bar
      page.drawRectangle({ x: 0, y: H - 3.5, width: W, height: 3.5, color: COLOR.SKY });
      // Left stripe
      page.drawRectangle({ x: 0, y: 0, width: 4, height: H - 3.5, color: COLOR.SKY });

      // Header: wordmark + report number
      drawWordmark(page, M + 8, H - 16 * MM, 10, pjsFont);
      const rnText = `No. ${reportNumber}`;
      const rnW = irFont.widthOfTextAtSize(rnText, 8);
      page.drawText(rnText, { x: W - M - rnW, y: H - 16 * MM, size: 8, font: irFont, color: COLOR.MIST });
      page.drawLine({ start: { x: M + 8, y: H - 20 * MM }, end: { x: W - M, y: H - 20 * MM }, thickness: 0.5, color: COLOR.BORDER });

      // Event identity
      const eventName = ((proj.name as string) || "Event");
      page.drawText(eventName, { x: M + 8, y: H - 33 * MM, size: 22, font: pjsFont, color: COLOR.INK });
      const venue = ((proj.event_location as string) || "");
      if (venue) page.drawText(venue, { x: M + 8, y: H - 40 * MM, size: 10, font: irFont, color: COLOR.SLATE });

      // Date row
      const dateY = H - 47 * MM;
      page.drawText(reportDateLabel, { x: M + 8, y: dateY, size: 10, font: pjsFont, color: COLOR.SKY });
      const dateW = pjsFont.widthOfTextAtSize(reportDateLabel, 10);
      page.drawText(buildDayLabel, { x: M + 8 + dateW + 10, y: dateY + 0.5, size: 9, font: irFont, color: COLOR.MIST });

      // Event logo (only render when an image was uploaded)
      const logoBoxX = W - M - 66, logoBoxY = H - 48 * MM, logoBoxW = 66, logoBoxH = 32;
      if (eventLogoImage) {
        const scale = Math.min(logoBoxW / eventLogoImage.width, logoBoxH / eventLogoImage.height);
        const lw = eventLogoImage.width * scale, lh = eventLogoImage.height * scale;
        page.drawImage(eventLogoImage, { x: logoBoxX + (logoBoxW - lw) / 2, y: logoBoxY + (logoBoxH - lh) / 2, width: lw, height: lh });
      }

      page.drawLine({ start: { x: M + 8, y: H - 51 * MM }, end: { x: W - M, y: H - 51 * MM }, thickness: 0.5, color: COLOR.BORDER });

      // Status + Weather row
      const ROW_TOP = H - 51 * MM;
      const LABEL_Y = ROW_TOP - 6 * MM;
      const PILL_Y = ROW_TOP - 14 * MM;
      page.drawText("OVERALL STATUS", { x: M + 8, y: LABEL_Y, size: 7, font: irFont, color: COLOR.MIST });
      const overallMeta = statusMeta(proj.overall_status as string | null);
      drawPill(page, M + 8, PILL_Y, overallMeta.label, overallMeta.text, overallMeta.bg, irFont, 8);
      const DIV_X = W / 2.5;
      page.drawLine({ start: { x: DIV_X, y: ROW_TOP - 5 * MM }, end: { x: DIV_X, y: ROW_TOP - 15 * MM }, thickness: 0.5, color: COLOR.BORDER });
      page.drawText("WEATHER", { x: DIV_X + 10, y: LABEL_Y, size: 7, font: irFont, color: COLOR.MIST });
      page.drawText(weatherStr || "—", { x: DIV_X + 10, y: PILL_Y + 2, size: 9, font: irFont, color: COLOR.SLATE });
      page.drawLine({ start: { x: M + 8, y: ROW_TOP - 18 * MM + 2 }, end: { x: W - M, y: ROW_TOP - 18 * MM + 2 }, thickness: 0.5, color: COLOR.BORDER });

      // Daily Updates 2x2 cards
      const UPD_TOP = ROW_TOP - 18 * MM - 6 * MM;
      const HALF = (CW - 10) / 2;
      const BLK_H = 52, BLK_GAP = 6;
      const cards = [
        { label: "TODAY'S OBJECTIVES", body: dayNote?.today_objectives ?? "" },
        { label: "TODAY'S ACHIEVEMENTS", body: dayNote?.today_achievements ?? "" },
        { label: "TOMORROW'S OBJECTIVES", body: dayNote?.tomorrow_objectives ?? "" },
        { label: "OPEN ISSUES / RISKS", body: dayNote?.open_issues ?? "" },
      ];
      for (let i = 0; i < cards.length; i++) {
        const bx = (M + 8) + (i % 2) * (HALF + 10);
        const by_top = UPD_TOP - Math.floor(i / 2) * (BLK_H + BLK_GAP);
        const by_bot = by_top - BLK_H;
        drawRoundedRect(page, { x: bx, y: by_bot, width: HALF, height: BLK_H, radius: 6, fill: COLOR.CLOUD });
        page.drawRectangle({ x: bx, y: by_bot, width: 3, height: BLK_H, color: COLOR.SKY });
        page.drawText(cards[i].label, { x: bx + 10, y: by_top - 11, size: 7.5, font: pjsFont, color: COLOR.INK });
        const lines = wrapLines(cards[i].body || "—", irFont, 8, HALF - 20);
        let ly = by_top - 22;
        for (let li = 0; li < Math.min(4, lines.length); li++) {
          page.drawText(lines[li], { x: bx + 10, y: ly, size: 8, font: irFont, color: COLOR.SLATE });
          ly -= 9.5;
        }
      }

      // Area Summary table
      const TBL_HEADER_Y = UPD_TOP - 2 * (BLK_H + BLK_GAP) - 30;
      const tblTitle = "AREA SUMMARY";
      page.drawText(tblTitle, { x: M + 8, y: TBL_HEADER_Y, size: 9, font: pjsFont, color: COLOR.INK });
      const tblTitleW = pjsFont.widthOfTextAtSize(tblTitle, 9);
      page.drawLine({ start: { x: M + 8, y: TBL_HEADER_Y - 2 }, end: { x: M + 8 + tblTitleW, y: TBL_HEADER_Y - 2 }, thickness: 1.5, color: COLOR.SKY });

      const TABLE_W = CW - 8;
      const C_AREA = 55 * MM;
      const C_STATUS = 26 * MM;
      const C_PHOTO = 11 * MM;
      const C_NOTES = TABLE_W - C_AREA - C_STATUS - C_PHOTO - 12;

      const COL_HDR_Y = TBL_HEADER_Y - 10;
      page.drawRectangle({ x: M + 8, y: COL_HDR_Y - 9, width: TABLE_W, height: 14, color: COLOR.CLOUD });
      page.drawText("AREA", { x: M + 16, y: COL_HDR_Y - 4, size: 7, font: irFont, color: COLOR.MIST });
      page.drawText("STATUS", { x: M + 16 + C_AREA, y: COL_HDR_Y - 4, size: 7, font: irFont, color: COLOR.MIST });
      page.drawText("PHOTOS", { x: M + 16 + C_AREA + C_STATUS, y: COL_HDR_Y - 4, size: 7, font: irFont, color: COLOR.MIST });
      page.drawText("NOTES", { x: M + 16 + C_AREA + C_STATUS + C_PHOTO, y: COL_HDR_Y - 4, size: 7, font: irFont, color: COLOR.MIST });

      const ROW_H = 44;
      let rowY = COL_HDR_Y - 12;
      for (let i = 0; i < areaData.length; i++) {
        const a = areaData[i];
        const meta = statusMeta(a.status);
        // Background
        if (i % 2 === 0) {
          page.drawRectangle({ x: M + 8, y: rowY - ROW_H, width: TABLE_W, height: ROW_H, color: COLOR.FOG });
        }
        // Status accent bar
        page.drawRectangle({ x: M + 8, y: rowY - ROW_H, width: 4, height: ROW_H, color: meta.text });
        // Area name
        const areaName = (a.name ?? "");
        page.drawText(areaName.length > 38 ? areaName.slice(0, 37) + "..." : areaName, {
          x: M + 16, y: rowY - ROW_H / 2 - 3, size: 8.5, font: pjsFont, color: COLOR.INK,
        });
        // Status pill (vertically centred — pill height ≈ 16)
        drawPill(page, M + 16 + C_AREA, rowY - ROW_H / 2 - 8, meta.label, meta.text, meta.bg, irFont, 8);
        // Photo count
        page.drawText(String(a.photoCount), { x: M + 16 + C_AREA + C_STATUS, y: rowY - ROW_H / 2 - 3, size: 8.5, font: irFont, color: COLOR.SLATE });
        // Notes (wrapped, max 3 lines)
        const notesX = M + 16 + C_AREA + C_STATUS + C_PHOTO;
        const notesMaxW = W - M - notesX - 10;
        const noteLines = wrapLines(a.notes || "—", irFont, 8, notesMaxW).slice(0, 3);
        const blockH = noteLines.length * 11;
        let ny = rowY - ROW_H / 2 + blockH / 2 - 4;
        for (const ln of noteLines) {
          page.drawText(ln, { x: notesX, y: ny, size: 8, font: irFont, color: COLOR.SLATE });
          ny -= 11;
        }
        // Row divider
        page.drawLine({ start: { x: M + 8, y: rowY - ROW_H }, end: { x: M + 8 + TABLE_W, y: rowY - ROW_H }, thickness: 0.25, color: COLOR.BORDER });
        rowY -= ROW_H;
      }
    }

    // ===== Area pages =====
    for (let ai = 0; ai < areaData.length; ai++) {
      const area = areaData[ai];
      const meta = statusMeta(area.status);
      const M = 18 * MM;
      const CW = W - 2 * M;
      const page = pdfDoc.addPage([W, H]);

      // Decorations
      const HDR_H = 30 * MM;
      page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: COLOR.INK });
      page.drawRectangle({ x: 0, y: H - 3.5, width: W, height: 3.5, color: meta.text });
      page.drawRectangle({ x: 0, y: 0, width: 4, height: H, color: meta.text });

      // Header text
      page.drawText(`AREA ${ai + 1} OF ${areaData.length}`, { x: M + 6, y: H - 9 * MM, size: 7.5, font: irFont, color: COLOR.SKY_SOFT });
      page.drawText((area.name ?? ""), { x: M + 6, y: H - 21 * MM, size: 18, font: pjsFont, color: COLOR.WHITE });

      // Status pill top-right
      const pillFontSize = 8;
      const pillTextW = irFont.widthOfTextAtSize(meta.label, pillFontSize);
      const pillW = pillTextW + 16;
      drawPill(page, W - M - pillW, H - 23 * MM, meta.label, meta.text, meta.bg, irFont, pillFontSize);

      // Meta strip
      const META_H = 12 * MM;
      const META_Y = H - HDR_H - META_H;
      page.drawRectangle({ x: 0, y: META_Y, width: W, height: META_H, color: COLOR.CLOUD });
      const metaLeft = `Photos: ${area.photoCount}  ·  ${reportDateLabel}  ·  ${buildDayLabel}`;
      page.drawText((metaLeft ?? ""), { x: M + 6, y: META_Y + 4 * MM, size: 8, font: irFont, color: COLOR.SLATE });
      drawWordmark(page, W - M - 70, META_Y + 3.5 * MM, 8.5, pjsFont);

      // Area Notes
      const NOTES_TOP = META_Y - 10 * MM;
      page.drawText("AREA NOTES", { x: M + 6, y: NOTES_TOP, size: 9, font: pjsFont, color: COLOR.INK });
      const anW = pjsFont.widthOfTextAtSize("AREA NOTES", 9);
      page.drawLine({ start: { x: M + 6, y: NOTES_TOP - 2 }, end: { x: M + 6 + anW, y: NOTES_TOP - 2 }, thickness: 1.5, color: meta.text });

      const noteLines = wrapLines(area.notes || "No notes for this area today.", irFont, 10, CW - 14);
      let noteY = NOTES_TOP - 20;
      for (const ln of noteLines) {
        if (noteY < 80) break; // leave room for photos+footer
        page.drawText(ln, { x: M + 6, y: noteY, size: 10, font: irFont, color: COLOR.SLATE });
        noteY -= 14;
      }
      const endY = noteY;

      // Photos
      const PH_TOP = endY - 12;
      page.drawText("PHOTOS", { x: M + 6, y: PH_TOP, size: 9, font: pjsFont, color: COLOR.INK });
      const phW = pjsFont.widthOfTextAtSize("PHOTOS", 9);
      page.drawLine({ start: { x: M + 6, y: PH_TOP - 2 }, end: { x: M + 6 + phW, y: PH_TOP - 2 }, thickness: 1.5, color: meta.text });

      const FOOTER_SPACE = 20 * MM;
      const avail_h = PH_TOP - 14 - FOOTER_SPACE;
      const PCOLS = 3, PROWS = 3;
      const gutter = 6;
      const photo_w = (CW - gutter * (PCOLS - 1)) / PCOLS;
      const max_ph = (avail_h - gutter * (PROWS - 1)) / PROWS;
      const photo_h = Math.min(photo_w * 0.65, max_ph);

      for (let row = 0; row < PROWS; row++) {
        for (let col = 0; col < PCOLS; col++) {
          const px = M + col * (photo_w + gutter);
          const py = PH_TOP - 14 - row * (photo_h + gutter) - photo_h;
          const tile_index = row * PCOLS + col;
          drawRoundedRect(page, { x: px, y: py, width: photo_w, height: photo_h, radius: 4, fill: COLOR.CLOUD, stroke: COLOR.BORDER, strokeWidth: 0.4 });
          const img = area.photoImages[tile_index];
          if (img) {
            // Cover-fit
            const scale = Math.max(photo_w / img.width, photo_h / img.height);
            const iw = img.width * scale, ih = img.height * scale;
            // Clip not supported directly; centre and draw at exact tile size by computing target.
            // Use min for safe-fit (no clip) so the whole image is visible.
            const fitScale = Math.min(photo_w / img.width, photo_h / img.height);
            const fw = img.width * fitScale, fh = img.height * fitScale;
            page.drawImage(img, { x: px + (photo_w - fw) / 2, y: py + (photo_h - fh) / 2, width: fw, height: fh });
            void iw; void ih;
            // Caption bar
            page.drawRectangle({ x: px, y: py, width: photo_w, height: 10, color: COLOR.CAPTION_BAR });
            const cap = (area.name ?? "").slice(0, 30);
            page.drawText(cap, { x: px + 4, y: py + 2.5, size: 5.5, font: irFont, color: COLOR.SLATE });
          }
        }
      }
    }

    // ===== Footer on every page =====
    const allPages = pdfDoc.getPages();
    const eventNameForFooter = ((proj.name as string) || "");
    for (let i = 0; i < allPages.length; i++) {
      const p = allPages[i];
      const pageNum = i + 1;
      p.drawLine({ start: { x: 18 * MM, y: 19 * MM }, end: { x: W - 18 * MM, y: 19 * MM }, thickness: 0.4, color: COLOR.BORDER });
      const left = `ReportAir · ${eventNameForFooter} · ${reportDateLabel}`;
      const center = `Page ${pageNum} of ${totalPages}`;
      const right = `${reportNumber} · Daily Report`;
      const fSize = 7;
      p.drawText((left ?? ""), { x: 18 * MM, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
      const cw = irFont.widthOfTextAtSize(center, fSize);
      p.drawText(center, { x: (W - cw) / 2, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
      const rw = irFont.widthOfTextAtSize((right ?? ""), fSize);
      p.drawText((right ?? ""), { x: W - 18 * MM - rw, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
    }

    // ===== Save and upload =====
    const pdfBytes = await pdfDoc.save();
    const outputPath = `${projectId}/${exportId}.pdf`;
    const { error: upErr } = await supabase.storage.from("exports").upload(outputPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await supabase.from("project_exports").update({
      status: "ready", output_path: outputPath, photo_count: dayPhotos.length, completed_at: new Date().toISOString(),
    }).eq("id", exportId);

    return new Response(JSON.stringify({ ok: true, output_path: outputPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pdf error", e);
    if (exportId) await fail(supabase, exportId, String((e as Error)?.message ?? e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
