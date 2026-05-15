BEGIN;

-- 1. Remap existing plan values to new tier names
UPDATE public.teams
SET plan = CASE
  WHEN plan = 'free'       THEN 'solo'
  WHEN plan = 'pro'        THEN 'solo'
  WHEN plan = 'team'       THEN 'pro'
  WHEN plan = 'enterprise' THEN 'studio'
  ELSE plan
END
WHERE plan IN ('free', 'pro', 'team', 'enterprise');

-- 2. Give ex-free rows a 14-day trial so they're not immediately locked out
UPDATE public.teams
SET trial_ends_at = now() + INTERVAL '14 days'
WHERE plan = 'solo'
  AND (trial_ends_at IS NULL OR trial_ends_at < now())
  AND stripe_subscription_id IS NULL;

-- 3. Update column default
ALTER TABLE public.teams
  ALTER COLUMN plan SET DEFAULT 'solo';

-- 4. Update plan_monthly_hkd() to new prices (HKD)
CREATE OR REPLACE FUNCTION public.plan_monthly_hkd(_plan text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_plan, 'solo'))
    WHEN 'solo'   THEN 128
    WHEN 'pro'    THEN 298
    WHEN 'studio' THEN 688
    ELSE 0
  END::numeric
$function$;

-- 5. Update admin_set_team_plan() to validate new plan names
CREATE OR REPLACE FUNCTION public.admin_set_team_plan(_team_id uuid, _plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _plan NOT IN ('solo', 'pro', 'studio') THEN
    RAISE EXCEPTION 'Invalid plan: must be solo, pro, or studio';
  END IF;
  UPDATE public.teams SET plan = _plan WHERE id = _team_id;
END $function$;

-- 6. Update admin_billing_summary() to exclude 'solo' (lowest tier) from MRR
-- since solo is a paid tier now (no free), all paying teams count
CREATE OR REPLACE FUNCTION public.admin_billing_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_mrr numeric := 0;
  active_accounts int := 0;
  churned_accounts int := 0;
  churned_mrr numeric := 0;
  mrr_start numeric := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT
    COALESCE(SUM(public.plan_monthly_hkd(t.plan)), 0),
    COUNT(*)::int
  INTO total_mrr, active_accounts
  FROM public.teams t
  WHERE t.suspended_at IS NULL
    AND COALESCE(t.subscription_status, 'active') IN ('active', 'trialing', 'past_due');

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(public.plan_monthly_hkd(t.plan)), 0)
  INTO churned_accounts, churned_mrr
  FROM public.teams t
  WHERE t.suspended_at IS NOT NULL
    AND t.suspended_at > now() - interval '30 days';

  mrr_start := total_mrr + churned_mrr;

  RETURN jsonb_build_object(
    'total_mrr', total_mrr,
    'active_accounts', active_accounts,
    'churned_accounts_last_30d', churned_accounts,
    'churned_mrr_last_30d', churned_mrr,
    'mrr_start_30d_ago', mrr_start,
    'currency', 'HKD'
  );
END $function$;

-- 7. Update admin_list_teams() to drop the 'free' fallback in subscription_status
CREATE OR REPLACE FUNCTION public.admin_list_teams()
RETURNS TABLE(id uuid, name text, plan text, status text, suspended_at timestamp with time zone, billing_owner_user_id uuid, billing_owner_email text, member_count integer, project_count integer, created_at timestamp with time zone, trial_ends_at timestamp with time zone, region text, industry text, plan_name text, billing_interval text, unit_amount numeric, subscription_status text, current_period_end timestamp with time zone, trial_end timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    t.id, t.name, t.plan, t.status, t.suspended_at,
    t.billing_owner_user_id,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = t.billing_owner_user_id) AS billing_owner_email,
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.team_id = t.id) AS member_count,
    (SELECT count(*)::int FROM public.projects pj WHERE pj.team_id = t.id) AS project_count,
    t.created_at, t.trial_ends_at, t.region, t.industry,
    initcap(t.plan) AS plan_name,
    COALESCE(t.billing_interval, 'monthly') AS billing_interval,
    public.plan_monthly_hkd(t.plan) AS unit_amount,
    COALESCE(t.subscription_status,
             CASE WHEN t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now() THEN 'trialing'
                  ELSE 'active' END) AS subscription_status,
    t.current_period_end,
    t.trial_ends_at AS trial_end
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $function$;

COMMIT;