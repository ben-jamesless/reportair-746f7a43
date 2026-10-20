CREATE TABLE public.plan_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_categories TO authenticated;
GRANT ALL ON public.plan_categories TO service_role;
ALTER TABLE public.plan_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX plan_categories_team_idx ON public.plan_categories(team_id);
CREATE POLICY "team members read categories" ON public.plan_categories FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.team_id = plan_categories.team_id AND public.is_project_reader(auth.uid(), p.id)));
CREATE POLICY "owners insert categories" ON public.plan_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_team_role(auth.uid(), team_id, 'owner'));
CREATE POLICY "owners update categories" ON public.plan_categories FOR UPDATE TO authenticated
  USING (public.has_team_role(auth.uid(), team_id, 'owner')) WITH CHECK (public.has_team_role(auth.uid(), team_id, 'owner'));

CREATE OR REPLACE FUNCTION public.seed_plan_categories(_team_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.plan_categories (team_id, name, sort_order, is_default)
  SELECT _team_id, n, o, true FROM (VALUES
    ('Site plans and CAD',1),('Renders',2),('Schedule and timeline',3),
    ('Safety and permits',4),('Supplier documents',5),('Other',6)) v(n,o)
  WHERE NOT EXISTS (SELECT 1 FROM public.plan_categories c WHERE c.team_id = _team_id);
$$;
REVOKE EXECUTE ON FUNCTION public.seed_plan_categories(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_seed_plan_categories() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_plan_categories(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER seed_plan_categories_on_team AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_plan_categories();

SELECT public.seed_plan_categories(id) FROM public.teams;

CREATE TABLE public.plan_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  category_id uuid REFERENCES public.plan_categories(id) ON DELETE SET NULL,
  area_ids uuid[] NOT NULL DEFAULT '{}',
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'file' CHECK (kind IN ('file','link')),
  url text,
  current_version_id uuid,
  client_visible boolean NOT NULL DEFAULT false,
  crew_visible boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
COMMENT ON COLUMN public.plan_files.crew_visible IS 'Reserved for a later phase; unused.';
GRANT SELECT, INSERT, UPDATE ON public.plan_files TO authenticated;
GRANT ALL ON public.plan_files TO service_role;
ALTER TABLE public.plan_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX plan_files_project_idx ON public.plan_files(project_id);
CREATE INDEX plan_files_category_idx ON public.plan_files(category_id);
CREATE INDEX plan_files_deleted_idx ON public.plan_files(deleted_at);
CREATE POLICY "readers see plan files" ON public.plan_files FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id));
CREATE POLICY "editors add plan files" ON public.plan_files FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[]) AND created_by = auth.uid());
CREATE POLICY "editors update plan files" ON public.plan_files FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[]))
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[]));

CREATE OR REPLACE FUNCTION public.plan_files_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT team_id INTO NEW.team_id FROM public.projects WHERE id = NEW.project_id;
    NEW.client_visible := false;
  ELSE
    NEW.project_id := OLD.project_id; NEW.team_id := OLD.team_id;
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
       AND auth.uid() IS NOT NULL
       AND NOT public.has_project_role(auth.uid(), OLD.project_id, 'owner'::public.project_role) THEN
      RAISE EXCEPTION 'Only an owner can restore deleted plans';
    END IF;
    IF NEW.deleted_at IS NOT NULL THEN NEW.client_visible := false; END IF;
  END IF;
  IF NEW.category_id IS NULL THEN NEW.client_visible := false; END IF;
  IF NEW.kind = 'link' AND (NEW.url IS NULL OR NEW.url !~ '^https://') THEN
    RAISE EXCEPTION 'Links must use https';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER plan_files_guard BEFORE INSERT OR UPDATE ON public.plan_files
  FOR EACH ROW EXECUTE FUNCTION public.plan_files_guard();

CREATE TABLE public.plan_file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_file_id uuid NOT NULL REFERENCES public.plan_files(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  revision_label text,
  change_note text,
  storage_path text NOT NULL,
  preview_storage_path text,
  mime_type text,
  file_ext text,
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.plan_file_versions TO authenticated;
GRANT ALL ON public.plan_file_versions TO service_role;
ALTER TABLE public.plan_file_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX plan_file_versions_file_idx ON public.plan_file_versions(plan_file_id);
CREATE POLICY "readers see versions" ON public.plan_file_versions FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id));
CREATE POLICY "editors add versions" ON public.plan_file_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[])
    AND EXISTS (SELECT 1 FROM public.plan_files f WHERE f.id = plan_file_id AND f.project_id = plan_file_versions.project_id));
CREATE POLICY "editors update versions" ON public.plan_file_versions FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[]))
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner','editor']::public.project_role[]));

ALTER TABLE public.plan_files ADD CONSTRAINT plan_files_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.plan_file_versions(id) ON DELETE SET NULL;

-- Storage: path = <project_id>/<plan_file_id>/<file>
CREATE POLICY "plan readers read objects" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plan-files' AND public.is_project_reader(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "plan editors write objects" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-files' AND public.has_project_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner','editor']::public.project_role[]));

-- Client link: list shared current files
CREATE OR REPLACE FUNCTION public.share_plan_files(_token uuid)
RETURNS TABLE (id uuid, name text, kind text, url text, category text, category_order int, area_ids uuid[], revision_label text, file_ext text, mime_type text, size_bytes bigint, has_preview boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links s WHERE s.token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN RETURN; END IF;
  RETURN QUERY
  SELECT f.id, f.name, f.kind, CASE WHEN f.kind='link' THEN f.url END,
    CASE WHEN c.is_hidden THEN 'Other' ELSE c.name END,
    CASE WHEN c.is_hidden THEN 999 ELSE c.sort_order END,
    f.area_ids, v.revision_label, v.file_ext, v.mime_type, v.size_bytes,
    (v.preview_storage_path IS NOT NULL), GREATEST(f.updated_at, COALESCE(v.uploaded_at, f.updated_at))
  FROM public.plan_files f
  JOIN public.plan_categories c ON c.id = f.category_id
  LEFT JOIN public.plan_file_versions v ON v.id = f.current_version_id
  WHERE f.project_id = link.project_id AND f.client_visible AND f.deleted_at IS NULL
  ORDER BY 13 DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.share_plan_files(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_share_plan_path(_token uuid, _plan_file_id uuid, _preview boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE link RECORD; p text;
BEGIN
  SELECT * INTO link FROM public.share_links s WHERE s.token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN RETURN NULL; END IF;
  SELECT CASE WHEN _preview THEN v.preview_storage_path ELSE v.storage_path END INTO p
  FROM public.plan_files f JOIN public.plan_file_versions v ON v.id = f.current_version_id
  WHERE f.id = _plan_file_id AND f.project_id = link.project_id AND f.client_visible
    AND f.deleted_at IS NULL AND f.category_id IS NOT NULL AND f.kind = 'file';
  RETURN p;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_share_plan_path(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_plan_path(uuid, uuid, boolean) TO service_role;