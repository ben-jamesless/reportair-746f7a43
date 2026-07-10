
-- 1. photo_day_hidden
CREATE TABLE IF NOT EXISTS public.photo_day_hidden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, photo_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_photo_day_hidden_project_date
  ON public.photo_day_hidden(project_id, date_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_day_hidden TO authenticated;
GRANT ALL ON public.photo_day_hidden TO service_role;

ALTER TABLE public.photo_day_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read photo_day_hidden"
  ON public.photo_day_hidden FOR SELECT
  USING (public.is_project_member(auth.uid(), project_id)
         OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

CREATE POLICY "Editors can insert photo_day_hidden"
  ON public.photo_day_hidden FOR INSERT
  WITH CHECK (public.has_project_role(auth.uid(), project_id,
              ARRAY['owner'::project_role, 'editor'::project_role]));

CREATE POLICY "Editors can delete photo_day_hidden"
  ON public.photo_day_hidden FOR DELETE
  USING (public.has_project_role(auth.uid(), project_id,
         ARRAY['owner'::project_role, 'editor'::project_role]));

-- 2. day_notes.objectives_seeded_at
ALTER TABLE public.day_notes
  ADD COLUMN IF NOT EXISTS objectives_seeded_at timestamptz;

-- 3. seed_todays_objectives (idempotent per project/date)
CREATE OR REPLACE FUNCTION public.seed_todays_objectives(_project_id uuid, _date_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := _date_key::date;
  _yesterday date := (_date_key::date - 1);
  _existing RECORD;
  _prev_tomorrow text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role, 'editor'::project_role]) THEN
    RETURN false;
  END IF;

  SELECT id, today_objectives, objectives_seeded_at
    INTO _existing
    FROM public.day_notes
    WHERE project_id = _project_id AND date = _today;

  -- Already have content or already tried to seed once → no-op
  IF _existing.id IS NOT NULL AND
     (COALESCE(btrim(_existing.today_objectives), '') <> ''
       OR _existing.objectives_seeded_at IS NOT NULL) THEN
    RETURN false;
  END IF;

  SELECT tomorrow_objectives INTO _prev_tomorrow
    FROM public.day_notes
    WHERE project_id = _project_id AND date = _yesterday;

  IF COALESCE(btrim(_prev_tomorrow), '') = '' THEN
    -- Still mark seeded to avoid re-checking on every open
    IF _existing.id IS NULL THEN
      INSERT INTO public.day_notes(project_id, date, objectives_seeded_at)
        VALUES (_project_id, _today, now());
    ELSE
      UPDATE public.day_notes SET objectives_seeded_at = now() WHERE id = _existing.id;
    END IF;
    RETURN false;
  END IF;

  IF _existing.id IS NULL THEN
    INSERT INTO public.day_notes(project_id, date, today_objectives, objectives_seeded_at)
      VALUES (_project_id, _today, _prev_tomorrow, now());
  ELSE
    UPDATE public.day_notes
      SET today_objectives = _prev_tomorrow,
          objectives_seeded_at = now()
      WHERE id = _existing.id;
  END IF;

  RETURN true;
END $$;

-- 4. copy_prior_day_statuses
CREATE OR REPLACE FUNCTION public.copy_prior_day_statuses(_project_id uuid, _date_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := _date_key::date;
  _source date;
  _n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role, 'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT MAX(date) INTO _source
    FROM public.area_day_status
    WHERE project_id = _project_id AND date < _today AND status <> 'no_status';

  IF _source IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.area_day_status(project_id, area_id, date, status, created_by)
  SELECT src.project_id, src.area_id, _today, src.status, auth.uid()
    FROM public.area_day_status src
    WHERE src.project_id = _project_id AND src.date = _source
      AND src.status <> 'no_status'
      AND NOT EXISTS (
        SELECT 1 FROM public.area_day_status dst
         WHERE dst.project_id = _project_id
           AND dst.area_id = src.area_id
           AND dst.date = _today
           AND dst.status <> 'no_status'
      );

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 5. list_share_hidden_photos
CREATE OR REPLACE FUNCTION public.list_share_hidden_photos(_token uuid)
RETURNS TABLE(photo_id uuid, date_key text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL
     OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT h.photo_id, h.date_key
      FROM public.photo_day_hidden h
     WHERE h.project_id = link.project_id;
END $$;
