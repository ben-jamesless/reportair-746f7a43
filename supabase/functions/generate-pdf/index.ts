// Generate a PDF export for a project. Async: invoked once per export row.
// Layout: BuildFolder V3 daily report — 1 cover page + 1 page per area.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { renderEditorialPortraitV1, renderGridLandscapeV1 } from "./new-layouts.ts";
import { eventDayKey, resolveEventTimeZone, UTC } from "../_shared/eventDay.ts";

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const fallback = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
  const allow =
    /^https:\/\/([a-z0-9-]+\.)*buildfolder\.com$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin)
      ? origin
      : fallback;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============ Auth helper ============
/**
 * Validates the caller's JWT and returns their user ID.
 * Returns null if the token is missing, invalid, or expired.
 */
async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const jwt = authHeader.replace("Bearer ", "").trim();
  // Use the anon-key client so we validate against Supabase Auth, not the service role.
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await anonClient.auth.getUser(jwt);
  if (error || !user) return null;
  return user.id;
}

/**
 * Checks the caller has at least editor-level access to the given project.
 * Editors, admins, and owners may trigger PDF generation; members/viewers may not.
 * Uses the service-role client so RLS does not block the lookup.
 */
async function callerCanExport(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return ["owner", "admin", "editor"].includes(data.role);
}

// ============ Brand tokens (V3) ============
const MM = 2.83465;
const HEX = (h: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
};
const COLOR = {
  // Brand orange (kept SKY key name for internal compat — value is BuildFolder accent)
  SKY: HEX("#D94F2A"),
  SKY_SOFT: HEX("#FBE6DE"),
  INK: HEX("#0F1417"),
  SLATE: HEX("#0F1417"),
  // PDF muted is cooler than the app's warm muted (per §0b spec)
  MIST: HEX("#6B6B70"),
  CLOUD: HEX("#F5F5F5"),
  // PDF page background is PURE WHITE (per §0b spec)
  FOG: HEX("#FFFFFF"),
  BORDER: HEX("#E5E5E5"),
  WHITE: rgb(1, 1, 1),
  CAPTION_BAR: HEX("#F5F5F5"),
  // ============ Horizontal-template tokens (landscape decks/logs) ============
  // These mirror the BuildFolder V1 horizontal mock — see
  // BuildSlides_Report_Templates_Horizontal_v1.pdf.
  PAPER: HEX("#F3EFE6"),       // Client deck page surface (warm cream)
  RULE: HEX("#E5E1D6"),        // Hairline rules on PAPER
  INK_DARK: HEX("#0E1316"),    // Production log page surface (deep ink)
  PAPER_ON_INK: HEX("#F3EFE6"),// Text on INK_DARK
  MUTED_ON_INK: HEX("#7A7A7E"),// Muted text on INK_DARK
  ONTRACK: HEX("#2EB872"),     // Status chip — green
  ONTRACK_SOFT: HEX("#D7F1E2"),
  SNAG: HEX("#C0392B"),        // Status chip — red
  SNAG_SOFT: HEX("#F5D9D4"),
  BUILD_YELLOW: HEX("#E0A82E"),
  BUILD_YELLOW_SOFT: HEX("#F6E6BF"),
};

type StatusKey = "in_progress" | "complete" | "flagged" | "delayed" | "not_started";
const STATUS: Record<StatusKey, { label: string; text: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> }> = {
  in_progress:         { label: "In Progress", text: HEX("#FFFFFF"), bg: HEX("#3A6EA5") },
  complete:            { label: "Complete", text: HEX("#FFFFFF"), bg: HEX("#3A7D44") },
  flagged:             { label: "Flagged",  text: HEX("#FFFFFF"), bg: HEX("#D4A017") },
  delayed:             { label: "Delayed",  text: HEX("#FFFFFF"), bg: HEX("#C7382A") },
  not_started:         { label: "None",     text: HEX("#FFFFFF"), bg: HEX("#9C9A93") },
};
const normaliseStatus = (s: string | null | undefined): StatusKey => {
  if (!s) return "not_started";
  if (s === "concern" || s === "behind_schedule" || s === "at_risk") return "delayed";
  if (s === "on_track") return "in_progress";
  if (s === "requires_discussion") return "flagged";
  if (s === "not_started") return "not_started";
  if (s === "in_progress" || s === "complete" || s === "flagged" || s === "delayed" || s === "not_started") return s;
  return "not_started";
};

const statusMeta = (s: string | null | undefined) => STATUS[normaliseStatus(s)];

// ============ Utilities ============

/** Normalise note text so bullets render consistently in PDFs.
 *  - Promotes inline " * x" / " - x" runs onto new lines.
 *  - Rewrites leading "* " / "- " markers to a bullet glyph.
 *  - Preserves explicit paragraph breaks.
 */
