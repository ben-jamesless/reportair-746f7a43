
-- 1. Drop the blanket UNIQUE (actor_id, verb) constraint and replace with a
--    partial index scoped only to once-only verbs.
ALTER TABLE public.growth_events
  DROP CONSTRAINT IF EXISTS growth_events_actor_verb_unique;

CREATE UNIQUE INDEX IF NOT EXISTS growth_events_once_only_actor_verb
  ON public.growth_events (actor_id, verb)
  WHERE verb IN ('external_user_started_own_team');

-- Non-unique lookup index for high-frequency verbs.
CREATE INDEX IF NOT EXISTS growth_events_actor_verb_created
  ON public.growth_events (actor_id, verb, created_at DESC);

-- 2. Ensure the teams-insert trigger uses ON CONFLICT DO NOTHING so a
--    telemetry-side conflict can never abort team creation. Also target the
--    partial index explicitly.
CREATE OR REPLACE FUNCTION public.log_external_user_started_own_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prior_teams uuid[];
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(team_id), ARRAY[]::uuid[])
    INTO v_prior_teams
    FROM public.team_members
   WHERE user_id = NEW.created_by
     AND member_type = 'external'
     AND team_id <> NEW.id;

  IF array_length(v_prior_teams, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.growth_events (actor_id, verb, metadata)
    VALUES (
      NEW.created_by,
      'external_user_started_own_team',
      jsonb_build_object(
        'new_team_id', NEW.id,
        'prior_team_ids', to_jsonb(v_prior_teams)
      )
    )
    ON CONFLICT (actor_id, verb) WHERE verb IN ('external_user_started_own_team')
    DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Telemetry must never abort team creation.
    NULL;
  END;

  RETURN NEW;
END $$;
