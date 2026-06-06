-- 1) Revoke column-level SELECT on share_links.password_hash from anon/authenticated.
-- Password verification happens server-side in resolve_share_link (SECURITY DEFINER).
REVOKE SELECT (password_hash) ON public.share_links FROM anon, authenticated;

-- 2) Allow team members (not just direct project members) to read exports from storage,
-- matching the access model used by photos/albums/areas/project_exports rows.
DROP POLICY IF EXISTS "Exports bucket: members read" ON storage.objects;
CREATE POLICY "Exports bucket: members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports'
    AND (
      public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_team_member(
           auth.uid(),
           public.project_team_id((split_part(name, '/', 1))::uuid)
         )
    )
  );