function normaliseBullets(text: string | null | undefined): string {
  if (!text) return "";
  let s = String(text).replace(/\r\n/g, "\n");
  s = s.replace(/([^\n])\s+(?=[*\-]\s+\S)/g, "$1\n");
  s = s
    .split("\n")
    .map((ln) => ln.replace(/^\s*[*\-]\s+/, "\u2022  "))
    .join("\n");
  return s;
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const cleaned = text ?? "";
  const paragraphs = cleaned.split(/\r?\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) { out.push(""); continue; }
    // Hanging indent for wrapped bullet continuation lines.
    const isBullet = /^\u2022\s+/.test(para);
    const indent = isBullet ? "   " : "";
    const words = para.split(/\s+/);
    let current = "";
    let first = true;
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) current = test;
      else {
        if (current) out.push(current);
        current = first ? w : `${indent}${w}`;
      }
      first = false;
    }
    if (current) out.push(current);
  }
  return out;
}

function fmtDateLong(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
// captured_at is the single source of truth for "when this photo was taken".
// There is deliberately no created_at fallback: stamping a photo with its
// upload time here while every other surface shows its capture time would put
// two different fields on the same record. A photo with no captured_at cannot
// be bucketed into a day at all, and is labelled "Time not recorded".
function dateKeyOf(p: { captured_at: string | null }, tz: string) {
  return eventDayKey(p.captured_at, tz);
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
  const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x, y: y + h,
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
  const r = h / 2;
  page.drawRectangle({ x: x + r, y, width: Math.max(0, w - h), height: h, color: bgColor });
  page.drawCircle({ x: x + r, y: y + r, size: r, color: bgColor });
  page.drawCircle({ x: x + w - r, y: y + r, size: r, color: bgColor });
  page.drawText((text ?? ""), { x: x + padX, y: y + padY + 0.8, size: fontSize, font, color: textColor });
  return w;
}

// Favicon-style mark: paper tile with ink rear card + orange front card.
// Matches /public/favicon.svg and the login-page lockup.
function drawLogomark(page: PDFPage, x: number, y: number, size: number, brandMarkImage?: PDFImage | null) {
  if (brandMarkImage) {
    page.drawImage(brandMarkImage, { x, y, width: size, height: size });
    return;
  }
  // Fallback: filled solid cards on a paper tile.
  page.drawRectangle({ x, y, width: size, height: size, color: COLOR.PAPER ?? rgb(0.957, 0.945, 0.917) });
  const CW = size * 0.391;
  const CH = size * 0.469;
  const toPdfY = (svgYTop: number, h: number) => y + size - svgYTop - h;
  // Rear card — solid ink
  page.drawRectangle({
    x: x + size * 0.207, y: toPdfY(size * 0.223, CH),
    width: CW, height: CH, color: COLOR.INK,
  });
  // Front card — solid accent
  page.drawRectangle({
    x: x + size * 0.402, y: toPdfY(size * 0.309, CH),
    width: CW, height: CH, color: COLOR.SKY,
  });
}

function drawWordmark(page: PDFPage, x: number, y: number, fontSize: number, pjsFont: PDFFont, brandMarkImage?: PDFImage | null) {
  const iconSize = fontSize * 1.6;
  drawLogomark(page, x, y - iconSize * 0.15, iconSize, brandMarkImage);
  const gap = iconSize * 0.35;
  const text = "BuildFolder";
  page.drawText(text, { x: x + iconSize + gap, y, size: fontSize, font: pjsFont, color: COLOR.INK });
}


// ============ Image embedding ============
async function fetchAndEmbedImage(pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const r = await fetchWithTimeout(url);
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
    try { const r = await fetchWithTimeout(url); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); }
    catch { return null; }
  };
  const [pjs, ir] = await Promise.all([fetchOne(PJS_URL), fetchOne(IR_URL)]);
  if (pjs && ir) _fontCache = { pjs, ir };
  return { pjs, ir };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsFor(req) });

  let exportId: string | null = null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    exportId = body.export_id;
    const shareToken: string | null = typeof body?.share_token === "string" ? body.share_token : null;

    if (!exportId) return new Response(JSON.stringify({ error: "missing export_id" }), {
      status: 400, headers: { ...corsFor(req), "Content-Type": "application/json" },
    });

    // Load the export row to get the project_id.
    const { data: exp, error: expErr } = await supabase.from("project_exports").select("*").eq("id", exportId).single();
    if (expErr || !exp) {
      return new Response(JSON.stringify({ error: "Export not found" }), {
        status: 404, headers: { ...corsFor(req), "Content-Type": "application/json" },
      });
    }
    const projectId = exp.project_id as string;

    // ============ AUTH GATE ============
    // Two paths:
    //  (a) Authenticated user with editor+ access (normal app flow).
    //  (b) Valid share-link token whose project matches the export (public share flow).
    let callerId: string | null = null;
    let allowed = false;
    if (shareToken) {
      const { data: link } = await supabase.from("share_links")
        .select("project_id, revoked_at, expires_at, created_by")
        .eq("token", shareToken).maybeSingle();
      if (link && !link.revoked_at && (!link.expires_at || new Date(link.expires_at as string) > new Date()) && link.project_id === projectId) {
        callerId = (link.created_by as string | null) ?? "share";
        allowed = true;
      }
    } else {
      callerId = await getCallerUserId(req);
      if (!callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsFor(req), "Content-Type": "application/json" },
        });
      }
      allowed = await callerCanExport(supabase, callerId, projectId);
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsFor(req), "Content-Type": "application/json" },
      });
    }
    // ============ END AUTH GATE ============

    console.log(JSON.stringify({ fn: "generate-pdf", event: "start", export_id: exportId, caller: callerId, via_share: !!shareToken, ts: new Date().toISOString() }));

    await supabase.from("project_exports").update({ status: "processing" }).eq("id", exportId);

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
      { data: hiddenRows },
    ] = await Promise.all([
      supabase.from("projects").select("name, event_location, event_date, build_start_date, overall_status, geo_lat, geo_lng, geo_location_query, client_name, logo_path, team_id, cover_photo_id, cover_asset_path").eq("id", projectId).single(),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order"),
      supabase.from("day_notes").select("today_objectives, today_achievements, tomorrow_objectives, open_issues, notes").eq("project_id", projectId).eq("date", reportDateStr).maybeSingle(),
      supabase.from("area_day_status").select("area_id, status").eq("project_id", projectId).eq("date", reportDateStr),
      supabase.from("area_day_notes").select("area_id, notes").eq("project_id", projectId).eq("date", reportDateStr),
      supabase.from("photos").select("id, file_name, caption, captured_at, created_at, storage_path, report_path, area_id").eq("project_id", projectId).order("captured_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      supabase.from("photo_day_hidden").select("photo_id").eq("project_id", projectId).eq("date_key", reportDateStr),
    ]);



    if (!proj) throw new Error("Project not found");

    // Event-local timezone — the same zone the UI buckets days in. When it
    // cannot be resolved the document says so on the cover; it never guesses
    // silently.
    const eventZone = await resolveEventZone(proj.geo_lat, proj.geo_lng);
    const eventTz = eventZone.tz;
    const tzNote = timeZoneNote(eventZone);

    const sortedAreas = (areas ?? []) as Array<{ id: string; name: string; sort_order: number }>;
    const statusByArea = new Map<string, string>();
    for (const r of (areaStatusRows ?? []) as Array<{ area_id: string; status: string }>) statusByArea.set(r.area_id, r.status);
    const notesByArea = new Map<string, string>();
    for (const r of (areaNotesRows ?? []) as Array<{ area_id: string; notes: string | null }>) {
      if (r.notes) notesByArea.set(r.area_id, r.notes);
    }

    // Photos for the report date, grouped by area
    // Photos for the report date, grouped by area — exclude any explicitly hidden from this day
    const hiddenIds = new Set<string>(((hiddenRows ?? []) as Array<{ photo_id: string }>).map((r) => r.photo_id));
    const dayPhotos = ((photos ?? []) as Array<{ id: string; storage_path: string; report_path: string | null; area_id: string | null; captured_at: string | null; created_at: string; caption: string | null }>)
      .filter((p) => dateKeyOf(p, eventTz) === reportDateStr && !hiddenIds.has(p.id));

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
        const gr = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1`);
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
            const wr = await fetchWithTimeout(url);
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
    pdfDoc.setTitle("BuildFolder Daily Report");

    const fontBytes = await loadFontBytes();
    let pjsFont: PDFFont, irFont: PDFFont;
    if (fontBytes.pjs && fontBytes.ir) {
      pjsFont = await pdfDoc.embedFont(fontBytes.pjs, { subset: true });
      irFont = await pdfDoc.embedFont(fontBytes.ir, { subset: true });
    } else {
      pjsFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      irFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Event logo: prefer per-export override, fall back to the project's saved default logo.
    let eventLogoImage: PDFImage | null = null;
    const { data: teamData } = await supabase
      .from("teams")
      .select("plan, brand_colour, white_label_pdf, name")
      .eq("id", (proj as { team_id: string }).team_id)
      .maybeSingle();
    const teamPlan = (teamData as { plan?: string } | null)?.plan ?? "free";

    // ── PDF access gate ──────────────────────────────────────────────────────
    // Free & Solo plans cannot export PDFs.
    const PDF_EXPORT_PLANS = ["pro", "team", "studio", "enterprise"];
    if (!PDF_EXPORT_PLANS.includes(teamPlan)) {
      if (exportId) await fail(supabase, exportId, "PDF export not available on this plan");
      return new Response(
        JSON.stringify({ error: "PDF export is not available on your current plan. Upgrade to Crew or Studio to export PDFs." }),
        { status: 403, headers: { ...corsFor(req), "Content-Type": "application/json" } },
      );
    }

    // ── Branding flags ───────────────────────────────────────────────────────
    // Crew (pro/team): client logo shown alongside BuildFolder wordmark.
    // Studio (studio/enterprise): BuildFolder suppressed entirely (full white-label).
    const LOGO_PLANS        = ["pro", "team", "studio", "enterprise"];
    const WHITE_LABEL_PLANS = ["studio", "enterprise"];
    const canUseLogo              = LOGO_PLANS.includes(teamPlan);
    const showBuildSlidesBranding = !WHITE_LABEL_PLANS.includes(teamPlan);

    // Client may pass show_buildslides_branding from usePlan() as override.
    const clientBrandingFlag = (body as { show_buildslides_branding?: unknown })?.show_buildslides_branding;
    const effectiveBranding  =
      typeof clientBrandingFlag === "boolean" ? clientBrandingFlag : showBuildSlidesBranding;

    pdfDoc.setAuthor(effectiveBranding ? "BuildFolder" : ((teamData as { name?: string | null } | null)?.name ?? "BuildFolder"));

    const brandColour: string | null = canUseLogo
      ? ((teamData as { brand_colour?: string | null } | null)?.brand_colour ?? null)
      : null;
    // White-label PDF: only when canUseLogo AND team has white_label_pdf enabled.
    const whiteLabelPdf: boolean = canUseLogo
      ? ((teamData as { white_label_pdf?: boolean } | null)?.white_label_pdf ?? false)
      : false;
    // Company name (used for footer when BuildFolder branding is suppressed).
    const companyName: string | null =
      (teamData as { name?: string | null } | null)?.name ?? null;
    const effectiveLogoPath: string | null = canUseLogo
      ? ((exp.logo_path as string | null) || ((proj as { logo_path?: string | null }).logo_path ?? null))
      : null;
    if (effectiveLogoPath) {
      try {
        const { data: logoBlob } = await supabase.storage.from("export-assets").download(effectiveLogoPath);
        if (logoBlob) {
          const bytes = new Uint8Array(await logoBlob.arrayBuffer());
          try { eventLogoImage = await pdfDoc.embedPng(bytes); }
          catch { try { eventLogoImage = await pdfDoc.embedJpg(bytes); } catch { eventLogoImage = null; } }
        }
      } catch (_) { /* fall through */ }
    }

    // Custom cover image is fetched after photoUrlFor is declared (below).
    let coverImage: PDFImage | null = null;

    // BuildFolder v5 brand mark — fetch favicon-96.png from origin and embed.
    // Used by the new-layouts renderers via drawFaviconTile for pixel-perfect
    // favicon-style mark in PDF headers. Fails silently — layouts fall back
    // to primitive-drawn solid cards if the fetch fails.
    let brandMarkImage: PDFImage | null = null;
    try {
      const origin = Deno.env.get("APP_URL") ?? "https://www.buildslides.com";
      const r = await fetchWithTimeout(`${origin}/favicon-96.png`);
      if (r.ok) {
        const bytes = new Uint8Array(await r.arrayBuffer());
        brandMarkImage = await pdfDoc.embedPng(bytes);
      }
    } catch (_) { /* fall through — layouts will use primitive fallback */ }

    const exportQuality: "compressed" | "high_res" = exp.options?.quality === "high_res" ? "high_res" : "compressed";
    const IMAGE_TRANSFORM = {
      compressed: { width: 900,  quality: 65 },
      high_res:   { width: 1800, quality: 80 },
    } as const;
    const transform = IMAGE_TRANSFORM[exportQuality];

    const photoUrlFor = async (p: { storage_path: string; report_path: string | null }): Promise<string | null> => {
      try {
        const sourcePath = p.report_path || p.storage_path;
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(sourcePath, 600, {
          transform: { width: transform.width, quality: transform.quality, resize: "contain" },
        });
        return signed?.signedUrl ?? null;
      } catch { return null; }
    };

    // Custom cover image (Studio only): prefer cover_photo_id, then cover_asset_path.
    if (canUseLogo) {
      const coverAssetPath = (proj as { cover_asset_path?: string | null }).cover_asset_path ?? null;
      const coverPhotoId = (proj as { cover_photo_id?: string | null }).cover_photo_id ?? null;
      if (coverPhotoId) {
        const { data: coverPhoto } = await supabase
          .from("photos")
          .select("storage_path, report_path")
          .eq("id", coverPhotoId)
          .maybeSingle();
        if (coverPhoto) {
          const url = await photoUrlFor(coverPhoto as { storage_path: string; report_path: string | null });
          if (url) coverImage = await fetchAndEmbedImage(pdfDoc, url);
        }
      } else if (coverAssetPath) {
        try {
          const { data: coverBlob } = await supabase.storage.from("export-assets").download(coverAssetPath);
          if (coverBlob) {
            const bytes = new Uint8Array(await coverBlob.arrayBuffer());
            try { coverImage = await pdfDoc.embedPng(bytes); }
            catch { try { coverImage = await pdfDoc.embedJpg(bytes); } catch { coverImage = null; } }
          }
        } catch { /* fall through */ }
      }
    }

    // Pre-fetch photo images for each area (parallel). Cap to 9 per area.
    type AreaData = {
      id: string;
      name: string;
      status: string;
      notes: string;
      photoCount: number;
      photoImages: (PDFImage | null)[];
      photoCaptions: string[];
    };
    const areaDataAll: AreaData[] = await Promise.all(sortedAreas.map(async (a) => {
      const ps = (photosByArea.get(a.id) ?? []).slice(0, 9);
      const urls = await Promise.all(ps.map((p) => photoUrlFor(p)));
      const images = await Promise.all(urls.map((u) => u ? fetchAndEmbedImage(pdfDoc, u) : Promise.resolve(null)));
      return {
        id: a.id,
        name: a.name,
        status: statusByArea.get(a.id) ?? "not_started",
        notes: notesByArea.get(a.id) ?? "",
        photoCount: (photosByArea.get(a.id) ?? []).length,
        photoImages: images,
        photoCaptions: ps.map((p) => {
          const cap = (p.caption ?? "").trim();
          if (p.captured_at) return cap;
          return cap ? `${cap} — Time not recorded` : "Time not recorded";
        }),
      };
    }));
    // Exclude empty areas: 0 photos AND no status AND no notes
    const areaData: AreaData[] = areaDataAll.filter(
      (a) => a.photoCount > 0 || (a.status && a.status !== "not_started") || (a.notes && a.notes.trim() !== "")
    );

    // ============ Template branch ============
    // The export dialog writes `template` into options. Three layouts are
    // wired up so far:
    //   portrait_v1             — original portrait (untouched)
    //   editorial_portrait_v1   — new Concept 1: dark cover, editorial layout
    //   grid_landscape_v1       — new Concept 4: landscape 3-column grid
    // Any unknown / missing value falls back to portrait_v1 so the function is
    // backwards compatible with existing queued exports.
    type TemplateKey = "portrait_v1" | "editorial_portrait_v1" | "grid_landscape_v1";
    const rawTemplate = (exp.options?.template ?? "portrait_v1") as string;
    const templateKey: TemplateKey =
      rawTemplate === "editorial_portrait_v1" || rawTemplate === "grid_landscape_v1"
        ? rawTemplate
        : "portrait_v1";

    if (templateKey === "portrait_v1") {
    // ============ Page constants ============
    const W = 595.28, H = 841.89;
    const totalPages = 1 + areaData.length;
    // Studio: custom accent overrides COLOR.SKY (the portrait template's accent).
    const effectiveAccent = brandColour && /^#[0-9a-fA-F]{6}$/.test(brandColour) ? HEX(brandColour) : COLOR.SKY;
    // Branding header: Studio (no BS branding) → logo only; Crew → logo + wordmark; else wordmark.
    const drawBrandHeader = (page: PDFPage, x: number, y: number, fontSize: number) => {
      if (whiteLabelPdf && eventLogoImage) {
        const maxH = fontSize * 1.6 * 1.2;
        const img = eventLogoImage;
        const scale = Math.min(maxH / img.height, 120 / img.width);
        const lw = img.width * scale, lh = img.height * scale;
        page.drawImage(img, { x, y: y - lh * 0.15, width: lw, height: lh });
        if (effectiveBranding) {
          // Crew: secondary BuildFolder wordmark to the right of client logo.
          drawWordmark(page, x + lw + 10, y, fontSize * 0.85, pjsFont, brandMarkImage);
        }
      } else if (effectiveBranding) {
        drawWordmark(page, x, y, fontSize, pjsFont, brandMarkImage);
      }
      // Studio + no logo: render nothing.
    };

    // ===== Cover page =====
    {
      const M = 20 * MM;
      const CW = W - 2 * M;
      const page = pdfDoc.addPage([W, H]);

      // Top bar
      page.drawRectangle({ x: 0, y: H - 3.5, width: W, height: 3.5, color: effectiveAccent });
      // Left stripe
      page.drawRectangle({ x: 0, y: 0, width: 4, height: H - 3.5, color: effectiveAccent });

      // Header: wordmark (or team logo when white-label) + report number
      drawBrandHeader(page, M + 8, H - 16 * MM, 10);
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
      page.drawText(reportDateLabel, { x: M + 8, y: dateY, size: 10, font: pjsFont, color: effectiveAccent });
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

      // Daily Updates 2x2 cards (dynamic height per row)
      const UPD_TOP = ROW_TOP - 18 * MM - 6 * MM;
      const HALF = (CW - 10) / 2;
      const BLK_GAP = 6;
      const LINE_H = 9.5;
      const CARD_PAD_TOP = 22; // label + spacing
      const CARD_PAD_BOTTOM = 8;
      const MIN_BLK_H = 52;
      const cards = [
        { label: "TODAY'S OBJECTIVES", body: normaliseBullets(dayNote?.today_objectives) },
        { label: "TODAY'S ACHIEVEMENTS", body: normaliseBullets(dayNote?.today_achievements) },
        { label: "TOMORROW'S OBJECTIVES", body: normaliseBullets(dayNote?.tomorrow_objectives) },
        { label: "OPEN ISSUES / RISKS", body: normaliseBullets(dayNote?.open_issues) },
      ];
      const cardLines = cards.map((c) => wrapLines(c.body || "—", irFont, 8, HALF - 20));
      const cardHeights = cardLines.map((ls) =>
        Math.max(MIN_BLK_H, CARD_PAD_TOP + ls.length * LINE_H + CARD_PAD_BOTTOM),
      );
      const row1H = Math.max(cardHeights[0], cardHeights[1]);
      const row2H = Math.max(cardHeights[2], cardHeights[3]);
      for (let i = 0; i < cards.length; i++) {
        const rowIdx = Math.floor(i / 2);
        const bx = (M + 8) + (i % 2) * (HALF + 10);
        const by_top = UPD_TOP - (rowIdx === 0 ? 0 : row1H + BLK_GAP);
        const blkH = rowIdx === 0 ? row1H : row2H;
        const by_bot = by_top - blkH;

        page.drawRectangle({ x: bx, y: by_bot, width: 3, height: blkH, color: effectiveAccent });
        page.drawText(cards[i].label, { x: bx + 10, y: by_top - 11, size: 7.5, font: pjsFont, color: COLOR.INK });
        let ly = by_top - CARD_PAD_TOP;
        for (const ln of cardLines[i]) {
          page.drawText(ln, { x: bx + 10, y: ly, size: 8, font: irFont, color: COLOR.SLATE });
          ly -= LINE_H;
        }
      }

      // Area Summary table
      const CARD_GRID_H = row1H + BLK_GAP + row2H;
      const TBL_HEADER_Y = UPD_TOP - CARD_GRID_H - 20;
      const tblTitle = "AREA SUMMARY";
      page.drawText(tblTitle, { x: M + 8, y: TBL_HEADER_Y, size: 9, font: pjsFont, color: COLOR.INK });
      const tblTitleW = pjsFont.widthOfTextAtSize(tblTitle, 9);
      page.drawLine({ start: { x: M + 8, y: TBL_HEADER_Y - 2 }, end: { x: M + 8 + tblTitleW, y: TBL_HEADER_Y - 2 }, thickness: 1.5, color: effectiveAccent });

      const TABLE_W = CW - 8;
      const C_AREA = 45 * MM;
      const C_STATUS = 38 * MM;
      const C_PHOTO = 16 * MM;
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
        if (i % 2 === 0) {
          page.drawRectangle({ x: M + 8, y: rowY - ROW_H, width: TABLE_W, height: ROW_H, color: COLOR.FOG });
        }
        page.drawRectangle({ x: M + 8, y: rowY - ROW_H, width: 4, height: ROW_H, color: meta.text });
        const areaName = (a.name ?? "");
        page.drawText(areaName.length > 38 ? areaName.slice(0, 37) + "..." : areaName, {
          x: M + 16, y: rowY - ROW_H / 2 - 3, size: 8.5, font: pjsFont, color: COLOR.INK,
        });
        const rowPillH = 8 + 4 * 2;
        drawPill(page, M + 16 + C_AREA, rowY - ROW_H / 2 - rowPillH / 2, meta.label, meta.text, meta.bg, irFont, 8);
        page.drawText(String(a.photoCount), { x: M + 16 + C_AREA + C_STATUS, y: rowY - ROW_H / 2 - 3, size: 8.5, font: irFont, color: COLOR.SLATE });
        const notesX = M + 16 + C_AREA + C_STATUS + C_PHOTO;
        const notesMaxW = W - M - notesX - 10;
        const noteLines = wrapLines(normaliseBullets(a.notes) || "—", irFont, 8, notesMaxW).slice(0, 3);
        const blockH = noteLines.length * 11;
        let ny = rowY - ROW_H / 2 + blockH / 2 - 4;
        for (const ln of noteLines) {
          page.drawText(ln, { x: notesX, y: ny, size: 8, font: irFont, color: COLOR.SLATE });
          ny -= 11;
        }
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

      const HDR_H = 30 * MM;
      page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: COLOR.INK });
      page.drawRectangle({ x: 0, y: H - 3.5, width: W, height: 3.5, color: meta.text });

      page.drawText(`AREA ${ai + 1} OF ${areaData.length}`, { x: M + 6, y: H - 9 * MM, size: 7.5, font: irFont, color: COLOR.SKY_SOFT });
      page.drawText((area.name ?? ""), { x: M + 6, y: H - 21 * MM, size: 18, font: pjsFont, color: COLOR.WHITE });

      const pillLabel = meta.label;
      const pillFontSize = 8;
      const pillPadX = 9;
      const pillPadY = 4;
      const pillTextW = irFont.widthOfTextAtSize(pillLabel, pillFontSize);
      const pillW = pillTextW + pillPadX * 2;
      const pillH = pillFontSize + pillPadY * 2;
      const pillX = W - M - pillW;
      const pillY = H - 23 * MM;
      drawRoundedRect(page, { x: pillX, y: pillY, width: pillW, height: pillH, radius: pillH / 2, fill: meta.bg });
      page.drawText(pillLabel, { x: pillX + pillPadX, y: pillY + pillPadY + 0.8, size: pillFontSize, font: irFont, color: meta.text });

      const META_H = 12 * MM;
      const META_Y = H - HDR_H - META_H;
      page.drawRectangle({ x: 0, y: META_Y, width: W, height: META_H, color: COLOR.CLOUD });
      page.drawRectangle({ x: 0, y: 0, width: 4, height: H, color: meta.text });
      const metaLeft = `Photos: ${area.photoCount}  ·  ${reportDateLabel}  ·  ${buildDayLabel}`;
      page.drawText((metaLeft ?? ""), { x: M + 6, y: META_Y + 4 * MM, size: 8, font: irFont, color: COLOR.SLATE });
      drawBrandHeader(page, W - M - 70, META_Y + 3.5 * MM, 8.5);

      const NOTES_TOP = META_Y - 10 * MM;
      page.drawText("AREA NOTES", { x: M + 6, y: NOTES_TOP, size: 9, font: pjsFont, color: COLOR.INK });
      const anW = pjsFont.widthOfTextAtSize("AREA NOTES", 9);
      page.drawLine({ start: { x: M + 6, y: NOTES_TOP - 2 }, end: { x: M + 6 + anW, y: NOTES_TOP - 2 }, thickness: 1.5, color: meta.text });

      const trimmedNotes = normaliseBullets(area.notes).trim();
      let noteY = NOTES_TOP - 20;
      if (trimmedNotes.length > 0) {
        const noteLines = wrapLines(trimmedNotes, irFont, 10, CW - 14);
        for (const ln of noteLines) {
          if (noteY < 80) break;
          page.drawText(ln, { x: M + 6, y: noteY, size: 10, font: irFont, color: COLOR.SLATE });
          noteY -= 14;
        }
      }
      const endY = noteY;

      const PH_TOP = endY - 12;
      if (area.photoCount > 0) {
        page.drawText("PHOTOS", { x: M + 6, y: PH_TOP, size: 9, font: pjsFont, color: COLOR.INK });
        const phW = pjsFont.widthOfTextAtSize("PHOTOS", 9);
        page.drawLine({ start: { x: M + 6, y: PH_TOP - 2 }, end: { x: M + 6 + phW, y: PH_TOP - 2 }, thickness: 1.5, color: meta.text });
      }

      const FOOTER_SPACE = 20 * MM;
      const avail_h = PH_TOP - 14 - FOOTER_SPACE;
      const paired = (area.photoImages ?? [])
        .map((img, idx) => ({ img, caption: area.photoCaptions?.[idx] ?? "" }))
        .filter((p): p is { img: PDFImage; caption: string } => p.img !== null)
        .slice(0, 9);
      const photoImages = paired.map((p) => p.img);
      const photoCaptions = paired.map((p) => p.caption);
      const photoCount = photoImages.length;
      if (photoCount > 0) {
        const PCOLS = 3;
        const PROWS = Math.ceil(photoCount / PCOLS);
        const gutter = 6;
        const photo_w = (CW - gutter * (PCOLS - 1)) / PCOLS;
        const MAX_TILE_H = 110 * MM;
        const CAPTION_H = 14;
        const rowHasCaption: boolean[] = [];
        for (let r = 0; r < PROWS; r++) {
          const start = r * PCOLS;
          const slice = photoCaptions.slice(start, start + PCOLS);
          rowHasCaption.push(slice.some((c) => c && c.length > 0));
        }
        const totalCaptionH = rowHasCaption.reduce((s, has) => s + (has ? CAPTION_H : 0), 0);
        const maxTileFromAvail = PROWS > 0 ? (avail_h - gutter * (PROWS - 1) - totalCaptionH) / PROWS : avail_h;
        const tileCap = Math.min(MAX_TILE_H, Math.max(24, maxTileFromAvail));

        const tileHeights: number[] = photoImages.map((img) => {
          const ar = img.height / img.width;
          return Math.min(photo_w * ar, tileCap);
        });
        const rowHeights: number[] = [];
        for (let r = 0; r < PROWS; r++) {
          const start = r * PCOLS;
          const slice = tileHeights.slice(start, start + PCOLS);
          rowHeights.push(slice.reduce((m, h) => Math.max(m, h), 0));
        }
        const rowTopOffset: number[] = [];
        let acc = 0;
        for (let r = 0; r < PROWS; r++) {
          rowTopOffset.push(acc);
          acc += rowHeights[r] + (rowHasCaption[r] ? CAPTION_H : 0) + gutter;
        }

        for (let i = 0; i < photoCount; i++) {
          const col = i % PCOLS;
          const row = Math.floor(i / PCOLS);
          const tile_w = photo_w;
          const tile_h = tileHeights[i];
          const px = M + col * (photo_w + gutter);
          const rowTopY = PH_TOP - 14 - rowTopOffset[row];
          const py = rowTopY - tile_h;
          const img = photoImages[i];
          drawRoundedRect(page, { x: px, y: py, width: tile_w, height: tile_h, radius: 4, fill: COLOR.CLOUD, stroke: COLOR.BORDER, strokeWidth: 0.4 });
          const fitScale = Math.min(tile_w / img.width, tile_h / img.height);
          const fw = img.width * fitScale, fh = img.height * fitScale;
          page.drawImage(img, { x: px + (tile_w - fw) / 2, y: py + (tile_h - fh) / 2, width: fw, height: fh });
          const caption = photoCaptions[i];
          if (caption && caption.length > 0) {
            page.drawRectangle({ x: px, y: py - CAPTION_H, width: tile_w, height: CAPTION_H, color: COLOR.CAPTION_BAR });
            let cap = caption;
            const maxW = tile_w - 8;
            while (cap.length > 0 && irFont.widthOfTextAtSize(cap, 7) > maxW) {
              cap = cap.slice(0, -1);
            }
            if (cap.length < caption.length && cap.length > 1) cap = cap.slice(0, -1) + "…";
            page.drawText(cap, { x: px + 4, y: py - CAPTION_H + 4, size: 7, font: irFont, color: COLOR.SLATE });
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
      const left = `${eventNameForFooter} · ${reportDateLabel}`;
      const center = `Page ${pageNum} of ${totalPages}`;
      const right = !effectiveBranding && companyName
        ? `${reportNumber} · ${companyName}`
        : `${reportNumber} · Daily Report`;
      const fSize = 7;
      p.drawText((left ?? ""), { x: 18 * MM, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
      const cw = irFont.widthOfTextAtSize(center, fSize);
      p.drawText(center, { x: (W - cw) / 2, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
      const rw = irFont.widthOfTextAtSize((right ?? ""), fSize);
      p.drawText((right ?? ""), { x: W - 18 * MM - rw, y: 11 * MM, size: fSize, font: irFont, color: COLOR.MIST });
    }
    } else if (templateKey === "editorial_portrait_v1") {
      await renderEditorialPortraitV1({
        pdfDoc, pjsFont, irFont, proj, areaData,
        dayNote: dayNote ?? null,
        reportDateLabel, buildDayLabel, reportNumber,
        logoImage: eventLogoImage,
        coverImage,
        brandMarkImage,
        accentColour: brandColour,
        whiteLabelPdf,
        companyName,
        showBuildSlidesBranding: effectiveBranding,
      });
    } else if (templateKey === "grid_landscape_v1") {
      await renderGridLandscapeV1({
        pdfDoc, pjsFont, irFont, proj, areaData,
        dayNote: dayNote ?? null,
        reportDateLabel, buildDayLabel, reportNumber,
        logoImage: eventLogoImage,
        coverImage,
        brandMarkImage,
        accentColour: brandColour,
        whiteLabelPdf,
        companyName,
        showBuildSlidesBranding: effectiveBranding,
      });
    }

    // ===== Save and upload =====
    const pdfBytes = await pdfDoc.save();
    const outputPath = `${projectId}/${exportId}.pdf`;
    const { error: upErr } = await supabase.storage.from("exports").upload(outputPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await supabase.from("project_exports").update({
      status: "ready",
      output_path: outputPath,
      photo_count: dayPhotos.length,
      completed_at: new Date().toISOString(),
      options: { ...(exp.options ?? {}), quality: exportQuality },
    }).eq("id", exportId);

    console.log(JSON.stringify({ fn: "generate-pdf", event: "complete", export_id: exportId, output_path: outputPath, ts: new Date().toISOString() }));

    return new Response(JSON.stringify({ ok: true, output_path: outputPath }), {
      headers: { ...corsFor(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify({
      fn: "generate-pdf",
      export_id: exportId ?? "unknown",
      error: (e as Error)?.message ?? String(e),
      stack: (e as Error)?.stack?.split("\n").slice(0, 5) ?? [],
      ts: new Date().toISOString(),
    }));
    if (exportId) await fail(supabase, exportId, String((e as Error)?.message ?? e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsFor(req), "Content-Type": "application/json" },
    });
  }
});
