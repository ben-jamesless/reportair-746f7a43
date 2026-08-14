-- 1. Throttle: track hashed email alongside IP
ALTER TABLE public.share_comment_throttle
  ADD COLUMN IF NOT EXISTS email_hash text;

CREATE INDEX IF NOT EXISTS idx_share_comment_throttle_ip_email
  ON public.share_comment_throttle (ip_hash, email_hash, created_at DESC);

-- 2. Shared visibility source: hide cascade lives here, not at each call site.
CREATE OR REPLACE FUNCTION public.visible_guest_notes(_project_id uuid)
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  project_id uuid,
  area_id uuid,
  photo_id uuid,
  day date,
  guest_name text,
  body text,
  is_ops boolean,
  resolved_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.parent_id, g.project_id, g.area_id, g.photo_id, g.day,
         g.guest_name, g.body, g.is_ops, g.resolved_at, g.created_at
    FROM public.guest_notes g
    LEFT JOIN public.guest_notes root ON root.id = g.parent_id
   WHERE g.project_id = _project_id
     AND g.hidden_by_owner_at IS NULL
     AND (g.parent_id IS NULL OR root.hidden_by_owner_at IS NULL)
   ORDER BY g.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.visible_guest_notes(uuid) TO authenticated, service_role;

-- 3. Public list now delegates the cascade, and exposes hidden rows to ops only
--    (flagged), so an accidental hide can be reversed from the panel.
DROP FUNCTION IF EXISTS public.list_report_comments_public(uuid);
CREATE OR REPLACE FUNCTION public.list_report_comments_public(_token uuid)
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  area_id uuid,
  area_name text,
  photo_id uuid,
  day date,
  guest_name text,
  body text,
  is_ops boolean,
  resolved_at timestamptz,
  hidden boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
  viewer_is_ops boolean := false;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    viewer_is_ops := public.has_project_role(
      auth.uid(), link.project_id, ARRAY['owner'::project_role, 'editor'::project_role]
    );
  END IF;

  IF viewer_is_ops THEN
    RETURN QUERY
      SELECT g.id, g.parent_id, g.area_id, ar.name, g.photo_id, g.day,
             g.guest_name, g.body, g.is_ops, g.resolved_at,
             (g.hidden_by_owner_at IS NOT NULL) AS hidden, g.created_at
        FROM public.guest_notes g
        LEFT JOIN public.areas ar ON ar.id = g.area_id
       WHERE g.project_id = link.project_id
       ORDER BY g.created_at DESC
       LIMIT 500;
  ELSE
    RETURN QUERY
      SELECT v.id, v.parent_id, v.area_id, ar.name, v.photo_id, v.day,
             v.guest_name, v.body, v.is_ops, v.resolved_at,
             false AS hidden, v.created_at
        FROM public.visible_guest_notes(link.project_id) v
        LEFT JOIN public.areas ar ON ar.id = v.area_id
       ORDER BY v.created_at DESC
       LIMIT 500;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.list_report_comments_public(uuid) TO anon, authenticated;