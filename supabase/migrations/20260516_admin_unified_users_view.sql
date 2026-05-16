-- Bug 2 (long-term fix): Unified admin view that merges users + accounts into one
-- queryable surface. Users without a team (e.g. abandoned sign-ups) appear with
-- NULL team columns rather than being invisible in the Accounts tab.
--
-- The AdminPanel UI should call admin_list_users_with_accounts() to replace the
-- separate Users + Accounts tabs, or use this as the data source for a combined
-- table that groups by team while keeping orphan rows visible.

CREATE OR REPLACE FUNCTION public.admin_list_users_with_accounts()
RETURNS TABLE(
  -- User columns
  user_id           uuid,
  email             text,
  name              text,
  user_created_at   timestamp with time zone,
  last_sign_in      timestamp with time zone,
  auth_provider     text,
  user_status       text,
  -- Team / account columns (NULL when user has no team)
  team_id           uuid,
  team_name         text,
  team_role         text,
  plan              text,
  subscription_status text,
  mrr_hkd           numeric,
  trial_ends_at     timestamp with time zone,
  team_suspended_at timestamp with time zone,
  -- Counts
  owned_project_count  integer,
  team_project_count   integer
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
    p.id                                          AS user_id,
    p.email,
    p.name,
    p.created_at                                  AS user_created_at,
    p.last_sign_in_at                             AS last_sign_in,
    p.auth_provider,
    CASE WHEN p.banned_until IS NOT NULL AND p.banned_until > now()
         THEN 'suspended' ELSE 'active'
    END                                           AS user_status,
    t.id                                          AS team_id,
    t.name                                        AS team_name,
    tm.role                                       AS team_role,
    t.plan,
    COALESCE(
      t.subscription_status,
      CASE WHEN t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now()
           THEN 'trialing' ELSE 'active' END
    )                                             AS subscription_status,
    CASE WHEN t.id IS NOT NULL
         THEN public.plan_monthly_hkd(t.plan)
         ELSE 0
    END                                           AS mrr_hkd,
    t.trial_ends_at,
    t.suspended_at                                AS team_suspended_at,
    -- Projects this user owns via team (matches quota logic)
    (
      SELECT count(*)::int
      FROM public.projects proj
      WHERE proj.archived_at IS NULL
        AND t.id IS NOT NULL
        AND proj.team_id = t.id
        AND tm.role = 'owner'
    )                                             AS owned_project_count,
    -- All projects for this team regardless of role
    (
      SELECT count(*)::int
      FROM public.projects proj2
      WHERE proj2.archived_at IS NULL
        AND proj2.team_id = t.id
    )                                             AS team_project_count
  FROM public.profiles p
  LEFT JOIN public.team_members tm ON tm.user_id = p.id
  LEFT JOIN public.teams t ON t.id = tm.team_id
  ORDER BY p.created_at DESC;
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users_with_accounts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_users_with_accounts() TO authenticated;
