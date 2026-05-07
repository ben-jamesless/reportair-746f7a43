-- 1. Mirror columns on teams (will be filled by Stripe sync later)
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_teams_stripe_customer_id ON public.teams(stripe_customer_id);

-- 2. Helper: monthly HKD price for a plan label (placeholder until Stripe price sync is live)
CREATE OR REPLACE FUNCTION public.plan_monthly_hkd(_plan text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_plan, 'free'))
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 80
    WHEN 'team' THEN 240
    WHEN 'enterprise' THEN 800
    ELSE 0
  END::numeric
$$;

-- 3. Extended admin_list_teams
DROP FUNCTION IF EXISTS public.admin_list_teams();
CREATE OR REPLACE FUNCTION public.admin_list_teams()
RETURNS TABLE(
  id uuid, name text, plan text, status text, suspended_at timestamptz,
  billing_owner_user_id uuid, billing_owner_email text,
  member_count integer, project_count integer, created_at timestamptz,
  trial_ends_at timestamptz, region text, industry text,
  plan_name text, billing_interval text, unit_amount numeric,
  subscription_status text, current_period_end timestamptz, trial_end timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
                  WHEN t.plan = 'free' THEN NULL
                  ELSE 'active' END) AS subscription_status,
    t.current_period_end,
    t.trial_ends_at AS trial_end
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $$;

-- 4. Billing summary RPC
CREATE OR REPLACE FUNCTION public.admin_billing_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    AND t.plan <> 'free'
    AND COALESCE(t.subscription_status, 'active') IN ('active', 'trialing', 'past_due');

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(public.plan_monthly_hkd(t.plan)), 0)
  INTO churned_accounts, churned_mrr
  FROM public.teams t
  WHERE t.suspended_at IS NOT NULL
    AND t.suspended_at > now() - interval '30 days'
    AND t.plan <> 'free';

  mrr_start := total_mrr + churned_mrr;

  RETURN jsonb_build_object(
    'total_mrr', total_mrr,
    'active_accounts', active_accounts,
    'churned_accounts_last_30d', churned_accounts,
    'churned_mrr_last_30d', churned_mrr,
    'mrr_start_30d_ago', mrr_start,
    'currency', 'HKD'
  );
END $$;