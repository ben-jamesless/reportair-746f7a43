// Server-side EXIF re-parse for an uploaded photo.
// Called fire-and-forget from the client right after insert. Downloads the
// stored object with service-role, parses EXIF, and updates the photo row
// only when a real DateTimeOriginal/CreateDate is found. Never overwrites
// an existing real capture date with `now()`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import exifr from "https://esm.sh/exifr@7.1.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "missing auth" });
    }

    const { photo_id } = await req.json();
    if (!photo_id || typeof photo_id !== "string") {
      return json(400, { error: "photo_id required" });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller has read access via their JWT (RLS).
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: photo, error: readErr } = await userClient
      .from("photos")
      .select("id, storage_path, captured_at")
      .eq("id", photo_id)
      .maybeSingle();
    if (readErr) return json(403, { error: readErr.message });
    if (!photo) return json(404, { error: "not found" });

    const admin = createClient(url, serviceKey);
    const { data: blob, error: dlErr } = await admin.storage
      .from("photos")
      .download(photo.storage_path);
    if (dlErr || !blob) return json(500, { error: dlErr?.message ?? "download failed" });

    const buf = new Uint8Array(await blob.arrayBuffer());
    let exif: Record<string, unknown> | null = null;
    try {
      exif = (await exifr.parse(buf, { gps: true, tiff: true, exif: true })) as
        | Record<string, unknown>
        | null;
    } catch (_e) {
      exif = null;
    }

    const captured =
      (exif?.DateTimeOriginal as string | Date | undefined) ||
      (exif?.CreateDate as string | Date | undefined) ||
      null;

    if (!captured) {
      return json(200, { updated: false, reason: "no exif date" });
    }

    const capturedIso = new Date(captured).toISOString();
    const update: Record<string, unknown> = { captured_at: capturedIso };
    if (exif?.Make) update.camera_make = exif.Make;
    if (exif?.Model) update.camera_model = exif.Model;
    if (exif?.LensModel || exif?.Lens) update.lens = (exif.LensModel ?? exif.Lens) as string;
    if (exif?.ISO != null) update.iso = Number(exif.ISO);
    if (exif?.FNumber != null) update.aperture = Number(exif.FNumber);
    if (exif?.FocalLength != null) update.focal_length = Number(exif.FocalLength);
    if (typeof exif?.latitude === "number") update.gps_lat = exif.latitude;
    if (typeof exif?.longitude === "number") update.gps_lng = exif.longitude;
    if (exif?.ExifImageWidth || exif?.ImageWidth) update.width = (exif.ExifImageWidth ?? exif.ImageWidth) as number;
    if (exif?.ExifImageHeight || exif?.ImageHeight) update.height = (exif.ExifImageHeight ?? exif.ImageHeight) as number;

    const { error: updErr } = await admin
      .from("photos")
      .update(update)
      .eq("id", photo_id);
    if (updErr) return json(500, { error: updErr.message });

    return json(200, { updated: true, captured_at: capturedIso });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
