-- ─────────────────────────────────────────────────────────────────────────────
-- Team page RPCs
-- 20260517200000_team_page_rpcs.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. get_team_roster ────────────────────────────────────────────────────────
-- Returns one row per unique collaborator (excluding the billing owner) on any
-- project owned by the caller's team.  Each row includes the list of projects
-- the collaborator belongs to so the Team page can render project pills.
CREATE OR REPLACE FUNCTION public.get_team_roster()
RETURNS TABLE (
  user_id        uuid,
  full_name      text,
  email          text,
  joined_at      timestamptz,
  last_active_at timestamptz,
  projects       jsonb   -- [{id, name, role}]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  -- Resolve the caller's team (billing owner or member)
  SELECT t.id INTO v_team_id
  FROM   public.teams t
  WHERE  t.billing_owner_user_id = auth.uid()
  LIMIT  1;

  IF v_team_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id                                        AS user_id,
    p.full_name,
    p.email,
    MIN(pm.created_at)                          AS joined_at,
    p.last_active_at,
    jsonb_agg(
      jsonb_build_object(
        'id',   proj.id,
        'name', proj.name,
        'role', pm.role
      )
      ORDER BY proj.name
    )                                           AS projects
  FROM   public.project_members pm
  JOIN   public.projects         proj ON proj.id = pm.project_id
  JOIN   public.profiles         p    ON p.id    = pm.user_id
  WHERE  proj.team_id = v_team_id
    AND  pm.user_id  <> auth.uid()           -- exclude the caller (billing owner)
    AND  proj.archived_at IS NULL
  GROUP  BY p.id, p.full_name, p.email, p.last_active_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_roster() TO authenticated;


-- ── 2. get_team_pending_invites ───────────────────────────────────────────────
-- Returns all un-accepted invites across all active projects on the caller's team.
CREATE OR REPLACE FUNCTION public.get_team_pending_invites()
RETURNS TABLE (
  invite_id   uuid,
  project_id  uuid,
  project_name text,
  email       text,
  role        text,
  token       text,
  created_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id
  FROM   public.teams t
  WHERE  t.billing_owner_user_id = auth.uid()
  LIMIT  1;

  IF v_team_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pi.id           AS invite_id,
    pi.project_id,
    proj.name       AS project_name,
    pi.email,
    pi.role::text,
    pi.token,
    pi.created_at
  FROM   public.project_invites pi
  JOIN   public.projects         proj ON proj.id = pi.project_id
  WHERE  proj.team_id     = v_team_id
    AND  pi.accepted_at  IS NULL
    AND  proj.archived_at IS NULL
  ORDER  BY pi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pending_invites() TO authenticated;


-- ── 3. remove_team_member ─────────────────────────────────────────────────────
-- Removes a user from ALL projects on the caller's team.
-- Only the billing owner may call this.
CREATE OR REPLACE FUNCTION public.remove_team_member(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT t.id INTO v_team_id
  FROM   public.teams t
  WHERE  t.billing_owner_user_id = auth.uid()
  LIMIT  1;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Only the billing owner can remove team members';
  END IF;

  -- Remove from all project_members rows on this team
  DELETE FROM public.project_members pm
  USING  public.projects proj
  WHERE  pm.project_id = proj.id
    AND  proj.team_id  = v_team_id
    AND  pm.user_id    = _user_id;

  -- Clean up any accepted invite rows so they can't be re-added silently
  DELETE FROM public.project_invites pi
  USING  public.projects proj
  WHERE  pi.project_id  = proj.id
    AND  proj.team_id   = v_team_id
    AND  pi.accepted_by = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
