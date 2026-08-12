-- 1. Status vocabulary rename
ALTER TYPE public.area_status RENAME VALUE 'no_status' TO 'not_started';
ALTER TYPE public.area_status RENAME VALUE 'on_track' TO 'in_progress';
ALTER TYPE public.area_status RENAME VALUE 'requires_discussion' TO 'flagged';
ALTER TYPE public.area_status RENAME VALUE 'concern' TO 'delayed';

ALTER TYPE public.project_status RENAME VALUE 'no_status' TO 'not_started';
ALTER TYPE public.project_status RENAME VALUE 'on_track' TO 'in_progress';
ALTER TYPE public.project_status RENAME VALUE 'requires_discussion' TO 'flagged';
ALTER TYPE public.project_status RENAME VALUE 'concern' TO 'delayed';

-- Re-assert defaults so they are unambiguous after the rename
ALTER TABLE public.area_day_status ALTER COLUMN status SET DEFAULT 'not_started'::area_status;
ALTER TABLE public.day_notes ALTER COLUMN day_status SET DEFAULT 'not_started'::area_status;
ALTER TABLE public.projects ALTER COLUMN overall_status SET DEFAULT 'not_started'::project_status;

-- Function that compares status literals
CREATE OR REPLACE FUNCTION public.copy_prior_day_statuses(_project_id uuid, _date_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE project_id = _project_id AND date < _today AND status <> 'not_started';

  IF _source IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.area_day_status(project_id, area_id, date, status, updated_by)
  SELECT src.project_id, src.area_id, _today, src.status, auth.uid()
    FROM public.area_day_status src
    WHERE src.project_id = _project_id AND src.date = _source
      AND src.status <> 'not_started'
      AND NOT EXISTS (
        SELECT 1 FROM public.area_day_status dst
         WHERE dst.project_id = _project_id
           AND dst.area_id = src.area_id
           AND dst.date = _today
           AND dst.status <> 'not_started'
      );

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $function$;

-- 2. Build window
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS build_end_date date;

-- 3. Event phases
CREATE TABLE public.event_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('build','on_show','takedown')),
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX event_phases_project_idx ON public.event_phases(project_id, start_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_phases TO authenticated;
GRANT ALL ON public.event_phases TO service_role;

ALTER TABLE public.event_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project readers can view phases"
ON public.event_phases FOR SELECT TO authenticated
USING (public.is_project_reader(auth.uid(), project_id));

CREATE POLICY "Owners and editors can insert phases"
ON public.event_phases FOR INSERT TO authenticated
WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Owners and editors can update phases"
ON public.event_phases FOR UPDATE TO authenticated
USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]))
WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Owners and editors can delete phases"
ON public.event_phases FOR DELETE TO authenticated
USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE TRIGGER event_phases_set_updated_at
BEFORE UPDATE ON public.event_phases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validation: end must not precede start (trigger, not CHECK)
CREATE OR REPLACE FUNCTION public.validate_event_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Phase end date cannot be before its start date';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER event_phases_validate
BEFORE INSERT OR UPDATE ON public.event_phases
FOR EACH ROW EXECUTE FUNCTION public.validate_event_phase();

-- 4. Lifecycle mode: pure function of as_of vs phases
CREATE OR REPLACE FUNCTION public.event_lifecycle_mode(_project_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ph AS (
    SELECT kind, start_date, end_date FROM public.event_phases WHERE project_id = _project_id
  ),
  active AS (
    SELECT kind FROM ph
     WHERE _as_of BETWEEN start_date AND end_date
     ORDER BY CASE kind WHEN 'on_show' THEN 0 WHEN 'takedown' THEN 1 ELSE 2 END
     LIMIT 1
  )
  SELECT COALESCE(
    (SELECT kind FROM active),
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM ph) THEN 'build'
      WHEN _as_of > (SELECT MAX(end_date) FROM ph) THEN 'filed'
      WHEN _as_of < (SELECT MIN(start_date) FROM ph) THEN 'build'
      ELSE 'build'
    END
  );
$$;

GRANT EXECUTE ON FUNCTION public.event_lifecycle_mode(uuid, date) TO anon, authenticated, service_role;