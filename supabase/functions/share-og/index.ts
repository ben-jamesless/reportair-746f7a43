// Serves link-preview (Open Graph) HTML for a client share link so chat apps
// and social platforms unfurl the event name plus its satellite map thumbnail.
// Real browsers are redirected straight to the share page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SHARE_BASE = "https://buildfolder.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
  const target = token ? `${SHARE_BASE}/s/${encodeURIComponent(token)}` : SHARE_BASE;

  let title = "BuildFolder — Live build report";
  let description = "Live event build report — areas, daily updates, photos and site map.";
  let image = `${SHARE_BASE}/og.png?v=6`;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: link } = await supabase
      .from("share_links")
      .select("project_id, revoked_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (link && !link.revoked_at) {
      const { data: project } = await supabase
        .from("projects")
        .select(
          "name, client_name, event_location, geo_lat, geo_lng, map_default_center_lat, map_default_center_lng, map_default_zoom"
        )
        .eq("id", link.project_id)
        .maybeSingle();

      if (project) {
        title = `BuildFolder — ${project.name}`;
        const bits = [project.client_name, project.event_location].filter(Boolean);
        description = bits.length
          ? `${bits.join(" · ")} — live build report: areas, daily updates, photos and site map.`
          : description;

        const lat = project.map_default_center_lat ?? project.geo_lat;
        const lng = project.map_default_center_lng ?? project.geo_lng;
        if (lat != null && lng != null) {
          const base = Deno.env.get("SUPABASE_URL");
          const params = new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            w: "600",
            h: "315",
            scale: "2",
            zoom: String(project.map_default_zoom ?? 16),
          });
          image = `${base}/functions/v1/static-map?${params.toString()}`;
        }
      }
    }
  } catch (e) {
    console.error("share-og error", e);
  }

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(target)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0; url=${esc(target)}" />
<script>window.location.replace(${JSON.stringify(target)});</script>
</head><body><p><a href="${esc(target)}">${esc(title)}</a></p></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
