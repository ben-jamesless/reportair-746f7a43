
-- area_map_features: rescope to authenticated
DROP POLICY "Editors can delete map features" ON public.area_map_features;
DROP POLICY "Editors can insert map features" ON public.area_map_features;
DROP POLICY "Editors can update map features" ON public.area_map_features;
DROP POLICY "Members can view map features" ON public.area_map_features;

CREATE POLICY "Editors can delete map features" ON public.area_map_features
  FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));
CREATE POLICY "Editors can insert map features" ON public.area_map_features
  FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));
CREATE POLICY "Editors can update map features" ON public.area_map_features
  FOR UPDATE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));
CREATE POLICY "Members can view map features" ON public.area_map_features
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- photo_day_hidden: drop duplicate public-role policies (authenticated equivalents already exist)
DROP POLICY "Editors can delete photo_day_hidden" ON public.photo_day_hidden;
DROP POLICY "Editors can insert photo_day_hidden" ON public.photo_day_hidden;
DROP POLICY "Members can read photo_day_hidden" ON public.photo_day_hidden;

-- share_links: rescope editors read to authenticated
DROP POLICY "Share: editors read" ON public.share_links;
CREATE POLICY "Share: editors read" ON public.share_links
  FOR SELECT TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));
