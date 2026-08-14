-- 1. Manual colours become "plan colours" (ops planning only)
ALTER TABLE public.area_map_features ADD COLUMN IF NOT EXISTS plan_color text;
UPDATE public.area_map_features SET plan_color = color WHERE plan_color IS NULL AND color IS NOT NULL;

-- The share renderer must not be able to read a manual colour at all.
DROP FUNCTION IF EXISTS public.list_share_map_features(uuid);
CREATE FUNCTION public.list_share_map_features(_token uuid)
RETURNS TABLE(id uuid, area_id uuid, kind text, geometry jsonb, label text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT f.id, f.area_id, f.kind, f.geometry, f.label
      FROM public.area_map_features f
     WHERE f.project_id = link.project_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.list_share_map_features(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_zone_with_geometry(_project_id uuid, _name text, _kind text, _geometry jsonb, _color text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_area_id uuid;
  v_sort int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role,'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _kind NOT IN ('polygon','rectangle','pin') THEN
    RAISE EXCEPTION 'Invalid kind: %', _kind;
  END IF;

  SELECT COALESCE(MAX(sort_order),0)+1 INTO v_sort
    FROM public.areas WHERE project_id = _project_id;

  INSERT INTO public.areas
    (project_id, name, sort_order, color, boundary_source, created_by)
  VALUES
    (_project_id,
     COALESCE(NULLIF(trim(_name),''),'Zone '||v_sort),
     v_sort, _color,
     CASE WHEN _kind IN ('polygon','rectangle') THEN 'drawn' ELSE 'none' END,
     auth.uid())
  RETURNING id INTO v_area_id;

  INSERT INTO public.area_map_features
    (project_id, area_id, kind, geometry, plan_color, is_primary, created_by)
  VALUES
    (_project_id, v_area_id, _kind, _geometry, _color, true, auth.uid());

  RETURN v_area_id;
END $function$;

ALTER TABLE public.area_map_features DROP COLUMN IF EXISTS color;

-- 2. Moderation audit trail
CREATE TABLE public.feedback_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  guest_note_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL CHECK (action IN ('hide','restore')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feedback_moderation_events TO authenticated;
GRANT ALL ON public.feedback_moderation_events TO service_role;

ALTER TABLE public.feedback_moderation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderation log: project ops read"
  ON public.feedback_moderation_events FOR SELECT TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE INDEX feedback_moderation_events_note_idx
  ON public.feedback_moderation_events (guest_note_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_report_comment_hidden(_id uuid, _hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.feedback_moderation_events (project_id, guest_note_id, actor_id, action)
  VALUES (note.project_id, _id, auth.uid(), CASE WHEN _hidden THEN 'hide' ELSE 'restore' END);
END $function$;

GRANT EXECUTE ON FUNCTION public.set_report_comment_hidden(uuid, boolean) TO authenticated;