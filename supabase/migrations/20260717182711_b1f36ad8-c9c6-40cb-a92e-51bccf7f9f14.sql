
-- 1. Accurate seat count regardless of caller RLS
CREATE OR REPLACE FUNCTION public.team_member_count(_team_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.team_members WHERE team_id = _team_id;
$$;

GRANT EXECUTE ON FUNCTION public.team_member_count(uuid) TO authenticated;

-- 2. Server-side seat cap + plan-includes-invites enforcement
CREATE OR REPLACE FUNCTION public.enforce_project_invite_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id     uuid;
  v_plan        text;
  v_max_members int;
  v_includes    boolean;
  v_used        int;
  v_pending     int;
BEGIN
  SELECT team_id INTO v_team_id FROM public.projects WHERE id = NEW.project_id;
  IF v_team_id IS NULL THEN
    RETURN NEW; -- personal project, no team-scoped limit
  END IF;

  SELECT plan INTO v_plan FROM public.teams WHERE id = v_team_id;
  v_plan := lower(COALESCE(v_plan, 'free'));
  -- Legacy normalisation
  IF v_plan = 'team'       THEN v_plan := 'pro';    END IF;
  IF v_plan = 'enterprise' THEN v_plan := 'studio'; END IF;

  v_max_members := CASE v_plan
                     WHEN 'free'   THEN 1
                     WHEN 'solo'   THEN 1
                     WHEN 'pro'    THEN 5
                     WHEN 'studio' THEN -1
                     ELSE 1
                   END;

  v_includes := v_plan IN ('pro','studio');

  IF NOT v_includes THEN
    RAISE EXCEPTION 'seat_limit_reached: plan % does not include invites', v_plan
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_max_members <> -1 THEN
    v_used := public.team_member_count(v_team_id);
    SELECT COUNT(*)::int INTO v_pending
      FROM public.project_invites pi
      JOIN public.projects p ON p.id = pi.project_id
     WHERE p.team_id = v_team_id AND pi.accepted_at IS NULL;

    IF (v_used + v_pending) >= v_max_members THEN
      RAISE EXCEPTION 'seat_limit_reached: team is at its % member cap', v_max_members
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_project_invite_seat_limit ON public.project_invites;
CREATE TRIGGER trg_enforce_project_invite_seat_limit
  BEFORE INSERT ON public.project_invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_invite_seat_limit();
