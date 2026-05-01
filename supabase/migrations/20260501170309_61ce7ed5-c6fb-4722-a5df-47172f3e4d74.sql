-- Add default_view to projects
DO $$ BEGIN
  CREATE TYPE public.project_default_view AS ENUM ('report', 'gallery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_view public.project_default_view NOT NULL DEFAULT 'report';
