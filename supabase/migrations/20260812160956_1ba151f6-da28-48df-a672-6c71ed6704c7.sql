ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS finalised_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_summary_text text,
  ADD COLUMN IF NOT EXISTS hero_photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.event_lifecycle_mode(_project_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT p.finalised_at FROM public.projects p WHERE p.id = _project_id) IS NOT NULL
      THEN 'filed'
    ELSE 'build'
  END;
$$;

CREATE OR REPLACE FUNCTION public.share_meta(_token uuid, _password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  link public.share_links;
  proj RECORD;
  team_row RECORD;
  latest_export RECORD;
  hide_branding boolean;
BEGIN
  link := public.share_link_check(_token, _password);
  IF link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  UPDATE public.share_links
     SET view_count = view_count + 1, last_accessed_at = now()
   WHERE id = link.id;

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

  RETURN jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'show_photo_pins', link.show_photo_pins,
    'generated_at', now(),
    'mode', public.event_lifecycle_mode(link.project_id, CURRENT_DATE),
    'project', to_jsonb(proj),
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
        'photo_count', (SELECT count(*) FROM public.photos p WHERE p.area_id = ar.id),
        'latest_status', (
          SELECT s.status::text FROM public.area_day_status s
           WHERE s.area_id = ar.id AND s.status <> 'not_started'
           ORDER BY s.day DESC LIMIT 1)
      ) ORDER BY ar.sort_order, ar.name)
      FROM public.areas ar
       WHERE ar.project_id = link.project_id AND ar.deleted_at IS NULL), '[]'::jsonb),
    'grid', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'area_id', g.area_id, 'date', to_char(g.day, 'YYYY-MM-DD'),
        'status', g.status, 'photo_count', g.photo_count))
      FROM (
        SELECT s.area_id, s.day, s.status::text AS status,
               (SELECT count(*) FROM public.photos p
                 WHERE p.area_id = s.area_id
                   AND (COALESCE(p.captured_at, p.created_at) AT TIME ZONE 'UTC')::date = s.day) AS photo_count
          FROM public.area_day_status s
          JOIN public.areas a2 ON a2.id = s.area_id AND a2.deleted_at IS NULL
         WHERE a2.project_id = link.project_id
        UNION
        SELECT p.area_id, (COALESCE(p.captured_at, p.created_at) AT TIME ZONE 'UTC')::date AS day,
               NULL::text, count(*)
          FROM public.photos p
          JOIN public.areas a3 ON a3.id = p.area_id AND a3.deleted_at IS NULL
         WHERE a3.project_id = link.project_id
         GROUP BY 1, 2
      ) g), '[]'::jsonb),
    'days', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'date')
      FROM (
        SELECT jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'day_status', (SELECT dn.day_status::text FROM public.day_notes dn
                          WHERE dn.project_id = link.project_id AND dn.day = d.day),
          'worst_status', (
            SELECT s.status::text FROM public.area_day_status s
             JOIN public.areas a4 ON a4.id = s.area_id AND a4.deleted_at IS NULL
            WHERE a4.project_id = link.project_id AND s.day = d.day
            ORDER BY CASE s.status::text
              WHEN 'delayed' THEN 0 WHEN 'flagged' THEN 1
              WHEN 'in_progress' THEN 2 WHEN 'complete' THEN 3 ELSE 4 END
            LIMIT 1),
          'photo_count', (SELECT count(*) FROM public.photos p
                           JOIN public.areas a5 ON a5.id = p.area_id
                          WHERE p.project_id = link.project_id
                            AND (COALESCE(p.captured_at, p.created_at) AT TIME ZONE 'UTC')::date = d.day),
          'has_notes', EXISTS (SELECT 1 FROM public.day_notes dn2
                                WHERE dn2.project_id = link.project_id AND dn2.day = d.day)
        ) AS x
        FROM (
          SELECT DISTINCT day FROM (
            SELECT (COALESCE(p.captured_at, p.created_at) AT TIME ZONE 'UTC')::date AS day
              FROM public.photos p WHERE p.project_id = link.project_id
            UNION
            SELECT dn.day FROM public.day_notes dn WHERE dn.project_id = link.project_id
            UNION
            SELECT s.day FROM public.area_day_status s
              JOIN public.areas a6 ON a6.id = s.area_id AND a6.deleted_at IS NULL
             WHERE a6.project_id = link.project_id
          ) u WHERE day IS NOT NULL
        ) d
      ) y), '[]'::jsonb),
    'photo_count', (SELECT count(*) FROM public.photos p WHERE p.project_id = link.project_id),
    'latest_export', CASE WHEN latest_export.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', latest_export.id, 'created_at', latest_export.created_at,
      'photo_count', latest_export.photo_count) END
  );
END;
$$;