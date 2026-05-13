CREATE OR REPLACE FUNCTION public.plan_monthly_hkd(_plan text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, 'free'))
    WHEN 'free'       THEN 0
    WHEN 'pro'        THEN 80
    WHEN 'team'       THEN 240
    WHEN 'enterprise' THEN 800
    ELSE 0
  END::numeric
$$;