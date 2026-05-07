
-- Make accept_project_invite idempotent: if the invite was already auto-accepted
-- (via the on-signup trigger) for THIS user, return its project_id instead of erroring.
CREATE OR REPLACE FUNCTION public.accept_project_invite(_token uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO inv FROM public.project_invites WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Already accepted? If accepted by this user (or matching email), just return project.
  IF inv.accepted_at IS NOT NULL THEN
    IF inv.accepted_by = auth.uid() OR lower(inv.email) = lower(user_email) THEN
      -- Make sure membership exists (defensive)
      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (inv.project_id, auth.uid(), inv.role)
      ON CONFLICT DO NOTHING;
      RETURN inv.project_id;
    ELSE
      RAISE EXCEPTION 'Invite already accepted';
    END IF;
  END IF;

  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Invite is for a different email';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (inv.project_id, auth.uid(), inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.project_invites
    SET accepted_at = now(), accepted_by = auth.uid()
    WHERE id = inv.id;

  RETURN inv.project_id;
END $function$;

-- Helper: returns the most recent project_id this user was invited to (accepted or pending),
-- so onboarding can route invited users straight into a project.
CREATE OR REPLACE FUNCTION public.my_latest_invited_project()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
  pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT project_id INTO pid
    FROM public.project_invites
    WHERE lower(email) = lower(user_email)
       OR accepted_by = auth.uid()
    ORDER BY COALESCE(accepted_at, created_at) DESC
    LIMIT 1;
  RETURN pid;
END $function$;
