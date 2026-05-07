CREATE OR REPLACE FUNCTION public.admin_list_projects()
 RETURNS TABLE(id uuid, name text, team_id uuid, team_name text, owner_id uuid, owner_email text, created_at timestamp with time zone, archived_at timestamp with time zone, overall_status project_status)
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
    p.name,
    p.team_id,
    (SELECT t.name FROM public.teams t WHERE t.id = p.team_id),
    p.created_by,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = p.created_by),
    p.created_at,
    p.archived_at,
    p.overall_status
  FROM public.projects p
  ORDER BY p.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_teams()
 RETURNS TABLE(id uuid, name text, plan text, status text, suspended_at timestamp with time zone, billing_owner_user_id uuid, billing_owner_email text, member_count integer, project_count integer, created_at timestamp with time zone)
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
    t.id,
    t.name,
    t.plan,
    t.status,
    t.suspended_at,
    t.billing_owner_user_id,
    (SELECT pr.email FROM public.profiles pr WHERE pr.id = t.billing_owner_user_id),
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.team_id = t.id),
    (SELECT count(*)::int FROM public.projects pj WHERE pj.team_id = t.id),
    t.created_at
  FROM public.teams t
  ORDER BY t.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, suspended_at timestamp with time zone, team_count integer, project_count integer)
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
    (SELECT count(*)::int FROM public.team_members tm WHERE tm.user_id = p.id),
    (SELECT count(*)::int FROM public.project_members pm WHERE pm.user_id = p.id)
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $function$;