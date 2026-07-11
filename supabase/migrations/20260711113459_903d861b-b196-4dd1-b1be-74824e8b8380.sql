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
    WHERE project_id = _project_id AND date < _today AND status <> 'no_status';

  IF _source IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.area_day_status(project_id, area_id, date, status, updated_by)
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
END $function$;