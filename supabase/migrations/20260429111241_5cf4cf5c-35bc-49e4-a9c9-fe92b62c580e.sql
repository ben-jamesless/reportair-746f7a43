-- Per-day per-area status: replace global areas.status with area_day_status table

CREATE TABLE public.area_day_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  area_id uuid NOT NULL,
  date date NOT NULL,
  status public.area_status NOT NULL DEFAULT 'no_status',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, area_id, date)
);

CREATE INDEX idx_area_day_status_proj_date ON public.area_day_status(project_id, date);
CREATE INDEX idx_area_day_status_area ON public.area_day_status(area_id);

ALTER TABLE public.area_day_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AreaDayStatus: members read"
  ON public.area_day_status FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "AreaDayStatus: editors insert"
  ON public.area_day_status FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "AreaDayStatus: editors update"
  ON public.area_day_status FOR UPDATE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "AreaDayStatus: owners delete"
  ON public.area_day_status FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER trg_area_day_status_updated_at
  BEFORE UPDATE ON public.area_day_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Drop the global per-area status; status is now per day+area
ALTER TABLE public.areas DROP COLUMN IF EXISTS status;