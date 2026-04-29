CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  paths text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id, ARRAY['owner'::project_role]) THEN
    RAISE EXCEPTION 'Only project owners can delete projects';
  END IF;

  -- Collect all photo storage paths for this project
  SELECT array_agg(storage_path) INTO paths FROM public.photos WHERE project_id = _project_id;

  -- Delete photo files from storage
  IF paths IS NOT NULL THEN
    DELETE FROM storage.objects WHERE bucket_id = 'photos' AND name = ANY(paths);
  END IF;

  -- Delete export artifacts from storage
  DELETE FROM storage.objects
  WHERE bucket_id = 'exports'
    AND name IN (SELECT output_path FROM public.project_exports WHERE project_id = _project_id AND output_path IS NOT NULL);
  DELETE FROM storage.objects
  WHERE bucket_id = 'export-assets'
    AND name IN (SELECT logo_path FROM public.project_exports WHERE project_id = _project_id AND logo_path IS NOT NULL);

  -- Delete child rows (no FK cascade exists)
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

  -- Finally the project itself
  DELETE FROM public.projects WHERE id = _project_id;
END;
$$;