// Generate an AI caption for a photo using Lovable AI Gateway (Gemini 2.5 Flash).
// Verifies the caller is a member of the project (RLS via user JWT) and that
// the photo belongs to the given project, then returns a concise caption.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  photo_id: string;
  hint?: string; // optional user hint, e.g. "more concise" or "focus on lighting"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

    // RLS-aware client (caller's JWT) — used to authorize read access to the photo row.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    // Service client — used to create a short-lived signed URL for the storage object.
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const { photo_id, hint } = (await req.json()) as Body;
    if (!photo_id) return json({ error: "photo_id is required" }, 400);

    // Authorization: caller must be able to SELECT the photo via RLS.
    const { data: photo, error: photoErr } = await userClient
      .from("photos")
      .select("id, project_id, storage_path, file_name, captured_at, camera_make, camera_model, lens, gps_lat, gps_lng")
      .eq("id", photo_id)
      .maybeSingle();

    if (photoErr) return json({ error: photoErr.message }, 400);
    if (!photo) return json({ error: "Photo not found or access denied" }, 404);

    // Signed URL so the model can fetch the image.
    const { data: signed, error: signErr } = await adminClient.storage
      .from("photos")
      .createSignedUrl(photo.storage_path, 300);
    if (signErr || !signed?.signedUrl) {
      return json({ error: signErr?.message ?? "Could not sign storage URL" }, 500);
    }

    const contextBits: string[] = [];
    if (photo.captured_at) contextBits.push(`captured at ${photo.captured_at}`);
    if (photo.camera_make || photo.camera_model)
      contextBits.push(`shot on ${[photo.camera_make, photo.camera_model].filter(Boolean).join(" ")}`);
    if (photo.lens) contextBits.push(`lens: ${photo.lens}`);
    if (photo.gps_lat && photo.gps_lng) contextBits.push(`GPS ${photo.gps_lat},${photo.gps_lng}`);
    const contextLine = contextBits.length ? `\nContext: ${contextBits.join("; ")}.` : "";
    const hintLine = hint ? `\nUser hint: ${hint}` : "";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write concise, vivid captions for event production photographs. Output 1–2 sentences, present tense, factual. No emoji, no hashtags, no quotes.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Write a caption for this photo.${contextLine}${hintLine}` },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings." }, 402);
    if (!aiResp.ok) {
      const text = await aiResp.text();
      return json({ error: `AI gateway error: ${text}` }, 500);
    }

    const aiJson = await aiResp.json();
    const caption = (aiJson?.choices?.[0]?.message?.content ?? "").toString().trim();
    if (!caption) return json({ error: "No caption returned" }, 500);

    // Persist caption (caller's JWT enforces editor/owner update via RLS).
    const { error: updErr } = await userClient
      .from("photos")
      .update({ caption })
      .eq("id", photo_id);
    if (updErr) {
      // Still return the caption so the UI can show it even if write was denied.
      return json({ caption, warning: updErr.message });
    }

    return json({ caption });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
