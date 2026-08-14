CREATE OR REPLACE FUNCTION public.share_viewer_role(_token uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
  r text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN NULL;
  END IF;
  SELECT pm.role::text INTO r
    FROM public.project_members pm
   WHERE pm.project_id = link.project_id AND pm.user_id = auth.uid()
   LIMIT 1;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.share_viewer_role(uuid) TO authenticated;