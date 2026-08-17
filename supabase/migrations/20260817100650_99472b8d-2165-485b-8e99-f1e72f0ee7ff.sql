CREATE OR REPLACE FUNCTION public.share_area(_token uuid, _password text DEFAULT NULL::text, _area_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
                                          'label', f.label, 'color', f.plan_color, 'is_primary', f.is_primary))
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
      FROM public.photos p WHERE p.area_id = ar.id AND p.is_reference = false), '[]'::jsonb)
  );
END $function$;