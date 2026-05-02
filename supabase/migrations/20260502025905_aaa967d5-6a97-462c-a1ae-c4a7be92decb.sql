
CREATE OR REPLACE FUNCTION public.list_guest_notes_project_public(_token uuid)
RETURNS TABLE (id uuid, photo_id uuid, guest_name text, body text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT g.id, g.photo_id, g.guest_name, g.body, g.created_at
    FROM public.guest_notes g
    WHERE g.project_id = link.project_id
    ORDER BY g.created_at DESC
    LIMIT 200;
END $$;

GRANT EXECUTE ON FUNCTION public.list_guest_notes_project_public(uuid) TO anon, authenticated;
