
CREATE OR REPLACE FUNCTION public.owner_leave_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_project_role(auth.uid(), _project_id, ARRAY['owner'::project_role]) THEN
    RAISE EXCEPTION 'Only owners can use this action';
  END IF;

  SELECT count(*) INTO owner_count
  FROM public.project_members
  WHERE project_id = _project_id AND role = 'owner'::project_role;

  IF owner_count <= 1 THEN
    RAISE EXCEPTION 'You are the only owner. Transfer ownership or delete the project instead.';
  END IF;

  DELETE FROM public.project_members
  WHERE project_id = _project_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_leave_project(uuid) TO authenticated;
