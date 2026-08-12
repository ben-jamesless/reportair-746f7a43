CREATE OR REPLACE FUNCTION public.derive_area_display_status(_area_id uuid, _day date)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(s.status::text, 'not_started') FROM public.area_day_status s
      WHERE s.area_id = _area_id AND s.date = _day),
    CASE WHEN EXISTS (
      SELECT 1 FROM public.photos p
       WHERE p.area_id = _area_id
         AND (p.captured_at AT TIME ZONE 'UTC')::date = _day
         AND NOT EXISTS (SELECT 1 FROM public.photo_day_hidden h
                          WHERE h.photo_id = p.id AND h.date_key = to_char(_day, 'YYYY-MM-DD'))
    ) THEN 'in_progress' ELSE 'not_started' END
  );
$$;

GRANT EXECUTE ON FUNCTION public.derive_area_display_status(uuid, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.share_day(_token uuid, _password text DEFAULT NULL::text, _date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
        'display_status', public.derive_area_display_status(ar.id, _date),
        'photo_count', (SELECT count(*) FROM public.photos p
                         WHERE p.area_id = ar.id
                           AND (p.captured_at AT TIME ZONE 'UTC')::date = _date
                           AND NOT EXISTS (SELECT 1 FROM public.photo_day_hidden h
                                            WHERE h.photo_id = p.id AND h.date_key = to_char(_date, 'YYYY-MM-DD'))),
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
END $function$;