-- Photos table
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  album_id uuid REFERENCES public.albums(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  captured_at timestamptz,
  camera_make text,
  camera_model text,
  lens text,
  iso integer,
  aperture numeric(4,2),
  shutter_speed text,
  focal_length numeric(6,2),
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  caption text,
  position integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_album ON public.photos(album_id, position);
CREATE INDEX idx_photos_project ON public.photos(project_id, captured_at DESC NULLS LAST);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos: members read"
  ON public.photos FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id)
         OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

CREATE POLICY "Photos: editors insert"
  ON public.photos FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role])
              AND auth.uid() = uploaded_by);

CREATE POLICY "Photos: editors update"
  ON public.photos FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Photos: editors delete"
  ON public.photos FOR DELETE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE TRIGGER photos_set_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket (private; access via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: extract project_id from path "<project_id>/<album_id>/<file>"
-- Storage policies: members of the project can read; editors can write.
CREATE POLICY "Photos storage: members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Photos storage: editors insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND public.has_project_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::project_role,'editor'::project_role])
  );

CREATE POLICY "Photos storage: editors update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.has_project_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::project_role,'editor'::project_role])
  );

CREATE POLICY "Photos storage: editors delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.has_project_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['owner'::project_role,'editor'::project_role])
  );