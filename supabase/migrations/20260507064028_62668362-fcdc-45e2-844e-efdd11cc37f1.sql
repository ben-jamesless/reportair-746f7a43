CREATE OR REPLACE FUNCTION public.my_accessible_projects()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  template project_template,
  created_at timestamp with time zone,
  color text,
  event_date date,
  event_location text,
  overall_status project_status,
  event_type text,
  client_name text,
  archived_at timestamp with time zone,
  folder_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    p.id,
    p.name,
    p.description,
    p.template,
    p.created_at,
    p.color,
    p.event_date,
    p.event_location,
    p.overall_status,
    p.event_type,
    p.client_name,
    p.archived_at,
    p.folder_id
  FROM public.projects p
  WHERE auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = p.team_id
          AND tm.user_id = auth.uid()
      )
    )
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_accessible_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_accessible_projects() TO authenticated;