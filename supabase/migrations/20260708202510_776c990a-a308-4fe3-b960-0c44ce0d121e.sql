
-- Projects: saved map view
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS map_zoom integer,
  ADD COLUMN IF NOT EXISTS map_type text,
  ADD COLUMN IF NOT EXISTS map_center jsonb;

-- Area map features
CREATE TABLE IF NOT EXISTS public.area_map_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pin','polygon','rectangle')),
  geometry jsonb NOT NULL,
  label text,
  color text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS area_map_features_project_idx ON public.area_map_features(project_id);
CREATE INDEX IF NOT EXISTS area_map_features_area_idx ON public.area_map_features(area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_map_features TO authenticated;
GRANT SELECT ON public.area_map_features TO anon;
GRANT ALL ON public.area_map_features TO service_role;

ALTER TABLE public.area_map_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view map features"
  ON public.area_map_features FOR SELECT
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Editors can insert map features"
  ON public.area_map_features FOR INSERT
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Editors can update map features"
  ON public.area_map_features FOR UPDATE
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Editors can delete map features"
  ON public.area_map_features FOR DELETE
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE TRIGGER area_map_features_updated_at
  BEFORE UPDATE ON public.area_map_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public read via share link
CREATE OR REPLACE FUNCTION public.list_share_map_features(_token uuid)
RETURNS TABLE(id uuid, area_id uuid, kind text, geometry jsonb, label text, color text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT f.id, f.area_id, f.kind, f.geometry, f.label, f.color
      FROM public.area_map_features f
     WHERE f.project_id = link.project_id;
END $$;

GRANT EXECUTE ON FUNCTION public.list_share_map_features(uuid) TO anon, authenticated;
