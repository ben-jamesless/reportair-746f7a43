DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('no_status','on_track','requires_discussion','concern','behind_schedule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS event_location text,
  ADD COLUMN IF NOT EXISTS overall_status public.project_status NOT NULL DEFAULT 'no_status',
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS client_name text;