
CREATE OR REPLACE FUNCTION public.list_share_hidden_photos(_token uuid)
RETURNS TABLE(photo_id uuid, date_key text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT h.photo_id, h.date_key
      FROM public.photo_day_hidden h
     WHERE h.project_id = link.project_id;
END $$;
