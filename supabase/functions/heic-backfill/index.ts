// Backfill: convert HEIC/HEIF photos in storage to JPEG and update DB rows.
// POST { project_id: uuid, limit?: number }
// Auth: requires a logged-in project member (verified via JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
// @ts-ignore - esm.sh provides types-less
import decode from "https://esm.sh/heic-decode@2.0.0";
// @ts-ignore
import { encode as jpegEncode } from "https://esm.sh/jpeg-js@0.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "https://www.buildslides.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return json({ error: "unauthorized" }, 401);
    }

    const { project_id, limit, exclude_ids } = await req.json();
    if (!project_id || typeof project_id !== "string") {
      return json({ error: "project_id required" }, 400);
    }
    const max = Math.max(1, Math.min(Number(limit) || 1, 3));
    const excluded: string[] = Array.isArray(exclude_ids) ? exclude_ids.filter((x) => typeof x === "string") : [];

    // Verify caller is a member of the project (uses caller's JWT)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const { data: member } = await userClient
      .from("project_members")
      .select("user_id")
      .eq("project_id", project_id)
      .eq("user_id", uid)
      .maybeSingle();
    if (!member) return json({ error: "forbidden" }, 403);

    // Service-role client for storage + DB writes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find HEIC photos for this project
    let q = admin
      .from("photos")
      .select("id, storage_path, file_name, mime_type")
      .eq("project_id", project_id)
      .or("file_name.ilike.%.heic,file_name.ilike.%.heif,mime_type.eq.image/heic,mime_type.eq.image/heif");
    if (excluded.length > 0) {
      q = q.not("id", "in", `(${excluded.join(",")})`);
    }
    const { data: photos, error: qErr } = await q.limit(max);

    if (qErr) return json({ error: qErr.message }, 500);
    if (!photos || photos.length === 0) {
      return json({ converted: 0, skipped: 0, failed: 0, total: 0 });
    }

    let converted = 0, failed = 0;
    const failures: { id: string; reason: string }[] = [];
    const processed_ids: string[] = [];

    for (const p of photos) {
      processed_ids.push(p.id);
      try {
        const { data: blob, error: dlErr } = await admin.storage.from("photos").download(p.storage_path);
        if (dlErr || !blob) throw new Error(dlErr?.message || "download failed");
        // Skip very large HEIC files — they will OOM the edge function.
        if (blob.size > 8 * 1024 * 1024) {
          throw new Error(`file too large to decode (${Math.round(blob.size / 1024 / 1024)}MB)`);
        }
        const inputBuf = new Uint8Array(await blob.arrayBuffer());

        const decoded = await decode({ buffer: inputBuf });
        const jpeg = jpegEncode(
          { data: decoded.data, width: decoded.width, height: decoded.height },
          82,
        );

        const newPath = p.storage_path.replace(/\.(heic|heif)$/i, "") + ".jpg";
        const newName = (p.file_name || "photo").replace(/\.(heic|heif)$/i, "") + ".jpg";

        const { error: upErr } = await admin.storage
          .from("photos")
          .upload(newPath, jpeg.data, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const { error: updErr } = await admin
          .from("photos")
          .update({ storage_path: newPath, file_name: newName, mime_type: "image/jpeg" })
          .eq("id", p.id);
        if (updErr) throw new Error(`db: ${updErr.message}`);

        if (newPath !== p.storage_path) {
          await admin.storage.from("photos").remove([p.storage_path]);
        }
        converted++;
      } catch (e) {
        failed++;
        failures.push({ id: p.id, reason: String((e as Error)?.message ?? e) });
      }
    }

    return json({ total: photos.length, converted, failed, failures, processed_ids });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
