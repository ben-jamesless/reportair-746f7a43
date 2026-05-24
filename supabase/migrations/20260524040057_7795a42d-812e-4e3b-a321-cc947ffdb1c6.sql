ALTER TABLE public.teams ALTER COLUMN plan SET DEFAULT 'free';

UPDATE public.teams
SET plan = 'free',
    subscription_status = NULL,
    trial_ends_at = NULL
WHERE id = '937209e1-a691-4ffc-89a4-2019b15bcb15';