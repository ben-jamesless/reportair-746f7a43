DROP FUNCTION IF EXISTS public.list_share_map_features(uuid);

CREATE OR REPLACE FUNCTION public.list_share_map_features(_token uuid)
 RETURNS TABLE(id uuid, area_id uuid, kind text, geometry jsonb, label text, plan_color text, is_primary boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT f.id, f.area_id, f.kind, f.geometry, f.label, f.plan_color, f.is_primary
      FROM public.area_map_features f
     WHERE f.project_id = link.project_id;
END $function$;