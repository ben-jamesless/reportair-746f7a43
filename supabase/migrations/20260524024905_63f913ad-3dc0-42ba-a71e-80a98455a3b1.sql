ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS grandfathered_until timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz;