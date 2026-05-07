
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_owner_user_id uuid;

UPDATE public.teams SET billing_owner_user_id = created_by WHERE billing_owner_user_id IS NULL;

ALTER TABLE public.teams ALTER COLUMN billing_owner_user_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.is_billing_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND billing_owner_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.guard_team_billing_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_owner_user_id IS DISTINCT FROM OLD.billing_owner_user_id THEN
    IF auth.uid() IS NULL OR auth.uid() <> OLD.billing_owner_user_id THEN
      RAISE EXCEPTION 'Only the current billing owner can transfer billing ownership';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_team_billing_owner_change ON public.teams;
CREATE TRIGGER guard_team_billing_owner_change
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.guard_team_billing_owner_change();
