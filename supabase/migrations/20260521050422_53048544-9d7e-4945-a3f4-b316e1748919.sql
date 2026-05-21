ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS areas_project_active_idx ON public.areas (project_id) WHERE deleted_at IS NULL;