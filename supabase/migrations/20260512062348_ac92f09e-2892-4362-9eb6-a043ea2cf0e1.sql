ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS build_start_date date;

ALTER TABLE public.day_notes
  ADD COLUMN IF NOT EXISTS today_objectives text,
  ADD COLUMN IF NOT EXISTS today_achievements text,
  ADD COLUMN IF NOT EXISTS tomorrow_objectives text,
  ADD COLUMN IF NOT EXISTS open_issues text;