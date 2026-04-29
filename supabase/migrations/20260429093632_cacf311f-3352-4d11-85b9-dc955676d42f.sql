-- Areas table
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_areas_project ON public.areas(project_id, sort_order);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Areas: members read"
  ON public.areas FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "Areas: editors insert"
  ON public.areas FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "Areas: editors update"
  ON public.areas FOR UPDATE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "Areas: owners delete"
  ON public.areas FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER trg_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- area_id on photos (set null on area delete so photos aren't lost)
ALTER TABLE public.photos
  ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

CREATE INDEX idx_photos_area ON public.photos(area_id);

-- Activity logging for area creation
CREATE OR REPLACE FUNCTION public.log_area_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (NEW.project_id, NEW.created_by, 'area.created', 'area', NEW.id,
          jsonb_build_object('name', NEW.name));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_areas_log_created
  AFTER INSERT ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.log_area_created();