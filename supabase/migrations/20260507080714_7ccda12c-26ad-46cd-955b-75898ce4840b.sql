
CREATE OR REPLACE FUNCTION public.admin_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'suspended_users', (SELECT count(*) FROM public.profiles p WHERE p.suspended_at IS NOT NULL),
    'active_users', (SELECT count(*) FROM public.profiles p WHERE p.suspended_at IS NULL),
    'new_users_30d', (SELECT count(*) FROM public.profiles p WHERE p.created_at > now() - interval '30 days'),
    'total_projects', (SELECT count(*) FROM public.projects),
    'active_projects', (SELECT count(*) FROM public.projects pj WHERE pj.archived_at IS NULL),
    'archived_projects', (SELECT count(*) FROM public.projects pj WHERE pj.archived_at IS NOT NULL),
    'new_projects_30d', (SELECT count(*) FROM public.projects pj WHERE pj.created_at > now() - interval '30 days'),
    'total_teams', (SELECT count(*) FROM public.teams),
    'total_photos', (SELECT count(*) FROM public.photos),
    'roles', (
      SELECT COALESCE(jsonb_object_agg(role_name, role_count), '{}'::jsonb)
      FROM (
        SELECT ur.role::text AS role_name, count(*)::int AS role_count
        FROM public.user_roles ur
        GROUP BY ur.role
      ) r
    ),
    'project_members_by_role', (
      SELECT COALESCE(jsonb_object_agg(role_name, role_count), '{}'::jsonb)
      FROM (
        SELECT pm.role::text AS role_name, count(*)::int AS role_count
        FROM public.project_members pm
        GROUP BY pm.role
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$;
