ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS team_view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.share_meta(_token uuid, _password text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  link public.share_links;
  proj RECORD;
  team_row RECORD;
  latest_export RECORD;
  hide_branding boolean;
  hero_id uuid;
  is_team_preview boolean;
BEGIN
  link := public.share_link_check(_token, _password);
  IF link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  -- Opens by a signed-in user with a role on the project are team previews,
  -- never client opens. The client figure must stay evidential.
  is_team_preview := auth.uid() IS NOT NULL
                     AND public.is_project_reader(auth.uid(), link.project_id);

  IF is_team_preview THEN
    UPDATE public.share_links
       SET team_view_count = team_view_count + 1
     WHERE id = link.id;
  ELSE
    UPDATE public.share_links
       SET view_count = view_count + 1, last_accessed_at = now()
     WHERE id = link.id;
  END IF;

  SELECT id, name, description, client_name, event_type, event_location, event_date,
         color, overall_status, build_start_date, build_end_date, logo_path,
         geo_lat, geo_lng, map_default_center_lat, map_default_center_lng, map_default_zoom,
         finalised_at, event_summary_text, hero_photo_id
    INTO proj FROM public.projects WHERE id = link.project_id;

  SELECT t.plan, t.name AS team_name, t.logo_path, t.white_label_pdf, t.brand_colour
    INTO team_row
    FROM public.projects p JOIN public.teams t ON t.id = p.team_id
   WHERE p.id = link.project_id;

  hide_branding := (team_row.plan = 'studio'
                    AND COALESCE(team_row.white_label_pdf, false) = true
                    AND team_row.logo_path IS NOT NULL);

  SELECT id, created_at, photo_count INTO latest_export
    FROM public.project_exports
   WHERE project_id = link.project_id AND status = 'ready' AND output_path IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;

  hero_id := proj.hero_photo_id;
  IF hero_id IS NULL THEN
    SELECT p.id INTO hero_id
      FROM public.photos p
     WHERE p.project_id = link.project_id
       AND p.is_reference = false
       AND p.area_id = (
         SELECT p2.area_id FROM public.photos p2
          JOIN public.areas a ON a.id = p2.area_id AND a.deleted_at IS NULL
          WHERE p2.project_id = link.project_id AND p2.is_reference = false
          GROUP BY p2.area_id
          ORDER BY count(*) DESC
          LIMIT 1)
     ORDER BY COALESCE(p.captured_at, p.created_at) DESC
     LIMIT 1;
  END IF;
  IF hero_id IS NULL THEN
    SELECT p.id INTO hero_id
      FROM public.photos p
     WHERE p.project_id = link.project_id AND p.is_reference = false
     ORDER BY COALESCE(p.captured_at, p.created_at) DESC
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'show_photo_pins', link.show_photo_pins,
    'generated_at', now(),
    'mode', public.event_lifecycle_mode(link.project_id, CURRENT_DATE),
    'project', to_jsonb(proj),
    'hero_photo_id', hero_id,
    'team_plan', COALESCE(team_row.plan, 'free'),
    'team_name', team_row.team_name,
    'team_logo_path', team_row.logo_path,
    'brand_colour', team_row.brand_colour,
    'hide_buildslides_branding', hide_branding,
    'phases', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ph.id, 'kind', ph.kind, 'label', ph.label,
        'start_date', to_char(ph.start_date, 'YYYY-MM-DD'),
        'end_date', to_char(ph.end_date, 'YYYY-MM-DD')
      ) ORDER BY ph.start_date, ph.sort_order)
      FROM public.event_phases ph WHERE ph.project_id = link.project_id), '[]'::jsonb),
    'areas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ar.id, 'name', ar.name, 'sort_order', ar.sort_order, 'color', ar.color,
        'photo_count', (SELECT count(*) FROM public.photos p WHERE p.area_id = ar.id AND p.is_reference = false),
        'cover_photo_id', (
          SELECT p.id FROM public.photos p
           WHERE p.area_id = ar.id AND p.is_reference = false
           ORDER BY COALESCE(p.captured_at, p.created_at) DESC
           LIMIT 1),
        'latest_status', (
          SELECT s.status::text FROM public.area_day_status s
           WHERE s.area_id = ar.id AND s.status <> 'not_started'
           ORDER BY s.date DESC LIMIT 1)
      ) ORDER BY ar.sort_order)
      FROM public.areas ar
      WHERE ar.project_id = link.project_id AND ar.deleted_at IS NULL), '[]'::jsonb),
    'reference_photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'area_id', p.area_id, 'width', p.width, 'height', p.height,
        'gps_lat', CASE WHEN link.show_photo_pins THEN p.gps_lat ELSE NULL END,
        'gps_lng', CASE WHEN link.show_photo_pins THEN p.gps_lng ELSE NULL END
      ) ORDER BY COALESCE(p.captured_at, p.created_at))
      FROM public.photos p
      WHERE p.project_id = link.project_id AND p.is_reference = true), '[]'::jsonb),
    'latest_export', CASE WHEN latest_export.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', latest_export.id, 'created_at', latest_export.created_at,
      'photo_count', latest_export.photo_count) END
  );
END $function$;