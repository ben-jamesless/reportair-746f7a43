ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS map_default_center_lat double precision,
  ADD COLUMN IF NOT EXISTS map_default_center_lng double precision,
  ADD COLUMN IF NOT EXISTS map_default_zoom double precision;