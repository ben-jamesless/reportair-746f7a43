CREATE OR REPLACE FUNCTION public.resolve_share_link(_token uuid, _password text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  link RECORD;
  proj RECORD;
  payload jsonb;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF link.expires_at IS NOT NULL AND link.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF link.password_hash IS NOT NULL THEN
    IF _password IS NULL OR NOT (link.password_hash = crypt(_password, link.password_hash)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'password_required');
    END IF;
  END IF;

  UPDATE public.share_links
    SET view_count = view_count + 1, last_accessed_at = now()
    WHERE id = link.id;

  SELECT id, name, description, template INTO proj FROM public.projects WHERE id = link.project_id;

  payload := jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'project', to_jsonb(proj),
    'albums', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.position) FROM public.albums a WHERE a.project_id = link.project_id), '[]'::jsonb),
    'areas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ar.id, 'name', ar.name, 'sort_order', ar.sort_order, 'notes', ar.notes) ORDER BY ar.sort_order) FROM public.areas ar WHERE ar.project_id = link.project_id), '[]'::jsonb),
    'day_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(dn.date, 'YYYY-MM-DD'), 'notes', dn.notes)) FROM public.day_notes dn WHERE dn.project_id = link.project_id), '[]'::jsonb),
    'area_day_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('area_id', s.area_id, 'date', to_char(s.date, 'YYYY-MM-DD'), 'status', s.status)) FROM public.area_day_status s WHERE s.project_id = link.project_id), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'album_id', p.album_id, 'area_id', p.area_id,
        'camera_make', p.camera_make, 'camera_model', p.camera_model, 'lens', p.lens,
        'iso', p.iso, 'aperture', p.aperture, 'shutter_speed', p.shutter_speed, 'focal_length', p.focal_length,
        'gps_lat', p.gps_lat, 'gps_lng', p.gps_lng, 'width', p.width, 'height', p.height
      ) ORDER BY p.captured_at DESC NULLS LAST, p.created_at DESC)
      FROM public.photos p WHERE p.project_id = link.project_id
    ), '[]'::jsonb)
  );
  RETURN payload;
END $function$;