ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS logo_path text;

CREATE OR REPLACE FUNCTION public.get_share_brand_colour(_token uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.brand_colour
  FROM public.share_links sl
  JOIN public.projects p ON p.id = sl.project_id
  JOIN public.teams t ON t.id = p.team_id
  WHERE sl.token = _token
    AND (sl.revoked_at IS NULL)
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_share_brand_colour(uuid) TO anon, authenticated;