
-- ============ PROJECT INVITES ============
CREATE TABLE public.project_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  email text NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_invites_email ON public.project_invites (lower(email)) WHERE accepted_at IS NULL;
CREATE INDEX idx_project_invites_project ON public.project_invites (project_id);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites: owners manage" ON public.project_invites
  FOR ALL TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]))
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE POLICY "Invites: members read" ON public.project_invites
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Auto-accept invites when a new user signs up (email match)
CREATE OR REPLACE FUNCTION public.accept_invites_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT * FROM public.project_invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (inv.project_id, NEW.id, inv.role)
    ON CONFLICT DO NOTHING;
    UPDATE public.project_invites
      SET accepted_at = now(), accepted_by = NEW.id
      WHERE id = inv.id;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_accept_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_invites_for_new_user();

-- Manual accept RPC (for users who already exist when invited)
CREATE OR REPLACE FUNCTION public.accept_project_invite(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO inv FROM public.project_invites
    WHERE token = _token AND accepted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Invite is for a different email';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (inv.project_id, auth.uid(), inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.project_invites
    SET accepted_at = now(), accepted_by = auth.uid()
    WHERE id = inv.id;

  RETURN inv.project_id;
END $$;

-- Activity log on invite
CREATE OR REPLACE FUNCTION public.log_invite_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_events (project_id, actor_id, verb, target_type, target_id, metadata)
  VALUES (NEW.project_id, NEW.invited_by, 'invite.created', 'invite', NEW.id,
          jsonb_build_object('email', NEW.email, 'role', NEW.role));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_invite_created AFTER INSERT ON public.project_invites
  FOR EACH ROW EXECUTE FUNCTION public.log_invite_created();

-- ============ SHARE LINKS ============
CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,
  password_hash text,
  expires_at timestamptz,
  created_by uuid,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_links_project ON public.share_links (project_id);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Share: editors manage" ON public.share_links
  FOR ALL TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]))
  WITH CHECK (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "Share: members read" ON public.share_links
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- ============ GUEST NOTES ============
CREATE TABLE public.guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  photo_id uuid NOT NULL,
  guest_name text NOT NULL,
  guest_email text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_notes_photo ON public.guest_notes (photo_id);
CREATE INDEX idx_guest_notes_project ON public.guest_notes (project_id);

ALTER TABLE public.guest_notes ENABLE ROW LEVEL SECURITY;

-- Project members can read guest notes
CREATE POLICY "GuestNotes: members read" ON public.guest_notes
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id) OR is_team_member(auth.uid(), project_team_id(project_id)));

-- Owners/editors can delete (moderation)
CREATE POLICY "GuestNotes: editors delete" ON public.guest_notes
  FOR DELETE TO authenticated
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

-- ============ SHARE LINK PUBLIC RPCs ============

-- Validate share link, optionally checking password. Bumps view stats. Returns project payload.
CREATE OR REPLACE FUNCTION public.resolve_share_link(_token uuid, _password text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  link RECORD;
  proj RECORD;
  payload jsonb;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF link.expires_at IS NOT NULL AND link.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF link.password_hash IS NOT NULL THEN
    IF _password IS NULL OR NOT (link.password_hash = crypt(_password, link.password_hash)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'password_required');
    END IF;
  END IF;

  -- Bump view stats
  UPDATE public.share_links
    SET view_count = view_count + 1, last_accessed_at = now()
    WHERE id = link.id;

  SELECT id, name, description, template INTO proj FROM public.projects WHERE id = link.project_id;

  payload := jsonb_build_object(
    'ok', true,
    'share_link_id', link.id,
    'project', to_jsonb(proj),
    'albums', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.position) FROM public.albums a WHERE a.project_id = link.project_id), '[]'::jsonb),
    'areas', COALESCE((SELECT jsonb_agg(to_jsonb(ar) ORDER BY ar.sort_order) FROM public.areas ar WHERE ar.project_id = link.project_id), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'storage_path', p.storage_path, 'file_name', p.file_name,
        'caption', p.caption, 'captured_at', p.captured_at, 'created_at', p.created_at,
        'album_id', p.album_id, 'area_id', p.area_id,
        'camera_make', p.camera_make, 'camera_model', p.camera_model, 'lens', p.lens,
        'iso', p.iso, 'aperture', p.aperture, 'shutter_speed', p.shutter_speed, 'focal_length', p.focal_length,
        'gps_lat', p.gps_lat, 'gps_lng', p.gps_lng, 'width', p.width, 'height', p.height
      ) ORDER BY p.captured_at DESC NULLS LAST, p.created_at DESC)
      FROM public.photos p WHERE p.project_id = link.project_id
    ), '[]'::jsonb)
  );
  RETURN payload;
END $$;

-- Public read of guest notes for a photo (validates token)
CREATE OR REPLACE FUNCTION public.list_guest_notes_public(_token uuid, _photo_id uuid)
RETURNS TABLE (id uuid, guest_name text, body text, created_at timestamptz)
LANGUAGE plpgsql
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
    SELECT g.id, g.guest_name, g.body, g.created_at
    FROM public.guest_notes g
    WHERE g.share_link_id = link.id AND g.photo_id = _photo_id
    ORDER BY g.created_at DESC;
END $$;

-- Public insert of a guest note
CREATE OR REPLACE FUNCTION public.add_guest_note_public(
  _token uuid, _photo_id uuid, _name text, _email text, _body text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
  new_id uuid;
  photo_project uuid;
BEGIN
  IF coalesce(trim(_name), '') = '' OR coalesce(trim(_body), '') = '' THEN
    RAISE EXCEPTION 'Name and note body are required';
  END IF;
  IF length(_body) > 2000 THEN
    RAISE EXCEPTION 'Note too long';
  END IF;
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;
  SELECT project_id INTO photo_project FROM public.photos WHERE id = _photo_id;
  IF photo_project IS NULL OR photo_project <> link.project_id THEN
    RAISE EXCEPTION 'Photo not in this project';
  END IF;
  INSERT INTO public.guest_notes (share_link_id, project_id, photo_id, guest_name, guest_email, body)
  VALUES (link.id, link.project_id, _photo_id, trim(_name), nullif(trim(_email), ''), trim(_body))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Helper to hash password when creating share link (called from client when password set)
CREATE OR REPLACE FUNCTION public.hash_share_password(_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _password IS NULL OR _password = '' THEN RETURN NULL; END IF;
  RETURN crypt(_password, gen_salt('bf'));
END $$;

-- pgcrypto for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Allow anon to call public RPCs
GRANT EXECUTE ON FUNCTION public.resolve_share_link(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_guest_notes_public(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_note_public(uuid, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_share_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invite(uuid) TO authenticated;

-- Public storage signed URLs won't work for anon; we need a function to mint signed URLs server-side.
-- Simpler: allow anon to read photos via storage by giving a per-token signed URL through an RPC.
CREATE OR REPLACE FUNCTION public.get_share_photo_url(_token uuid, _photo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  link RECORD;
  path text;
  signed jsonb;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN NULL;
  END IF;
  SELECT storage_path INTO path FROM public.photos WHERE id = _photo_id AND project_id = link.project_id;
  RETURN path;
END $$;
GRANT EXECUTE ON FUNCTION public.get_share_photo_url(uuid, uuid) TO anon, authenticated;
