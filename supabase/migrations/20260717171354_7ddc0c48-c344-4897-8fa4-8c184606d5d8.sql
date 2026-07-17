
CREATE OR REPLACE FUNCTION public.get_invite_context(_token uuid)
RETURNS TABLE(email text, project_name text, account_exists boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _project_name text;
  _exists boolean;
BEGIN
  SELECT pi.email, p.name
    INTO _email, _project_name
    FROM public.project_invites pi
    LEFT JOIN public.projects p ON p.id = pi.project_id
   WHERE pi.token = _token AND pi.accepted_at IS NULL
   LIMIT 1;

  IF _email IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(_email))
    INTO _exists;

  email := _email;
  project_name := _project_name;
  account_exists := COALESCE(_exists, false);
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invite_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_context(uuid) TO anon, authenticated;
