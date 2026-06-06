DROP POLICY IF EXISTS "Photos storage: members read" ON storage.objects;
CREATE POLICY "Photos storage: members read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    public.is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_team_member(auth.uid(), public.project_team_id(((storage.foldername(name))[1])::uuid))
  )
);