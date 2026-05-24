-- Restore token visibility on share_links (managers need it to copy URLs); password_hash stays revoked
GRANT SELECT (token) ON public.share_links TO authenticated;

-- Expose a non-sensitive flag indicating whether a password is set
ALTER TABLE public.share_links
  ADD COLUMN IF NOT EXISTS has_password boolean
  GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED;

-- Secure function: invitee fetches their own pending invite token for a project
CREATE OR REPLACE FUNCTION public.get_my_pending_invite_token(_project_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token
  FROM public.project_invites
  WHERE project_id = _project_id
    AND accepted_at IS NULL
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_invite_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invite_token(uuid) TO authenticated;

-- Secure function: project owner fetches an invite token by id
CREATE OR REPLACE FUNCTION public.get_invite_token(_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token uuid;
  _pid   uuid;
BEGIN
  SELECT token, project_id INTO _token, _pid
  FROM public.project_invites WHERE id = _invite_id;
  IF _pid IS NULL THEN RETURN NULL; END IF;
  IF NOT public.has_project_role(auth.uid(), _pid, ARRAY['owner'::project_role]) THEN
    RETURN NULL;
  END IF;
  RETURN _token;
END
$$;

REVOKE ALL ON FUNCTION public.get_invite_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invite_token(uuid) TO authenticated;