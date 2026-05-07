-- Soft suspension flags
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Helper: is the caller a platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'::app_role
  )
$$;

-- Admin: list users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, email text, full_name text, created_at timestamptz,
  suspended_at timestamptz, team_count int, project_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.email, p.full_name, p.created_at, p.suspended_at,
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.user_id = p.id),
    (SELECT count(*)::int FROM public.project_members pm WHERE pm.user_id = p.id)
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $$;

-- Admin: list teams
CREATE OR REPLACE FUNCTION public.admin_list_teams()
RETURNS TABLE(
  id uuid, name text, plan text, status text, suspended_at timestamptz,
  billing_owner_user_id uuid, billing_owner_email text,
  member_count int, project_count int, created_at timestamptz
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
    (SELECT email FROM public.profiles WHERE id = t.billing_owner_user_id),
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.team_id = t.id),
    (SELECT count(*)::int FROM public.projects pr WHERE pr.team_id = t.id),
    t.created_at
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $$;

-- Admin: list projects
CREATE OR REPLACE FUNCTION public.admin_list_projects()
RETURNS TABLE(
  id uuid, name text, team_id uuid, team_name text,
  owner_id uuid, owner_email text,
  created_at timestamptz, archived_at timestamptz, overall_status project_status
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
    (SELECT name FROM public.teams WHERE id = p.team_id),
    p.created_by,
    (SELECT email FROM public.profiles WHERE id = p.created_by),
    p.created_at, p.archived_at, p.overall_status
  FROM public.projects p
  ORDER BY p.created_at DESC;
END $$;

-- Admin actions
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(_user_id uuid, _suspended boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles SET suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END
   WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_team_suspended(_team_id uuid, _suspended boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.teams
     SET suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END,
         status = CASE WHEN _suspended THEN 'suspended' ELSE 'active' END
   WHERE id = _team_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_team_plan(_team_id uuid, _plan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.teams SET plan = _plan WHERE id = _team_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_team_billing_owner(_team_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'User is not a member of this team';
  END IF;
  -- Bypass guard_team_billing_owner_change trigger by disabling within definer ctx
  -- The trigger checks auth.uid() = OLD.billing_owner_user_id; for admin, we need to bypass.
  -- Simplest: temporarily set the trigger to disabled is not safe. Use a SECURITY DEFINER path:
  PERFORM set_config('app.admin_override', '1', true);
  UPDATE public.teams SET billing_owner_user_id = _user_id WHERE id = _team_id;
END $$;

-- Update guard to allow platform_admin override
CREATE OR REPLACE FUNCTION public.guard_team_billing_owner_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.billing_owner_user_id IS DISTINCT FROM OLD.billing_owner_user_id THEN
    IF current_setting('app.admin_override', true) = '1' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NULL OR auth.uid() <> OLD.billing_owner_user_id THEN
      RAISE EXCEPTION 'Only the current billing owner can transfer billing ownership';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_project_archived(_project_id uuid, _archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.projects
    SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END
   WHERE id = _project_id;
END $$;

-- RLS so platform admins can read profiles/teams/projects globally for the dashboard
CREATE POLICY "Profiles: platform admins read all"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Teams: platform admins read all"
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Projects: platform admins read all"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_platform_admin());
