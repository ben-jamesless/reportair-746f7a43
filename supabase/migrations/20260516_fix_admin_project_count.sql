-- Bug fix: admin_list_users project_count was counting project_members rows,
-- which includes projects a user was only *invited* into (and may have since left).
-- Now mirrors my_owned_projects_count() — only counts projects the user owns
-- via their team membership, matching the business rule that invited projects
-- don't count toward a user's quota or project tally.

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id             uuid,
  email          text,
  name           text,
  created_at     timestamp with time zone,
  last_sign_in   timestamp with time zone,
  auth_provider  text,
  roles          text,
  project_count  integer,
  status         text
)
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
    p.name,
    p.created_at,
    p.last_sign_in_at,
    p.auth_provider,
    -- Roles: list teams this user owns, then member teams
    (
      SELECT string_agg(role_desc, '; ' ORDER BY role_desc)
      FROM (
        SELECT
          CASE WHEN tm.role = 'owner'
            THEN 'Owner on 1 team: ' || t2.name
            ELSE NULL
          END AS role_desc
        FROM public.team_members tm
        JOIN public.teams t2 ON t2.id = tm.team_id
        WHERE tm.user_id = p.id AND tm.role = 'owner'
        UNION ALL
        SELECT
          'member on ' || count(*)::text || ' team' ||
          CASE WHEN count(*) = 1 THEN '' ELSE 's' END
        FROM public.team_members tm2
        WHERE tm2.user_id = p.id AND tm2.role != 'owner'
        HAVING count(*) >= 0
      ) role_rows
    ) AS roles,
    -- *** FIX: count only projects owned via team membership, not project_members ***
    -- This means invited-only projects (and projects a user has since left) are
    -- excluded, consistent with my_owned_projects_count() and plan limit logic.
    (
      SELECT count(*)::int
      FROM public.projects proj
      WHERE proj.archived_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.team_members tm3
          WHERE tm3.team_id = proj.team_id
            AND tm3.user_id = p.id
        )
    ) AS project_count,
    CASE WHEN p.banned_until IS NOT NULL AND p.banned_until > now()
         THEN 'suspended'
         ELSE 'active'
    END AS status
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END $function$;
