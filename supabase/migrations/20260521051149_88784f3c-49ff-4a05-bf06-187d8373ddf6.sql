CREATE OR REPLACE FUNCTION public.get_share_logo_path(_token uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.logo_path
  FROM public.share_links sl
  JOIN public.projects p ON p.id = sl.project_id
  WHERE sl.token = _token
    AND (sl.revoked_at IS NULL)
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.get_share_logo_path(uuid) TO anon, authenticated;