CREATE OR REPLACE FUNCTION public.get_share_project_center(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  link RECORD;
  proj RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN NULL;
  END IF;
  SELECT geo_lat, geo_lng INTO proj FROM public.projects WHERE id = link.project_id;
  IF proj.geo_lat IS NULL OR proj.geo_lng IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('lat', proj.geo_lat, 'lng', proj.geo_lng);
END $$;

GRANT EXECUTE ON FUNCTION public.get_share_project_center(uuid) TO anon, authenticated;