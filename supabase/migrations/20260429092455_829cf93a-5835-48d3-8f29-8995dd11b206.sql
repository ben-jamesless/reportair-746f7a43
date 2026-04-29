-- Remove annotations
DROP TABLE IF EXISTS public.annotations CASCADE;

-- Activity events
CREATE TABLE public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  actor_id UUID,
  verb TEXT NOT NULL,           -- e.g. 'project.created', 'album.created', 'photo.uploaded', 'photo.deleted'
  target_type TEXT NOT NULL,    -- 'project' | 'album' | 'photo'
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_project_created ON public.activity_events(project_id, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Members can read their project's activity
CREATE POLICY "Activity: members read"
  ON public.activity_events FOR SELECT TO authenticated
  USING (
    is_project_member(auth.uid(), project_id)
    OR is_team_member(auth.uid(), project_team_id(project_id))
  );

-- No client INSERT/UPDATE/DELETE policies — only triggers (SECURITY DEFINER) write.

-- Trigger functions
CREATE OR REPLACE FUNCTION public.log_project_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (NEW.id, NEW.created_by, 'project.created', 'project', NEW.id,
          jsonb_build_object('name', NEW.name, 'template', NEW.template));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_album_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (NEW.project_id, NEW.created_by, 'album.created', 'album', NEW.id,
          jsonb_build_object('name', NEW.name));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_photo_uploaded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (NEW.project_id, NEW.uploaded_by, 'photo.uploaded', 'photo', NEW.id,
          jsonb_build_object('file_name', NEW.file_name, 'album_id', NEW.album_id));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_photo_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (OLD.project_id, auth.uid(), 'photo.deleted', 'photo', OLD.id,
          jsonb_build_object('file_name', OLD.file_name));
  RETURN OLD;
END $$;

-- Attach triggers
DROP TRIGGER IF EXISTS on_project_created_log ON public.projects;
CREATE TRIGGER on_project_created_log
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_created();

DROP TRIGGER IF EXISTS on_album_created_log ON public.albums;
CREATE TRIGGER on_album_created_log
AFTER INSERT ON public.albums
FOR EACH ROW EXECUTE FUNCTION public.log_album_created();

DROP TRIGGER IF EXISTS on_photo_uploaded_log ON public.photos;
CREATE TRIGGER on_photo_uploaded_log
AFTER INSERT ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.log_photo_uploaded();

DROP TRIGGER IF EXISTS on_photo_deleted_log ON public.photos;
CREATE TRIGGER on_photo_deleted_log
AFTER DELETE ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.log_photo_deleted();