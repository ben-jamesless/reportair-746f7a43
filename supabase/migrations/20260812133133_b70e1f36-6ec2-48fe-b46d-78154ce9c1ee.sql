-- Per-link pin opt-in (v1 ignores this column)
ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS show_photo_pins boolean NOT NULL DEFAULT false;

-- Internal: validate a share token + password, returning the link row.
CREATE OR REPLACE FUNCTION public.share_link_check(_token uuid, _password text)
RETURNS public.share_links
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE link public.share_links;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF link.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
  IF link.expires_at IS NOT NULL AND link.expires_at < now() THEN RETURN NULL; END IF;
  IF link.password_hash IS NOT NULL THEN
    IF _password IS NULL OR NOT (link.password_hash = crypt(_password, link.password_hash)) THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN link;
END $$;

REVOKE EXECUTE ON FUNCTION public.share_link_check(uuid, text) FROM PUBLIC, anon, authenticated;

-- Status severity ranking (worst first)
CREATE OR REPLACE FUNCTION public.area_status_rank(_s area_status)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _s
    WHEN 'delayed' THEN 0
    WHEN 'flagged' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'complete' THEN 3
    ELSE 4
  END;
$$;

GRANT EXECUTE ON FUNCTION public.area_status_rank(area_status) TO anon, authenticated, service_role;

-- Worst area status for a given event day
CREATE OR REPLACE FUNCTION public.worst_status_for_event_day(_project_id uuid, _date date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.status::text
    FROM public.area_day_status s
    JOIN public.areas a ON a.id = s.area_id AND a.deleted_at IS NULL
   WHERE s.project_id = _project_id AND s.date = _date
   ORDER BY public.area_status_rank(s.status)
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.worst_status_for_event_day(uuid, date) TO anon, authenticated, service_role;

-- ============ share_meta ============
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
         geo_lat, geo_lng, map_default_center_lat, map_default_center_lng, map_default_zoom
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
           ORDER BY s.date DESC LIMIT 1)
      ) ORDER BY ar.sort_order)
      FROM public.areas ar
      WHERE ar.project_id = link.project_id AND ar.deleted_at IS NULL), '[]'::jsonb),
    'days', COALESCE((
      SELECT jsonb_agg(d ORDER BY d->>'date')
      FROM (
        SELECT jsonb_build_object(
          'date', to_char(dd.date, 'YYYY-MM-DD'),
          'day_status', (SELECT dn.day_status::text FROM public.day_notes dn
                          WHERE dn.project_id = link.project_id AND dn.date = dd.date),
          'worst_status', public.worst_status_for_event_day(link.project_id, dd.date),
          'photo_count', (SELECT count(*) FROM public.photos p
                           WHERE p.project_id = link.project_id
                             AND (p.captured_at AT TIME ZONE 'UTC')::date = dd.date),
          'has_notes', EXISTS (SELECT 1 FROM public.day_notes dn
                                WHERE dn.project_id = link.project_id AND dn.date = dd.date
                                  AND COALESCE(dn.notes, dn.today_objectives, dn.today_achievements,
                                               dn.tomorrow_objectives, dn.open_issues) IS NOT NULL)
        ) AS d
        FROM (
          SELECT date FROM public.day_notes WHERE project_id = link.project_id
          UNION
          SELECT date FROM public.area_day_status WHERE project_id = link.project_id
          UNION
          SELECT (captured_at AT TIME ZONE 'UTC')::date FROM public.photos
            WHERE project_id = link.project_id AND captured_at IS NOT NULL
        ) dd
      ) x), '[]'::jsonb),
    'photo_count', (SELECT count(*) FROM public.photos p WHERE p.project_id = link.project_id),
    'latest_export', CASE WHEN latest_export.id IS NOT NULL THEN
      jsonb_build_object('id', latest_export.id, 'created_at', latest_export.created_at,
                         'photo_count', latest_export.photo_count)
      ELSE NULL END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.share_meta(uuid, text) TO anon, authenticated, service_role;

-- ============ share_day ============
CREATE OR REPLACE FUNCTION public.share_day(_token uuid, _password text DEFAULT NULL, _date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  link public.share_links;
  dn RECORD;
BEGIN
  link := public.share_link_check(_token, _password);
  IF link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO dn FROM public.day_notes
   WHERE project_id = link.project_id AND date = _date;

  RETURN jsonb_build_object(
    'ok', true,
    'date', to_char(_date, 'YYYY-MM-DD'),
    'day_status', dn.day_status,
    'notes', dn.notes,
    'today_objectives', dn.today_objectives,
    'today_achievements', dn.today_achievements,
    'tomorrow_objectives', dn.tomorrow_objectives,
    'open_issues', dn.open_issues,
    'last_updated_at', dn.updated_at,
    'worst_status', public.worst_status_for_event_day(link.project_id, _date),
    'areas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'area_id', ar.id,
        'name', ar.name,
        'sort_order', ar.sort_order,
        'status', (SELECT s.status::text FROM public.area_day_status s
                    WHERE s.area_id = ar.id AND s.date = _date),
        'notes', (SELECT n.notes FROM public.area_day_notes n
                   WHERE n.area_id = ar.id AND n.date = _date)
      ) ORDER BY ar.sort_order)
      FROM public.areas ar
      WHERE ar.project_id = link.project_id AND ar.deleted_at IS NULL), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'area_id', p.area_id, 'width', p.width, 'height', p.height,
        'gps_lat', CASE WHEN link.show_photo_pins THEN p.gps_lat ELSE NULL END,
        'gps_lng', CASE WHEN link.show_photo_pins THEN p.gps_lng ELSE NULL END
      ) ORDER BY p.captured_at NULLS LAST, p.created_at)
      FROM public.photos p
      WHERE p.project_id = link.project_id
        AND (p.captured_at AT TIME ZONE 'UTC')::date = _date
        AND NOT EXISTS (
          SELECT 1 FROM public.photo_day_hidden h
           WHERE h.photo_id = p.id AND h.date_key = to_char(_date, 'YYYY-MM-DD'))
    ), '[]'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.share_day(uuid, text, date) TO anon, authenticated, service_role;

-- ============ share_area ============
CREATE OR REPLACE FUNCTION public.share_area(_token uuid, _password text DEFAULT NULL, _area_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  link public.share_links;
  ar RECORD;
BEGIN
  link := public.share_link_check(_token, _password);
  IF link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO ar FROM public.areas
   WHERE id = _area_id AND project_id = link.project_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'area', jsonb_build_object('id', ar.id, 'name', ar.name, 'sort_order', ar.sort_order, 'color', ar.color),
    'features', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'geometry', f.geometry,
                                          'label', f.label, 'color', f.color, 'is_primary', f.is_primary))
      FROM public.area_map_features f WHERE f.area_id = ar.id), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', to_char(s.date, 'YYYY-MM-DD'),
        'status', s.status::text,
        'notes', (SELECT n.notes FROM public.area_day_notes n
                   WHERE n.area_id = ar.id AND n.date = s.date)
      ) ORDER BY s.date)
      FROM public.area_day_status s WHERE s.area_id = ar.id), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'width', p.width, 'height', p.height,
        'gps_lat', CASE WHEN link.show_photo_pins THEN p.gps_lat ELSE NULL END,
        'gps_lng', CASE WHEN link.show_photo_pins THEN p.gps_lng ELSE NULL END
      ) ORDER BY p.captured_at NULLS LAST, p.created_at)
      FROM public.photos p WHERE p.area_id = ar.id), '[]'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.share_area(uuid, text, uuid) TO anon, authenticated, service_role;