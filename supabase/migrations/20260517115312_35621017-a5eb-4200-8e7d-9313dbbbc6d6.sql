DROP FUNCTION IF EXISTS public.admin_list_users_with_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_users_with_accounts()
 RETURNS TABLE(user_id uuid, email text, full_name text, user_created_at timestamp with time zone, last_active_at timestamp with time zone, auth_method text, user_suspended_at timestamp with time zone, team_id uuid, team_name text, team_role text, plan text, subscription_status text, mrr_hkd numeric, trial_ends_at timestamp with time zone, team_suspended_at timestamp with time zone, owned_project_count integer, team_project_count integer, has_payment_method boolean)
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
    ) AS team_project_count,
    (t.stripe_subscription_id IS NOT NULL) AS has_payment_method
  FROM public.profiles p
  LEFT JOIN public.team_members tm ON tm.user_id = p.id
  LEFT JOIN public.teams t ON t.id = tm.team_id
  ORDER BY p.created_at DESC;
END $function$;