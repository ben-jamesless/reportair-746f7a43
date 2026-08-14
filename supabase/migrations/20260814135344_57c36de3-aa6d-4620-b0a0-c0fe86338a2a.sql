-- Definer helper: policies must be able to confirm an area belongs to the
-- project without being filtered by the caller's RLS view of `areas`.
CREATE OR REPLACE FUNCTION public.area_in_project(_area_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.areas a
     WHERE a.id = _area_id AND a.project_id = _project_id
  )
$$;

REVOKE ALL ON FUNCTION public.area_in_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.area_in_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_in_project(uuid, uuid) TO service_role;

-- Crew may only file a note under their own name, and only against an area
-- that belongs to the same project. Their read policy already requires
-- updated_by = auth.uid(), so unattributed rows were write-only before.
DROP POLICY IF EXISTS "AreaDayNotes: crew insert" ON public.area_day_notes;
CREATE POLICY "AreaDayNotes: crew insert"
  ON public.area_day_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_crew(auth.uid(), project_id)
    AND updated_by = auth.uid()
    AND public.area_in_project(area_id, project_id)
  );

DROP POLICY IF EXISTS "AreaDayNotes: editors insert" ON public.area_day_notes;
CREATE POLICY "AreaDayNotes: editors insert"
  ON public.area_day_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role])
    AND public.area_in_project(area_id, project_id)
  );

-- Fail closed by role, not only by auth.uid() being null.
ALTER POLICY "Exports bucket: members read" ON storage.objects TO authenticated;
