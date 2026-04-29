-- Trigger-only functions: revoke ALL execute (triggers run as table owner regardless)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_team() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_project() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_event_production_albums() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_invites_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_photo_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_photo_deleted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_album_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_area_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_invite_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_project_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Internal helper: only used inside other security-definer functions
REVOKE EXECUTE ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon, authenticated;

-- Auth-required RPCs: remove anon access (they internally check auth.uid() but no need to expose)
REVOKE EXECUTE ON FUNCTION public.delete_project(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_project_invite(uuid) FROM PUBLIC, anon;

-- RLS predicate helpers: only authenticated users need them; never anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_project_role(uuid, uuid, project_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_team_role(uuid, uuid, team_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_team_id(uuid) FROM PUBLIC, anon;

-- Token-based share-link RPCs MUST remain anon-callable (public share pages)
GRANT EXECUTE ON FUNCTION public.resolve_share_link(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_photo_url(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_guest_notes_public(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_note_public(uuid, uuid, text, text, text) TO anon, authenticated;