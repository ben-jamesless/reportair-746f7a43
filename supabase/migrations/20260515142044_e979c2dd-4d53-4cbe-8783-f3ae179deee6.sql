CREATE OR REPLACE FUNCTION public.my_owned_projects_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.projects p
  WHERE auth.uid() IS NOT NULL
    AND p.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.my_owned_projects_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_owned_projects_count() TO authenticated;