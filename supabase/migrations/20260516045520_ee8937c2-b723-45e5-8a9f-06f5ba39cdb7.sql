-- Per-user project folder assignments so each user organises projects independently.
CREATE TABLE IF NOT EXISTS public.user_project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  folder_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_upf_user ON public.user_project_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_upf_folder ON public.user_project_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_upf_project ON public.user_project_folders(project_id);

ALTER TABLE public.user_project_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "UPF: read own"
  ON public.user_project_folders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "UPF: insert own"
  ON public.user_project_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.owner_id = auth.uid())
  );

CREATE POLICY "UPF: update own"
  ON public.user_project_folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.owner_id = auth.uid())
  );

CREATE POLICY "UPF: delete own"
  ON public.user_project_folders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_upf_updated_at
  BEFORE UPDATE ON public.user_project_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill existing per-project folder assignments to the folder's owner.
INSERT INTO public.user_project_folders (user_id, project_id, folder_id)
SELECT f.owner_id, p.id, p.folder_id
FROM public.projects p
JOIN public.folders f ON f.id = p.folder_id
WHERE p.folder_id IS NOT NULL
ON CONFLICT (user_id, project_id) DO NOTHING;

-- Update my_accessible_projects to return the current user's folder_id.
CREATE OR REPLACE FUNCTION public.my_accessible_projects()
 RETURNS TABLE(id uuid, name text, description text, template project_template, created_at timestamp with time zone, color text, event_date date, event_location text, overall_status project_status, event_type text, client_name text, archived_at timestamp with time zone, folder_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    p.id, p.name, p.description, p.template, p.created_at, p.color,
    p.event_date, p.event_location, p.overall_status, p.event_type,
    p.client_name, p.archived_at,
    (SELECT upf.folder_id FROM public.user_project_folders upf
       WHERE upf.user_id = auth.uid() AND upf.project_id = p.id) AS folder_id
  FROM public.projects p
  WHERE auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid())
    )
  ORDER BY p.created_at DESC;
$function$;