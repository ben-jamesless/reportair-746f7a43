
CREATE OR REPLACE FUNCTION public.get_team_roster()
RETURNS TABLE (
  user_id        uuid,
  full_name      text,
  email          text,
  joined_at      timestamptz,
  last_active_at timestamptz,
  projects       jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id FROM public.teams t
  WHERE t.billing_owner_user_id = auth.uid() LIMIT 1;
  IF v_team_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    MIN(pm.created_at)   AS joined_at,
    p.last_active_at,
    jsonb_agg(
      jsonb_build_object('id', proj.id, 'name', proj.name, 'role', pm.role)
      ORDER BY proj.name
    ) AS projects
  FROM   public.project_members pm
  JOIN   public.projects  proj ON proj.id = pm.project_id
  JOIN   public.profiles  p    ON p.id    = pm.user_id
  WHERE  proj.team_id    = v_team_id
    AND  pm.user_id     <> auth.uid()
    AND  proj.archived_at IS NULL
  GROUP  BY p.id, p.full_name, p.email, p.last_active_at;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_team_roster() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_pending_invites()
RETURNS TABLE (
  invite_id    uuid,
  project_id   uuid,
  project_name text,
  email        text,
  role         text,
  token        text,
  created_at   timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id FROM public.teams t
  WHERE t.billing_owner_user_id = auth.uid() LIMIT 1;
  IF v_team_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT pi.id, pi.project_id, proj.name, pi.email, pi.role::text, pi.token::text, pi.created_at
  FROM   public.project_invites pi
  JOIN   public.projects proj ON proj.id = pi.project_id
  WHERE  proj.team_id    = v_team_id
    AND  pi.accepted_at  IS NULL
    AND  proj.archived_at IS NULL
  ORDER  BY pi.created_at DESC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_team_pending_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_team_member(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id FROM public.teams t
  WHERE t.billing_owner_user_id = auth.uid() LIMIT 1;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only the billing owner can remove team members';
  END IF;

  DELETE FROM public.project_members pm
  USING  public.projects proj
  WHERE  pm.project_id = proj.id AND proj.team_id = v_team_id AND pm.user_id = _user_id;

  DELETE FROM public.project_invites pi
  USING  public.projects proj
  WHERE  pi.project_id = proj.id AND proj.team_id = v_team_id AND pi.accepted_by = _user_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
