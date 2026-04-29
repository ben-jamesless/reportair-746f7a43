// Generate a PDF export for a project. Async: invoked once per export row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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
  if (!m) return { r: 1 / 255, g: 105 / 255, b: 111 / 255 }; // teal default
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
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let g = map.get(key);
    if (!g) { g = { date: d, label: fmtDateGroup(d), photos: [] }; map.set(key, g); }
    g.photos.push(p);
  }
  return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

async function fail(supabase: any, exportId: string, msg: string) {
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

    // Mark processing
    await supabase.from("project_exports").update({ status: "processing" }).eq("id", exportId);

    const { data: exp, error: expErr } = await supabase.from("project_exports").select("*").eq("id", exportId).single();
    if (expErr || !exp) throw new Error("Export row not found");

    const projectId = exp.project_id;
    const sections: Sections = { cover: true, grid: true, captions: true, exif: false, notes: true, activity: false, ...(exp.options?.sections ?? {}) };
    const dayKey: string | null = exp.options?.day_key ?? null;
    const dayLabel: string | null = exp.options?.day_label ?? null;
    const accent = hexToRgb(exp.accent_color || "#01696F");

    // Load project + photos + albums + areas + activity + notes
    const [{ data: proj }, { data: photos }, { data: albums }, { data: areas }, { data: activity }, { data: notes }] = await Promise.all([
      supabase.from("projects").select("name, description, template").eq("id", projectId).single(),
      supabase.from("photos").select("id, file_name, caption, captured_at, created_at, storage_path, album_id, area_id, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height").eq("project_id", projectId).order("captured_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("albums").select("id, name").eq("project_id", projectId),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
      supabase.from("activity_events").select("verb, target_type, metadata, created_at, actor_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200),
      supabase.from("guest_notes").select("photo_id, guest_name, body, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    if (!proj) throw new Error("Project not found");
    let allPhotos = (photos ?? []) as any[];

    // Day-scoped export: filter to photos that fall on the chosen day (by EXIF capture date or upload date)
    const photoDayKey = (p: any) => {
      const raw = p.captured_at || p.created_at;
      const d = new Date(raw);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };
    if (dayKey) {
      allPhotos = allPhotos.filter((p) => photoDayKey(p) === dayKey);
      if (allPhotos.length === 0) throw new Error("No photos found for the selected day.");
    }

    if (allPhotos.length > PHOTO_CAP) {
      throw new Error(`This export contains ${allPhotos.length} photos. The PDF export is limited to ${PHOTO_CAP}. Split your project across more days or remove photos before exporting.`);
    }

    const albumName = new Map((albums ?? []).map((a: any) => [a.id, a.name]));
    const areaName = new Map((areas ?? []).map((a: any) => [a.id, a.name]));
    const notesByPhoto = new Map<string, any[]>();
    for (const n of (notes ?? [])) {
      const arr = notesByPhoto.get(n.photo_id) ?? [];
      arr.push(n); notesByPhoto.set(n.photo_id, arr);
    }

    // Resolve actor names for activity
    const actorIds = Array.from(new Set((activity ?? []).map((a: any) => a.actor_id).filter(Boolean)));
    const actorMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
      for (const p of (profs ?? [])) actorMap.set(p.id, p.full_name || "Member");
    }

    // ============ Build PDF ============
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Sanitize text so pdf-lib's WinAnsi-only standard fonts never throw.
    // Replaces smart quotes, dashes, exotic spaces, etc. with ASCII equivalents
    // and strips anything else outside the basic WinAnsi range.
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
      s = s.replace(/[\u00A0\u2007\u2009\u200A\u202F\u205F\u3000\u200B\u200C\u200D\uFEFF\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2013\u2014\u2212\u2026\u2022\u00B7]/g, (c) => map[c] ?? "");
      // Strip remaining non-WinAnsi characters (keep printable ASCII + Latin-1 supplement)
      s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "?");
      return s;
    };

    // Wrap drawText so every string passes through sanitize()
    const _wrapDraw = (p: any) => {
      const orig = p.drawText.bind(p);
      p.drawText = (text: string, opts: any) => orig(sanitize(text), opts);
      return p;
    };
    const origAddPage = pdf.addPage.bind(pdf);
    pdf.addPage = ((...args: any[]) => _wrapDraw((origAddPage as any)(...args))) as any;

    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;
    const M = 40;
    const TEXT = rgb(0.1, 0.1, 0.1);
    const MUTED = rgb(0.45, 0.45, 0.45);
    const ACCENT = rgb(accent.r, accent.g, accent.b);

    // ---- Cover ----
    if (sections.cover) {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      // Accent bar
      page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: ACCENT });

      let y = PAGE_H - 120;

      // Logo
      if (exp.logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage.from("export-assets").download(exp.logo_path);
          if (logoBlob) {
            const bytes = new Uint8Array(await logoBlob.arrayBuffer());
            let img;
            try { img = await pdf.embedPng(bytes); } catch { img = await pdf.embedJpg(bytes); }
            const maxW = 200, maxH = 80;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const w = img.width * scale, h = img.height * scale;
            page.drawImage(img, { x: M, y: y - h, width: w, height: h });
            y -= h + 30;
          }
        } catch (_) { /* skip logo */ }
      }

      const titleText = dayKey && dayLabel ? `${proj.name} — ${dayLabel}` : proj.name;
      page.drawText(titleText, { x: M, y: y - 30, size: 28, font: fontBold, color: TEXT });
      y -= 60;
      if (proj.description) {
        const lines = wrapText(proj.description, font, 12, PAGE_W - 2 * M);
        for (const line of lines.slice(0, 6)) {
          page.drawText(line, { x: M, y: y - 16, size: 12, font, color: MUTED });
          y -= 18;
        }
      }
      // Stats footer
      const stats = dayKey
        ? `${allPhotos.length} photos on ${dayLabel ?? "this day"} · Exported ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
        : `${allPhotos.length} photos · ${(albums ?? []).length} albums · Exported ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
      page.drawText(stats, { x: M, y: 60, size: 10, font, color: MUTED });
    }

    // ---- Photo grid (grouped by date) ----
    if (sections.grid && allPhotos.length > 0) {
      const groups = groupByDate(allPhotos);
      // Layout: 3 cols x 3 rows per page = 9 thumbs
      const COLS = 3;
      const GAP = 12;
      const colW = (PAGE_W - 2 * M - GAP * (COLS - 1)) / COLS;
      const cellH = colW * 0.75 + (sections.captions ? 28 : 12);

      let page = pdf.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - M;

      const ensureSpace = (needed: number) => {
        if (y - needed < M) {
          page = pdf.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - M;
        }
      };

      for (const group of groups) {
        ensureSpace(40);
        page.drawRectangle({ x: M, y: y - 4, width: 24, height: 2, color: ACCENT });
        page.drawText(`${group.label}  ·  ${group.photos.length} photo${group.photos.length === 1 ? "" : "s"}`, { x: M, y: y - 18, size: 11, font: fontBold, color: TEXT });
        y -= 32;

        // Render photos in rows
        for (let i = 0; i < group.photos.length; i += COLS) {
          ensureSpace(cellH + 6);
          const rowPhotos = group.photos.slice(i, i + COLS);
          const rowTop = y;
          for (let c = 0; c < rowPhotos.length; c++) {
            const ph = rowPhotos[c];
            const x = M + c * (colW + GAP);
            const imgH = colW * 0.75;
            // placeholder bg
            page.drawRectangle({ x, y: rowTop - imgH, width: colW, height: imgH, color: rgb(0.92, 0.92, 0.92) });
            try {
              // Use Supabase image transform to force JPEG output (handles HEIC, WebP, etc.)
              const { data: signed } = await supabase.storage.from("photos").createSignedUrl(
                ph.storage_path,
                600,
                { transform: { width: 1200, quality: 80, format: "origin" } as any },
              );
              // Fallback: also build a transform URL manually since SDK types vary
              const baseUrl = signed?.signedUrl;
              const transformedUrl = baseUrl
                ? baseUrl.replace("/object/sign/", "/render/image/sign/") + "&width=1200&quality=80"
                : null;
              if (transformedUrl) {
                let r = await fetch(transformedUrl);
                if (!r.ok && baseUrl) r = await fetch(baseUrl); // fall back to original
                if (r.ok) {
                  const bytes = new Uint8Array(await r.arrayBuffer());
                  const ct = r.headers.get("content-type") || "";
                  let img: any = null;
                  try {
                    if (ct.includes("png")) img = await pdf.embedPng(bytes);
                    else img = await pdf.embedJpg(bytes);
                  } catch {
                    try { img = await pdf.embedJpg(bytes); } catch { try { img = await pdf.embedPng(bytes); } catch { img = null; } }
                  }
                  if (img) {
                    const scale = Math.min(colW / img.width, imgH / img.height);
                    const w = img.width * scale, h = img.height * scale;
                    const ox = x + (colW - w) / 2;
                    const oy = rowTop - imgH + (imgH - h) / 2;
                    page.drawImage(img, { x: ox, y: oy, width: w, height: h });
                  }
                }
              }
            } catch (_) { /* placeholder remains */ }

            if (sections.captions) {
              const caption = ph.caption || ph.file_name;
              const truncated = caption.length > 40 ? caption.slice(0, 38) + "…" : caption;
              page.drawText(truncated, { x, y: rowTop - imgH - 14, size: 8, font, color: TEXT });
              const meta: string[] = [];
              if (ph.area_id && areaName.get(ph.area_id)) meta.push(areaName.get(ph.area_id)!);
              if (ph.album_id && albumName.get(ph.album_id)) meta.push(albumName.get(ph.album_id)!);
              if (meta.length) page.drawText(meta.join(" · ").slice(0, 50), { x, y: rowTop - imgH - 24, size: 7, font, color: MUTED });
            }
          }
          y -= cellH + 6;
        }
        y -= 8;
      }
    }

    // ---- EXIF table ----
    if (sections.exif && allPhotos.length > 0) {
      let page = pdf.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - M;
      page.drawText("EXIF data", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      const headers = ["File", "Captured", "Camera", "Exposure", "ISO"];
      const widths = [180, 90, 110, 100, 35];
      const drawRow = (cells: string[], bold = false) => {
        let x = M;
        for (let i = 0; i < cells.length; i++) {
          const txt = (cells[i] ?? "").slice(0, 40);
          page.drawText(txt, { x, y, size: 8, font: bold ? fontBold : font, color: bold ? TEXT : rgb(0.2, 0.2, 0.2) });
          x += widths[i];
        }
        y -= 14;
      };
      drawRow(headers, true);
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: PAGE_W - M, y: y + 4 }, thickness: 0.5, color: MUTED });

      for (const p of allPhotos) {
        if (y < M + 20) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
        const cam = [p.camera_make, p.camera_model].filter(Boolean).join(" ");
        const exp = [p.aperture ? `f/${p.aperture}` : "", p.shutter_speed || ""].filter(Boolean).join(" ");
        drawRow([
          p.file_name,
          p.captured_at ? new Date(p.captured_at).toLocaleDateString("en-GB") : "",
          cam,
          exp,
          p.iso ? String(p.iso) : "",
        ]);
      }
    }

    // ---- Notes ----
    if (sections.notes && (notes ?? []).length > 0) {
      let page = pdf.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - M;
      page.drawText("Guest notes", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      for (const ph of allPhotos) {
        const list = notesByPhoto.get(ph.id);
        if (!list?.length) continue;
        if (y < M + 60) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
        page.drawText(ph.file_name, { x: M, y, size: 10, font: fontBold, color: TEXT }); y -= 14;
        for (const n of list) {
          const head = `${n.guest_name} · ${new Date(n.created_at).toLocaleDateString("en-GB")}`;
          page.drawText(head, { x: M, y, size: 8, font: fontBold, color: ACCENT }); y -= 10;
          for (const line of wrapText(n.body, font, 9, PAGE_W - 2 * M).slice(0, 8)) {
            if (y < M + 12) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
            page.drawText(line, { x: M, y, size: 9, font, color: TEXT }); y -= 12;
          }
          y -= 6;
        }
        y -= 8;
      }
    }

    // ---- Activity log ----
    if (sections.activity && (activity ?? []).length > 0) {
      let page = pdf.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - M;
      page.drawText("Activity log", { x: M, y, size: 16, font: fontBold, color: TEXT }); y -= 24;

      for (const ev of (activity ?? [])) {
        if (y < M + 12) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
        const who = ev.actor_id ? (actorMap.get(ev.actor_id) ?? "Member") : "System";
        const when = new Date(ev.created_at).toLocaleString("en-GB");
        const meta = ev.metadata?.name || ev.metadata?.file_name || "";
        const line = `${when}  ·  ${who}  ·  ${ev.verb}${meta ? `  ·  ${meta}` : ""}`;
        page.drawText(line.slice(0, 110), { x: M, y, size: 8, font, color: TEXT }); y -= 12;
      }
    }

    // Footer page numbers
    const pages = pdf.getPages();
    pages.forEach((p, idx) => {
      p.drawText(`${idx + 1} / ${pages.length}`, { x: PAGE_W - M - 30, y: 20, size: 8, font, color: MUTED });
    });

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
    if (exportId) await fail(supabase, exportId, String(e?.message ?? e));
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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
