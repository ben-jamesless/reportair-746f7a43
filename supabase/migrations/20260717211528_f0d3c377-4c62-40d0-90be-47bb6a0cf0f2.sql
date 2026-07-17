
-- ============================================================================
-- Membership rev. 3
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- 1. teams: rename pro→crew, add addon_seats + domain_matching_override,
--    drop grandfathered_until, add plan CHECK.
-- ---------------------------------------------------------------------------
UPDATE public.teams SET plan = 'crew' WHERE plan IN ('pro','team');
UPDATE public.teams SET plan = 'studio' WHERE plan = 'enterprise';
UPDATE public.teams SET plan = 'free' WHERE plan IS NULL OR plan NOT IN ('free','solo','crew','studio');

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS addon_seats integer NOT NULL DEFAULT 0
    CHECK (addon_seats BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS domain_matching_override boolean NOT NULL DEFAULT false;

ALTER TABLE public.teams DROP COLUMN IF EXISTS grandfathered_until;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_plan_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_plan_check CHECK (plan IN ('free','solo','crew','studio'));

-- ---------------------------------------------------------------------------
-- 2. team_members.member_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT 'core'
    CHECK (member_type IN ('core','external'));

-- ---------------------------------------------------------------------------
-- 3. free_email_domains (seed with standard blocklist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.free_email_domains (
  domain text PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.free_email_domains TO authenticated;
GRANT ALL ON public.free_email_domains TO service_role;
ALTER TABLE public.free_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Free email domains readable by authenticated"
  ON public.free_email_domains;
CREATE POLICY "Free email domains readable by authenticated"
  ON public.free_email_domains FOR SELECT TO authenticated USING (true);

INSERT INTO public.free_email_domains(domain) VALUES
  ('gmail.com'),('googlemail.com'),('outlook.com'),('hotmail.com'),
  ('live.com'),('yahoo.com'),('icloud.com'),('me.com'),('qq.com'),
  ('163.com'),('126.com'),('protonmail.com'),('proton.me'),('aol.com'),
  ('gmx.com'),('mail.com'),('yandex.com')
ON CONFLICT (domain) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. team_external_approvals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_external_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invitee_email citext NOT NULL,
  invited_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  use_case_note text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected')),
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_external_approvals_pending_uniq
  ON public.team_external_approvals(team_id, invitee_email)
  WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS team_external_approvals_team_status
  ON public.team_external_approvals(team_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_external_approvals TO authenticated;
GRANT ALL ON public.team_external_approvals TO service_role;
ALTER TABLE public.team_external_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "External approvals visible to team admins"
  ON public.team_external_approvals;
CREATE POLICY "External approvals visible to team admins"
  ON public.team_external_approvals FOR SELECT TO authenticated
  USING (
    public.has_team_role(auth.uid(), team_id, 'owner'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
  );

DROP POLICY IF EXISTS "External approvals inserted by team admins"
  ON public.team_external_approvals;
CREATE POLICY "External approvals inserted by team admins"
  ON public.team_external_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.has_team_role(auth.uid(), team_id, 'owner'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
  );

DROP POLICY IF EXISTS "External approvals updated by team admins"
  ON public.team_external_approvals;
CREATE POLICY "External approvals updated by team admins"
  ON public.team_external_approvals FOR UPDATE TO authenticated
  USING (
    public.has_team_role(auth.uid(), team_id, 'owner'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
  );

DROP POLICY IF EXISTS "External approvals deletable by team admins"
  ON public.team_external_approvals;
CREATE POLICY "External approvals deletable by team admins"
  ON public.team_external_approvals FOR DELETE TO authenticated
  USING (
    public.has_team_role(auth.uid(), team_id, 'owner'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
  );

CREATE TRIGGER trg_team_external_approvals_updated_at
  BEFORE UPDATE ON public.team_external_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. plan_monthly_hkd(plan, interval) — new prices
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.plan_monthly_hkd(text);
CREATE OR REPLACE FUNCTION public.plan_monthly_hkd(_plan text, _interval text DEFAULT 'monthly')
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan,'free'))
    WHEN 'solo'   THEN CASE WHEN _interval = 'annual' THEN 148 ELSE 188 END
    WHEN 'crew'   THEN CASE WHEN _interval = 'annual' THEN 598 ELSE 748 END
    WHEN 'studio' THEN 0
    ELSE 0
  END::numeric
$$;

-- Rebuild admin views that referenced the old signature.
CREATE OR REPLACE FUNCTION public.admin_list_users_with_accounts()
 RETURNS TABLE(user_id uuid, email text, full_name text, user_created_at timestamptz,
   last_active_at timestamptz, auth_method text, user_suspended_at timestamptz,
   team_id uuid, team_name text, team_role text, plan text, subscription_status text,
   mrr_hkd numeric, trial_ends_at timestamptz, team_suspended_at timestamptz,
   owned_project_count integer, team_project_count integer, has_payment_method boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    p.id, p.email, p.full_name, p.created_at,
    COALESCE(p.last_active_at, p.created_at),
    COALESCE(p.auth_method, 'password'),
    p.suspended_at,
    t.id, t.name, tm.role::text, t.plan,
    COALESCE(t.subscription_status,
      CASE WHEN t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now()
           THEN 'trialing' ELSE 'active' END),
    CASE WHEN t.id IS NOT NULL
         THEN public.plan_monthly_hkd(t.plan, COALESCE(t.billing_interval,'monthly'))
         ELSE 0 END,
    t.trial_ends_at, t.suspended_at,
    (SELECT count(*)::int FROM public.projects proj
      WHERE proj.archived_at IS NULL AND t.id IS NOT NULL AND proj.team_id = t.id AND tm.role = 'owner'::team_role),
    (SELECT count(*)::int FROM public.projects proj2
      WHERE proj2.archived_at IS NULL AND proj2.team_id = t.id),
    (t.stripe_subscription_id IS NOT NULL)
  FROM public.profiles p
  LEFT JOIN public.team_members tm ON tm.user_id = p.id
  LEFT JOIN public.teams t ON t.id = tm.team_id
  ORDER BY p.created_at DESC;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_list_teams()
 RETURNS TABLE(id uuid, name text, plan text, status text, suspended_at timestamptz,
   billing_owner_user_id uuid, billing_owner_email text, member_count integer,
   project_count integer, created_at timestamptz, trial_ends_at timestamptz,
   region text, industry text, plan_name text, billing_interval text,
   unit_amount numeric, subscription_status text, current_period_end timestamptz,
   trial_end timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    t.id, t.name, t.plan, t.status, t.suspended_at,
    t.billing_owner_user_id,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = t.billing_owner_user_id),
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.team_id = t.id),
    (SELECT count(*)::int FROM public.projects pj WHERE pj.team_id = t.id),
    t.created_at, t.trial_ends_at, t.region, t.industry,
    initcap(t.plan),
    COALESCE(t.billing_interval,'monthly'),
    public.plan_monthly_hkd(t.plan, COALESCE(t.billing_interval,'monthly')),
    COALESCE(t.subscription_status,
      CASE WHEN t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now() THEN 'trialing'
           ELSE 'active' END),
    t.current_period_end,
    t.trial_ends_at
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. Drop the old per-project seat trigger — enforcement moves to team_members.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_project_invite_seat_limit ON public.project_invites;
DROP FUNCTION IF EXISTS public.enforce_project_invite_seat_limit();

-- ---------------------------------------------------------------------------
-- 7. Domain / cap helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_domain(_email text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(split_part(coalesce(_email,''), '@', 2)) $$;

CREATE OR REPLACE FUNCTION public.plan_core_cap(_plan text, _addon integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_plan,'free'))
    WHEN 'free'   THEN 1
    WHEN 'solo'   THEN 1
    WHEN 'crew'   THEN 5 + COALESCE(_addon,0)
    WHEN 'studio' THEN 2147483647
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.plan_allows_externals(_plan text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(coalesce(_plan,'free')) IN ('crew','studio')
$$;

CREATE OR REPLACE FUNCTION public.team_domain_matching_enabled(_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_override boolean; v_owner uuid; v_email text; v_domain text; v_blocked boolean;
BEGIN
  SELECT domain_matching_override, billing_owner_user_id
    INTO v_override, v_owner
    FROM public.teams WHERE id = _team_id;
  IF v_override THEN RETURN true; END IF;
  IF v_owner IS NULL THEN RETURN true; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_owner;
  v_domain := public.email_domain(v_email);
  IF v_domain = '' OR v_domain IS NULL THEN RETURN true; END IF;
  SELECT EXISTS (SELECT 1 FROM public.free_email_domains WHERE domain = v_domain)
    INTO v_blocked;
  RETURN NOT v_blocked;
END $$;

-- ---------------------------------------------------------------------------
-- 8. B6 backfill: classify existing team_members
-- ---------------------------------------------------------------------------
UPDATE public.team_members tm
SET member_type = CASE
  WHEN tm.role = 'owner'::team_role THEN 'core'
  WHEN NOT public.team_domain_matching_enabled(tm.team_id) THEN 'core'
  WHEN public.email_domain((SELECT email FROM auth.users WHERE id = tm.user_id))
     = public.email_domain((SELECT email FROM auth.users
                             WHERE id = (SELECT billing_owner_user_id
                                           FROM public.teams WHERE id = tm.team_id)))
  THEN 'core'
  ELSE 'external'
END;

-- Convert un-accepted outside-domain project_invites into pending external approvals.
INSERT INTO public.team_external_approvals
  (team_id, invitee_email, invited_by_user_id, use_case_note, status, created_at)
SELECT DISTINCT proj.team_id, pi.email, pi.invited_by,
       'Backfilled from pending project invite', 'pending_approval', pi.created_at
FROM public.project_invites pi
JOIN public.projects proj ON proj.id = pi.project_id
WHERE pi.accepted_at IS NULL
  AND public.team_domain_matching_enabled(proj.team_id)
  AND public.email_domain(pi.email) IS DISTINCT FROM
      public.email_domain((SELECT email FROM auth.users
                             WHERE id = (SELECT billing_owner_user_id
                                           FROM public.teams WHERE id = proj.team_id)))
ON CONFLICT DO NOTHING;

-- Over-cap report
DO $bf$
DECLARE r RECORD; v_core int; v_ext int; v_cap int;
BEGIN
  FOR r IN SELECT id, plan, addon_seats FROM public.teams LOOP
    SELECT count(*) FILTER (WHERE member_type='core'),
           count(*) FILTER (WHERE member_type='external')
      INTO v_core, v_ext
      FROM public.team_members WHERE team_id = r.id;
    v_cap := public.plan_core_cap(r.plan, r.addon_seats);
    IF v_core > v_cap OR (v_ext > v_core * 5 AND public.plan_allows_externals(r.plan)) THEN
      INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
      SELECT p.id, NULL, 'backfill.over_cap', 'team', r.id,
             jsonb_build_object('plan', r.plan, 'core_count', v_core, 'core_cap', v_cap,
                                'external_count', v_ext)
      FROM public.projects p WHERE p.team_id = r.id LIMIT 1;
    END IF;
  END LOOP;
END $bf$;

-- ---------------------------------------------------------------------------
-- 9. team_seat_summary RPC — the single counter surface
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_seat_summary(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan text; v_addon int; v_core int; v_ext int; v_cap int; v_dm boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_team_member(auth.uid(), _team_id)
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT plan, addon_seats INTO v_plan, v_addon FROM public.teams WHERE id = _team_id;
  IF v_plan IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) FILTER (WHERE member_type='core'),
         count(*) FILTER (WHERE member_type='external')
    INTO v_core, v_ext
    FROM public.team_members WHERE team_id = _team_id;
  v_cap := public.plan_core_cap(v_plan, v_addon);
  v_dm := public.team_domain_matching_enabled(_team_id);
  RETURN jsonb_build_object(
    'plan', v_plan,
    'core_count', v_core,
    'core_cap', v_cap,
    'addon_seats', v_addon,
    'external_count', v_ext,
    'external_cap', CASE WHEN public.plan_allows_externals(v_plan)
                         THEN v_core * 5 ELSE 0 END,
    'domain_matching_enabled', v_dm
  );
END $$;

GRANT EXECUTE ON FUNCTION public.team_seat_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Enforcement trigger on team_members
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_team_member_caps()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan text; v_addon int; v_owner uuid; v_dm boolean;
  v_owner_domain text; v_invitee_email text; v_invitee_domain text;
  v_blocked boolean; v_core int; v_ext int; v_cap int; v_type text;
  v_has_approval boolean;
BEGIN
  SELECT plan, addon_seats, billing_owner_user_id
    INTO v_plan, v_addon, v_owner
    FROM public.teams WHERE id = NEW.team_id;

  -- Owner insert (bootstrap): always core, skip caps.
  IF NEW.role = 'owner'::team_role OR v_owner IS NULL OR NEW.user_id = v_owner THEN
    NEW.member_type := 'core';
    RETURN NEW;
  END IF;

  v_dm := public.team_domain_matching_enabled(NEW.team_id);
  SELECT email INTO v_invitee_email FROM auth.users WHERE id = NEW.user_id;
  v_invitee_domain := public.email_domain(v_invitee_email);
  SELECT email INTO v_owner_domain FROM auth.users WHERE id = v_owner;
  v_owner_domain := public.email_domain(v_owner_domain);
  SELECT EXISTS (SELECT 1 FROM public.free_email_domains WHERE domain = v_invitee_domain)
    INTO v_blocked;

  -- Determine member_type
  IF v_dm AND NOT v_blocked AND v_invitee_domain = v_owner_domain AND v_invitee_domain <> '' THEN
    v_type := 'core';
  ELSIF NOT v_dm THEN
    -- Owner on blocklist: admin must supply explicit member_type via NEW.member_type
    IF NEW.member_type IS NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'member_type_required: team has domain matching disabled; specify core or external',
        ERRCODE = 'P0001';
    END IF;
    v_type := NEW.member_type;
  ELSE
    v_type := 'external';
  END IF;

  -- Counter reads
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
END $$;

DROP TRIGGER IF EXISTS trg_enforce_team_member_caps ON public.team_members;
CREATE TRIGGER trg_enforce_team_member_caps
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_member_caps();

-- Immutable member_type
CREATE OR REPLACE FUNCTION public.guard_team_member_type_immutable()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.member_type IS DISTINCT FROM OLD.member_type THEN
    RAISE EXCEPTION USING
      MESSAGE = 'member_type_immutable: remove and re-invite to reclassify',
      ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_team_member_type_immutable ON public.team_members;
CREATE TRIGGER trg_guard_team_member_type_immutable
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_type_immutable();

-- Guard addon_seats reduction below current core usage
CREATE OR REPLACE FUNCTION public.guard_team_addon_seats()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_core int;
BEGIN
  IF NEW.addon_seats < OLD.addon_seats THEN
    SELECT count(*) INTO v_core
      FROM public.team_members
      WHERE team_id = NEW.id AND member_type = 'core';
    IF v_core > public.plan_core_cap(NEW.plan, NEW.addon_seats) THEN
      RAISE EXCEPTION USING
        MESSAGE = 'addon_reduction_below_usage: remove core members before reducing add-on seats',
        ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_team_addon_seats ON public.teams;
CREATE TRIGGER trg_guard_team_addon_seats
  BEFORE UPDATE OF addon_seats ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_addon_seats();

-- Below-ratio activity event after core removal
CREATE OR REPLACE FUNCTION public.log_team_below_ratio_on_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_core int; v_ext int; v_plan text;
BEGIN
  IF OLD.member_type <> 'core' THEN RETURN OLD; END IF;
  SELECT plan INTO v_plan FROM public.teams WHERE id = OLD.team_id;
  IF NOT public.plan_allows_externals(v_plan) THEN RETURN OLD; END IF;
  SELECT count(*) FILTER (WHERE member_type='core'),
         count(*) FILTER (WHERE member_type='external')
    INTO v_core, v_ext
    FROM public.team_members WHERE team_id = OLD.team_id;
  IF v_ext > v_core * 5 THEN
    INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
    SELECT p.id, auth.uid(), 'team_below_external_ratio', 'team', OLD.team_id,
           jsonb_build_object('core_count', v_core, 'external_count', v_ext)
    FROM public.projects p WHERE p.team_id = OLD.team_id LIMIT 1;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_log_team_below_ratio ON public.team_members;
CREATE TRIGGER trg_log_team_below_ratio
  AFTER DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.log_team_below_ratio_on_delete();

COMMIT;
