-- Area status enum
CREATE TYPE public.area_status AS ENUM ('no_status', 'on_track', 'requires_discussion', 'concern');

-- Add notes + status to areas
ALTER TABLE public.areas
  ADD COLUMN notes text,
  ADD COLUMN status public.area_status NOT NULL DEFAULT 'no_status';

-- Day notes table (one row per project + date)
CREATE TABLE public.day_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  date date NOT NULL,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, date)
);

ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DayNotes: members read"
  ON public.day_notes FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "DayNotes: editors insert"
  ON public.day_notes FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "DayNotes: editors update"
  ON public.day_notes FOR UPDATE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "DayNotes: owners delete"
  ON public.day_notes FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER day_notes_set_updated_at
  BEFORE UPDATE ON public.day_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();