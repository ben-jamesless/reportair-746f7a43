CREATE OR REPLACE FUNCTION public.resolve_share_link(_token uuid, _password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  link public.share_links%ROWTYPE;
  project_row public.projects%ROWTYPE;
  team_row public.teams%ROWTYPE;
  latest_export public.project_exports%ROWTYPE;
  hide_branding boolean := false;
  payload jsonb;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF link.expires_at IS NOT NULL AND link.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF link.password_hash IS NOT NULL THEN
    IF _password IS NULL OR public.hash_share_password(_password) <> link.password_hash THEN
      RETURN jsonb_build_object('ok', false, 'error', 'password_required');
    END IF;
  END IF;

  SELECT * INTO project_row FROM public.projects WHERE id = link.project_id;
  IF project_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO team_row FROM public.teams WHERE id = project_row.team_id;
  hide_branding := COALESCE(team_row.white_label_pdf, false);

  SELECT * INTO latest_export
  FROM public.project_exports
  WHERE project_id = link.project_id AND status = 'ready'
  ORDER BY created_at DESC
  LIMIT 1;

  payload := jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'show_photo_pins', link.show_photo_pins,
    'project', jsonb_build_object(
      'name', project_row.name,
      'description', project_row.description,
      'client_name', project_row.client_name,
      'event_type', project_row.event_type,
      'event_location', project_row.event_location,
      'event_date', project_row.event_date,
      'color', project_row.color,
      'overall_status', project_row.overall_status
    ),
    'team_plan', team_row.plan,
    'team_name', team_row.name,
    'team_logo_path', team_row.logo_path,
    'hide_buildslides_branding', hide_branding,
    'albums', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.position) FROM public.albums a WHERE a.project_id = link.project_id), '[]'::jsonb),
    'areas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ar.id, 'name', ar.name, 'sort_order', ar.sort_order) ORDER BY ar.sort_order) FROM public.areas ar WHERE ar.project_id = link.project_id AND ar.deleted_at IS NULL), '[]'::jsonb),
    'day_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', to_char(dn.date, 'YYYY-MM-DD'),
      'notes', dn.notes,
      'today_objectives', dn.today_objectives,
      'today_achievements', dn.today_achievements,
      'tomorrow_objectives', dn.tomorrow_objectives,
      'open_issues', dn.open_issues,
      'day_status', dn.day_status
    )) FROM public.day_notes dn WHERE dn.project_id = link.project_id), '[]'::jsonb),
    'area_day_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('area_id', s.area_id, 'date', to_char(s.date, 'YYYY-MM-DD'), 'status', s.status)) FROM public.area_day_status s WHERE s.project_id = link.project_id), '[]'::jsonb),
    'area_day_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('area_id', n.area_id, 'date', to_char(n.date, 'YYYY-MM-DD'), 'notes', n.notes)) FROM public.area_day_notes n WHERE n.project_id = link.project_id), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'album_id', p.album_id, 'area_id', p.area_id,
        'is_reference', p.is_reference,
        'camera_make', p.camera_make, 'camera_model', p.camera_model, 'lens', p.lens,
        'iso', p.iso, 'aperture', p.aperture, 'shutter_speed', p.shutter_speed, 'focal_length', p.focal_length,
        'gps_lat', p.gps_lat, 'gps_lng', p.gps_lng, 'width', p.width, 'height', p.height
      ) ORDER BY p.captured_at DESC NULLS LAST, p.created_at DESC)
      FROM public.photos p WHERE p.project_id = link.project_id
    ), '[]'::jsonb),
    'latest_export', CASE WHEN latest_export.id IS NOT NULL THEN
      jsonb_build_object(
        'id', latest_export.id,
        'created_at', latest_export.created_at,
        'photo_count', latest_export.photo_count
      )
      ELSE NULL END
  );
  RETURN payload;
END $function$;