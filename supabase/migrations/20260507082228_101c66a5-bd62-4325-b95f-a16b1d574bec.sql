CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, suspended_at timestamp with time zone, last_active_at timestamp with time zone, auth_method text, team_count integer, project_count integer, owner_team_count integer, member_team_count integer, role_summary text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.created_at,
    p.suspended_at,
    COALESCE(p.last_active_at, p.created_at) AS last_active_at,
    COALESCE(p.auth_method, 'password') AS auth_method,
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.user_id = p.id) AS team_count,
    (SELECT count(*)::int FROM public.project_members pm WHERE pm.user_id = p.id) AS project_count,
    (SELECT count(*)::int FROM public.team_members tm2 WHERE tm2.user_id = p.id AND tm2.role = 'owner'::team_role) AS owner_team_count,
    (SELECT count(*)::int FROM public.team_members tm3 WHERE tm3.user_id = p.id AND tm3.role <> 'owner'::team_role) AS member_team_count,
    (
      WITH owner_teams AS (
        SELECT t.name FROM public.team_members tm4
        JOIN public.teams t ON t.id = tm4.team_id
        WHERE tm4.user_id = p.id AND tm4.role = 'owner'::team_role
        ORDER BY t.name
      ),
      member_teams AS (
        SELECT t.name FROM public.team_members tm5
        JOIN public.teams t ON t.id = tm5.team_id
        WHERE tm5.user_id = p.id AND tm5.role <> 'owner'::team_role
        ORDER BY t.name
      ),
      o AS (SELECT count(*)::int AS c, string_agg(name, ', ') AS names FROM owner_teams),
      m AS (SELECT count(*)::int AS c, string_agg(name, ', ') AS names FROM member_teams)
      SELECT
        'Owner on ' || o.c || CASE WHEN o.c = 1 THEN ' team' ELSE ' teams' END
        || CASE WHEN o.c > 0 THEN ': ' || o.names ELSE '' END
        || '; member on ' || m.c || CASE WHEN m.c = 1 THEN ' team' ELSE ' teams' END
        || CASE WHEN m.c > 0 THEN ': ' || m.names ELSE '' END
      FROM o, m
    ) AS role_summary
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $function$;