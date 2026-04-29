CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id, ARRAY['owner'::project_role]) THEN
    RAISE EXCEPTION 'Only project owners can delete projects';
  END IF;

  DELETE FROM public.guest_notes WHERE project_id = _project_id;
  DELETE FROM public.area_day_status WHERE project_id = _project_id;
  DELETE FROM public.day_notes WHERE project_id = _project_id;
  DELETE FROM public.photos WHERE project_id = _project_id;
  DELETE FROM public.areas WHERE project_id = _project_id;
  DELETE FROM public.albums WHERE project_id = _project_id;
  DELETE FROM public.share_links WHERE project_id = _project_id;
  DELETE FROM public.project_invites WHERE project_id = _project_id;
  DELETE FROM public.project_exports WHERE project_id = _project_id;
  DELETE FROM public.activity_events WHERE project_id = _project_id;
  DELETE FROM public.project_members WHERE project_id = _project_id;
  DELETE FROM public.projects WHERE id = _project_id;
END;
$$;