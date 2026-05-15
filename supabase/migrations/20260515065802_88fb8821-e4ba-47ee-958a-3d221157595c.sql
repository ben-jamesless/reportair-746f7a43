CREATE OR REPLACE FUNCTION public.admin_delete_team(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  proj RECORD;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Delete all projects belonging to this team (cascades cleanup)
  FOR proj IN SELECT id FROM public.projects WHERE team_id = _team_id LOOP
    DELETE FROM public.notifications WHERE project_id = proj.id;
    DELETE FROM public.comments WHERE project_id = proj.id;
    DELETE FROM public.guest_notes WHERE project_id = proj.id;
    DELETE FROM public.area_day_status WHERE project_id = proj.id;
    DELETE FROM public.area_day_notes WHERE project_id = proj.id;
    DELETE FROM public.day_notes WHERE project_id = proj.id;
    DELETE FROM public.photos WHERE project_id = proj.id;
    DELETE FROM public.areas WHERE project_id = proj.id;
    DELETE FROM public.albums WHERE project_id = proj.id;
    DELETE FROM public.share_links WHERE project_id = proj.id;
    DELETE FROM public.project_invites WHERE project_id = proj.id;
    DELETE FROM public.project_exports WHERE project_id = proj.id;
    DELETE FROM public.activity_events WHERE project_id = proj.id;
    DELETE FROM public.project_members WHERE project_id = proj.id;
    DELETE FROM public.projects WHERE id = proj.id;
  END LOOP;

  DELETE FROM public.team_members WHERE team_id = _team_id;
  DELETE FROM public.teams WHERE id = _team_id;
END
$function$;