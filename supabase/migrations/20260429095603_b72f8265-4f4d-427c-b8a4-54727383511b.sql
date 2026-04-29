
CREATE TYPE export_status AS ENUM ('queued', 'processing', 'ready', 'failed');

CREATE TABLE public.project_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  created_by uuid NOT NULL,
  status export_status NOT NULL DEFAULT 'queued',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_path text,
  accent_color text,
  output_path text,
  photo_count integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_project_exports_project ON public.project_exports (project_id, created_at DESC);

ALTER TABLE public.project_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exports: members read" ON public.project_exports
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "Exports: editors create" ON public.project_exports
  FOR INSERT TO authenticated
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]) AND auth.uid() = created_by);

CREATE POLICY "Exports: owners delete" ON public.project_exports
  FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER trg_exports_updated_at BEFORE UPDATE ON public.project_exports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('export-assets', 'export-assets', false) ON CONFLICT DO NOTHING;

-- Storage policies: members can read PDFs for their project; editors can upload logos
-- Path convention: {project_id}/{export_id}.pdf for exports, {project_id}/{filename} for assets
CREATE POLICY "Exports bucket: members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Export-assets: members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'export-assets'
  AND is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Export-assets: editors upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'export-assets'
  AND has_project_role(auth.uid(), (split_part(name, '/', 1))::uuid, ARRAY['owner'::project_role, 'editor'::project_role])
);

CREATE POLICY "Export-assets: editors delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'export-assets'
  AND has_project_role(auth.uid(), (split_part(name, '/', 1))::uuid, ARRAY['owner'::project_role, 'editor'::project_role])
);
