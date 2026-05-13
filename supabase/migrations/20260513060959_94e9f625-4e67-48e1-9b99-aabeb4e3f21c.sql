ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS exports_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exports_reset_at  timestamptz NOT NULL DEFAULT date_trunc('month', now());

CREATE OR REPLACE FUNCTION public.get_team_export_count(_team_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count  integer;
  v_reset  timestamptz;
  v_month  timestamptz := date_trunc('month', now());
BEGIN
  SELECT exports_this_month, exports_reset_at
    INTO v_count, v_reset
    FROM public.teams
   WHERE id = _team_id;

  IF v_reset < v_month THEN
    UPDATE public.teams
       SET exports_this_month = 0,
           exports_reset_at   = v_month
     WHERE id = _team_id;
    RETURN 0;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_team_export_count(_team_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_month timestamptz := date_trunc('month', now());
BEGIN
  UPDATE public.teams
     SET exports_this_month = CASE WHEN exports_reset_at < v_month THEN 1
                                   ELSE exports_this_month + 1 END,
         exports_reset_at   = CASE WHEN exports_reset_at < v_month THEN v_month
                                   ELSE exports_reset_at END
   WHERE id = _team_id;
END;
$$;