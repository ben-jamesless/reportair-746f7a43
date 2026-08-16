-- Mirrors the "Photos: readers read" table policy for direct storage access.
-- Crew are deliberately limited to their own uploads; without this the same
-- object was downloadable straight from the bucket.
CREATE OR REPLACE FUNCTION public.can_read_photo_object(_user uuid, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  IF _user IS NULL OR _name IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    pid := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF public.is_project_reader(_user, pid)
     OR public.is_team_member(_user, public.project_team_id(pid)) THEN
    RETURN true;
  END IF;

  -- Crew: only the files backing their own photo rows.
  IF public.is_project_crew(_user, pid) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.photos p
       WHERE p.project_id = pid
         AND p.storage_path = _name
         AND p.uploaded_by = _user
    );
  END IF;

  RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.can_read_photo_object(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_photo_object(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Photos storage: members read" ON storage.objects;
CREATE POLICY "Photos storage: members read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'photos' AND public.can_read_photo_object(auth.uid(), name));

-- Exports output: match "Exports: members read" (is_project_reader excludes crew).
DROP POLICY IF EXISTS "Exports bucket: members read" ON storage.objects;
CREATE POLICY "Exports bucket: members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND (
    public.is_project_reader(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.is_team_member(auth.uid(), public.project_team_id((split_part(name, '/', 1))::uuid))
  )
);

-- Export output assets keyed by project id follow the same rule. Cover images
-- and team logos stay member-visible: they are project branding shown in the
-- app, not export output.
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
    RETURN is_project_reader(_user, pid) OR is_team_member(_user, project_team_id(pid));
  END IF;
END $$;