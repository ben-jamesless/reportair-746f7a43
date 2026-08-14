ALTER TABLE public.guest_notes
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.guest_notes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS day date,
  ADD COLUMN IF NOT EXISTS author_email text,
  ADD COLUMN IF NOT EXISTS is_ops boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by_owner_at timestamptz;

UPDATE public.guest_notes
   SET author_email = coalesce(nullif(trim(guest_email), ''), 'legacy-unknown@buildfolder.invalid')
 WHERE author_email IS NULL;

ALTER TABLE public.guest_notes ALTER COLUMN author_email SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_notes_parent ON public.guest_notes (parent_id);
CREATE INDEX IF NOT EXISTS idx_guest_notes_project_created ON public.guest_notes (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_notes_area ON public.guest_notes (area_id);

CREATE OR REPLACE FUNCTION public.guest_notes_enforce_single_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  grandparent uuid;
  found_parent boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A comment cannot reply to itself';
  END IF;
  SELECT true, parent_id INTO found_parent, grandparent
    FROM public.guest_notes WHERE id = NEW.parent_id;
  IF found_parent IS NOT TRUE THEN
    RAISE EXCEPTION 'Parent comment not found';
  END IF;
  IF grandparent IS NOT NULL THEN
    RAISE EXCEPTION 'Replies cannot be nested more than one level deep';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guest_notes_single_level ON public.guest_notes;
CREATE TRIGGER trg_guest_notes_single_level
  BEFORE INSERT OR UPDATE OF parent_id ON public.guest_notes
  FOR EACH ROW EXECUTE FUNCTION public.guest_notes_enforce_single_level();

CREATE TABLE IF NOT EXISTS public.share_comment_throttle (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  share_link_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.share_comment_throttle TO service_role;

ALTER TABLE public.share_comment_throttle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Throttle: service only" ON public.share_comment_throttle;
CREATE POLICY "Throttle: service only" ON public.share_comment_throttle
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_share_comment_throttle_ip
  ON public.share_comment_throttle (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.list_report_comments_public(_token uuid)
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  area_id uuid,
  area_name text,
  photo_id uuid,
  day date,
  guest_name text,
  body text,
  is_ops boolean,
  resolved_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT g.id, g.parent_id, g.area_id, ar.name AS area_name, g.photo_id, g.day,
           g.guest_name, g.body, g.is_ops, g.resolved_at, g.created_at
      FROM public.guest_notes g
      LEFT JOIN public.areas ar ON ar.id = g.area_id
      LEFT JOIN public.guest_notes root ON root.id = g.parent_id
     WHERE g.project_id = link.project_id
       AND g.hidden_by_owner_at IS NULL
       AND (g.parent_id IS NULL OR root.hidden_by_owner_at IS NULL)
     ORDER BY g.created_at DESC
     LIMIT 500;
END $$;

GRANT EXECUTE ON FUNCTION public.list_report_comments_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.share_viewer_is_ops(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN false;
  END IF;
  RETURN public.has_project_role(
    auth.uid(), link.project_id, ARRAY['owner'::project_role, 'editor'::project_role]
  );
END $$;

GRANT EXECUTE ON FUNCTION public.share_viewer_is_ops(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_report_comment_ops(
  _token uuid,
  _parent_id uuid,
  _body text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
  parent RECORD;
  me RECORD;
  new_id uuid;
BEGIN
  IF coalesce(trim(_body), '') = '' THEN
    RAISE EXCEPTION 'Reply cannot be empty';
  END IF;
  IF length(_body) > 1000 THEN
    RAISE EXCEPTION 'Reply must be 1000 characters or fewer';
  END IF;

  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;

  IF NOT public.has_project_role(
       auth.uid(), link.project_id, ARRAY['owner'::project_role, 'editor'::project_role]
     ) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  IF (SELECT finalised_at FROM public.projects WHERE id = link.project_id) IS NOT NULL THEN
    RAISE EXCEPTION 'This event is filed - feedback is read-only';
  END IF;

  SELECT * INTO parent FROM public.guest_notes WHERE id = _parent_id AND project_id = link.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;
  IF parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Replies cannot be nested more than one level deep';
  END IF;

  SELECT full_name, email INTO me FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.guest_notes (
    share_link_id, project_id, parent_id, photo_id, area_id, day,
    guest_name, guest_email, author_email, body, is_ops
  ) VALUES (
    link.id, link.project_id, parent.id, parent.photo_id, parent.area_id, parent.day,
    coalesce(nullif(trim(me.full_name), ''), 'Site team'), me.email,
    coalesce(me.email, 'ops@buildfolder.invalid'), trim(_body), true
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.add_report_comment_ops(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_report_comment_resolved(_id uuid, _resolved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note RECORD;
BEGIN
  SELECT * INTO note FROM public.guest_notes WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment not found'; END IF;
  IF note.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Only root threads can be resolved'; END IF;
  IF NOT public.has_project_role(
       auth.uid(), note.project_id, ARRAY['owner'::project_role, 'editor'::project_role]
     ) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  UPDATE public.guest_notes
     SET resolved_at = CASE WHEN _resolved THEN now() ELSE NULL END
   WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION public.set_report_comment_resolved(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_report_comment_hidden(_id uuid, _hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note RECORD;
BEGIN
  SELECT * INTO note FROM public.guest_notes WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment not found'; END IF;
  IF NOT public.has_project_role(auth.uid(), note.project_id, ARRAY['owner'::project_role]) THEN
    RAISE EXCEPTION 'Only the event owner can moderate feedback';
  END IF;

  UPDATE public.guest_notes
     SET hidden_by_owner_at = CASE WHEN _hidden THEN now() ELSE NULL END
   WHERE id = _id;
END $$;

GRANT EXECUTE ON FUNCTION public.set_report_comment_hidden(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.add_guest_note_project_public(uuid, text, text, text) FROM anon, authenticated;