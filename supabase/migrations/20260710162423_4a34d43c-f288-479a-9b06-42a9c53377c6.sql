
-- 1) photo_day_hidden junction table
CREATE TABLE public.photo_day_hidden (
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  hidden_by uuid,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, date_key)
);

CREATE INDEX idx_photo_day_hidden_project_date
  ON public.photo_day_hidden(project_id, date_key);

GRANT SELECT, INSERT, DELETE ON public.photo_day_hidden TO authenticated;
GRANT ALL ON public.photo_day_hidden TO service_role;

ALTER TABLE public.photo_day_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view photo_day_hidden"
  ON public.photo_day_hidden FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project editors can insert photo_day_hidden"
  ON public.photo_day_hidden FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_role(auth.uid(), project_id,
      ARRAY['owner'::project_role, 'editor'::project_role])
  );

CREATE POLICY "Project editors can delete photo_day_hidden"
  ON public.photo_day_hidden FOR DELETE TO authenticated
  USING (
    public.has_project_role(auth.uid(), project_id,
      ARRAY['owner'::project_role, 'editor'::project_role])
  );

-- 2) day_notes: track one-shot objectives seeding
ALTER TABLE public.day_notes
  ADD COLUMN IF NOT EXISTS objectives_seeded_at timestamptz;

-- 3) RPC: seed today's objectives from yesterday's tomorrow_objectives (idempotent)
CREATE OR REPLACE FUNCTION public.seed_todays_objectives(
  _project_id uuid,
  _date_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_date date := _date_key::date;
  v_today RECORD;
  v_prior_tomorrow text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role, 'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_today FROM public.day_notes
    WHERE project_id = _project_id AND date = v_today_date;

  -- Already seeded: no-op
  IF v_today.objectives_seeded_at IS NOT NULL THEN
    RETURN false;
  END IF;

  -- If existing objectives are non-empty, mark as seeded and stop
  IF v_today.today_objectives IS NOT NULL AND btrim(v_today.today_objectives) <> '' THEN
    UPDATE public.day_notes
       SET objectives_seeded_at = now()
     WHERE project_id = _project_id AND date = v_today_date;
    RETURN false;
  END IF;

  -- Find most recent prior day with a non-empty tomorrow_objectives
  SELECT tomorrow_objectives INTO v_prior_tomorrow
    FROM public.day_notes
   WHERE project_id = _project_id
     AND date < v_today_date
     AND tomorrow_objectives IS NOT NULL
     AND btrim(tomorrow_objectives) <> ''
   ORDER BY date DESC
   LIMIT 1;

  IF v_prior_tomorrow IS NULL THEN
    RETURN false;
  END IF;

  IF v_today.id IS NULL THEN
    INSERT INTO public.day_notes
      (project_id, date, today_objectives, objectives_seeded_at, updated_by)
    VALUES
      (_project_id, v_today_date, v_prior_tomorrow, now(), auth.uid());
  ELSE
    UPDATE public.day_notes
       SET today_objectives = v_prior_tomorrow,
           objectives_seeded_at = now(),
           updated_by = auth.uid()
     WHERE project_id = _project_id AND date = v_today_date;
  END IF;

  RETURN true;
END $$;

-- 4) RPC: copy prior day statuses into today for areas with no status set yet
CREATE OR REPLACE FUNCTION public.copy_prior_day_statuses(
  _project_id uuid,
  _date_key text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_date date := _date_key::date;
  v_source_date date;
  v_copied integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role, 'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find most recent prior day with any statuses recorded
  SELECT MAX(date) INTO v_source_date
    FROM public.area_day_status
   WHERE project_id = _project_id
     AND date < v_today_date;

  IF v_source_date IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert statuses only for (area, today) rows that don't exist yet
  WITH inserted AS (
    INSERT INTO public.area_day_status (project_id, area_id, date, status, updated_by)
    SELECT s.project_id, s.area_id, v_today_date, s.status, auth.uid()
      FROM public.area_day_status s
     WHERE s.project_id = _project_id
       AND s.date = v_source_date
       AND NOT EXISTS (
         SELECT 1 FROM public.area_day_status t
          WHERE t.project_id = _project_id
            AND t.area_id = s.area_id
            AND t.date = v_today_date
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_copied FROM inserted;

  RETURN v_copied;
END $$;
