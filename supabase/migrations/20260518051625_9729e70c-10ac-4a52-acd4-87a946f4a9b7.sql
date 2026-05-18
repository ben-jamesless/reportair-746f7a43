
CREATE OR REPLACE FUNCTION public.can_write_export_asset(_user uuid, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text := split_part(_name, '/', 1);
  second text := split_part(_name, '/', 2);
  pid uuid;
  tid uuid;
BEGIN
  IF prefix = 'covers' THEN
    BEGIN pid := second::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN has_project_role(_user, pid, ARRAY['owner'::project_role, 'editor'::project_role]);
  ELSIF prefix = 'logos' THEN
    BEGIN tid := second::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN has_team_role(_user, tid, 'owner'::team_role) OR has_team_role(_user, tid, 'admin'::team_role);
  ELSE
    BEGIN pid := prefix::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN has_project_role(_user, pid, ARRAY['owner'::project_role, 'editor'::project_role]);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_read_export_asset(_user uuid, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text := split_part(_name, '/', 1);
  second text := split_part(_name, '/', 2);
  pid uuid;
  tid uuid;
BEGIN
  IF prefix = 'covers' THEN
    BEGIN pid := second::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN is_project_member(_user, pid) OR is_team_member(_user, project_team_id(pid));
  ELSIF prefix = 'logos' THEN
    BEGIN tid := second::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN is_team_member(_user, tid);
  ELSE
    BEGIN pid := prefix::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    RETURN is_project_member(_user, pid);
  END IF;
END $$;

DROP POLICY IF EXISTS "Export-assets: members read" ON storage.objects;
DROP POLICY IF EXISTS "Export-assets: editors upload" ON storage.objects;
DROP POLICY IF EXISTS "Export-assets: editors update" ON storage.objects;
DROP POLICY IF EXISTS "Export-assets: editors delete" ON storage.objects;

CREATE POLICY "Export-assets: members read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'export-assets' AND public.can_read_export_asset(auth.uid(), name));

CREATE POLICY "Export-assets: editors upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'export-assets' AND public.can_write_export_asset(auth.uid(), name));

CREATE POLICY "Export-assets: editors update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'export-assets' AND public.can_write_export_asset(auth.uid(), name))
WITH CHECK (bucket_id = 'export-assets' AND public.can_write_export_asset(auth.uid(), name));

CREATE POLICY "Export-assets: editors delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'export-assets' AND public.can_write_export_asset(auth.uid(), name));
