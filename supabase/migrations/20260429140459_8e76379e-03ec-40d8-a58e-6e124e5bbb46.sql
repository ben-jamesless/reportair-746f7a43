-- =========================================================================
-- COMMENTS (internal team comments on photos with @mentions)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL,
  photo_id    uuid NOT NULL,
  author_id   uuid NOT NULL,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  mentions    uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_photo ON public.comments(photo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_project ON public.comments(project_id, created_at DESC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments: members read"
  ON public.comments FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

CREATE POLICY "Comments: editors insert"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role])
    AND auth.uid() = author_id
  );

CREATE POLICY "Comments: authors update"
  ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Comments: authors or owners delete"
  ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id
      OR public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('mention', 'reply', 'guest_comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  actor_id    uuid,
  actor_name  text,
  project_id  uuid NOT NULL,
  photo_id    uuid,
  comment_id  uuid,
  type        public.notification_type NOT NULL,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications: read own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Notifications: update own (mark read)"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Notifications: delete own"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
-- INSERT is performed by SECURITY DEFINER triggers only — no INSERT policy.

-- =========================================================================
-- TRIGGER: notify on new internal comment (mentions + replies)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_label text;
  mentioned   uuid;
  prev_author uuid;
  notified    uuid[] := ARRAY[NEW.author_id]; -- never notify self
BEGIN
  SELECT COALESCE(p.full_name, 'A teammate') INTO actor_label
    FROM public.profiles p WHERE p.id = NEW.author_id;

  -- @mentions
  IF NEW.mentions IS NOT NULL THEN
    FOREACH mentioned IN ARRAY NEW.mentions LOOP
      IF mentioned IS NULL OR mentioned = ANY(notified) THEN CONTINUE; END IF;
      IF NOT public.is_project_member(mentioned, NEW.project_id) THEN CONTINUE; END IF;
      INSERT INTO public.notifications
        (user_id, actor_id, actor_name, project_id, photo_id, comment_id, type, body)
      VALUES
        (mentioned, NEW.author_id, actor_label, NEW.project_id, NEW.photo_id, NEW.id, 'mention', NEW.body);
      notified := notified || mentioned;
    END LOOP;
  END IF;

  -- Replies: notify previous distinct authors on the same photo
  FOR prev_author IN
    SELECT DISTINCT c.author_id
      FROM public.comments c
     WHERE c.photo_id = NEW.photo_id AND c.id <> NEW.id
  LOOP
    IF prev_author IS NULL OR prev_author = ANY(notified) THEN CONTINUE; END IF;
    INSERT INTO public.notifications
      (user_id, actor_id, actor_name, project_id, photo_id, comment_id, type, body)
    VALUES
      (prev_author, NEW.author_id, actor_label, NEW.project_id, NEW.photo_id, NEW.id, 'reply', NEW.body);
    notified := notified || prev_author;
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- =========================================================================
-- TRIGGER: notify photo uploader on guest_notes insert
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_on_guest_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uploader uuid;
BEGIN
  SELECT uploaded_by INTO uploader FROM public.photos WHERE id = NEW.photo_id;
  IF uploader IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications
    (user_id, actor_id, actor_name, project_id, photo_id, comment_id, type, body)
  VALUES
    (uploader, NULL, NEW.guest_name, NEW.project_id, NEW.photo_id, NEW.id, 'guest_comment', NEW.body);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_guest_note
  AFTER INSERT ON public.guest_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_guest_note();

-- =========================================================================
-- HELPER: mark all unread as read
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  IF _ids IS NULL THEN
    UPDATE public.notifications SET read_at = now()
      WHERE user_id = auth.uid() AND read_at IS NULL;
  ELSE
    UPDATE public.notifications SET read_at = now()
      WHERE user_id = auth.uid() AND read_at IS NULL AND id = ANY(_ids);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Make sure delete_project also cleans these up
CREATE OR REPLACE FUNCTION public.delete_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id, ARRAY['owner'::project_role]) THEN
    RAISE EXCEPTION 'Only project owners can delete projects';
  END IF;

  DELETE FROM public.notifications WHERE project_id = _project_id;
  DELETE FROM public.comments WHERE project_id = _project_id;
  DELETE FROM public.guest_notes WHERE project_id = _project_id;
  DELETE FROM public.area_day_status WHERE project_id = _project_id;
  DELETE FROM public.area_day_notes WHERE project_id = _project_id;
  DELETE FROM public.day_notes WHERE project_id = _project_id;
  DELETE FROM public.photos WHERE project_id = _project_id;
  DELETE FROM public.areas WHERE project_id = _project_id;
  DELETE FROM public.albums WHERE project_id = _project_id;
  DELETE FROM public.share_links WHERE project_id = _project_id;
  DELETE FROM public.project_invites WHERE project_id = _project_id;
  DELETE FROM public.project_exports WHERE project_id = _project_id;
  DELETE FROM public.activity_events WHERE project_id = _project_id;
  DELETE FROM public.project_members WHERE project_id = _project_id;
  DELETE FROM public.projects WHERE id = _project_id;
END $$;
