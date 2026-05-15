-- ─────────────────────────────────────────────────────────────────────────────
-- Share-link password brute-force protection (M1)
--
-- Strategy: track failed password attempts per share_link token in a lightweight
-- table. After 10 failures within a 10-minute window, return a "rate_limited"
-- error. Successful attempts reset the counter. Old rows are cleaned up
-- automatically via a partial index + the cleanup call inside the function.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Attempt tracking table
CREATE TABLE IF NOT EXISTS public.share_link_attempts (
  id           bigserial PRIMARY KEY,
  token        uuid        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_token_time
  ON public.share_link_attempts (token, attempted_at);

-- No RLS needed — only accessed via SECURITY DEFINER functions below.
-- Anon/authenticated roles have no direct access.
REVOKE ALL ON public.share_link_attempts FROM PUBLIC, anon, authenticated;

-- 2. Helper: count recent failures and optionally record a new one
CREATE OR REPLACE FUNCTION public._share_link_record_attempt(_token uuid)
RETURNS int   -- returns the number of attempts in the last 10 minutes (AFTER inserting)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  attempt_count int;
  window_start  timestamptz := now() - interval '10 minutes';
BEGIN
  -- Prune old rows for this token (keep the table tidy)
  DELETE FROM public.share_link_attempts
    WHERE token = _token AND attempted_at < window_start;

  -- Insert this attempt
  INSERT INTO public.share_link_attempts (token) VALUES (_token);

  -- Count attempts in window
  SELECT COUNT(*) INTO attempt_count
    FROM public.share_link_attempts
    WHERE token = _token AND attempted_at >= window_start;

  RETURN attempt_count;
END $function$;

-- 3. Helper: reset attempts on successful auth
CREATE OR REPLACE FUNCTION public._share_link_clear_attempts(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.share_link_attempts WHERE token = _token;
END $function$;

-- 4. Update resolve_share_link to enforce server-side rate limiting
CREATE OR REPLACE FUNCTION public.resolve_share_link(_token uuid, _password text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  link          RECORD;
  proj          RECORD;
  latest_export RECORD;
  payload       jsonb;
  attempt_count int;
  window_start  timestamptz := now() - interval '10 minutes';
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

  -- Password-protected links: check rate limit before verifying password.
  IF link.password_hash IS NOT NULL THEN
    -- Count attempts in the current window (before recording this one).
    SELECT COUNT(*) INTO attempt_count
      FROM public.share_link_attempts
      WHERE token = _token AND attempted_at >= window_start;

    IF attempt_count >= 10 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
    END IF;

    IF _password IS NULL OR NOT (link.password_hash = crypt(_password, link.password_hash)) THEN
      -- Record the failed attempt
      PERFORM public._share_link_record_attempt(_token);
      RETURN jsonb_build_object('ok', false, 'error', 'password_required');
    END IF;

    -- Correct password — clear the attempt counter
    PERFORM public._share_link_clear_attempts(_token);
  END IF;

  UPDATE public.share_links
    SET view_count = view_count + 1, last_accessed_at = now()
    WHERE id = link.id;

  -- Explicit allowlist of project columns: geo_lat, geo_lng and other internal
  -- fields are intentionally excluded from share-link payloads.
  SELECT name, description, client_name, event_type, event_location, event_date, color, overall_status
    INTO proj FROM public.projects WHERE id = link.project_id;

  SELECT id, output_path, created_at, photo_count
    INTO latest_export
    FROM public.project_exports
    WHERE project_id = link.project_id AND status = 'ready' AND output_path IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;

  payload := jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'project', to_jsonb(proj),
    'albums', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.position) FROM public.albums a WHERE a.project_id = link.project_id), '[]'::jsonb),
    'areas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ar.id, 'name', ar.name, 'sort_order', ar.sort_order) ORDER BY ar.sort_order) FROM public.areas ar WHERE ar.project_id = link.project_id), '[]'::jsonb),
    'day_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', to_char(dn.date, 'YYYY-MM-DD'),
      'notes', dn.notes,
      'today_objectives', dn.today_objectives,
      'today_achievements', dn.today_achievements,
      'tomorrow_objectives', dn.tomorrow_objectives,
      'open_issues', dn.open_issues
    )) FROM public.day_notes dn WHERE dn.project_id = link.project_id), '[]'::jsonb),
    'area_day_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('area_id', s.area_id, 'date', to_char(s.date, 'YYYY-MM-DD'), 'status', s.status)) FROM public.area_day_status s WHERE s.project_id = link.project_id), '[]'::jsonb),
    'area_day_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('area_id', n.area_id, 'date', to_char(n.date, 'YYYY-MM-DD'), 'notes', n.notes)) FROM public.area_day_notes n WHERE n.project_id = link.project_id), '[]'::jsonb),
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

-- Re-grant execute to anon + authenticated (same as before)
GRANT EXECUTE ON FUNCTION public.resolve_share_link(uuid, text) TO anon, authenticated;
