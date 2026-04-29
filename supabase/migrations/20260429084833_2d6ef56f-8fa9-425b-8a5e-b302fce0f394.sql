REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_team_role(UUID, UUID, team_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_project_role(UUID, UUID, project_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_team_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_team() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_project() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;

ALTER FUNCTION public.set_updated_at() SET search_path = public;