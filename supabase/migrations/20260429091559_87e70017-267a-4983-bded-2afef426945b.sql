CREATE TABLE public.annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL,
  project_id UUID NOT NULL,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  x NUMERIC,
  y NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_photo ON public.annotations(photo_id);
CREATE INDEX idx_annotations_project ON public.annotations(project_id);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Annotations: members read"
  ON public.annotations FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

CREATE POLICY "Annotations: editors insert"
  ON public.annotations FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role])
    AND auth.uid() = author_id
  );

CREATE POLICY "Annotations: author or editor update"
  ON public.annotations FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role])
  );

CREATE POLICY "Annotations: author or editor delete"
  ON public.annotations FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role])
  );

CREATE TRIGGER annotations_set_updated_at
BEFORE UPDATE ON public.annotations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();