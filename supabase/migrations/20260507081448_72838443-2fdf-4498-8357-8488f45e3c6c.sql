
-- Add new columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_method text;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- admin_list_users
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, created_at timestamptz,
  suspended_at timestamptz, last_active_at timestamptz, auth_method text,
  team_count integer, project_count integer,
  owner_team_count integer, member_team_count integer, role_summary text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    p.suspended_at,
    COALESCE(p.last_active_at, p.created_at) AS last_active_at,
    COALESCE(p.auth_method, 'password') AS auth_method,
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.user_id = p.id) AS team_count,
    (SELECT count(*)::int FROM public.project_members pm WHERE pm.user_id = p.id) AS project_count,
    (SELECT count(*)::int FROM public.team_members tm2 WHERE tm2.user_id = p.id AND tm2.role = 'owner'::team_role) AS owner_team_count,
    (SELECT count(*)::int FROM public.team_members tm3 WHERE tm3.user_id = p.id AND tm3.role <> 'owner'::team_role) AS member_team_count,
    (
      'Owner on ' ||
      (SELECT count(*)::text FROM public.team_members tm4 WHERE tm4.user_id = p.id AND tm4.role = 'owner'::team_role) ||
      ' teams, member on ' ||
      (SELECT count(*)::text FROM public.team_members tm5 WHERE tm5.user_id = p.id AND tm5.role <> 'owner'::team_role) ||
      ' teams'
    ) AS role_summary
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $$;

-- admin_list_teams
DROP FUNCTION IF EXISTS public.admin_list_teams();
CREATE OR REPLACE FUNCTION public.admin_list_teams()
RETURNS TABLE(
  id uuid, name text, plan text, status text, suspended_at timestamptz,
  billing_owner_user_id uuid, billing_owner_email text,
  member_count integer, project_count integer, created_at timestamptz,
  trial_ends_at timestamptz, region text, industry text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.name, t.plan, t.status, t.suspended_at,
    t.billing_owner_user_id,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = t.billing_owner_user_id) AS billing_owner_email,
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.team_id = t.id) AS member_count,
    (SELECT count(*)::int FROM public.projects pj WHERE pj.team_id = t.id) AS project_count,
    t.created_at,
    t.trial_ends_at,
    t.region,
    t.industry
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $$;

-- admin_list_projects
DROP FUNCTION IF EXISTS public.admin_list_projects();
CREATE OR REPLACE FUNCTION public.admin_list_projects(
  _team_id uuid DEFAULT NULL,
  _phase text DEFAULT NULL,
  _project_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, name text, team_id uuid, team_name text,
  owner_id uuid, owner_email text, created_at timestamptz,
  archived_at timestamptz, overall_status project_status,
  project_type text, phase text, location text, last_activity_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.name, p.team_id,
    (SELECT t.name FROM public.teams t WHERE t.id = p.team_id) AS team_name,
    p.created_by AS owner_id,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = p.created_by) AS owner_email,
    p.created_at, p.archived_at, p.overall_status,
    p.project_type, p.phase, p.location, p.last_activity_at
  FROM public.projects p
  WHERE (_team_id IS NULL OR p.team_id = _team_id)
    AND (_phase IS NULL OR p.phase = _phase)
    AND (_project_type IS NULL OR p.project_type = _project_type)
  ORDER BY p.created_at DESC;
END $$;
