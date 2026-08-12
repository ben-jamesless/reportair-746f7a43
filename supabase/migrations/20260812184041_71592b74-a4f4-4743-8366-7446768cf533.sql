ALTER TABLE public.guest_notes ALTER COLUMN photo_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.add_guest_note_project_public(_token uuid, _name text, _email text, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link RECORD;
  new_id uuid;
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
  INSERT INTO public.guest_notes (share_link_id, project_id, photo_id, guest_name, guest_email, body)
  VALUES (link.id, link.project_id, NULL, trim(_name), nullif(trim(_email), ''), trim(_body))
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.add_guest_note_project_public(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.share_ops_contact(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link RECORD;
  contact RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN NULL;
  END IF;

  SELECT pr.full_name, pm.role::text AS role
    INTO contact
    FROM public.project_members pm
    JOIN public.profiles pr ON pr.id = pm.user_id
   WHERE pm.project_id = link.project_id
   ORDER BY CASE pm.role::text WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, pm.created_at
   LIMIT 1;

  IF contact.full_name IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('name', contact.full_name, 'role', contact.role);
END $function$;

GRANT EXECUTE ON FUNCTION public.share_ops_contact(uuid) TO anon, authenticated;