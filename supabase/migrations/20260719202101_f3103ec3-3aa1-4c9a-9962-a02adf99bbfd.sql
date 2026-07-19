-- Return -1 for unlimited cap; add unclassified surface.
CREATE OR REPLACE FUNCTION public.team_seat_summary(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text; v_addon int; v_core int; v_ext int; v_null int;
  v_cap int; v_ext_cap int; v_dm boolean; v_unclassified jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_team_member(auth.uid(), _team_id)
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT plan, addon_seats INTO v_plan, v_addon FROM public.teams WHERE id = _team_id;
  IF v_plan IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE member_type='core'),
         count(*) FILTER (WHERE member_type='external'),
         count(*) FILTER (WHERE member_type IS NULL)
    INTO v_core, v_ext, v_null
    FROM public.team_members WHERE team_id = _team_id;

  v_cap := public.plan_core_cap(v_plan, v_addon);
  -- Map INT_MAX (studio) to -1 sentinel; UI renders as "Unlimited".
  IF v_cap >= 2147483647 THEN v_cap := -1; END IF;

  IF public.plan_allows_externals(v_plan) THEN
    v_ext_cap := CASE WHEN v_cap = -1 THEN -1 ELSE v_core * 5 END;
  ELSE
    v_ext_cap := 0;
  END IF;

  v_dm := public.team_domain_matching_enabled(_team_id);

  -- Unclassified = users touching the team's projects (via project_members)
  -- who lack a team_members row with a set member_type, PLUS any team_members
  -- row with NULL member_type. Predates the B6 backfill or is a
  -- project-only invite that never provisioned a team seat.
  WITH team_users AS (
    SELECT DISTINCT pm.user_id
      FROM public.project_members pm
      JOIN public.projects p ON p.id = pm.project_id
     WHERE p.team_id = _team_id
    UNION
    SELECT tm.user_id
      FROM public.team_members tm
     WHERE tm.team_id = _team_id AND tm.member_type IS NULL
  ),
  unclassified AS (
    SELECT tu.user_id,
           (SELECT email FROM public.profiles WHERE id = tu.user_id) AS email,
           (SELECT full_name FROM public.profiles WHERE id = tu.user_id) AS full_name,
           CASE
             WHEN EXISTS (SELECT 1 FROM public.team_members tm2
                            WHERE tm2.team_id = _team_id
                              AND tm2.user_id = tu.user_id
                              AND tm2.member_type IS NULL)
               THEN 'team_member_null'
             ELSE 'project_only'
           END AS source
      FROM team_users tu
     WHERE NOT EXISTS (
       SELECT 1 FROM public.team_members tm3
        WHERE tm3.team_id = _team_id
          AND tm3.user_id = tu.user_id
          AND tm3.member_type IN ('core','external')
     )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id', user_id,
           'email',   email,
           'full_name', full_name,
           'source',  source
         )), '[]'::jsonb)
    INTO v_unclassified
    FROM unclassified;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'core_count', v_core,
    'core_cap', v_cap,
    'addon_seats', v_addon,
    'external_count', v_ext,
    'external_cap', v_ext_cap,
    'domain_matching_enabled', v_dm,
    'unclassified_count', jsonb_array_length(v_unclassified),
    'unclassified_members', v_unclassified
  );
END $function$;

-- One-tap classifier for the Members UI. Inserts into team_members, letting
-- the enforce_team_member_caps trigger authoritatively validate seat caps.
CREATE OR REPLACE FUNCTION public.classify_unclassified_member(
  _team_id uuid, _user_id uuid, _member_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role team_role := 'member';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _member_type NOT IN ('core','external') THEN
    RAISE EXCEPTION 'Invalid member_type: %', _member_type;
  END IF;
  -- Only team owners (billing owner or team-role owner) may classify.
  IF NOT public.has_team_role(auth.uid(), _team_id, 'owner'::team_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.teams
        WHERE id = _team_id AND billing_owner_user_id = auth.uid()
     )
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- If a NULL-typed row exists, delete it so the enforcement trigger runs on
  -- INSERT (it validates classification against classify_invitee + caps).
  DELETE FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND member_type IS NULL;

  INSERT INTO public.team_members (team_id, user_id, role, member_type)
  VALUES (_team_id, _user_id, v_role, _member_type)
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET member_type = EXCLUDED.member_type;
END $function$;

GRANT EXECUTE ON FUNCTION public.classify_unclassified_member(uuid, uuid, text) TO authenticated;