// Generate a PDF export for a project. Async: invoked once per export row.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

type PhotoRow = {
  id: string;
  storage_path: string;
  file_name?: string | null;
  caption?: string | null;
  area_id: string | null;
  album_id?: string | null;
  captured_at: string | null;
  created_at: string;
  camera_make?: string | null;
  camera_model?: string | null;
  lens?: string | null;
  iso?: number | null;
  aperture?: number | null;
  shutter_speed?: string | null;
  focal_length?: number | null;
};
type AreaRow = { id: string; name: string; sort_order: number };
type AlbumRow = { id: string; name: string };
type ActivityRow = { verb: string; target_type: string; metadata: Record<string, unknown> | null; created_at: string; actor_id: string | null };
type GuestNoteRow = { photo_id: string; guest_name: string; body: string; created_at: string };
type DayNoteRow = { date: string; notes: string | null };
type AreaDayStatusRow = { area_id: string; date: string; status: string };
type ProfileRow = { id: string; full_name: string | null };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Sections = {
  cover: boolean;
  grid: boolean;
  captions: boolean;
  exif: boolean;
  notes: boolean;
  activity: boolean;
};

const PHOTO_CAP = 300;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 1 / 255, g: 105 / 255, b: 111 / 255 };
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

function fmtDateGroup(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function groupByDate<T extends { captured_at: string | null; created_at: string }>(photos: T[]) {
  const map = new Map<string, { date: Date; label: string; photos: T[] }>();
  for (const p of photos) {
    const raw = p.captured_at || p.created_at;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let g = map.get(key);
    if (!g) { g = { date: d, label: fmtDateGroup(d), photos: [] }; map.set(key, g); }
    g.photos.push(p);
  }
  return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

async function fail(supabase: SupabaseClient, exportId: string, msg: string) {
  await supabase.from("project_exports").update({ status: "failed", error_message: msg.slice(0, 500), completed_at: new Date().toISOString() }).eq("id", exportId);
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
    const sections: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false, ...(exp.options?.sections ?? {}) };
    const dayKey: string | null = exp.options?.day_key ?? null;
    const dayLabel: string | null = exp.options?.day_label ?? null;
    const dateFrom: string | null = exp.options?.date_from ?? null;
    const dateTo: string | null = exp.options?.date_to ?? null;
    const albumIdFilter: string | null = exp.options?.album_id ?? null;
    const albumLabel: string | null = exp.options?.album_label ?? null;
    const orientation: "landscape" | "portrait" = exp.options?.orientation === "portrait" ? "portrait" : "landscape";
    const isRange = !!(dateFrom && dateTo);
    const isAlbum = !!albumIdFilter;
    const accent = hexToRgb(exp.accent_color || "#01696F");

    const [{ data: proj }, { data: photos }, { data: albums }, { data: areas }, { data: activity }, { data: notes }, { data: dayNotesRows }, { data: areaDayStatusRows }, { data: areaDayNotesRows }] = await Promise.all([
      supabase.from("projects").select("name, description, template, client_name, event_location, event_date").eq("id", projectId).single(),
      supabase.from("photos").select("id, file_name, caption, captured_at, created_at, storage_path, album_id, area_id, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height").eq("project_id", projectId).order("captured_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("albums").select("id, name").eq("project_id", projectId),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("activity_events").select("verb, target_type, metadata, created_at, actor_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200),
      supabase.from("guest_notes").select("photo_id, guest_name, body, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("day_notes").select("date, notes").eq("project_id", projectId),
      supabase.from("area_day_status").select("area_id, date, status").eq("project_id", projectId),
      supabase.from("area_day_notes").select("area_id, date, notes").eq("project_id", projectId),
    ]);

    const areaDayStatus = new Map<string, string>();
    for (const r of (areaDayStatusRows ?? []) as AreaDayStatusRow[]) {
      areaDayStatus.set(`${r.area_id}|${r.date}`, r.status);
    }
    const areaDayNotes = new Map<string, string>();
    for (const r of (areaDayNotesRows ?? []) as { area_id: string; date: string; notes: string | null }[]) {
      if (r.notes && r.notes.trim()) areaDayNotes.set(`${r.area_id}|${r.date}`, r.notes);
    }

    if (!proj) throw new Error("Project not found");
    let allPhotos = (photos ?? []) as PhotoRow[];

    const photoDayKey = (p: PhotoRow) => {
      const raw = p.captured_at || p.created_at;
      const d = new Date(raw);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    if (dayKey) {
      allPhotos = allPhotos.filter((p) => photoDayKey(p) === dayKey);
      if (allPhotos.length === 0) throw new Error("No photos found for the selected day.");
    } else if (isRange) {
      allPhotos = allPhotos.filter((p) => {
        const k = photoDayKey(p);
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

    const albumName = new Map(((albums ?? []) as AlbumRow[]).map((a) => [a.id, a.name]));
    const areaName = new Map(((areas ?? []) as AreaRow[]).map((a) => [a.id, a.name]));
    const dayNoteByDate = new Map<string, string>();
    for (const r of (dayNotesRows ?? [])) {
      if (r.notes && String(r.notes).trim()) dayNoteByDate.set(r.date, String(r.notes));
    }
    const STATUS_LABEL: Record<string, string> = {
      no_status: "No status",
      on_track: "On track",
      requires_discussion: "Requires discussion",
      concern: "Concern / behind schedule",
    };
    const notesByPhoto = new Map<string, GuestNoteRow[]>();
    for (const n of (notes ?? [])) {
      const arr = notesByPhoto.get(n.photo_id) ?? [];
      arr.push(n); notesByPhoto.set(n.photo_id, arr);
    }

    const actorIds = Array.from(new Set(((activity ?? []) as ActivityRow[]).map((a) => a.actor_id).filter((x): x is string => Boolean(x))));
    const actorMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
      for (const p of (profs ?? []) as ProfileRow[]) actorMap.set(p.id, p.full_name || "Member");
    }

    // ============ Build PDF ============
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const sanitize = (input: unknown): string => {
      if (input === null || input === undefined) return "";
      let s = String(input);
      const map: Record<string, string> = {
        "\u00A0": " ", "\u2007": " ", "\u2009": " ", "\u200A": " ",
        "\u202F": " ", "\u205F": " ", "\u3000": " ", "\u200B": "",
        "\u200C": "", "\u200D": "", "\uFEFF": "",
        "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
        "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
        "\u2013": "-", "\u2014": "-", "\u2212": "-",
        "\u2026": "...", "\u2022": "*", "\u00B7": "-",
      };
      // eslint-disable-next-line no-misleading-character-class
      s = s.replace(/[\u00A0\u2007\u2009\u200A\u202F\u205F\u3000\u200B\u200C\u200D\uFEFF\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2212\u2026\u2022\u00B7]/g, (c) => map[c] ?? "");
      // eslint-disable-next-line no-control-regex
      s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "?");
      return s;
    };

    type DrawTextFn = PDFPage["drawText"];
    const _wrapDraw = (p: PDFPage): PDFPage => {
      const orig = p.drawText.bind(p) as DrawTextFn;
      p.drawText = ((text: string, opts: Parameters<DrawTextFn>[1]) =>
        orig(sanitize(text), opts)) as DrawTextFn;
      return p;
    };
    const origAddPage = pdf.addPage.bind(pdf);
    // Track which pages are "content pages" (eligible for footer)
    const contentPageIndices = new Set<number>();
    let pageCounter = 0;
    pdf.addPage = ((...args: Parameters<typeof origAddPage>) => {
      const p = _wrapDraw(origAddPage(...args));
      pageCounter += 1;
      return p;
    }) as typeof pdf.addPage;

    // Page dimensions based on orientation. A4: 595.28 x 841.89.
    const PAGE_W = orientation === "landscape" ? 841.89 : 595.28;
    const PAGE_H = orientation === "landscape" ? 595.28 : 841.89;
    const M = 40;
    const TEXT = rgb(0.1, 0.1, 0.1);
    const MUTED = rgb(0.45, 0.45, 0.45);
    const ACCENT = rgb(accent.r, accent.g, accent.b);
    const WHITE = rgb(1, 1, 1);

    const addContentPage = (): PDFPage => {
      const p = pdf.addPage([PAGE_W, PAGE_H]);
      contentPageIndices.add(pdf.getPageCount() - 1);
      return p;
    };

    // ---- Cover ----
    if (sections.cover) {
      const page = pdf.addPage([PAGE_W, PAGE_H]); // Cover is NOT a content page
      const BAND_H = 180;
      // Full-bleed accent band at top
      page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: ACCENT });

      // Logo or project name in band
      let logoDrawn = false;
      if (exp.logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage.from("export-assets").download(exp.logo_path);
          if (logoBlob) {
            const bytes = new Uint8Array(await logoBlob.arrayBuffer());
            let img;
            try { img = await pdf.embedPng(bytes); } catch { img = await pdf.embedJpg(bytes); }
            const maxW = 320, maxH = 120;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const w = img.width * scale, h = img.height * scale;
            const cx = (PAGE_W - w) / 2;
            const cy = PAGE_H - BAND_H + (BAND_H - h) / 2;
            page.drawImage(img, { x: cx, y: cy, width: w, height: h });
            logoDrawn = true;
          }
        } catch (_) { /* fall through */ }
      }
      if (!logoDrawn) {
        const titleSize = 36;
        const titleW = fontBold.widthOfTextAtSize(sanitize(proj.name), titleSize);
        const tx = (PAGE_W - titleW) / 2;
        const ty = PAGE_H - BAND_H + (BAND_H - titleSize) / 2 + titleSize * 0.2;
        page.drawText(proj.name, { x: tx, y: ty, size: titleSize, font: fontBold, color: WHITE });
      }

      // Below the band, project metadata
      let y = PAGE_H - BAND_H - 50;
      page.drawText(proj.name, { x: M, y, size: 26, font: fontBold, color: TEXT });
      y -= 32;

      const fmtRangeLabel = (k: string) => {
        const [yy, mm, dd] = k.split("-").map(Number);
        return new Date(yy, mm - 1, dd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      };
      let scopeLine: string | null = null;
      if (dayKey && dayLabel) scopeLine = dayLabel;
      else if (isRange) scopeLine = `${fmtRangeLabel(dateFrom!)} – ${fmtRangeLabel(dateTo!)}`;
      else if (isAlbum) scopeLine = `Album: ${albumLabel ?? "Album"}`;
      if (scopeLine) {
        page.drawText(scopeLine, { x: M, y, size: 14, font, color: MUTED });
        y -= 24;
      }

      const metaLines: string[] = [];
      if (proj.client_name) metaLines.push(`Client: ${proj.client_name}`);
      if (proj.event_date) {
        try {
          const d = new Date(proj.event_date as string);
          metaLines.push(`Event date: ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
        } catch { /* ignore */ }
      }
      if (proj.event_location) metaLines.push(`Location: ${proj.event_location}`);
      const exportedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      metaLines.push(`Exported: ${exportedOn}`);

      for (const line of metaLines) {
        page.drawText(line, { x: M, y, size: 12, font, color: TEXT });
        y -= 18;
      }

      if (proj.description) {
        y -= 10;
        const lines = wrapText(proj.description, font, 11, PAGE_W - 2 * M);
        for (const line of lines.slice(0, 8)) {
          page.drawText(line, { x: M, y, size: 11, font, color: MUTED });
          y -= 16;
        }
      }
    }

    // Helpers for bullet rendering
    const drawBullets = (
      page: PDFPage,
      text: string,
      yStart: number,
      maxWidth: number,
      size = 10,
      color = TEXT,
      onNewPage?: () => { page: PDFPage; y: number },
    ): { page: PDFPage; y: number } => {
      let y = yStart;
      let p = page;
      const lineH = size + 4;
      const indent = 12;
      const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const ln of lines) {
        const wrapped = wrapText(ln, font, size, maxWidth - indent);
        for (let i = 0; i < wrapped.length; i++) {
          if (y - lineH < M + 30 && onNewPage) {
            const next = onNewPage();
            p = next.page; y = next.y;
          }
          if (i === 0) {
            p.drawText("•", { x: M, y: y - size, size, font, color });
          }
          p.drawText(wrapped[i], { x: M + indent, y: y - size, size, font, color });
          y -= lineH;
        }
        y -= 2;
      }
      return { page: p, y };
    };

    // Section divider page (full-bleed accent)
    const drawDivider = (title: string, summary: string) => {
      const page = pdf.addPage([PAGE_W, PAGE_H]); // Dividers are NOT content pages
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: ACCENT });
      const titleSize = 32;
      const summarySize = 14;
      // wrap title to fit
      const maxW = PAGE_W - 2 * M;
      const titleLines = wrapText(title, fontBold, titleSize, maxW);
      const summaryLines = wrapText(summary, font, summarySize, maxW);
      const totalH = titleLines.length * (titleSize + 8) + 14 + summaryLines.length * (summarySize + 4);
      let y = PAGE_H / 2 + totalH / 2;
      for (const tl of titleLines) {
        const w = fontBold.widthOfTextAtSize(sanitize(tl), titleSize);
        page.drawText(tl, { x: (PAGE_W - w) / 2, y: y - titleSize, size: titleSize, font: fontBold, color: WHITE });
        y -= titleSize + 8;
      }
      y -= 6;
      for (const sl of summaryLines) {
        const w = font.widthOfTextAtSize(sanitize(sl), summarySize);
        page.drawText(sl, { x: (PAGE_W - w) / 2, y: y - summarySize, size: summarySize, font, color: WHITE });
        y -= summarySize + 4;
      }
    };

    // ---- Photo grid ----
    if (sections.grid && allPhotos.length > 0) {
      type Group = { label: string; photos: PhotoRow[]; areaId?: string; dateKey?: string; dayHeader?: string };
      let groups: Group[];

      const sortedAreasList = (areas ?? []) as AreaRow[];
      const splitByArea = (photos: PhotoRow[]): { label: string; photos: PhotoRow[]; areaId?: string }[] => {
        const byArea = new Map<string, PhotoRow[]>();
        const unassigned: PhotoRow[] = [];
        for (const p of photos) {
          if (!p.area_id) unassigned.push(p);
          else {
            const arr = byArea.get(p.area_id) ?? [];
            arr.push(p);
            byArea.set(p.area_id, arr);
          }
        }
        const out: { label: string; photos: PhotoRow[]; areaId?: string }[] = [];
        for (const ar of sortedAreasList) {
          const list = byArea.get(ar.id);
          if (list?.length) out.push({ label: ar.name, photos: list, areaId: ar.id });
        }
        if (unassigned.length) out.push({ label: "Unassigned", photos: unassigned });
        return out;
      };

      // Build day-grouped structure for divider insertion
      type DayBucket = { label: string; dateKey: string; photos: PhotoRow[]; subgroups: { label: string; photos: PhotoRow[]; areaId?: string; dateKey: string }[] };
      const dayBuckets: DayBucket[] = [];

      if (dayKey) {
        const subs = splitByArea(allPhotos).map((s) => ({ ...s, dateKey: dayKey! }));
        dayBuckets.push({ label: dayLabel ?? dayKey, dateKey: dayKey, photos: allPhotos, subgroups: subs });
      } else if (isRange) {
        const byDay = groupByDate(allPhotos);
        for (const dg of byDay) {
          const d = dg.date;
          const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const subs = splitByArea(dg.photos).map((s) => ({ ...s, dateKey: dKey }));
          dayBuckets.push({ label: dg.label, dateKey: dKey, photos: dg.photos, subgroups: subs });
        }
      } else if (isAlbum) {
        const byDay = groupByDate(allPhotos);
        for (const dg of byDay) {
          const d = dg.date;
          const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dayBuckets.push({
            label: dg.label,
            dateKey: dKey,
            photos: dg.photos,
            subgroups: [{ label: dg.label, photos: dg.photos, dateKey: dKey }],
          });
        }
      } else {
        const byDay = groupByDate(allPhotos);
        for (const dg of byDay) {
          const d = dg.date;
          const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dayBuckets.push({
            label: dg.label,
            dateKey: dKey,
            photos: dg.photos,
            subgroups: [{ label: dg.label, photos: dg.photos, dateKey: dKey }],
          });
        }
      }

      // Layout: orientation-aware columns
      const COLS = orientation === "landscape" ? 4 : 3;
      const GAP = 7;
      const FOOTER_H = 30;
      const colW = (PAGE_W - 2 * M - GAP * (COLS - 1)) / COLS;
      const imgH = colW * 0.75;
      // captions add a small block underneath; no filename anymore
      const captionBlock = sections.captions ? 22 : 0;
      const cellH = imgH + captionBlock;

      for (const day of dayBuckets) {
        // Day divider page
        const areaCount = day.subgroups.filter((s) => s.areaId).length;
        const summary = `${day.photos.length} photo${day.photos.length === 1 ? "" : "s"}${areaCount > 0 ? ` · ${areaCount} area${areaCount === 1 ? "" : "s"}` : ""}`;
        drawDivider(day.label, summary);

        for (let si = 0; si < day.subgroups.length; si++) {
          const sub = day.subgroups[si];
          // Area divider page (only when this day has multiple area subgroups and the subgroup represents an area)
          if (day.subgroups.length > 1 && sub.areaId) {
            drawDivider(`Area: ${sub.label}`, `${sub.photos.length} photo${sub.photos.length === 1 ? "" : "s"}`);
          }

          let page = addContentPage();
          let y = PAGE_H - M;

          const ensureSpace = (needed: number) => {
            if (y - needed < M + FOOTER_H) {
              page = addContentPage();
              y = PAGE_H - M;
            }
          };

          // Day note (once per day, at top of first subgroup)
          if (si === 0) {
            const dn = dayNoteByDate.get(day.dateKey);
            if (dn) {
              ensureSpace(20);
              page.drawText("Day notes", { x: M, y: y - 12, size: 10, font: fontBold, color: ACCENT });
              y -= 22;
              const res = drawBullets(page, dn, y, PAGE_W - 2 * M, 10, TEXT, () => {
                const np = addContentPage();
                return { page: np, y: PAGE_H - M };
              });
              page = res.page; y = res.y - 6;
            }
          }

          // Subgroup header (label · count [· status])
          ensureSpace(40);
          page.drawRectangle({ x: M, y: y - 4, width: 24, height: 2, color: ACCENT });
          let header = `${sub.label}  ·  ${sub.photos.length} photo${sub.photos.length === 1 ? "" : "s"}`;
          if (sub.areaId) {
            const st = areaDayStatus.get(`${sub.areaId}|${sub.dateKey}`);
            if (st && st !== "no_status") header += `  ·  ${STATUS_LABEL[st] ?? st}`;
          }
          page.drawText(header, { x: M, y: y - 18, size: 12, font: fontBold, color: TEXT });
          y -= 32;

          // Per-area, per-day update note (bulleted)
          if (sub.areaId) {
            const note = areaDayNotes.get(`${sub.areaId}|${sub.dateKey}`);
            if (note && note.trim()) {
              const res = drawBullets(page, note, y, PAGE_W - 2 * M, 9, MUTED, () => {
                const np = addContentPage();
                return { page: np, y: PAGE_H - M };
              });
              page = res.page; y = res.y - 6;
            }
          }

          // Photos: edge-to-edge with small gutter, no border, no filename
          for (let i = 0; i < sub.photos.length; i += COLS) {
            ensureSpace(cellH + GAP);
            const rowPhotos = sub.photos.slice(i, i + COLS);
            const rowTop = y;
            for (let c = 0; c < rowPhotos.length; c++) {
              const ph = rowPhotos[c];
              const x = M + c * (colW + GAP);
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
                      // Cover-fit: fill the cell, cropping overflow visually by scaling proportionally to the smaller dim
                      // Use contain to preserve full image. Center within cell. No border drawn.
                      const scale = Math.min(colW / img.width, imgH / img.height);
                      const w = img.width * scale, h = img.height * scale;
                      const ox = x + (colW - w) / 2;
                      const oy = rowTop - imgH + (imgH - h) / 2;
                      page.drawImage(img, { x: ox, y: oy, width: w, height: h });
                    }
                  }
                }
              } catch (_) { /* skip */ }

              if (sections.captions && ph.caption && ph.caption.trim()) {
                const truncated = ph.caption.length > 60 ? ph.caption.slice(0, 58) + "…" : ph.caption;
                page.drawText(truncated, { x, y: rowTop - imgH - 12, size: 8, font, color: TEXT });
              }
            }
            y -= cellH + GAP;
          }
          y -= 6;
        }
      }
    }

    // ---- EXIF table ----
    if (sections.exif && allPhotos.length > 0) {
      let page = addContentPage();
      let y = PAGE_H - M;
      page.drawText("EXIF data", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      const headers = ["File", "Captured", "Camera", "Exposure", "ISO"];
      const widths = orientation === "landscape" ? [260, 120, 160, 140, 50] : [180, 90, 110, 100, 35];
      const drawRow = (cells: string[], bold = false) => {
        let x = M;
        for (let i = 0; i < cells.length; i++) {
          const txt = (cells[i] ?? "").slice(0, 60);
          page.drawText(txt, { x, y, size: 8, font: bold ? fontBold : font, color: bold ? TEXT : rgb(0.2, 0.2, 0.2) });
          x += widths[i];
        }
        y -= 14;
      };
      drawRow(headers, true);
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: PAGE_W - M, y: y + 4 }, thickness: 0.5, color: MUTED });

      for (const p of allPhotos) {
        if (y < M + 40) { page = addContentPage(); y = PAGE_H - M; }
        const cam = [p.camera_make, p.camera_model].filter(Boolean).join(" ");
        const exp = [p.aperture ? `f/${p.aperture}` : "", p.shutter_speed || ""].filter(Boolean).join(" ");
        drawRow([
          p.file_name ?? "",
          p.captured_at ? new Date(p.captured_at).toLocaleDateString("en-GB") : "",
          cam,
          exp,
          p.iso ? String(p.iso) : "",
        ]);
      }
    }

    // ---- Notes ----
    if (sections.notes && (notes ?? []).length > 0) {
      let page = addContentPage();
      let y = PAGE_H - M;
      page.drawText("Guest notes", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      for (const ph of allPhotos) {
        const list = notesByPhoto.get(ph.id);
        if (!list?.length) continue;
        if (y < M + 80) { page = addContentPage(); y = PAGE_H - M; }
        page.drawText(ph.caption || ph.file_name || "Photo", { x: M, y, size: 10, font: fontBold, color: TEXT }); y -= 14;
        for (const n of list) {
          const head = `${n.guest_name} · ${new Date(n.created_at).toLocaleDateString("en-GB")}`;
          page.drawText(head, { x: M, y, size: 8, font: fontBold, color: ACCENT }); y -= 10;
          for (const line of wrapText(n.body, font, 9, PAGE_W - 2 * M).slice(0, 8)) {
            if (y < M + 40) { page = addContentPage(); y = PAGE_H - M; }
            page.drawText(line, { x: M, y, size: 9, font, color: TEXT }); y -= 12;
          }
          y -= 6;
        }
        y -= 8;
      }
    }

    // ---- Activity log ----
    if (sections.activity && (activity ?? []).length > 0) {
      let page = addContentPage();
      let y = PAGE_H - M;
      page.drawText("Activity log", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      for (const ev of (activity ?? [])) {
        if (y < M + 40) { page = addContentPage(); y = PAGE_H - M; }
        const who = ev.actor_id ? (actorMap.get(ev.actor_id) ?? "Member") : "System";
        const when = new Date(ev.created_at).toLocaleString("en-GB");
        const meta = (ev.metadata as { name?: string; file_name?: string } | null)?.name
          || (ev.metadata as { name?: string; file_name?: string } | null)?.file_name
          || "";
        const line = `${when}  ·  ${who}  ·  ${ev.verb}${meta ? `  ·  ${meta}` : ""}`;
        page.drawText(line.slice(0, 140), { x: M, y, size: 8, font, color: TEXT }); y -= 12;
      }
    }

    // ---- Footer on every content page ----
    const exportedDateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const allPages = pdf.getPages();
    const contentPages = allPages.filter((_, idx) => contentPageIndices.has(idx));
    const totalContent = contentPages.length;
    let pageNum = 0;
    for (let idx = 0; idx < allPages.length; idx++) {
      if (!contentPageIndices.has(idx)) continue;
      pageNum += 1;
      const p = allPages[idx];
      // Hairline rule above footer
      p.drawLine({
        start: { x: M, y: 32 },
        end: { x: PAGE_W - M, y: 32 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
      // Left: project name
      p.drawText(proj.name, { x: M, y: 18, size: 8, font, color: MUTED });
      // Center: export date
      const dateW = font.widthOfTextAtSize(sanitize(exportedDateStr), 8);
      p.drawText(exportedDateStr, { x: (PAGE_W - dateW) / 2, y: 18, size: 8, font, color: MUTED });
      // Right: Page X of Y
      const pageStr = `Page ${pageNum} of ${totalContent}`;
      const pageW = font.widthOfTextAtSize(sanitize(pageStr), 8);
      p.drawText(pageStr, { x: PAGE_W - M - pageW, y: 18, size: 8, font, color: MUTED });
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

    return new Response(JSON.stringify({ ok: true, output_path: outputPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-pdf error", e);
    if (exportId) await fail(supabase, exportId, String((e as Error)?.message ?? e));
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text).split(/\s+/);
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
