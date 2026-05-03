
-- Folders feature: per-owner project folders
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_folders_owner ON public.folders(owner_id);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Folders: owner read"
  ON public.folders FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Folders: owner insert"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Folders: owner update"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Folders: owner delete"
  ON public.folders FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Add folder_id to projects (nullable, set null on folder delete)
ALTER TABLE public.projects
  ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_folder ON public.projects(folder_id);
