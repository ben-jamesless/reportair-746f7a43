
-- 1. classify_invitee: single source of truth for domain classification.
CREATE OR REPLACE FUNCTION public.classify_invitee(_team_id uuid, _email text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_dm boolean;
  v_owner_domain text;
  v_invitee_domain text;
  v_blocked boolean;
  v_owner_email text;
BEGIN
  IF _email IS NULL OR _email = '' THEN
    RETURN 'requires_explicit_choice';
  END IF;

  SELECT billing_owner_user_id INTO v_owner
    FROM public.teams WHERE id = _team_id;
  IF v_owner IS NULL THEN
    RETURN 'requires_explicit_choice';
  END IF;

  v_dm := public.team_domain_matching_enabled(_team_id);
  v_invitee_domain := public.email_domain(_email);
  SELECT email INTO v_owner_email FROM auth.users WHERE id = v_owner;
  v_owner_domain := public.email_domain(v_owner_email);

  SELECT EXISTS (SELECT 1 FROM public.free_email_domains WHERE domain = v_invitee_domain)
    INTO v_blocked;

  -- Blocklisted invitee is always external, regardless of shared domain.
  IF v_blocked THEN
    RETURN 'external';
  END IF;

  -- Owner on a free/blocklisted domain OR team override disabled: needs explicit choice.
  IF NOT v_dm THEN
    RETURN 'requires_explicit_choice';
  END IF;

  IF v_owner_domain <> '' AND v_invitee_domain = v_owner_domain THEN
    RETURN 'core';
  END IF;

  RETURN 'external';
END $$;

REVOKE ALL ON FUNCTION public.classify_invitee(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classify_invitee(uuid, text) TO authenticated, service_role;

-- 2. Refactor enforce_team_member_caps to call classify_invitee.
CREATE OR REPLACE FUNCTION public.enforce_team_member_caps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text; v_addon int; v_owner uuid;
  v_invitee_email text;
  v_core int; v_ext int; v_cap int; v_type text;
  v_classification text; v_has_approval boolean;
BEGIN
  SELECT plan, addon_seats, billing_owner_user_id
    INTO v_plan, v_addon, v_owner
    FROM public.teams WHERE id = NEW.team_id;

  -- Owner bootstrap: always core, skip caps.
  IF NEW.role = 'owner'::team_role OR v_owner IS NULL OR NEW.user_id = v_owner THEN
    NEW.member_type := 'core';
    RETURN NEW;
  END IF;

  SELECT email INTO v_invitee_email FROM auth.users WHERE id = NEW.user_id;
  v_classification := public.classify_invitee(NEW.team_id, v_invitee_email);

  IF v_classification = 'requires_explicit_choice' THEN
    IF NEW.member_type IS NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'member_type_required: team has domain matching disabled; specify core or external',
        ERRCODE = 'P0001';
    END IF;
    v_type := NEW.member_type;
  ELSE
    v_type := v_classification;
  END IF;

  SELECT count(*) FILTER (WHERE member_type='core'),
         count(*) FILTER (WHERE member_type='external')
    INTO v_core, v_ext
    FROM public.team_members WHERE team_id = NEW.team_id;

  IF v_type = 'core' THEN
    v_cap := public.plan_core_cap(v_plan, v_addon);
    IF v_core + 1 > v_cap THEN
      RAISE EXCEPTION USING
        MESSAGE = 'seat_cap_core: team is at its core seat cap',
        ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NOT public.plan_allows_externals(v_plan) THEN
      RAISE EXCEPTION USING
        MESSAGE = 'plan_no_externals: plan does not include external collaborators',
        ERRCODE = 'P0001';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.team_external_approvals
      WHERE team_id = NEW.team_id
        AND lower(invitee_email::text) = lower(v_invitee_email)
        AND status = 'approved'
    ) INTO v_has_approval;
    IF NOT v_has_approval THEN
      RAISE EXCEPTION USING
        MESSAGE = 'external_not_approved: no approved external request for this email',
        ERRCODE = 'P0001';
    END IF;
    IF v_ext + 1 > v_core * 5 THEN
      RAISE EXCEPTION USING
        MESSAGE = 'seat_cap_external: team is at its external ratio cap',
        ERRCODE = 'P0001';
    END IF;
  END IF;

  NEW.member_type := v_type;
  RETURN NEW;
END $function$;

-- 3. Approvals: origin_project_id for approve+assign single-step.
ALTER TABLE public.team_external_approvals
  ADD COLUMN IF NOT EXISTS origin_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_project_role text;

-- 4. growth_events: workspace-level telemetry, source of truth for GA-vs-ad-blocker parity.
CREATE TABLE IF NOT EXISTS public.growth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verb text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_events_actor_verb_unique UNIQUE (actor_id, verb)
);

GRANT SELECT ON public.growth_events TO authenticated;
GRANT ALL ON public.growth_events TO service_role;

ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;

-- Actor can read their own row (useful for client-side confirmation / GA emit).
CREATE POLICY "growth_events_self_select" ON public.growth_events
FOR SELECT TO authenticated
USING (auth.uid() = actor_id);

-- Platform admins can read all.
CREATE POLICY "growth_events_admin_select" ON public.growth_events
FOR SELECT TO authenticated
USING (public.is_platform_admin());

-- 5. Trigger: on teams insert, if creator was previously an external member
--    of any other team, record external_user_started_own_team exactly once.
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

  INSERT INTO public.growth_events (actor_id, verb, metadata)
  VALUES (
    NEW.created_by,
    'external_user_started_own_team',
    jsonb_build_object(
      'new_team_id', NEW.id,
      'prior_team_ids', to_jsonb(v_prior_teams)
    )
  )
  ON CONFLICT (actor_id, verb) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_external_user_started_own_team ON public.teams;
CREATE TRIGGER trg_log_external_user_started_own_team
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.log_external_user_started_own_team();
