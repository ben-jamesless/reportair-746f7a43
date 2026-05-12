ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logo_path text;

CREATE POLICY "Export-assets: editors update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'export-assets'
  AND has_project_role(auth.uid(), (split_part(name, '/', 1))::uuid, ARRAY['owner'::project_role, 'editor'::project_role])
)
WITH CHECK (
  bucket_id = 'export-assets'
  AND has_project_role(auth.uid(), (split_part(name, '/', 1))::uuid, ARRAY['owner'::project_role, 'editor'::project_role])
);