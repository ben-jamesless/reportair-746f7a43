CREATE TABLE IF NOT EXISTS public.share_preview_secret (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.share_preview_secret ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.share_preview_secret TO service_role;

INSERT INTO public.share_preview_secret (id, secret)
VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.share_preview_sign(_link_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(
    extensions.hmac(_link_id::text || ':' || _user_id::text, s.secret, 'sha256'),
    'hex')
  FROM public.share_preview_secret s WHERE s.id = 1
$$;

CREATE OR REPLACE FUNCTION public.share_preview_token(_share_link_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT project_id INTO proj FROM public.share_links WHERE id = _share_link_id;
  IF proj IS NULL OR NOT public.is_project_reader(auth.uid(), proj) THEN
    RETURN NULL;
  END IF;
  RETURN auth.uid()::text || '.' || public.share_preview_sign(_share_link_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.share_preview_is_team(_link_id uuid, _project_id uuid, _preview text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed uuid;
  sig text;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_project_reader(auth.uid(), _project_id) THEN
    RETURN true;
  END IF;

  IF _preview IS NULL OR position('.' IN _preview) = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    claimed := split_part(_preview, '.', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  sig := split_part(_preview, '.', 2);

  IF sig IS NULL OR sig = '' OR sig <> public.share_preview_sign(_link_id, claimed) THEN
    RETURN false;
  END IF;

  RETURN public.is_project_reader(claimed, _project_id);
END;
$$;

REVOKE ALL ON FUNCTION public.share_preview_sign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_preview_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_preview_is_team(uuid, uuid, text) TO anon, authenticated;

DO $rewrite$
DECLARE
  def text;
  newdef text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'share_meta'
     AND pg_get_function_identity_arguments(p.oid) = '_token uuid, _password text';

  IF def IS NULL THEN
    RAISE EXCEPTION 'share_meta(uuid, text) not found - refusing to guess';
  END IF;

  newdef := replace(def,
    'share_meta(_token uuid, _password text DEFAULT NULL::text)',
    'share_meta(_token uuid, _password text DEFAULT NULL::text, _preview text DEFAULT NULL::text)');

  newdef := replace(newdef,
    'is_team_preview := auth.uid() IS NOT NULL' || E'\n' ||
    '                     AND public.is_project_reader(auth.uid(), link.project_id);',
    'is_team_preview := public.share_preview_is_team(link.id, link.project_id, _preview);');

  IF newdef = def THEN
    RAISE EXCEPTION 'share_meta did not match the expected signature/attribution block';
  END IF;

  EXECUTE newdef;
END
$rewrite$;

DROP FUNCTION IF EXISTS public.share_meta(uuid, text);
GRANT EXECUTE ON FUNCTION public.share_meta(uuid, text, text) TO anon, authenticated;