-- Bug 1: fix project_count in admin_list_users to count only team-owned (non-archived) projects.
-- Preserves existing return signature so AdminUsers UI continues to work until replaced.
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, suspended_at timestamp with time zone, last_active_at timestamp with time zone, auth_method text, team_count integer, project_count integer, owner_team_count integer, member_team_count integer, role_summary text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- FIX: count only non-archived projects on teams this user belongs to
    (
      SELECT count(*)::int FROM public.projects proj
      WHERE proj.archived_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.team_members tmx
          WHERE tmx.team_id = proj.team_id AND tmx.user_id = p.id
        )
    ) AS project_count,
    (SELECT count(*)::int FROM public.team_members tm2 WHERE tm2.user_id = p.id AND tm2.role = 'owner'::team_role) AS owner_team_count,
    (SELECT count(*)::int FROM public.team_members tm3 WHERE tm3.user_id = p.id AND tm3.role <> 'owner'::team_role) AS member_team_count,
    (
      WITH owner_teams AS (
        SELECT t.name FROM public.team_members tm4
        JOIN public.teams t ON t.id = tm4.team_id
        WHERE tm4.user_id = p.id AND tm4.role = 'owner'::team_role
        ORDER BY t.name
      ),
      member_teams AS (
        SELECT t.name FROM public.team_members tm5
        JOIN public.teams t ON t.id = tm5.team_id
        WHERE tm5.user_id = p.id AND tm5.role <> 'owner'::team_role
        ORDER BY t.name
      ),
      o AS (SELECT count(*)::int AS c, string_agg(name, ', ') AS names FROM owner_teams),
      m AS (SELECT count(*)::int AS c, string_agg(name, ', ') AS names FROM member_teams)
      SELECT
        'Owner on ' || o.c || CASE WHEN o.c = 1 THEN ' team' ELSE ' teams' END
        || CASE WHEN o.c > 0 THEN ': ' || o.names ELSE '' END
        || '; member on ' || m.c || CASE WHEN m.c = 1 THEN ' team' ELSE ' teams' END
        || CASE WHEN m.c > 0 THEN ': ' || m.names ELSE '' END
      FROM o, m
    ) AS role_summary
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $function$;

-- Bug 2: unified admin view, one row per user with optional team/account columns.
CREATE OR REPLACE FUNCTION public.admin_list_users_with_accounts()
RETURNS TABLE(
  user_id             uuid,
  email               text,
  full_name           text,
  user_created_at     timestamp with time zone,
  last_active_at      timestamp with time zone,
  auth_method         text,
  user_suspended_at   timestamp with time zone,
  team_id             uuid,
  team_name           text,
  team_role           text,
  plan                text,
  subscription_status text,
  mrr_hkd             numeric,
  trial_ends_at       timestamp with time zone,
  team_suspended_at   timestamp with time zone,
  owned_project_count integer,
  team_project_count  integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email,
    p.full_name,
    p.created_at AS user_created_at,
    COALESCE(p.last_active_at, p.created_at) AS last_active_at,
    COALESCE(p.auth_method, 'password') AS auth_method,
    p.suspended_at AS user_suspended_at,
    t.id AS team_id,
    t.name AS team_name,
    tm.role::text AS team_role,
    t.plan,
    COALESCE(
      t.subscription_status,
      CASE WHEN t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now()
           THEN 'trialing' ELSE 'active' END
    ) AS subscription_status,
    CASE WHEN t.id IS NOT NULL THEN public.plan_monthly_hkd(t.plan) ELSE 0 END AS mrr_hkd,
    t.trial_ends_at,
    t.suspended_at AS team_suspended_at,
    (
      SELECT count(*)::int FROM public.projects proj
      WHERE proj.archived_at IS NULL
        AND t.id IS NOT NULL AND proj.team_id = t.id AND tm.role = 'owner'::team_role
    ) AS owned_project_count,
    (
      SELECT count(*)::int FROM public.projects proj2
      WHERE proj2.archived_at IS NULL AND proj2.team_id = t.id
    ) AS team_project_count
  FROM public.profiles p
  LEFT JOIN public.team_members tm ON tm.user_id = p.id
  LEFT JOIN public.teams t ON t.id = tm.team_id
  ORDER BY p.created_at DESC;
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users_with_accounts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users_with_accounts() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_users_with_accounts() TO authenticated;