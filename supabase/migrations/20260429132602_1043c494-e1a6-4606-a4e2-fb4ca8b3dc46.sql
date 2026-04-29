-- Per-area, per-day update notes. Replaces the previous single-text "areas.notes"
-- field with rows scoped to (project, area, date), so each day's update is unique.
CREATE TABLE IF NOT EXISTS public.area_day_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, area_id, date)
);

CREATE INDEX IF NOT EXISTS idx_area_day_notes_proj_date ON public.area_day_notes (project_id, date);
CREATE INDEX IF NOT EXISTS idx_area_day_notes_area ON public.area_day_notes (area_id);

ALTER TABLE public.area_day_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AreaDayNotes: members read"
  ON public.area_day_notes FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "AreaDayNotes: editors insert"
  ON public.area_day_notes FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "AreaDayNotes: editors update"
  ON public.area_day_notes FOR UPDATE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "AreaDayNotes: owners delete"
  ON public.area_day_notes FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER area_day_notes_set_updated_at
  BEFORE UPDATE ON public.area_day_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();